/**
 * O plano dá N projetos e M páginas POR PROJETO. O teto de páginas é avaliado
 * no DONO do projeto, não em quem está editando — então um membro convidado
 * trabalha sob o limite de quem o convidou, e nada do que ele cria consome o
 * espaço dos outros projetos daquele dono.
 */

import { useProjectStore } from "@/store/projectStore";
import { DEFAULT_APP_LIMITS } from "@/store/slices/types";

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

const MEMBER = "member-user-id";
const OWNER = "owner-user-id";

/** Projeto do OWNER, com `count` páginas, compartilhado com MEMBER. */
function sharedProject(count: number, id = "shared-project") {
  return {
    id,
    title: "Granjita",
    description: "",
    ownerId: OWNER,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sections: Array.from({ length: count }, (_, i) => ({
      id: `${id}-sec-${i}`,
      title: `P${i}`,
      content: "",
      created_at: "2026-01-01T00:00:00.000Z",
      order: i,
    })),
  } as any;
}

const withPageLimit = (max: number) => ({
  ...DEFAULT_APP_LIMITS,
  FREE_MAX_SECTIONS_PER_PROJECT: max,
});

describe("limites de página por projeto, medidos no dono", () => {
  beforeEach(() => {
    localStorage.clear();
    uuidCounter = 0;
    jest.clearAllMocks();
  });

  it("aplica o limite estendido do dono, não o do membro que edita", () => {
    useProjectStore.setState({
      projects: [sharedProject(300)],
      diagramsBySection: {},
      userId: MEMBER,
      appLimits: withPageLimit(300),
      limitsByOwner: {
        [MEMBER]: withPageLimit(300),
        [OWNER]: withPageLimit(500),
      },
    });

    expect(() =>
      useProjectStore.getState().addSection("shared-project", "Nova página")
    ).not.toThrow();
  });

  it("bloqueia quando o teto do próprio dono é atingido", () => {
    useProjectStore.setState({
      projects: [sharedProject(500)],
      diagramsBySection: {},
      userId: MEMBER,
      appLimits: withPageLimit(300),
      limitsByOwner: { [OWNER]: withPageLimit(500) },
    });

    expect(() =>
      useProjectStore.getState().addSection("shared-project", "Nova página")
    ).toThrow("structural_limit_sections_per_project");
  });

  it("páginas de um projeto não consomem o teto de outro projeto do mesmo dono", () => {
    useProjectStore.setState({
      projects: [sharedProject(500), sharedProject(0, "outro-projeto")],
      diagramsBySection: {},
      userId: MEMBER,
      appLimits: withPageLimit(300),
      limitsByOwner: { [OWNER]: withPageLimit(500) },
    });

    // O primeiro projeto está lotado; o segundo continua com 500 livres.
    expect(() =>
      useProjectStore.getState().addSection("outro-projeto", "Primeira página")
    ).not.toThrow();
  });

  it("projeto compartilhado não consome o plano do membro", () => {
    useProjectStore.setState({
      projects: [sharedProject(300)],
      diagramsBySection: {},
      userId: MEMBER,
      appLimits: withPageLimit(300),
      limitsByOwner: {
        [MEMBER]: withPageLimit(300),
        [OWNER]: withPageLimit(500),
      },
    });

    const ownId = useProjectStore.getState().addProject("Meu", "");
    expect(() =>
      useProjectStore.getState().addSection(ownId, "Primeira página")
    ).not.toThrow();
  });
});
