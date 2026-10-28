"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import DiffView from "@/components/changelog/DiffView";
import { countTextWords } from "@/lib/changelog/diff";
import type { ChangeKind, ChangelogEntry } from "@/lib/changelog/types";
import { toSlug } from "@/lib/utils/slug";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  entry: ChangelogEntry;
  projectSlug: string;
  /** Verdadeiro quando a mudança é posterior à última visita: ganha o traço. */
  isNew?: boolean;
}

const KIND_STYLES: Record<ChangeKind, string> = {
  created: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  edited: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  renamed: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  deleted: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

/** Hora no idioma do app: 24h em português, AM/PM em inglês. */
function formatTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export default function ChangeCard({ entry, projectSlug, isNew = false }: Props) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const kindLabels: Record<ChangeKind, string> = {
    created: t("changelog.kind.created", "criada"),
    edited: t("changelog.kind.edited", "editada"),
    renamed: t("changelog.kind.renamed", "renomeada"),
    deleted: t("changelog.kind.deleted", "apagada"),
  };

  // O saldo de palavras é uma varredura linear; o diff de verdade só roda
  // quando alguém abre o cartão.
  const delta = useMemo(
    () => countTextWords(entry.after) - countTextWords(entry.before),
    [entry.after, entry.before]
  );

  const hasDiff = entry.before !== entry.after && (entry.before !== "" || entry.after !== "");

  const title = (
    <span className={entry.kind === "deleted" ? "text-subtle line-through" : "text-ink"}>
      {entry.sectionTitle}
    </span>
  );

  return (
    <article
      className={`rounded-xl border bg-gray-900/50 transition-colors ${
        isNew ? "border-l-2 border-l-emerald-500/70 border-y-line border-r-line" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-3.5 py-3">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide ${KIND_STYLES[entry.kind]}`}
        >
          {kindLabels[entry.kind]}
        </span>

        <h3 className="min-w-0 truncate text-sm font-medium">
          {entry.sectionExists ? (
            <Link
              href={`/projects/${projectSlug}/sections/${toSlug(entry.sectionTitle)}`}
              prefetch={false}
              className="transition-colors hover:text-ink hover:underline"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>

        {entry.previousTitle && (
          <span className="truncate text-[11px] text-subtle">
            {t("changelog.renamedFrom", "antes: {title}").replace("{title}", entry.previousTitle)}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          {delta !== 0 && (
            <span
              className={`text-[11px] tabular-nums ${delta > 0 ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-rose-600/80 dark:text-rose-400/80"}`}
              title={t("changelog.wordDelta", "saldo de palavras")}
            >
              {delta > 0 ? "+" : "−"}
              {Math.abs(delta)}
            </span>
          )}
          {entry.origin === "mcp" && (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold leading-none text-violet-700 dark:text-violet-300">
              {t("changelog.originMcp", "agente")}
            </span>
          )}
          {entry.authorName && (
            <span className="max-w-[10rem] truncate text-xs text-muted">{entry.authorName}</span>
          )}
          <span className="text-xs tabular-nums text-subtle">{formatTime(entry.at, locale)}</span>
          {hasDiff && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              {expanded
                ? t("changelog.hideDiff", "ocultar")
                : t("changelog.showDiff", "ver mudança")}
            </button>
          )}
        </div>
      </div>

      {expanded && hasDiff && (
        <div className="border-t border-line bg-canvas/60 px-3.5 py-3">
          <DiffView before={entry.before} after={entry.after} />
        </div>
      )}
    </article>
  );
}
