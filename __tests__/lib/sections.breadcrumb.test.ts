/**
 * O caminho da página na árvore — o que o modal de prévia mostra embaixo do
 * título, para a pessoa saber de onde vem a página antes de saltar pra ela.
 */

import { sectionBreadcrumb, shortenBreadcrumb } from "@/lib/sections/breadcrumb";

const sections = [
  { id: "a", title: "📦Insumos", parentId: null },
  { id: "b", title: "Sementes", parentId: "a" },
  { id: "c", title: "Cenoura", parentId: "b" },
  { id: "solta", title: "Visão Geral", parentId: null },
];

describe("sectionBreadcrumb", () => {
  it("vai da raiz até a página, incluindo ela", () => {
    expect(sectionBreadcrumb("c", sections)).toEqual(["📦Insumos", "Sementes", "Cenoura"]);
  });

  it("página de raiz tem só o próprio nome", () => {
    expect(sectionBreadcrumb("solta", sections)).toEqual(["Visão Geral"]);
  });

  it("página que não existe devolve caminho vazio", () => {
    expect(sectionBreadcrumb("sumiu", sections)).toEqual([]);
  });

  it("não trava se o parentId formar um ciclo", () => {
    const ciclo = [
      { id: "x", title: "X", parentId: "y" },
      { id: "y", title: "Y", parentId: "x" },
    ];
    expect(sectionBreadcrumb("x", ciclo)).toEqual(["Y", "X"]);
  });
});

describe("shortenBreadcrumb", () => {
  it("caminho curto passa inteiro", () => {
    expect(shortenBreadcrumb(["A", "B", "C"])).toEqual(["A", "B", "C"]);
  });

  it("caminho longo guarda a raiz e os dois últimos degraus", () => {
    expect(shortenBreadcrumb(["A", "B", "C", "D", "E"])).toEqual(["A", "…", "D", "E"]);
  });
});
