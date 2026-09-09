import { toPreviewText } from "@/lib/richDoc/previewText";

describe("toPreviewText — spoiler", () => {
  it("troca o bloco pelo cadeado e o rótulo, sem o conteúdo", () => {
    const md = "Gire a estátua.\n\n> [!spoiler] Senha do cofre\n> 4-7-1-9\n\nDepois volte à sala.";
    expect(toPreviewText(md)).toBe("Gire a estátua. 🔒 Senha do cofre Depois volte à sala.");
  });

  it("usa o rótulo padrão quando o spoiler não tem um", () => {
    const md = "> [!spoiler]\n> O mordomo é o assassino.\n> E o cachorro sabia.";
    expect(toPreviewText(md)).toBe("🔒 Spoiler");
  });

  it("aguenta mais de um spoiler na mesma página", () => {
    const md = "> [!spoiler] A\n> segredo um\n\ntexto\n\n> [!spoiler] B\n> segredo dois";
    const out = toPreviewText(md);
    expect(out).toBe("🔒 A texto 🔒 B");
    expect(out).not.toContain("segredo");
  });

  it("engole o espelho do editor, que vem com uma linha `>` vazia no meio", () => {
    const md = "Guia.\n\n> [!spoiler] Senha do cofre\n>\n> 4-7-1-9\n";
    expect(toPreviewText(md)).toBe("Guia. 🔒 Senha do cofre");
  });
});

describe("toPreviewText — o resto da marcação", () => {
  it("reduz a marcação a prosa de uma linha", () => {
    const md = "## O Moinho\n\nMói o **osso** em `farinha`.\n\n- rápido\n- barato";
    expect(toPreviewText(md)).toBe("O Moinho Mói o osso em farinha. rápido barato");
  });

  it("mostra o nome da referência, não a sintaxe", () => {
    expect(toPreviewText("Moído no $[Moinho] e vendido na @[loja].")).toBe(
      "Moído no Moinho e vendido na loja.",
    );
  });

  it("tira o marcador do callout mas mantém o texto", () => {
    expect(toPreviewText("> [!warning]\n> Não solte o boss antes da cutscene.")).toBe(
      "Não solte o boss antes da cutscene.",
    );
  });

  it("não confunde citação comum com bloco marcado", () => {
    expect(toPreviewText("> uma citação qualquer")).toBe("uma citação qualquer");
  });

  it("preserva hifens — uma senha não é uma lista", () => {
    expect(toPreviewText("O código é 4-7-1-9.")).toBe("O código é 4-7-1-9.");
  });

  it("corta no teto com reticências", () => {
    const out = toPreviewText("a".repeat(400), 20);
    expect(out).toHaveLength(20);
    expect(out.endsWith("…")).toBe(true);
  });

  it("aguenta vazio e undefined", () => {
    expect(toPreviewText("")).toBe("");
    expect(toPreviewText(undefined as never)).toBe("");
  });
});
