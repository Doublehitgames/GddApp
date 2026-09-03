/**
 * Tipos do changelog do projeto — a linha do tempo do que mudou no GDD.
 *
 * A matéria-prima já existia no banco: `section_versions` guarda um snapshot a
 * cada save, e `section_activity_log` guarda o que aconteceu com a página
 * (inclusive apagar, que o snapshot não sobrevive por causa do ON DELETE
 * CASCADE). O changelog é a leitura das duas coisas juntas.
 */

/** Uma linha de `section_versions`, como o banco devolve. */
export type SectionVersionRow = {
  id: string;
  section_id: string;
  project_id: string;
  title: string;
  content: string | null;
  sort_order: number | null;
  color: string | null;
  created_at: string;
  updated_by: string | null;
  updated_by_name: string | null;
  /** 'app' (navegador) ou 'mcp' (agente). NULL nas linhas anteriores à coluna. */
  origin?: "app" | "mcp" | null;
};

export type ChangeKind = "created" | "edited" | "renamed" | "deleted";

/** Um item da linha do tempo: uma página, num momento, por alguém. */
export type ChangelogEntry = {
  /** Id da versão que originou o item (ou do evento, para páginas apagadas). */
  id: string;
  sectionId: string;
  /** Título atual da página; o do momento da mudança quando ela não existe mais. */
  sectionTitle: string;
  kind: ChangeKind;
  /** ISO. */
  at: string;
  authorName: string | null;
  origin: "app" | "mcp";
  /** Preenchido em `renamed`. */
  previousTitle?: string;
  /** Conteúdo antes e depois — vazio quando não há o que comparar. */
  before: string;
  after: string;
  /** Falso para páginas apagadas: o cartão não vira link. */
  sectionExists: boolean;
};

/** Um dia da linha do tempo. */
export type ChangelogDay = {
  /** Data local no formato YYYY-MM-DD, usada como chave. */
  date: string;
  entries: ChangelogEntry[];
};

export type ChangelogFilters = {
  /** Janela em dias. `null` = tudo que veio. */
  days: number | null;
  /** Nome do autor, exatamente como gravado. `null` = todos. */
  author: string | null;
  origin: "all" | "app" | "mcp";
};

export const DEFAULT_CHANGELOG_FILTERS: ChangelogFilters = {
  days: 7,
  author: null,
  origin: "all",
};
