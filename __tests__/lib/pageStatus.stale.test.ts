import { checkStale, listStaleSections, type StaleCandidate } from "@/lib/pageStatus/stale";

const APPROVED_AT = "2026-08-20T10:00:00.000Z";

function page(over: Partial<StaleCandidate> & { id: string; title: string }): StaleCandidate {
  return { updated_at: APPROVED_AT, ...over };
}

describe("checkStale", () => {
  const moinho = page({ id: "m", title: "Moinho", updated_at: "2026-08-28T10:00:00.000Z" });
  const forno = page({ id: "f", title: "Forno", updated_at: "2026-08-01T10:00:00.000Z" });

  it("acusa quando algo citado mudou depois da aprovação", () => {
    const receita = page({
      id: "r",
      title: "Receita: Pão",
      content: "Trigo moído no $[Moinho] e assado no $[Forno].",
      status: "approved",
      statusAt: APPROVED_AT,
    });

    const verdict = checkStale(receita, [receita, moinho, forno]);
    expect(verdict.stale).toBe(true);
    expect(verdict.changedRefs.map((r) => r.title)).toEqual(["Moinho"]);
  });

  it("fica quieto quando nada citado mudou depois", () => {
    const receita = page({
      id: "r",
      title: "Receita: Pão",
      content: "Assado no $[Forno].",
      status: "approved",
      statusAt: APPROVED_AT,
    });

    expect(checkStale(receita, [receita, forno]).stale).toBe(false);
  });

  it("não avalia rascunho nem página em revisão", () => {
    const base = {
      id: "r",
      title: "Receita: Pão",
      content: "Moído no $[Moinho].",
      statusAt: APPROVED_AT,
    };

    expect(checkStale(page({ ...base, status: "draft" }), [moinho]).stale).toBe(false);
    expect(checkStale(page({ ...base, status: "review" }), [moinho]).stale).toBe(false);
    expect(checkStale(page({ ...base, status: "implemented" }), [moinho]).stale).toBe(true);
  });

  it("não acusa página sem statusAt — não há a partir de quando comparar", () => {
    const receita = page({
      id: "r",
      title: "Receita: Pão",
      content: "Moído no $[Moinho].",
      status: "approved",
      statusAt: null,
    });

    expect(checkStale(receita, [receita, moinho]).stale).toBe(false);
  });

  it("ignora a citação a si mesma", () => {
    const auto = page({
      id: "r",
      title: "Moinho",
      content: "O $[Moinho] é o coração da fazenda.",
      status: "approved",
      statusAt: APPROVED_AT,
      updated_at: "2026-08-28T10:00:00.000Z",
    });

    expect(checkStale(auto, [auto]).stale).toBe(false);
  });

  it("resolve referência por id, não só por título", () => {
    const receita = page({
      id: "r",
      title: "Receita: Pão",
      content: "Moído no $[#m].",
      status: "approved",
      statusAt: APPROVED_AT,
    });

    expect(checkStale(receita, [receita, moinho]).stale).toBe(true);
  });

  it("não repete a mesma página citada duas vezes", () => {
    const receita = page({
      id: "r",
      title: "Receita: Pão",
      content: "Do $[Moinho] para o $[Moinho].",
      status: "approved",
      statusAt: APPROVED_AT,
    });

    expect(checkStale(receita, [receita, moinho]).changedRefs).toHaveLength(1);
  });

  it("varre o projeto inteiro", () => {
    const receita = page({
      id: "r",
      title: "Receita: Pão",
      content: "Moído no $[Moinho].",
      status: "approved",
      statusAt: APPROVED_AT,
    });
    const outra = page({ id: "o", title: "Outra", content: "Sem refs.", status: "approved", statusAt: APPROVED_AT });

    expect([...listStaleSections([receita, outra, moinho])]).toEqual(["r"]);
  });
});
