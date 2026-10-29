/**
 * A Biblioteca é balanceamento: coleção é a página-mãe com regra de tabelas,
 * não a que só tem cara de catálogo na árvore.
 */

import { libraryCollections } from "@/lib/library/collections";

type S = { id: string; title: string; parentId?: string; order?: number; tableRule?: unknown };
const RULE = { tables: [{ name: "Economia", columns: [{ name: "Compra", type: "number" }] }] };
const page = (id: string, parentId?: string, order = 0, tableRule?: unknown): S => ({ id, title: id, parentId, order, tableRule });
const leaves = (parent: string, n: number) => Array.from({ length: n }, (_, i) => page(`${parent}-${i}`, parent, i));

describe("libraryCollections", () => {
  it("só a mãe com regra entra, e conta as filhas", () => {
    const out = libraryCollections([
      page("Insumos"),
      page("Sementes", "Insumos", 0, RULE), ...leaves("Sementes", 3),
      page("Frutos", "Insumos", 1), ...leaves("Frutos", 5),
    ]);
    expect(out.map((c) => [c.section.title, c.itemCount])).toEqual([["Sementes", 3]]);
  });

  it("forma de catálogo sem regra não é coleção", () => {
    // Era o furo do critério pela árvore: 31 de 33 assim no Granjita, sem um número.
    expect(libraryCollections([page("Cozinha"), ...leaves("Cozinha", 11)])).toEqual([]);
  });

  it("regra vazia ou quebrada não conta", () => {
    expect(libraryCollections([page("A", undefined, 0, { tables: [] }), page("B", undefined, 1, "Economia")])).toEqual([]);
  });

  it("segue a ordem da árvore, em qualquer profundidade", () => {
    const out = libraryCollections([
      page("B", undefined, 1, RULE),
      page("A", undefined, 0), page("A1", "A", 0, RULE),
    ]);
    expect(out.map((c) => c.section.title)).toEqual(["A1", "B"]);
  });

  it("filha de pai apagado conta como raiz em vez de sumir", () => {
    expect(libraryCollections([page("Órfã", "não-existe", 0, RULE)]).map((c) => c.section.title)).toEqual(["Órfã"]);
  });
});
