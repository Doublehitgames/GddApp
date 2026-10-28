/**
 * Busca de páginas por título e texto — a régua comum das telas de leitura.
 *
 * Cada modo tinha o seu `toLowerCase().includes()`, e nenhum tirava acento:
 * quem digitava "acao" não achava "Ação", e o português do GDD é cheio deles.
 * Aqui a comparação ignora maiúsculas e acentos, e o recorte que aparece no
 * resultado sai do texto original, com acento e tudo.
 *
 * Sem DOM e sem React.
 */

import { toPreviewText } from "@/lib/richDoc/previewText";

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Minúsculas e sem acento: "Ação" e "acao" viram a mesma coisa. */
export function foldForSearch(text: string): string {
  return (text || "").normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

/**
 * O mesmo `foldForSearch`, guardando de onde veio cada caractere — é o que
 * deixa marcar o trecho encontrado no texto original, que pode ter acento
 * onde a busca não tinha.
 */
function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  let offset = 0;
  for (const char of text) {
    const piece = foldForSearch(char);
    for (let i = 0; i < piece.length; i += 1) map.push(offset);
    folded += piece;
    offset += char.length;
  }
  map.push(offset);
  return { folded, map };
}

/** Faixa `[start, end)` no texto original. */
export type SearchRange = { start: number; end: number };

type Folded = { text: string; folded: string; map: number[] };

export type SectionSearchEntry = { id: string; title: Folded; body: Folded };

export type SectionSearchHit = {
  id: string;
  /** Onde a busca casou no título, se casou. */
  titleRange: SearchRange | null;
  /** Recorte do texto em volta do trecho, quando quem casou foi só o texto. */
  snippet: { before: string; match: string; after: string } | null;
};

function fold(text: string): Folded {
  const { folded, map } = foldWithMap(text);
  return { text, folded, map };
}

/**
 * O índice da busca, na ordem em que as páginas vierem.
 *
 * O texto pesquisado é o da prévia (`toPreviewText`), e não o markdown cru: a
 * marcação não entra na busca, e o conteúdo de um spoiler também não — o
 * resultado mostra um recorte, e um recorte não tem onde clicar para revelar.
 */
export function buildSectionSearchIndex(
  sections: Array<{ id: string; title?: string; content?: string }>
): SectionSearchEntry[] {
  return sections.map((section) => ({
    id: section.id,
    title: fold(section.title || ""),
    body: fold(toPreviewText(section.content || "", Number.POSITIVE_INFINITY)),
  }));
}

function rangeOf(entry: Folded, at: number, length: number): SearchRange {
  return { start: entry.map[at], end: entry.map[at + length] };
}

const SNIPPET_BEFORE = 36;
const SNIPPET_AFTER = 90;

function snippetOf(body: Folded, range: SearchRange) {
  const from = Math.max(0, range.start - SNIPPET_BEFORE);
  const to = Math.min(body.text.length, range.end + SNIPPET_AFTER);
  return {
    before: (from > 0 ? "…" : "") + body.text.slice(from, range.start).trimStart(),
    match: body.text.slice(range.start, range.end),
    after: body.text.slice(range.end, to).trimEnd() + (to < body.text.length ? "…" : ""),
  };
}

/**
 * As páginas que casam com a busca: primeiro as que casam no título, depois as
 * que casam só no texto — cada grupo na ordem do índice. É a mesma prioridade
 * do mapa mental: quem procura um nome quer a página dele antes das menções.
 */
export function searchSectionIndex(index: SectionSearchEntry[], query: string): SectionSearchHit[] {
  const needle = foldForSearch(query).replace(/\s+/g, " ").trim();
  if (!needle) return [];

  const byTitle: SectionSearchHit[] = [];
  const byBody: SectionSearchHit[] = [];
  for (const entry of index) {
    const inTitle = entry.title.folded.indexOf(needle);
    if (inTitle >= 0) {
      byTitle.push({ id: entry.id, titleRange: rangeOf(entry.title, inTitle, needle.length), snippet: null });
      continue;
    }
    const inBody = entry.body.folded.indexOf(needle);
    if (inBody >= 0) {
      byBody.push({
        id: entry.id,
        titleRange: null,
        snippet: snippetOf(entry.body, rangeOf(entry.body, inBody, needle.length)),
      });
    }
  }
  return [...byTitle, ...byBody];
}
