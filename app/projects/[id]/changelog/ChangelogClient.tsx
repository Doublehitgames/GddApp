"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ChangeCard from "@/components/changelog/ChangeCard";
import {
  buildChangelogEntries,
  countSince,
  filterChangelogEntries,
  groupByDay,
  listAuthors,
} from "@/lib/changelog/entries";
import { readChangelogSeen, writeChangelogSeen } from "@/lib/changelog/seen";
import {
  DEFAULT_CHANGELOG_FILTERS,
  type ChangelogFilters,
  type SectionVersionRow,
} from "@/lib/changelog/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface Props {
  projectId: string;
}

const PAGE_SIZE = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rótulo do dia: hoje e ontem por nome, o resto por data por extenso.
 *
 * A data segue o idioma do app, não o do navegador — quem escolheu português na
 * barra não quer ler "Friday, August 28" no meio de uma tela em português.
 */
function useDayLabel() {
  const { t, locale } = useI18n();
  return (dateKey: string): string => {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, (month ?? 1) - 1, day ?? 1);
    const today = new Date();
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (isSameDay(date, today)) return t("changelog.today", "Hoje");
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (isSameDay(date, yesterday)) return t("changelog.yesterday", "Ontem");

    return date.toLocaleDateString(locale, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
    });
  };
}

/**
 * A tela do changelog: a linha do tempo do GDD, um dia por bloco.
 *
 * A tela não guarda nada — ela cruza os snapshots que o servidor devolve com a
 * árvore de páginas que o store já tem em mãos, e o diff só é calculado quando
 * alguém abre um cartão.
 */
export default function ChangelogClient({ projectId }: Props) {
  const { t } = useI18n();
  const dayLabel = useDayLabel();

  const getProjectBySlug = useProjectStore((s) => s.getProjectBySlug);
  const projects = useProjectStore((s) => s.projects);
  const fetchActivityLog = useProjectStore((s) => s.fetchActivityLog);
  const activityLogByProject = useProjectStore((s) => s.activityLogByProject);

  const project = useMemo(
    () => getProjectBySlug(projectId),
    [getProjectBySlug, projectId, projects]
  );
  const realProjectId = project?.id ?? projectId;
  const isCloudProject = UUID_RE.test(realProjectId);

  const [versions, setVersions] = useState<SectionVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ChangelogFilters>(DEFAULT_CHANGELOG_FILTERS);

  // Congelado na montagem: se acompanhasse o localStorage, marcar como lido
  // apagaria os traços verdes debaixo do olho de quem está lendo.
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [markedRead, setMarkedRead] = useState(false);

  useEffect(() => {
    setSeenAt(readChangelogSeen(realProjectId));
  }, [realProjectId]);

  useEffect(() => {
    if (isCloudProject) fetchActivityLog(realProjectId);
  }, [isCloudProject, realProjectId, fetchActivityLog]);

  const fetchPage = useCallback(
    async (before?: string) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (before) params.set("before", before);
      const response = await fetch(
        `/api/projects/${encodeURIComponent(realProjectId)}/changelog?${params}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as { versions: SectionVersionRow[]; hasMore: boolean };
    },
    [realProjectId]
  );

  useEffect(() => {
    if (!isCloudProject) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPage()
      .then((data) => {
        if (cancelled) return;
        setVersions(data.versions ?? []);
        setHasMore(Boolean(data.hasMore));
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("changelog.loadError", "Não deu para carregar o histórico agora."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, isCloudProject, t]);

  const loadOlder = async () => {
    const oldest = versions[versions.length - 1]?.created_at;
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(oldest);
      setVersions((current) => [...current, ...(data.versions ?? [])]);
      setHasMore(Boolean(data.hasMore));
    } catch {
      setError(t("changelog.loadError", "Não deu para carregar o histórico agora."));
    } finally {
      setLoadingMore(false);
    }
  };

  const sections = useMemo(
    () =>
      (project?.sections ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        created_at: s.created_at,
      })),
    [project?.sections]
  );

  const entries = useMemo(
    () =>
      buildChangelogEntries({
        versions,
        sections,
        activity: activityLogByProject[realProjectId] ?? [],
      }),
    [versions, sections, activityLogByProject, realProjectId]
  );

  const visible = useMemo(() => filterChangelogEntries(entries, filters), [entries, filters]);
  const days = useMemo(() => groupByDay(visible), [visible]);
  const authors = useMemo(() => listAuthors(entries), [entries]);
  const newCount = markedRead ? 0 : countSince(entries, seenAt);

  // Comparação por instante, não por texto: o Postgres devolve "+00:00" e o
  // marcador local grava "Z", e os dois não ordenam igual como string.
  const seenTime = seenAt ? new Date(seenAt).getTime() : null;
  const isNewEntry = (iso: string) =>
    !markedRead && seenTime != null && new Date(iso).getTime() > seenTime;

  const periods: Array<{ value: number | null; label: string }> = [
    { value: 1, label: t("changelog.period.day", "24h") },
    { value: 7, label: t("changelog.period.week", "7 dias") },
    { value: 30, label: t("changelog.period.month", "30 dias") },
    { value: null, label: t("changelog.period.all", "Tudo") },
  ];

  const origins: Array<{ value: ChangelogFilters["origin"]; label: string }> = [
    { value: "all", label: t("changelog.origin.all", "Todos") },
    { value: "app", label: t("changelog.origin.app", "Pessoas") },
    { value: "mcp", label: t("changelog.origin.mcp", "Agente") },
  ];

  const chipClass = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs transition-colors ${
      active ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
    }`;

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-white">
            {t("changelog.pageTitle", "O que mudou")}
          </h1>
          <Link
            href={`/projects/${projectId}`}
            className="ml-auto text-xs text-gray-400 transition-colors hover:text-gray-100"
          >
            {t("changelog.backToProject", "voltar ao projeto")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
        {newCount > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
            <p className="text-sm text-emerald-300">
              {(newCount === 1
                ? t("changelog.newSinceOne", "1 mudança desde a sua última visita")
                : t("changelog.newSince", "{n} mudanças desde a sua última visita")
              ).replace("{n}", String(newCount))}
            </p>
            <button
              type="button"
              onClick={() => {
                writeChangelogSeen(realProjectId);
                setMarkedRead(true);
              }}
              className="ml-auto rounded-lg border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-300 transition-colors hover:bg-emerald-500/10"
            >
              {t("changelog.markRead", "marcar como lido")}
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-gray-900 p-0.5">
            {periods.map((period) => (
              <button
                key={String(period.value)}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, days: period.value }))}
                className={chipClass(filters.days === period.value)}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5 rounded-lg bg-gray-900 p-0.5">
            {origins.map((origin) => (
              <button
                key={origin.value}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, origin: origin.value }))}
                className={chipClass(filters.origin === origin.value)}
              >
                {origin.label}
              </button>
            ))}
          </div>

          {authors.length > 1 && (
            <select
              value={filters.author ?? ""}
              onChange={(event) =>
                setFilters((f) => ({ ...f, author: event.target.value || null }))
              }
              className="rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1.5 text-xs text-gray-300 focus:border-gray-700 focus:outline-none"
            >
              <option value="">{t("changelog.everyone", "Todo mundo")}</option>
              {authors.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
          )}

          <span className="ml-auto text-xs text-gray-500">
            {(visible.length === 1
              ? t("changelog.countOne", "1 mudança")
              : t("changelog.count", "{n} mudanças")
            ).replace("{n}", String(visible.length))}
          </span>
        </div>

        {!isCloudProject ? (
          <p className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-6 text-sm text-gray-400">
            {t(
              "changelog.localOnly",
              "Este projeto ainda não está na nuvem — o histórico começa a ser guardado no primeiro sync."
            )}
          </p>
        ) : loading ? (
          <p className="px-1 py-6 text-sm text-gray-500">{t("changelog.loading", "Carregando…")}</p>
        ) : error ? (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-4 text-sm text-rose-300">
            {error}
          </p>
        ) : days.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-800 px-4 py-8 text-center text-sm text-gray-500">
            {entries.length === 0
              ? t("changelog.empty", "Nenhuma mudança registrada ainda.")
              : t("changelog.emptyFiltered", "Nada mudou nesse período.")}
          </p>
        ) : (
          <div className="space-y-6">
            {days.map((day) => (
              <section key={day.date}>
                <h2 className="mb-2 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <span className="first-letter:uppercase">{dayLabel(day.date)}</span>
                  <span className="h-px flex-1 bg-gray-800" />
                  <span className="font-normal normal-case tabular-nums text-gray-600">
                    {day.entries.length}
                  </span>
                </h2>
                <div className="space-y-2">
                  {day.entries.map((entry) => (
                    <ChangeCard
                      key={entry.id}
                      entry={entry}
                      projectSlug={projectId}
                      isNew={isNewEntry(entry.at)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {hasMore && filters.days === null && (
              <button
                type="button"
                onClick={loadOlder}
                disabled={loadingMore}
                className="w-full rounded-xl border border-gray-800 py-2.5 text-xs text-gray-400 transition-colors hover:border-gray-700 hover:text-gray-200 disabled:opacity-50"
              >
                {loadingMore
                  ? t("changelog.loading", "Carregando…")
                  : t("changelog.loadOlder", "carregar mudanças mais antigas")}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
