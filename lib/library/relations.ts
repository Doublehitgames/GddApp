/**
 * Relações e resumo para a Biblioteca — tudo derivado do texto das páginas.
 *
 * "Usado em 3 receitas" no mock é, aqui, quem cita a página com `$[...]`,
 * agrupado pela página-mãe de quem cita. O app não sabe o que é "receita":
 * sabe que três páginas filhas de `Receitas` citam esta.
 */

import { extractSectionReferences, findSection } from "@/utils/sectionReferences";
import { toPreviewText } from "@/lib/richDoc/previewText";

type RelSection = { id: string; title: string; parentId?: string; content?: string };

export type Backlink = { id: string; title: string; parentId?: string };

/**
 * Quem cita quem, para o projeto inteiro de uma vez. A tela mostra uma
 * coleção de dezenas de páginas; chamar getBacklinks por card seria varrer o
 * projeto inteiro uma vez por card.
 */
export function backlinkIndex<S extends RelSection>(sections: S[]): Map<string, Backlink[]> {
  const index = new Map<string, Backlink[]>();
  for (const source of sections) {
    const seen = new Set<string>();
    for (const ref of extractSectionReferences(source.content || "")) {
      const target = findSection(sections, ref);
      if (!target || target.id === source.id || seen.has(target.id)) continue;
      seen.add(target.id);
      const list = index.get(target.id) ?? [];
      list.push({ id: source.id, title: source.title, parentId: source.parentId });
      index.set(target.id, list);
    }
  }
  return index;
}

export type RelationGroup = {
  /** A página-mãe de quem cita; `null` para quem cita da raiz. */
  parent: { id: string; title: string } | null;
  pages: Backlink[];
};

/** Os backlinks de uma página, agrupados pela mãe de quem cita — o maior grupo primeiro. */
export function groupRelations(backlinks: Backlink[], byId: Map<string, { id: string; title: string }>): RelationGroup[] {
  const groups = new Map<string, RelationGroup>();
  for (const link of backlinks) {
    const parent = link.parentId ? byId.get(link.parentId) ?? null : null;
    const key = parent?.id ?? "";
    const group = groups.get(key) ?? { parent: parent ? { id: parent.id, title: parent.title } : null, pages: [] };
    group.pages.push(link);
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) => b.pages.length - a.pages.length || (a.parent?.title ?? "").localeCompare(b.parent?.title ?? ""),
  );
}

/**
 * A prosa da página, sem as tabelas e sem o título que fica em cima delas.
 *
 * No card, o resumo é o papel da coisa; os números já aparecem no painel,
 * lidos da tabela. Repetir "38 | 10512 | 5256" no resumo era o número
 * diluído na prosa que a regra existe para evitar.
 */
export function proseOnly(markdown: string): string {
  const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
  const isTableLine = (line: string | undefined) => !!line && /^\s*\|.*\|\s*$/.test(line);
  const nextContent = (from: number) => {
    for (let i = from; i < lines.length; i++) if (lines[i].trim()) return lines[i];
    return undefined;
  };
  return lines
    .filter((line, i) => {
      if (isTableLine(line)) return false;
      if (/^\s*#{1,6}\s/.test(line) && isTableLine(nextContent(i + 1))) return false;
      return true;
    })
    .join("\n");
}

export function proseExcerpt(markdown: string, maxLength: number, sections?: Array<{ id: string; title: string }>): string {
  return toPreviewText(proseOnly(markdown), maxLength, sections);
}
