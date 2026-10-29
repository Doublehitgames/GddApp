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

describe("toPreviewText — referências", () => {
  const sections = [
    { id: "f36e6617-413b-4530-84a7-d996bf87d213", title: "Cacau" },
    { id: "b3b99be0-6048-4d34-a4ad-9a4f8c7d1e22", title: "🥛Leite" },
  ];

  it("resolve a forma legada $[#uuid] para o nome da página", () => {
    const md = "Junta $[#f36e6617-413b-4530-84a7-d996bf87d213] ou $[#b3b99be0-6048-4d34-a4ad-9a4f8c7d1e22].";
    expect(toPreviewText(md, undefined, sections)).toBe("Junta Cacau ou 🥛Leite.");
  });

  it("deixa o uuid de fora quando a página não existe mais", () => {
    const md = "Junta $[#00000000-0000-4000-8000-000000000000] na batedeira.";
    expect(toPreviewText(md, undefined, sections)).toBe("Junta na batedeira.");
  });

  it("casa por título sem diferenciar maiúscula", () => {
    expect(toPreviewText("Mói o $[cacau] no moinho.", undefined, sections)).toBe("Mói o Cacau no moinho.");
  });

  it("sem sections, a ref por nome continua virando o nome", () => {
    expect(toPreviewText("Mói o $[Cacau] no moinho.")).toBe("Mói o Cacau no moinho.");
  });
});
