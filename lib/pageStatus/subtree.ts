/**
 * O ramo de uma página: ela e tudo que pende dela.
 *
 * Classificar um GDD página por página é inviável num documento de 250, e o
 * agrupamento útil já existe na estrutura — "Sementes" e as 30 sementes
 * abaixo dela nascem, são aprovadas e entram no jogo juntas. Por isso o lote
 * segue a árvore em vez de pedir uma seleção manual.
 */

export type TreeNode = { id: string; parentId?: string | null };

/**
 * Ids de todos os descendentes de `rootId`, em qualquer profundidade — sem o
 * próprio root.
 *
 * Varre em largura a partir do root em vez de recursão por página, e guarda os
 * já vistos: uma árvore com um ciclo (pai que aponta para o próprio neto, que o
 * store não impede) faria a recursão ingênua rodar para sempre.
 */
export function collectDescendantIds(nodes: TreeNode[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const node of nodes) {
    const parent = node.parentId ?? null;
    if (parent == null) continue;
    const list = childrenByParent.get(parent);
    if (list) list.push(node.id);
    else childrenByParent.set(parent, [node.id]);
  }

  const found: string[] = [];
  const seen = new Set<string>([rootId]);
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of childrenByParent.get(current) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      found.push(child);
      queue.push(child);
    }
  }

  return found;
}
