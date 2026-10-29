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

import { extractSectionReferences, findSection } from "@/utils/sectionReferences";

/** Teto padrão de caracteres da prévia. Serve a carta e a linha de lista, onde o texto divide espaço com o resto. */
export const PREVIEW_MAX_LENGTH = 160;

/**
 * Teto da prévia no modal, que é bem mais generoso: ali o texto é o conteúdo
 * da tela, e a pessoa está decidindo se vale sair de onde está. Três linhas
 * não respondem isso. O corpo do modal rola quando passa da altura da janela.
 */
export const PREVIEW_DIALOG_MAX_LENGTH = 600;

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

/** O mínimo que a prévia precisa saber de uma página para resolver uma referência a ela. */
export type PreviewSection = { id: string; title?: string | null };

/**
 * Troca cada `$[...]` pelo título da página apontada, usando o mesmo casamento
 * do renderizador (`findSection`): por id na forma legada `$[#uuid]`, por
 * título case-insensitive na forma normal.
 *
 * Referência que não resolve sai da frase. Na página, o renderizador pinta uma
 * ref quebrada de vermelho para a pessoa notar; uma prévia não tem cor nem
 * clique, e um uuid de 36 caracteres não é prosa — mostrá-lo só gasta o card
 * com um dado que não diz nada a ninguém.
 */
function resolveReferences(markdown: string, sections: PreviewSection[]): string {
  if (!markdown.includes("$[")) return markdown;
  const refs = extractSectionReferences(markdown);
  if (refs.length === 0) return markdown;

  let out = "";
  let cursor = 0;
  for (const ref of refs) {
    out += markdown.slice(cursor, ref.startIndex);
    const resolved = findSection(sections as never[], ref);
    if (resolved) out += resolved.title;
    else if (ref.refType === "name") out += ref.refValue;
    cursor = ref.endIndex;
  }
  return out + markdown.slice(cursor);
}

/**
 * Uma linha de prosa legível, pronta para caber num card: spoiler reduzido ao
 * cadeado, sem marcação e sem quebra de linha. `$[Moinho]` e `@[token]` viram
 * só o nome — numa prévia o que interessa é ler a frase, não a sintaxe.
 *
 * Passe `sections` sempre que elas estiverem à mão: é o que faz a forma legada
 * `$[#uuid]` virar o nome da página em vez de despejar o uuid no card.
 */
export function toPreviewText(
  markdown: string,
  maxLength: number = PREVIEW_MAX_LENGTH,
  sections?: PreviewSection[]
): string {
  const source = sections?.length ? resolveReferences(markdown || "", sections) : markdown || "";
  const plain = redactSpoilerBlocks(source)
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
