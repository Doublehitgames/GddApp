/**
 * As coleções da Biblioteca: as páginas-mãe que têm regra de tabelas.
 *
 * A Biblioteca é conteúdo de balanceamento, e a forma da árvore não diz isso.
 * Medido no Granjita, das 33 páginas cujas filhas são todas folhas, 31 não têm
 * uma tabela sequer — são capítulos de documentação com cara de catálogo. O
 * sinal honesto é a regra (lib/tableRule/tableRule.ts): alguém decidiu que
 * aquelas filhas carregam números, e disse quais.
 *
 * A regra guarda nomes de coluna, não categoria: o app continua sem saber se a
 * coleção é "itens" ou "inimigos", e não deve saber.
 */

import { parseTableRule } from "@/lib/tableRule/tableRule";

type TreeSection = {
  id: string;
  title: string;
  parentId?: string;
  order?: number;
  tableRule?: unknown;
};

export type LibraryCollection<S extends TreeSection = TreeSection> = {
  section: S;
  /** Quantas páginas a coleção tem — as filhas diretas da página-mãe. */
  itemCount: number;
};

/** As coleções com regra, na ordem da árvore (pré-ordem, a mesma da Documentação). */
export function libraryCollections<S extends TreeSection>(sections: S[]): LibraryCollection<S>[] {
  const ids = new Set(sections.map((s) => s.id));
  const byParent = new Map<string | null, S[]>();
  for (const section of sections) {
    // Filha de um pai que não existe mais conta como raiz, não some.
    const parent = section.parentId && ids.has(section.parentId) ? section.parentId : null;
    const list = byParent.get(parent);
    if (list) list.push(section);
    else byParent.set(parent, [section]);
  }
  for (const list of byParent.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const out: LibraryCollection<S>[] = [];
  const visit = (section: S) => {
    const children = byParent.get(section.id) ?? [];
    if (parseTableRule(section.tableRule)) out.push({ section, itemCount: children.length });
    children.forEach(visit);
  };
  (byParent.get(null) ?? []).forEach(visit);
  return out;
}
