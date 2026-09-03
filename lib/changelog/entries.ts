/**
 * Montagem da linha do tempo do changelog a partir das versões e do log de
 * atividade. Lógica pura — a tela só desenha o que sai daqui.
 */

import type { ActivityLogEvent } from "@/lib/supabase/activityLogSync";
import type {
  ChangeKind,
  ChangelogDay,
  ChangelogEntry,
  ChangelogFilters,
  SectionVersionRow,
} from "./types";

/** Página como o changelog precisa dela: para saber o título de hoje e se nasceu agora. */
export type ChangelogSection = {
  id: string;
  title: string;
  created_at: string;
};

/**
 * Folga entre o nascimento da página e o primeiro snapshot. O snapshot leva o
 * `updated_at` do save, que num projeto criado por template pode chegar alguns
 * segundos depois do `created_at` da página.
 */
const CREATION_WINDOW_MS = 2 * 60_000;

function ts(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function normalizeOrigin(origin: string | null | undefined): "app" | "mcp" {
  return origin === "mcp" ? "mcp" : "app";
}

/**
 * Cruza versões (que têm o texto) com o log (que tem o que sumiu) e devolve a
 * linha do tempo em ordem decrescente.
 */
export function buildChangelogEntries({
  versions,
  sections,
  activity = [],
}: {
  versions: SectionVersionRow[];
  sections: ChangelogSection[];
  activity?: ActivityLogEvent[];
}): ChangelogEntry[] {
  const sectionById = new Map(sections.map((s) => [s.id, s]));

  const bySection = new Map<string, SectionVersionRow[]>();
  for (const version of versions) {
    const list = bySection.get(version.section_id);
    if (list) list.push(version);
    else bySection.set(version.section_id, [version]);
  }

  const entries: ChangelogEntry[] = [];

  for (const [sectionId, rows] of bySection) {
    rows.sort((a, b) => ts(a.created_at) - ts(b.created_at));
    const section = sectionById.get(sectionId);

    rows.forEach((row, index) => {
      const previous = index > 0 ? rows[index - 1] : undefined;
      const before = previous?.content ?? "";
      const after = row.content ?? "";

      let kind: ChangeKind;
      if (!previous) {
        // Sem antecessor: ou a página nasceu aqui, ou o snapshot anterior ficou
        // fora do lote buscado. O nascimento da página desempata.
        const isBirth =
          section != null &&
          Math.abs(ts(row.created_at) - ts(section.created_at)) <= CREATION_WINDOW_MS;
        kind = isBirth ? "created" : "edited";
      } else if (previous.title !== row.title && before === after) {
        kind = "renamed";
      } else {
        kind = "edited";
      }

      // Save sem mudança visível (só reordenação, por exemplo) não vira linha.
      if (kind === "edited" && previous && before === after && previous.title === row.title) {
        return;
      }

      entries.push({
        id: row.id,
        sectionId,
        sectionTitle: section?.title ?? row.title,
        kind,
        at: row.created_at,
        authorName: row.updated_by_name || null,
        origin: normalizeOrigin(row.origin),
        previousTitle:
          previous && previous.title !== row.title ? previous.title : undefined,
        before: kind === "created" ? "" : before,
        after,
        sectionExists: section != null,
      });
    });
  }

  // O log entra onde a versão não chega: páginas apagadas (o snapshot vai junto
  // no CASCADE) e páginas criadas sem nenhum snapshot no lote.
  for (const event of activity) {
    if (event.action === "deleted") {
      entries.push({
        id: event.id,
        sectionId: event.section_id,
        sectionTitle: event.section_title,
        kind: "deleted",
        at: event.created_at,
        authorName: event.user_name || null,
        origin: normalizeOrigin(event.origin),
        before: "",
        after: "",
        sectionExists: false,
      });
      continue;
    }

    if (event.action === "created" && !bySection.has(event.section_id)) {
      const section = sectionById.get(event.section_id);
      entries.push({
        id: event.id,
        sectionId: event.section_id,
        sectionTitle: section?.title ?? event.section_title,
        kind: "created",
        at: event.created_at,
        authorName: event.user_name || null,
        origin: normalizeOrigin(event.origin),
        before: "",
        after: "",
        sectionExists: section != null,
      });
    }
  }

  return entries.sort((a, b) => ts(b.at) - ts(a.at));
}

export function filterChangelogEntries(
  entries: ChangelogEntry[],
  filters: ChangelogFilters,
  now = Date.now()
): ChangelogEntry[] {
  const cutoff = filters.days == null ? null : now - filters.days * 86_400_000;
  return entries.filter((entry) => {
    if (cutoff != null && ts(entry.at) < cutoff) return false;
    if (filters.author != null && (entry.authorName ?? "") !== filters.author) return false;
    if (filters.origin !== "all" && entry.origin !== filters.origin) return false;
    return true;
  });
}

/** Chave de dia no fuso do leitor — agrupar por UTC jogaria a noite para amanhã. */
export function localDateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function groupByDay(entries: ChangelogEntry[]): ChangelogDay[] {
  const days: ChangelogDay[] = [];
  for (const entry of entries) {
    const date = localDateKey(entry.at);
    const last = days[days.length - 1];
    if (last && last.date === date) last.entries.push(entry);
    else days.push({ date, entries: [entry] });
  }
  return days;
}

/** Autores presentes na linha do tempo, para montar o filtro. */
export function listAuthors(entries: ChangelogEntry[]): string[] {
  const names = new Set<string>();
  for (const entry of entries) if (entry.authorName) names.add(entry.authorName);
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Quantas mudanças aconteceram depois de um instante — o selo de "novidades". */
export function countSince(entries: ChangelogEntry[], sinceIso: string | null): number {
  if (!sinceIso) return 0;
  const since = ts(sinceIso);
  return entries.filter((entry) => ts(entry.at) > since).length;
}
