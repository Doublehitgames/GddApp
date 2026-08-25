/**
 * Texto de uma seção enviado aos prompts de IA.
 *
 * A descrição da página é escrita em blocos (`contentBlocks`) e espelhada em
 * `content` como markdown no save, então o markdown já é a visão completa do
 * que o leitor vê. Mantido como função para os chamadores não precisarem saber
 * disso e por tolerar objetos de seção parciais (formas de sync/legado).
 */
export function getSectionAiContent(section: unknown): string {
  if (!section || typeof section !== "object") return "";
  const s = section as { content?: unknown };
  return typeof s.content === "string" ? s.content.trim() : "";
}
