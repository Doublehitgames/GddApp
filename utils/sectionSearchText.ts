/**
 * Texto pesquisável de uma seção: título + markdown da descrição. Usado pelo
 * filtro da barra lateral.
 *
 * Tolerante a objetos de seção parciais (formas de sync/legado) — campos
 * ausentes contam como vazio.
 */
export function getSectionSearchText(section: unknown): string {
  if (!section || typeof section !== "object") return "";
  const s = section as { title?: unknown; content?: unknown };
  const parts: string[] = [];
  if (typeof s.title === "string") parts.push(s.title);
  if (typeof s.content === "string") parts.push(s.content);
  return parts.join("\n");
}
