/**
 * "Reli, continua valendo" para um lote de páginas.
 *
 * O selo de releitura mede a distância entre o carimbo de estado e a última
 * reescrita das páginas citadas. Renomear uma página faz TODAS que a citam
 * pedirem releitura no mesmo segundo — daí o lote: recarimba muitas de uma vez
 * sem reclassificar nenhuma.
 */

import { useProjectStore } from "@/store/projectStore";
import { listStaleSections, type StaleCandidate } from "@/lib/pageStatus/stale";

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

const ONTEM = "2026-09-04T10:00:00.000Z";
const HOJE = "2026-09-05T10:00:00.000Z";

/** Páginas do projeto, do jeito que o selo as lê. */
const secoes = (projectId: string): StaleCandidate[] =>
  (useProjectStore.getState().getProject(projectId)?.sections ?? []) as never;

const acha = (projectId: string, id: string) =>
  useProjectStore.getState().getProject(projectId)!.sections!.find((s) => s.id === id)!;

describe("confirmSectionsRead", () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], diagramsBySection: {} });
    localStorage.clear();
    uuidCounter = 0;
    jest.clearAllMocks();
  });

  /**
   * Monta o caso real: duas páginas no jogo citam o Moinho, que foi reescrito
   * hoje — depois do carimbo de ontem. As duas pedem releitura.
   */
  const cenario = () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const moinho = store.addSection(projectId, "Moinho", "Mói o trigo.");
    const pao = store.addSection(projectId, "Receita: Pão", "Moído no $[Moinho].");
    const bolo = store.addSection(projectId, "Receita: Bolo", "Farinha do $[Moinho].");

    useProjectStore.getState().setSectionsStatus(projectId, [pao, bolo], "implemented");
    useProjectStore.setState({
      projects: useProjectStore.getState().projects.map((p) =>
        p.id !== projectId
          ? p
          : {
              ...p,
              sections: p.sections!.map((s) =>
                s.id === moinho
                  ? { ...s, content_updated_at: HOJE }
                  : { ...s, statusAt: ONTEM, content_updated_at: ONTEM }
              ),
            }
      ),
    } as never);

    return { projectId, moinho, pao, bolo };
  };

  it("o cenário parte de duas páginas pedindo releitura", () => {
    const { projectId, pao, bolo } = cenario();
    expect([...listStaleSections(secoes(projectId))].sort()).toEqual([pao, bolo].sort());
  });

  it("apaga o selo das duas de uma vez", () => {
    const { projectId, pao, bolo } = cenario();
    useProjectStore.getState().confirmSectionsRead(projectId, [pao, bolo]);
    expect(listStaleSections(secoes(projectId)).size).toBe(0);
  });

  it("não reclassifica ninguém: o estado de cada página fica o que era", () => {
    const { projectId, pao, bolo } = cenario();
    useProjectStore.getState().setSectionsStatus(projectId, [bolo], "approved");
    useProjectStore.getState().confirmSectionsRead(projectId, [pao, bolo]);
    expect(acha(projectId, pao).status).toBe("implemented");
    expect(acha(projectId, bolo).status).toBe("approved");
  });

  it("recarimba só quem está no lote", () => {
    const { projectId, pao, bolo } = cenario();
    useProjectStore.getState().confirmSectionsRead(projectId, [pao]);
    expect(acha(projectId, pao).statusAt).not.toBe(ONTEM);
    expect(acha(projectId, bolo).statusAt).toBe(ONTEM);
    expect([...listStaleSections(secoes(projectId))]).toEqual([bolo]);
  });

  it("não inventa carimbo para página sem estado", () => {
    const { projectId, moinho, pao } = cenario();
    useProjectStore.getState().confirmSectionsRead(projectId, [moinho, pao]);
    expect(acha(projectId, moinho).status).toBeUndefined();
    expect(acha(projectId, moinho).statusAt).toBeUndefined();
  });

  it("não toca em updated_at: confirmar releitura não é editar a página", () => {
    const { projectId, pao } = cenario();
    const antes = acha(projectId, pao).updated_at;
    useProjectStore.getState().confirmSectionsRead(projectId, [pao]);
    expect(acha(projectId, pao).updated_at).toBe(antes);
  });

  it("lote vazio não mexe no projeto", () => {
    const { projectId } = cenario();
    const antes = useProjectStore.getState().getProject(projectId)!;
    useProjectStore.getState().confirmSectionsRead(projectId, []);
    expect(useProjectStore.getState().getProject(projectId)).toBe(antes);
  });
});
