import { collectDescendantIds } from "@/lib/pageStatus/subtree";

const tree = [
  { id: "raiz" },
  { id: "sementes", parentId: "raiz" },
  { id: "nabo", parentId: "sementes" },
  { id: "nabo-nv2", parentId: "nabo" },
  { id: "margarida", parentId: "sementes" },
  { id: "animais", parentId: "raiz" },
  { id: "galinha", parentId: "animais" },
];

describe("collectDescendantIds", () => {
  it("pega filhos, netos e bisnetos, sem o próprio root", () => {
    expect(collectDescendantIds(tree, "sementes").sort()).toEqual(
      ["margarida", "nabo", "nabo-nv2"].sort()
    );
  });

  it("devolve vazio para folha", () => {
    expect(collectDescendantIds(tree, "galinha")).toEqual([]);
  });

  it("não atravessa para o ramo vizinho", () => {
    expect(collectDescendantIds(tree, "animais")).toEqual(["galinha"]);
  });

  it("pega a árvore toda a partir da raiz", () => {
    expect(collectDescendantIds(tree, "raiz")).toHaveLength(6);
  });

  it("não trava numa árvore com ciclo", () => {
    const ciclico = [
      { id: "a", parentId: "c" },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ];
    expect(collectDescendantIds(ciclico, "a").sort()).toEqual(["b", "c"]);
  });

  it("ignora id que não existe na árvore", () => {
    expect(collectDescendantIds(tree, "fantasma")).toEqual([]);
  });
});
