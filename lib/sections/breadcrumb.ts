/**
 * O caminho de uma página na árvore do GDD, em títulos: da raiz até ela,
 * incluindo ela — a mesma trilha que a barra de cima mostra.
 *
 * Sem DOM e sem React: serve tanto a tela quanto o que roda no servidor.
 */

export type BreadcrumbSection = { id: string; title?: string | null; parentId?: string | null };

/** Da raiz até a página, incluindo a própria. Página solta devolve só o nome dela. */
export function sectionBreadcrumb(sectionId: string, sections: BreadcrumbSection[]): string[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const path: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(sectionId);
  // `visited` existe por causa de dado torto: um ciclo de parentId travaria a tela.
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(String(current.title || ""));
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/**
 * O mesmo caminho, encurtado para caber numa linha: a raiz, reticências e os
 * dois últimos degraus. O fim é o que localiza a pessoa, então é ele que fica.
 */
export function shortenBreadcrumb(path: string[], maxSegments = 4): string[] {
  if (path.length <= maxSegments) return path;
  return [path[0], "…", ...path.slice(-2)];
}
