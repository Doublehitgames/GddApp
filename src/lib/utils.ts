import type { Section } from "@/store/projectStore";
import { SEARCH } from "./constants";

/**
 * Verifica se uma seção corresponde ao termo de busca (título ou conteúdo)
 */
export function matchesSearch(section: Section, searchTerm: string): boolean {
  if (!searchTerm.trim()) return true;
  
  const lowerSearch = searchTerm.toLowerCase();
  const titleMatch = section.title.toLowerCase().includes(lowerSearch);
  const contentMatch = section.content?.toLowerCase().includes(lowerSearch) || false;
  
  return titleMatch || contentMatch;
}

/**
 * Gera snippet de conteúdo com contexto ao redor da busca
 */
export function getContentSnippet(content: string, search: string): string {
  const lowerContent = content.toLowerCase();
  const lowerSearch = search.toLowerCase();
  const index = lowerContent.indexOf(lowerSearch);
  
  if (index === -1) return "";
  
  const start = Math.max(0, index - SEARCH.SNIPPET_PREFIX_LENGTH);
  const end = Math.min(
    content.length,
    index + search.length + SEARCH.SNIPPET_SUFFIX_LENGTH
  );
  
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  
  return prefix + content.slice(start, end) + suffix;
}

/**
 * Constrói breadcrumbs para navegação (flat structure com parentId)
 */
export function buildBreadcrumbs(
  sections: Section[],
  sectionId: string
): Section[] | null {
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return null;
  
  const path: Section[] = [];
  let current: Section | undefined = section;
  
  while (current) {
    path.unshift(current);
    if (current.parentId) {
      current = sections.find((s) => s.id === current!.parentId);
    } else {
      current = undefined;
    }
  }
  
  return path;
}

/**
 * Gera ID único para seções
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Coleta todos os IDs descendentes de uma seção (para delete em cascata)
 * Funciona com estrutura flat usando parentId
 */
export function collectDescendantIds(sectionId: string, allSections: Section[]): string[] {
  const ids = [sectionId];
  const children = allSections.filter((s) => s.parentId === sectionId);
  
  children.forEach((child) => {
    ids.push(...collectDescendantIds(child.id, allSections));
  });
  
  return ids;
}
