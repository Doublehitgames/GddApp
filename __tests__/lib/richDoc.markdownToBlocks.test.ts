import { markdownToBlocks } from "@/lib/richDoc/markdownToBlocks";

/** Flatten a block's inline content back to a string. */
function textOf(block: { content: { text: string }[] }): string {
  return block.content.map((n) => n.text).join("");
}

describe("markdownToBlocks — spoiler", () => {
  it("reads a `> [!spoiler] label` blockquote as a spoiler block", () => {
    const blocks = markdownToBlocks("> [!spoiler] Senha do cofre\n> 4-7-1-9");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("spoiler");
    expect(blocks[0].props).toEqual({ label: "Senha do cofre" });
    expect(textOf(blocks[0] as never)).toBe("4-7-1-9");
  });

  it("takes an unlabelled spoiler — the block falls back to its own label", () => {
    const blocks = markdownToBlocks("> [!spoiler]\n> O mordomo é o assassino.");
    expect(blocks[0].props).toEqual({ label: "" });
    expect(textOf(blocks[0] as never)).toBe("O mordomo é o assassino.");
  });

  it("joins the body lines and keeps the inline styles", () => {
    const blocks = markdownToBlocks("> [!spoiler] Solução\n> Gire a **estátua**\n> e depois puxe a alavanca.");
    expect(blocks[0].content).toEqual([
      { type: "text", text: "Gire a " },
      { type: "text", text: "estátua", styles: { bold: true } },
      { type: "text", text: " e depois puxe a alavanca." },
    ]);
  });

  it("does not swallow the blocks that follow it", () => {
    const blocks = markdownToBlocks("> [!spoiler] Senha\n> 1234\n\nO cofre fica na sala do chefe.");
    expect(blocks.map((b) => b.type)).toEqual(["spoiler", "paragraph"]);
  });
});

describe("markdownToBlocks — callout", () => {
  it("reads each known variant as a callout block", () => {
    for (const variant of ["note", "warning", "design-decision", "balance-note"]) {
      const blocks = markdownToBlocks(`> [!${variant}]\n> Cuidado aqui.`);
      expect(blocks[0].type).toBe("callout");
      expect(blocks[0].props).toEqual({ variant });
      expect(textOf(blocks[0] as never)).toBe("Cuidado aqui.");
    }
  });

  it("keeps text left on the marker line — it is part of the callout, not a label", () => {
    const blocks = markdownToBlocks("> [!note] Isto ensina o jargão\n> do time.");
    expect(textOf(blocks[0] as never)).toBe("Isto ensina o jargão do time.");
  });

  it("leaves an unknown marker as a plain quote", () => {
    const blocks = markdownToBlocks("> [!whatever]\n> texto");
    expect(blocks.every((b) => b.type === "quote")).toBe(true);
  });

  it("still reads a plain blockquote as a quote", () => {
    const blocks = markdownToBlocks("> só uma citação");
    expect(blocks[0].type).toBe("quote");
    expect(textOf(blocks[0] as never)).toBe("só uma citação");
  });
});

describe("markdownToBlocks — o que a cura acrescentou", () => {
  it("não trava mais em título h4-h6 — achata em h3", () => {
    const blocks = markdownToBlocks("#### Fundo\n\n##### Mais fundo\n");
    expect(blocks.map((b) => [b.type, b.props])).toEqual([
      ["heading", { level: 3 }],
      ["heading", { level: 3 }],
    ]);
  });

  it("lê tabela do GFM", () => {
    const md = "| Pista | Onde |\n| --- | --- |\n| Estátua | Hall |\n| Chave | Cozinha |";
    const [table] = markdownToBlocks(md);
    expect(table.type).toBe("table");
    const content = table.content as { type: string; rows: Array<{ cells: Array<Array<{ text: string }>> }> };
    expect(content.type).toBe("tableContent");
    expect(content.rows).toHaveLength(3);
    expect(content.rows[0].cells.map((c) => c[0].text)).toEqual(["Pista", "Onde"]);
    expect(content.rows[2].cells.map((c) => c[0].text)).toEqual(["Chave", "Cozinha"]);
  });

  it("não confunde parágrafo com barra vertical com tabela", () => {
    expect(markdownToBlocks("| isto não é tabela |")[0].type).toBe("paragraph");
  });

  it("lê imagem sozinha na linha como bloco de imagem", () => {
    const [image] = markdownToBlocks('![Planta do hall](https://drive.test/x.png "ignorado")');
    expect(image.type).toBe("image");
    expect(image.props).toEqual({ url: "https://drive.test/x.png", caption: "Planta do hall" });
  });

  it("lê link como nó de link, e deixa $[ref] em paz", () => {
    const [para] = markdownToBlocks("Veja o $[Moinho] e o [manual](https://x.test/m).");
    expect(para.content).toEqual([
      { type: "text", text: "Veja o $[Moinho] e o " },
      { type: "link", href: "https://x.test/m", content: [{ type: "text", text: "manual" }] },
      { type: "text", text: "." },
    ]);
  });

  it("aninha lista indentada e lê lista de tarefa", () => {
    const md = "- pai\n  - filho\n  - outro filho\n- tio\n\n- [x] feito\n- [ ] pendente";
    const blocks = markdownToBlocks(md);
    expect(blocks[0].children.map((c) => (c.content as Array<{ text: string }>)[0].text)).toEqual([
      "filho",
      "outro filho",
    ]);
    expect(blocks[1].children).toEqual([]);
    expect(blocks.slice(2).map((b) => [b.type, b.props])).toEqual([
      ["checkListItem", { checked: true }],
      ["checkListItem", { checked: false }],
    ]);
  });

  it("lê riscado e mantém asterisco solto como texto", () => {
    expect(markdownToBlocks("~~fora~~ e 2 * 3")[0].content).toEqual([
      { type: "text", text: "fora", styles: { strikethrough: true } },
      { type: "text", text: " e 2 * 3" },
    ]);
  });

  it("aguenta markdown estranho sem entrar em laço", () => {
    for (const md of ["####", "|", ">", "```", "- ", "![](", "[x](", "#\t", "***"]) {
      expect(() => markdownToBlocks(md)).not.toThrow();
    }
  });
});
