import { TEMPLATE_SYSTEM_PROMPT, generateChatWithContextPrompt, generateTemplatePrompt } from "@/utils/ai/prompts";

describe("AI prompts relevance guardrails", () => {
  it("template prompt reforca aderencia ao tema", () => {
    const prompt = generateTemplatePrompt({
      gameType: "Simulação de fazenda",
      description: "Plantar, colher, cuidar de animais e vender produtos.",
    });

    expect(prompt).toContain("NÃO invente sistemas fora do escopo descrito");
    expect(prompt).toContain("Sistemas específicos do gênero descrito");
  });

  it("chat context prompt inclui descricao do projeto", () => {
    const prompt = generateChatWithContextPrompt("Sugira paginas", {
      projectTitle: "Granjita Alegre",
      projectDescription: "Fazendinha casual com economia leve e interação social.",
      sections: [{ id: "1", title: "Core Loop" }],
    });

    expect(prompt).toContain("Descrição:");
    expect(prompt).toContain("Nunca proponha sistemas fora do tema do projeto");
  });

  it("template system prompt impede estrutura generica fora de contexto", () => {
    expect(TEMPLATE_SYSTEM_PROMPT).toContain("Não inclua sistemas genéricos");
    expect(TEMPLATE_SYSTEM_PROMPT).toContain("Retorne apenas JSON válido");
  });
});

