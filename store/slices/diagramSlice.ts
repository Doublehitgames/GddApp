import type { Project, ProjectStore, UUID, DiagramState } from "./types";
import { buildSectionDiagramKey, persistDiagrams } from "./storageHelpers";
import { findProjectByRef, findSectionByRef, toSlug } from "@/lib/utils/slug";
import type { SyncEngineAPI } from "./syncEngine";

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

/**
 * O editor de fluxograma é aberto por uma rota em slug
 * (`/projects/<projeto>/sections/<pagina>/diagramas`), enquanto o link público
 * abre a mesma tela por UUID. Aceitar as duas formas aqui é o que impede o
 * quadro de abrir em branco por não reconhecer o "id" que recebeu.
 */
type ResolvedSectionRef = { projectId: UUID; sectionId: UUID; legacyKey: string };

function resolveSectionRef(
  projects: Project[],
  projectRef: string,
  sectionRef: string
): ResolvedSectionRef | null {
  const project = findProjectByRef(projects, projectRef);
  const section = findSectionByRef(project?.sections, sectionRef);
  if (!project || !section) return null;
  return {
    projectId: project.id,
    sectionId: section.id,
    // Enquanto a tela não resolvia slug, o diagrama era salvo no cache local
    // sob esta chave — e não chegava ao projeto nem ao Supabase. Continuar
    // olhando para ela é o que traz de volta o que ficou preso ali.
    legacyKey: buildSectionDiagramKey(toSlug(project.title), toSlug(section.title)),
  };
}

/** Diagrama vazio no cache é quase sempre rastro de uma tela que abriu em
 *  branco, não a decisão de alguém de apagar tudo. Não compete com a página. */
function withNodes(state: DiagramState | undefined): DiagramState | undefined {
  return state && Array.isArray(state.nodes) && state.nodes.length > 0 ? state : undefined;
}

/** O mais recente vence; empate fica com o primeiro candidato da lista. */
function pickFreshest(candidates: (DiagramState | undefined)[]): DiagramState | undefined {
  let best: DiagramState | undefined;
  let bestAt = -1;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const at = Date.parse(candidate.updatedAt || "") || 0;
    if (!best || at > bestAt) {
      best = candidate;
      bestAt = at;
    }
  }
  return best;
}

export function createDiagramSlice(set: StoreSet, get: StoreGet, engine: SyncEngineAPI) {
  return {
    getSectionDiagram: (projectId: string, sectionId: string) => {
      const state = get();
      const map = state.diagramsBySection;
      const resolved = resolveSectionRef(state.projects, projectId, sectionId);
      if (!resolved) return map[buildSectionDiagramKey(projectId, sectionId)];

      const section = state.projects
        .find((p) => p.id === resolved.projectId)
        ?.sections?.find((s) => s.id === resolved.sectionId);

      // A página manda: é o que o Supabase guarda e o que uma escrita de fora
      // (a API, o MCP) atualiza. O cache local só entra quando é mais novo —
      // ou quando é o único lugar onde o diagrama sobreviveu.
      return pickFreshest([
        section?.flowchartState,
        withNodes(map[buildSectionDiagramKey(resolved.projectId, resolved.sectionId)]),
        withNodes(map[resolved.legacyKey]),
      ]);
    },

    saveSectionDiagram: (projectId: string, sectionId: string, state: DiagramState) => {
      const resolved = resolveSectionRef(get().projects, projectId, sectionId);
      // Sem página resolvida não há onde gravar: escrever mesmo assim é o que
      // deixava diagramas órfãos no cache, fora do projeto e fora do banco.
      if (!resolved) return;
      const now = new Date().toISOString();
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === resolved.projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    s.id === resolved.sectionId
                      ? {
                          ...s,
                          flowchartEnabled: true,
                          flowchartState: state,
                          updated_at: now,
                        }
                      : s
                  ),
                }
              : p
          ),
        resolved.projectId
      );
      const next = {
        ...get().diagramsBySection,
        [buildSectionDiagramKey(resolved.projectId, resolved.sectionId)]: state,
      };
      delete next[resolved.legacyKey];
      set({ diagramsBySection: next });
      persistDiagrams(next);
    },

    resetSectionDiagram: (projectId: string, sectionId: string) => {
      const resolved = resolveSectionRef(get().projects, projectId, sectionId);
      if (!resolved) return;
      const now = new Date().toISOString();
      const nextState: DiagramState = {
        version: 1,
        updatedAt: now,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === resolved.projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    s.id === resolved.sectionId
                      ? { ...s, flowchartEnabled: true, flowchartState: nextState, updated_at: now }
                      : s
                  ),
                }
              : p
          ),
        resolved.projectId
      );
      const next = {
        ...get().diagramsBySection,
        [buildSectionDiagramKey(resolved.projectId, resolved.sectionId)]: nextState,
      };
      delete next[resolved.legacyKey];
      set({ diagramsBySection: next });
      persistDiagrams(next);
    },

    removeSectionDiagram: (projectId: string, sectionId: string) => {
      const resolved = resolveSectionRef(get().projects, projectId, sectionId);
      const targetProjectId = resolved?.projectId ?? projectId;
      const targetSectionId = resolved?.sectionId ?? sectionId;
      engine.wrappedSet((prev) =>
        prev.map((p) =>
          p.id === targetProjectId
            ? {
                ...p,
                sections: (p.sections || []).map((s) =>
                  s.id === targetSectionId ? { ...s, flowchartState: undefined } : s
                ),
              }
            : p
        )
      );
      const next = { ...get().diagramsBySection };
      delete next[buildSectionDiagramKey(targetProjectId, targetSectionId)];
      if (resolved) delete next[resolved.legacyKey];
      set({ diagramsBySection: next });
      persistDiagrams(next);
    },

    setSectionFlowchartEnabled: (projectId: UUID, sectionId: UUID, enabled: boolean) => {
      const resolved = resolveSectionRef(get().projects, projectId, sectionId);
      const targetProjectId = resolved?.projectId ?? projectId;
      const targetSectionId = resolved?.sectionId ?? sectionId;
      const now = new Date().toISOString();
      const defaultFlowchartState: DiagramState = {
        version: 1,
        updatedAt: now,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === targetProjectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    s.id === targetSectionId
                      ? {
                          ...s,
                          flowchartEnabled: enabled,
                          flowchartState: enabled ? (s.flowchartState || defaultFlowchartState) : undefined,
                          updated_at: now,
                        }
                      : s
                  ),
                }
              : p
          ),
        targetProjectId
      );
      const next = { ...get().diagramsBySection };
      const key = buildSectionDiagramKey(targetProjectId, targetSectionId);
      if (enabled) {
        next[key] = next[key] || defaultFlowchartState;
      } else {
        delete next[key];
        if (resolved) delete next[resolved.legacyKey];
      }
      set({ diagramsBySection: next });
      persistDiagrams(next);
    },

    disableSectionFlowchartAndClearDiagram: (projectId: UUID, sectionId: UUID) => {
      const resolved = resolveSectionRef(get().projects, projectId, sectionId);
      const targetProjectId = resolved?.projectId ?? projectId;
      const targetSectionId = resolved?.sectionId ?? sectionId;
      const now = new Date().toISOString();
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === targetProjectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    s.id === targetSectionId ? { ...s, flowchartEnabled: false, flowchartState: undefined, updated_at: now } : s
                  ),
                }
              : p
          ),
        targetProjectId
      );
      get().removeSectionDiagram(targetProjectId, targetSectionId);
    },
  };
}
