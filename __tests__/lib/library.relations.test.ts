/**
 * Relações da Biblioteca: quem cita a página, agrupado pela mãe de quem cita,
 * e o resumo que deixa a tabela de fora.
 */

import { backlinkIndex, groupRelations, proseOnly } from "@/lib/library/relations";

const s = (id: string, title: string, parentId?: string, content = "") => ({ id, title, parentId, content });

describe("backlinkIndex + groupRelations", () => {
  const sections = [
    s("r", "Receitas"),
    s("r1", "Bolo", "r", "Leva $[Trigo] e $[trigo] de novo."),
    s("r2", "Pão", "r", "Feito com $[Trigo]."),
    s("m", "Moinho", undefined, "Mói o $[Trigo]."),
    s("t", "Trigo", undefined, "Cita a si mesmo: $[Trigo]."),
    s("x", "Outra", undefined, "$[Página que não existe]"),
  ];
  const index = backlinkIndex(sections);
  const byId = new Map(sections.map((x) => [x.id, x]));

  it("conta cada página que cita uma vez só, e ignora a página citando a si mesma", () => {
    expect(index.get("t")?.map((b) => b.title).sort()).toEqual(["Bolo", "Moinho", "Pão"]);
  });

  it("agrupa pela mãe de quem cita, o maior grupo primeiro", () => {
    const groups = groupRelations(index.get("t")!, byId);
    expect(groups.map((g) => [g.parent?.title ?? null, g.pages.length])).toEqual([["Receitas", 2], [null, 1]]);
  });

  it("referência que não resolve não cria relação", () => {
    expect([...index.keys()].sort()).toEqual(["t"]);
  });
});

describe("proseOnly", () => {
  it("tira as tabelas e o título que fica em cima delas, e deixa o resto", () => {
    const md = [
      "Semente de flor.",
      "",
      "## Economia",
      "",
      "| Compra | Venda |",
      "| --- | --- |",
      "| 10 | 5 |",
      "",
      "## História",
      "Veio do vale.",
    ].join("\n");
    const out = proseOnly(md);
    expect(out).toContain("Semente de flor.");
    expect(out).toContain("## História");
    expect(out).toContain("Veio do vale.");
    expect(out).not.toContain("Economia");
    expect(out).not.toContain("10");
  });
});
