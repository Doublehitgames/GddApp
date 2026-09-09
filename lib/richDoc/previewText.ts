/**
 * Prosa curta para prévias — o card que aparece antes de saltar para uma
 * página referenciada, o painel do mapa mental, a lista de backlinks.
 *
 * Existe porque cada tela tinha a sua própria régua de "tira o markdown", e
 * elas divergiam: uma apagava `$[Moinho]` inteiro, outra deixava `[!note]`
 * cru na tela, uma terceira comia os hifens de `4-7-1-9`. Com uma régua só,
 * a regra que importa de verdade vale em todas: **o texto de um spoiler
 * nunca entra numa prévia**. Uma prévia não tem onde clicar para revelar,
 * então o que ela mostrasse estaria revelado sem ninguém pedir. Fica o
 * cadeado e o rótulo — dizer "aqui tem algo escondido" não estraga nada, e
 * some menos conteúdo do card do que apagar o bloco inteiro.
 *
 * Sem DOM e sem React — roda no servidor também.
 */

/** Teto padrão de caracteres da prévia. */
export const PREVIEW_MAX_LENGTH = 160;

/** Rótulo de um spoiler sem rótulo. Repete o literal de
 *  `lib/richDoc/spoilerBlock.tsx`, que é módulo de cliente. */
const SPOILER_FALLBACK_LABEL = "Spoiler";

/**
 * O bloco de spoiler em markdown: a linha do marcador e todas as linhas de
 * citação que vêm atrás dela. Ver `lib/richDoc/spoilerBlock.tsx`, que escreve
 * essa forma, e `markdownToBlocks.ts`, que a lê de volta.
 */
const SPOILER_BLOCK_RE = /^[ \t]*>[ \t]*\[!spoiler\][ \t]*([^\n]*)(?:\n[ \t]*>[^\n]*)*/gim;

/** Sobra do marcador de callout — o texto do callout fica, o `[!note]` sai. */
const CALLOUT_MARKER_RE = /\[!(?:note|warning|design-decision|balance-note)\]/gi;

/**
 * Troca cada bloco de spoiler pelo seu rótulo com cadeado, jogando fora o
 * conteúdo. É a regra da casa para qualquer superfície que mostre descrição
 * sem poder revelar.
 */
function redactSpoilerBlocks(markdown: string): string {
  if (!markdown) return "";
  return markdown.replace(SPOILER_BLOCK_RE, (_match, label: string) => {
    const trimmed = (label || "").trim();
    return `🔒 ${trimmed || SPOILER_FALLBACK_LABEL}`;
  });
}

/**
 * Uma linha de prosa legível, pronta para caber num card: spoiler reduzido ao
 * cadeado, sem marcação e sem quebra de linha. `$[Moinho]` e `@[token]` viram
 * só o nome — numa prévia o que interessa é ler a frase, não a sintaxe.
 */
export function toPreviewText(markdown: string, maxLength: number = PREVIEW_MAX_LENGTH): string {
  const plain = redactSpoilerBlocks(markdown || "")
    .replace(/\r\n/g, "\n")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[$@]\[([^\]]*)\]/g, "$1")
    .replace(CALLOUT_MARKER_RE, " ")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "")
    .replace(/^[ \t]*\|[-\s|:]*\|[ \t]*$/gm, " ")
    .replace(/[*_`~|>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > maxLength ? `${plain.slice(0, maxLength - 1).trimEnd()}…` : plain;
}
