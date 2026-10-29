/**
 * Grupos e coleções saem da forma da árvore. O formato do Granjita: um grupo
 * de coleções na raiz, um grupo aninhado num capítulo misto, e capítulos de
 * documentação que não podem aparecer.
 */

import { detectGroups } from "@/lib/library/collections";

type S = { id: string; title: string; parentId?: string; order?: number };
const page = (id: string, parentId?: string, order = 0): S => ({ id, title: id, parentId, order });
const leaves = (parent: string, n: number) => Array.from({ length: n }, (_, i) => page(`${parent}-${i}`, parent, i));

describe("detectGroups", () => {
  it("acha o grupo cujas filhas são todas coleções, e conta as coisas dentro", () => {
    const groups = detectGroups([page("Insumos"), page("Sementes", "Insumos", 0), ...leaves("Sementes", 3), page("Madeira", "Insumos", 1), ...leaves("Madeira", 2)]);
    expect(groups.map((g) => g.section.title)).toEqual(["Insumos"]);
    expect(groups[0].collections.map((c) => c.title)).toEqual(["Sementes", "Madeira"]);
    expect(groups[0].itemCount).toBe(5);
  });

  it("capítulo misto não é grupo, mas o grupo dentro dele é", () => {
    const groups = detectGroups([
      page("Mecânicas"),
      page("Terrenos", "Mecânicas", 0), // folha: torna Mecânicas misto
      page("Extração", "Mecânicas", 1),
      page("Floresta", "Extração", 0),
      ...leaves("Floresta", 2),
    ]);
    expect(groups.map((g) => g.section.title)).toEqual(["Extração"]);
  });

  it("coleção sozinha, sem grupo, não aparece — só folhas sob ela é documento comum", () => {
    expect(detectGroups([page("Visão Geral"), ...leaves("Visão Geral", 3)])).toEqual([]);
  });

  it("segue a ordem da árvore", () => {
    const groups = detectGroups([
      page("B", undefined, 1), page("Bc", "B"), ...leaves("Bc", 1),
      page("A", undefined, 0), page("Ac", "A"), ...leaves("Ac", 1),
    ]);
    expect(groups.map((g) => g.section.title)).toEqual(["A", "B"]);
  });

  it("filha de pai apagado conta como raiz em vez de sumir", () => {
    const groups = detectGroups([page("Órfão", "não-existe"), page("C", "Órfão"), ...leaves("C", 2)]);
    expect(groups.map((g) => g.section.title)).toEqual(["Órfão"]);
  });
});
