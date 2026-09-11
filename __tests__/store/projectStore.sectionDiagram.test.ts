/**
 * O editor de fluxograma é aberto por uma rota em slug
 * (`/projects/<projeto>/sections/<pagina>/diagramas`), então a store precisa
 * aceitar slug onde antes só entendia UUID. Enquanto não aceitava, o quadro
 * abria em branco — inclusive por cima de um fluxograma escrito pela API.
 */

import { useProjectStore } from "@/store/projectStore";
import type { DiagramState } from "@/store/slices/types";

jest.mock("@/lib/supabase/projectSync", () => ({
  fetchProjectsFromSupabase: jest.fn(async () => []),
  upsertProjectToSupabase: jest.fn(async () => ({ error: null })),
  deleteProjectFromSupabase: jest.fn(async () => ({ error: null })),
  migrateLocalProjectsToSupabase: jest.fn(async () => ({ migrated: 0, errors: 0 })),
}));

let uuidCounter = 0;
global.crypto = {
  randomUUID: jest.fn(() => `uuid-${++uuidCounter}`),
} as any;

function diagram(updatedAt: string, labels: string[]): DiagramState {
  return {
    version: 1,
    updatedAt,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: labels.map((label, i) => ({
      id: label,
      type: "diagramNode",
      position: { x: 0, y: i * 100 },
      data: { label, blockType: "retangulo", width: 120, height: 40 },
    })),
    edges: [],
  } as DiagramState;
}

/** Projeto "Meu Jogo" com a página "Loop Principal" e o fluxograma dado. */
function seed(state: DiagramState | undefined) {
  const store = useProjectStore.getState();
  const projectId = store.addProject("Meu Jogo", "");
  const sectionId = store.addSection(projectId, "Loop Principal", "texto");
  if (state) {
    useProjectStore.setState((prev) => ({
      projects: prev.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sections: p.sections.map((s) =>
                s.id === sectionId ? { ...s, flowchartEnabled: true, flowchartState: state } : s
              ),
            }
          : p
      ),
    }));
  }
  return { projectId, sectionId };
}

describe("getSectionDiagram", () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], diagramsBySection: {} });
    localStorage.clear();
    uuidCounter = 0;
    jest.clearAllMocks();
  });

  it("encontra o fluxograma da página quando a rota vem em slug", () => {
    seed(diagram("2026-09-10T00:00:00.000Z", ["a", "b"]));

    const found = useProjectStore.getState().getSectionDiagram("meu-jogo", "loop-principal");

    expect(found?.nodes.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("ignora o quadro vazio que ficou no cache local", () => {
    const { projectId, sectionId } = seed(diagram("2026-09-10T00:00:00.000Z", ["a", "b"]));
    useProjectStore.setState({
      diagramsBySection: {
        [`${projectId}:${sectionId}`]: diagram("2026-09-11T00:00:00.000Z", []),
      },
    });

    const found = useProjectStore.getState().getSectionDiagram("meu-jogo", "loop-principal");

    expect(found?.nodes).toHaveLength(2);
  });

  it("resgata o diagrama que ficou preso na chave de slug do cache", () => {
    seed(diagram("2026-01-01T00:00:00.000Z", ["antigo"]));
    useProjectStore.setState({
      diagramsBySection: {
        "meu-jogo:loop-principal": diagram("2026-09-01T00:00:00.000Z", ["x", "y", "z"]),
      },
    });

    const found = useProjectStore.getState().getSectionDiagram("meu-jogo", "loop-principal");

    expect(found?.nodes.map((n) => n.id)).toEqual(["x", "y", "z"]);
  });
});

describe("saveSectionDiagram", () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], diagramsBySection: {} });
    localStorage.clear();
    uuidCounter = 0;
    jest.clearAllMocks();
  });

  it("grava na página certa mesmo recebendo slug, e limpa a chave de slug", () => {
    const { projectId, sectionId } = seed(undefined);
    useProjectStore.setState({
      diagramsBySection: { "meu-jogo:loop-principal": diagram("2026-01-01T00:00:00.000Z", ["velho"]) },
    });

    useProjectStore
      .getState()
      .saveSectionDiagram("meu-jogo", "loop-principal", diagram("2026-09-11T00:00:00.000Z", ["novo"]));

    const section = useProjectStore
      .getState()
      .projects.find((p) => p.id === projectId)
      ?.sections.find((s) => s.id === sectionId);

    expect(section?.flowchartState?.nodes.map((n) => n.id)).toEqual(["novo"]);
    expect(section?.flowchartEnabled).toBe(true);
    expect(Object.keys(useProjectStore.getState().diagramsBySection)).toEqual([
      `${projectId}:${sectionId}`,
    ]);
  });

  it("não grava nada quando a página não existe na store", () => {
    useProjectStore
      .getState()
      .saveSectionDiagram("nao-existe", "nem-essa", diagram("2026-09-11T00:00:00.000Z", ["x"]));

    expect(useProjectStore.getState().diagramsBySection).toEqual({});
  });
});
