import type { ProjectStore, UUID, DiagramState } from "./types";
import { buildSectionDiagramKey, persistDiagrams } from "./storageHelpers";
import type { SyncEngineAPI } from "./syncEngine";

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

export function createDiagramSlice(set: StoreSet, get: StoreGet, engine: SyncEngineAPI) {
  return {
    getSectionDiagram: (projectId: string, sectionId: string) => {
      const fromMap = get().diagramsBySection[buildSectionDiagramKey(projectId, sectionId)];
      if (fromMap) return fromMap;
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      return section?.flowchartState;
    },

    saveSectionDiagram: (projectId: string, sectionId: string, state: DiagramState) => {
      const now = new Date().toISOString();
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    s.id === sectionId
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
        projectId
      );
      const next = {
        ...get().diagramsBySection,
        [buildSectionDiagramKey(projectId, sectionId)]: state,
      };
      set({ diagramsBySection: next });
      persistDiagrams(next);
    },

    resetSectionDiagram: (projectId: string, sectionId: string) => {
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
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    s.id === sectionId
                      ? { ...s, flowchartEnabled: true, flowchartState: nextState, updated_at: now }
                      : s
                  ),
                }
              : p
          ),
        projectId
      );
      const next = {
        ...get().diagramsBySection,
        [buildSectionDiagramKey(projectId, sectionId)]: nextState,
      };
      set({ diagramsBySection: next });
      persistDiagrams(next);
    },

    removeSectionDiagram: (projectId: string, sectionId: string) => {
      engine.wrappedSet((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                sections: (p.sections || []).map((s) =>
                  s.id === sectionId ? { ...s, flowchartState: undefined } : s
                ),
              }
            : p
        )
      );
      const next = { ...get().diagramsBySection };
      delete next[buildSectionDiagramKey(projectId, sectionId)];
      set({ diagramsBySection: next });
      persistDiagrams(next);
    },

    setSectionFlowchartEnabled: (projectId: UUID, sectionId: UUID, enabled: boolean) => {
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
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    s.id === sectionId
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
        projectId
      );
      const next = { ...get().diagramsBySection };
      if (enabled) {
        next[buildSectionDiagramKey(projectId, sectionId)] =
          next[buildSectionDiagramKey(projectId, sectionId)] || defaultFlowchartState;
      } else {
        delete next[buildSectionDiagramKey(projectId, sectionId)];
      }
      set({ diagramsBySection: next });
      persistDiagrams(next);
    },

    disableSectionFlowchartAndClearDiagram: (projectId: UUID, sectionId: UUID) => {
      const now = new Date().toISOString();
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    s.id === sectionId ? { ...s, flowchartEnabled: false, flowchartState: undefined, updated_at: now } : s
                  ),
                }
              : p
          ),
        projectId
      );
      get().removeSectionDiagram(projectId, sectionId);
    },
  };
}
