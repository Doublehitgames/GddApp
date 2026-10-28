import { buildSectionSearchIndex, foldForSearch, searchSectionIndex } from "@/lib/search/sectionSearch";

const index = buildSectionSearchIndex([
  { id: "a", title: "🌾 Colheita", content: "A **Ação** principal do jogo, feita no $[Moinho]." },
  { id: "b", title: "Moinho", content: "Mói o osso em farinha." },
  { id: "c", title: "Segredo", content: "Antes.\n\n> [!spoiler] Senha\n> moinho escondido\n\nDepois." },
  { id: "d", title: "Ação de Colheita", content: "" },
]);

describe("foldForSearch", () => {
  it("ignora maiúsculas e acentos", () => {
    expect(foldForSearch("Ação Pão ÉPICO")).toBe("acao pao epico");
  });
});

describe("searchSectionIndex", () => {
  it("casa sem acento e sem caixa, título antes de texto", () => {
    const hits = searchSectionIndex(index, "ACAO");
    expect(hits.map((h) => h.id)).toEqual(["d", "a"]);
  });

  it("marca o trecho no título original, com acento", () => {
    const [hit] = searchSectionIndex(index, "acao");
    expect(hit.id).toBe("d");
    expect("Ação de Colheita".slice(hit.titleRange!.start, hit.titleRange!.end)).toBe("Ação");
  });

  it("devolve recorte do texto sem a marcação", () => {
    const hit = searchSectionIndex(index, "acao").find((h) => h.id === "a")!;
    expect(hit.titleRange).toBeNull();
    expect(hit.snippet).toEqual({
      before: "A ",
      match: "Ação",
      after: " principal do jogo, feita no Moinho.",
    });
  });

  it("emoji no título não atrapalha o casamento", () => {
    const [hit] = searchSectionIndex(index, "colheita");
    expect(hit.id).toBe("a");
    expect("🌾 Colheita".slice(hit.titleRange!.start, hit.titleRange!.end)).toBe("Colheita");
  });

  it("o texto de um spoiler não entra na busca", () => {
    expect(searchSectionIndex(index, "escondido")).toEqual([]);
    expect(searchSectionIndex(index, "moinho").map((h) => h.id)).toEqual(["b", "a"]);
  });

  it("busca vazia não devolve nada", () => {
    expect(searchSectionIndex(index, "   ")).toEqual([]);
  });
});
