/**
 * Coleções e grupos — lidos da árvore, nunca declarados.
 *
 * - **coleção**: página cujas filhas são todas folhas (Sementes → 36 sementes).
 * - **grupo**: página cujas filhas são todas coleções (Insumos → Sementes,
 *   Frutos, Madeira…). É o grupo que vira botão de navegação.
 *
 * Página com filhas mistas (umas folhas, outras com filhas) não é nenhum dos
 * dois: é capítulo de documentação, e fica de fora da Biblioteca. Esse padrão
 * separa sozinho balanceamento de texto, sem o app saber do que o jogo é — o
 * app não sabe que um grupo é "itens" ou "inimigos", e não deve saber.
 */

type TreeSection = {
  id: string;
  title: string;
  parentId?: string;
  order?: number;
};

export type DetectedGroup<S extends TreeSection = TreeSection> = {
  section: S;
  collections: S[];
  /** Quantas coisas o grupo tem, somando as folhas de todas as coleções. */
  itemCount: number;
};

function childrenIndex<S extends TreeSection>(sections: S[]): Map<string, S[]> {
  const ids = new Set(sections.map((s) => s.id));
  const byParent = new Map<string, S[]>();
  for (const section of sections) {
    // Filha de um pai que não existe mais conta como raiz, não como filha.
    if (!section.parentId || !ids.has(section.parentId)) continue;
    const list = byParent.get(section.parentId);
    if (list) list.push(section);
    else byParent.set(section.parentId, [section]);
  }
  for (const list of byParent.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return byParent;
}

/**
 * Os grupos do projeto, na ordem em que aparecem na árvore (pré-ordem, a
 * mesma da Documentação).
 */
export function detectGroups<S extends TreeSection>(sections: S[]): DetectedGroup<S>[] {
  const byParent = childrenIndex(sections);
  const isLeaf = (s: S) => !byParent.has(s.id);
  const isCollection = (s: S) => {
    const children = byParent.get(s.id);
    return !!children && children.every(isLeaf);
  };

  const ids = new Set(sections.map((s) => s.id));
  const roots = sections
    .filter((s) => !s.parentId || !ids.has(s.parentId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const groups: DetectedGroup<S>[] = [];
  const visit = (section: S) => {
    const children = byParent.get(section.id);
    if (!children) return;
    if (children.every(isCollection)) {
      groups.push({
        section,
        collections: children,
        itemCount: children.reduce((sum, c) => sum + (byParent.get(c.id)?.length ?? 0), 0),
      });
      return;
    }
    children.forEach(visit);
  };
  roots.forEach(visit);
  return groups;
}
