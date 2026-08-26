/**
 * Limites estruturais são avaliados no DONO do projeto, não em quem está
 * editando. Um membro convidado num projeto compartilhado usa a cota do dono,
 * e o projeto compartilhado não pode consumir a cota do próprio membro.
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
function sharedProject(count: number) {
  return {
    id: "shared-project",
    title: "Granjita",
    description: "",
    ownerId: OWNER,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sections: Array.from({ length: count }, (_, i) => ({
      id: `sec-${i}`,
      title: `P${i}`,
      content: "",
      created_at: "2026-01-01T00:00:00.000Z",
      order: i,
    })),
  } as any;
}

describe("limites por dono do projeto", () => {
  beforeEach(() => {
    localStorage.clear();
    uuidCounter = 0;
    jest.clearAllMocks();
  });

  it("aplica o limite estendido do dono, não o do membro que edita", () => {
    useProjectStore.setState({
      projects: [sharedProject(200)],
      diagramsBySection: {},
      userId: MEMBER,
      appLimits: { ...DEFAULT_APP_LIMITS, FREE_MAX_SECTIONS_TOTAL: 200 },
      limitsByOwner: {
        [MEMBER]: { ...DEFAULT_APP_LIMITS, FREE_MAX_SECTIONS_TOTAL: 200 },
        [OWNER]: { ...DEFAULT_APP_LIMITS, FREE_MAX_SECTIONS_TOTAL: 500 },
      },
    });

    // O membro está em 200/200 na própria cota, mas o dono tem 500.
    expect(() =>
      useProjectStore.getState().addSection("shared-project", "Nova página")
    ).not.toThrow();
  });

  it("bloqueia quando o próprio limite do dono é atingido", () => {
    useProjectStore.setState({
      projects: [sharedProject(500)],
      diagramsBySection: {},
      userId: MEMBER,
      appLimits: { ...DEFAULT_APP_LIMITS, FREE_MAX_SECTIONS_TOTAL: 200 },
      limitsByOwner: {
        [OWNER]: {
          ...DEFAULT_APP_LIMITS,
          FREE_MAX_SECTIONS_PER_PROJECT: 500,
          FREE_MAX_SECTIONS_TOTAL: 500,
        },
      },
    });

    expect(() =>
      useProjectStore.getState().addSection("shared-project", "Nova página")
    ).toThrow("structural_limit_sections_per_project");
  });

  it("projeto compartilhado não consome a cota do membro", () => {
    useProjectStore.setState({
      projects: [sharedProject(200)],
      diagramsBySection: {},
      userId: MEMBER,
      appLimits: { ...DEFAULT_APP_LIMITS, FREE_MAX_SECTIONS_TOTAL: 200 },
      limitsByOwner: {
        [MEMBER]: { ...DEFAULT_APP_LIMITS, FREE_MAX_SECTIONS_TOTAL: 200 },
        [OWNER]: { ...DEFAULT_APP_LIMITS, FREE_MAX_SECTIONS_TOTAL: 500 },
      },
    });

    // O membro cria um projeto próprio: as 200 páginas do projeto alheio
    // não podem contar contra ele.
    const ownId = useProjectStore.getState().addProject("Meu", "");
    expect(() =>
      useProjectStore.getState().addSection(ownId, "Primeira página")
    ).not.toThrow();
  });
});
