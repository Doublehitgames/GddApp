"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import { GENRE_BENCHMARKS, getMetricStatus, diagnose } from "@/lib/kpi/benchmarks";
import type { MetricStatus } from "@/lib/kpi/benchmarks";
import type { KpiEntry } from "@/lib/kpi/types";

interface Props {
  projectId: string;
  realProjectId: string;
}

const STATUS_CHIP: Record<MetricStatus, { bg: string; text: string; arrow: string }> = {
  great:    { bg: "bg-emerald-500/20 border-emerald-700/50", text: "text-emerald-300", arrow: "↑" },
  ok:       { bg: "bg-sky-500/20 border-sky-700/50",         text: "text-sky-300",     arrow: "→" },
  low:      { bg: "bg-amber-500/20 border-amber-700/50",     text: "text-amber-300",   arrow: "↓" },
  critical: { bg: "bg-rose-500/20 border-rose-700/50",       text: "text-rose-300",    arrow: "↓↓" },
};

const DIAG_STYLE = {
  great:   { dot: "bg-emerald-400", text: "text-emerald-300", border: "border-emerald-700/40 bg-emerald-950/30" },
  warning: { dot: "bg-amber-400",   text: "text-amber-300",   border: "border-amber-700/40 bg-amber-950/30" },
  critical:{ dot: "bg-rose-400",    text: "text-rose-300",    border: "border-rose-700/40 bg-rose-950/30" },
};

const GENRE_LABELS: Record<string, string> = {
  farm: "Farm", casual: "Casual", rpg: "RPG",
  puzzle: "Puzzle", idle: "Idle", shooter: "Shooter",
};

function daysAgo(isoDate: string): number {
  const d = new Date(isoDate + "T00:00:00");
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function MetricChip({ label, value, entry }: { label: "d1" | "d7" | "d30"; value: number | undefined; entry: KpiEntry }) {
  if (value === undefined) return null;
  const bench = GENRE_BENCHMARKS[entry.genre];
  const status = getMetricStatus(value, bench[label]);
  const chip = STATUS_CHIP[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-mono font-semibold ${chip.bg} ${chip.text}`}>
      {label.toUpperCase()} {value}% {chip.arrow}
    </span>
  );
}

export default function KpiWidget({ projectId, realProjectId }: Props) {
  const kpiEntriesByProject = useProjectStore((s) => s.kpiEntriesByProject);
  const kpiConfigByProject  = useProjectStore((s) => s.kpiConfigByProject);

  const entries = kpiEntriesByProject[realProjectId] ?? [];
  const config  = kpiConfigByProject[realProjectId];
  const profile = config?.profile;

  const sorted  = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)), [entries]);
  const last    = sorted[0] ?? null;

  // pending = has hypothesis but no outcome yet
  const pending = useMemo(
    () => sorted.find((e) => e.hypothesis && !e.outcome) ?? null,
    [sorted]
  );

  const diagnosis = useMemo(
    () => last ? diagnose(last.metrics, last.genre, profile) : null,
    [last, profile]
  );

  const href = `/projects/${projectId}/kpi`;

  return (
    <section className="ui-card-premium p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">Análise do Jogo</span>
          {pending && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-700/50 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              hipótese pendente
            </span>
          )}
        </div>
        <Link
          href={href}
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-200 transition-colors"
        >
          Abrir
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex flex-col gap-3">

        {/* Empty state */}
        {!last && (
          <Link
            href={href}
            className="flex items-center gap-3 rounded-xl border border-dashed border-gray-700 px-3 py-4 text-gray-500 hover:border-emerald-700/50 hover:text-emerald-400 transition-colors"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">Registre os KPIs do seu jogo publicado</span>
          </Link>
        )}

        {/* Last entry */}
        {last && (
          <>
            {/* Date + genre */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{formatDate(last.date)}</span>
              <span className="rounded-full border border-emerald-700/40 bg-emerald-900/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                {GENRE_LABELS[last.genre] ?? last.genre}
              </span>
              <span className="text-xs text-gray-600">· última entrada</span>
            </div>

            {/* Metric chips */}
            <div className="flex flex-wrap gap-1.5">
              <MetricChip label="d1"  value={last.metrics.d1}  entry={last} />
              <MetricChip label="d7"  value={last.metrics.d7}  entry={last} />
              <MetricChip label="d30" value={last.metrics.d30} entry={last} />
            </div>

            {/* Diagnosis */}
            {diagnosis && (() => {
              const s = DIAG_STYLE[diagnosis.priority];
              return (
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${s.border}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                  <span className={`text-sm font-medium ${s.text}`}>{diagnosis.headline}</span>
                </div>
              );
            })()}

            {/* Pending hypothesis */}
            {pending && (
              <div className="flex flex-col gap-1 rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest">Hipótese em aberto</span>
                  <span className="text-[11px] text-gray-600">
                    {daysAgo(pending.date) === 0
                      ? "hoje"
                      : daysAgo(pending.date) === 1
                      ? "há 1 dia"
                      : `há ${daysAgo(pending.date)} dias`}
                  </span>
                </div>
                <p className="text-xs text-amber-200/70 line-clamp-2">{pending.hypothesis}</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
