import { assessThematicRelevance, stripExecutionCommands } from "@/utils/ai/thematicGuardrails";

describe("thematicGuardrails", () => {
  const farmingContext = {
    projectTitle: "Granjita Alegre",
    projectDescription:
      "Jogo casual de fazenda com foco em plantar, colher, cuidar de animais e vender produtos.",
    sections: [
      { title: "Core Loop", content: "Plantar, colher, vender e reinvestir." },
      { title: "Economia da Fazenda", content: "Custos de sementes e lucro de venda." },
    ],
  };

  it("marca baixa aderencia para sugestao de combate sem justificativa", () => {
    const result = assessThematicRelevance(
      "Crie as secoes Sistema de Combate, Armas e Bosses para o jogador derrotar inimigos.",
      farmingContext
    );

    expect(result.needsReview).toBe(true);
    expect(result.conflictHits.length).toBeGreaterThan(0);
  });

  it("aceita sugestao alinhada ao tema de fazenda", () => {
    const result = assessThematicRelevance(
      "Crie as secoes Economia da Fazenda, Producao Animal e Mercado para organizar o core loop.",
      farmingContext
    );

    expect(result.needsReview).toBe(false);
    expect(result.score).toBeGreaterThan(0.2);
  });

  it("remove bloco de comandos para analise de contexto", () => {
    const content = "Texto inicial\n[EXECUTAR]\nCRIAR: Sistema de Combate | ...\n\nResumo final";
    const stripped = stripExecutionCommands(content);

    expect(stripped).toContain("Texto inicial");
    expect(stripped).toContain("Resumo final");
    expect(stripped).not.toContain("CRIAR:");
  });
});

