"use client";

import { useState } from "react";
import type { KpiEntry, KpiMetrics } from "@/lib/kpi/types";
import type { MetricStatus } from "@/lib/kpi/benchmarks";
import { GENRE_BENCHMARKS, getMetricStatus } from "@/lib/kpi/benchmarks";

interface Props {
  entries: KpiEntry[];
  onUpdateEntry: (id: string, patch: Partial<Pick<KpiEntry, "hypothesis" | "hypothesisArea" | "outcome" | "learning" | "metrics">>) => void;
  onDeleteEntry: (id: string) => void;
}

const STATUS_CHIP: Record<MetricStatus, { bg: string; text: string; arrow: string }> = {
  great:    { bg: "bg-emerald-500/20 border-emerald-700/60", text: "text-emerald-300", arrow: "↑" },
  ok:       { bg: "bg-sky-500/20 border-sky-700/60",         text: "text-sky-300",     arrow: "→" },
  low:      { bg: "bg-amber-500/20 border-amber-700/60",     text: "text-amber-300",   arrow: "↓" },
  critical: { bg: "bg-rose-500/20 border-rose-700/60",       text: "text-rose-300",    arrow: "↓↓" },
};

const OUTCOME_BADGES = {
  confirmed:    { bg: "bg-emerald-500/20 border-emerald-700/60", text: "text-emerald-300", label: "Confirmou" },
  refuted:      { bg: "bg-rose-500/20 border-rose-700/60",       text: "text-rose-300",    label: "Refutou" },
  inconclusive: { bg: "bg-gray-700/60 border-gray-600/60",       text: "text-gray-400",    label: "Inconclusivo" },
};

function formatDate(iso: string): string {
  try {
    const [year, month, day] = iso.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function MetricChip({ label, value, metrics, entry }: { label: string; value: number | undefined; metrics: KpiMetrics; entry: KpiEntry }) {
  if (value === undefined) return null;
  const bench = GENRE_BENCHMARKS[entry.genre];
  const benchKey = label.toLowerCase() as "d1" | "d7" | "d30";
  const status = getMetricStatus(value, bench[benchKey]);
  const chip = STATUS_CHIP[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-mono font-semibold ${chip.bg} ${chip.text}`}>
      {label} {value}% {chip.arrow}
    </span>
  );
}

function OutcomeForm({ entry, onSave, onCancel }: { entry: KpiEntry; onSave: (outcome: KpiEntry["outcome"], learning: string) => void; onCancel: () => void }) {
  const [outcome, setOutcome] = useState<KpiEntry["outcome"]>(entry.outcome ?? "confirmed");
  const [learning, setLearning] = useState(entry.learning ?? "");

  return (
    <div className="mt-3 space-y-3 border-t border-gray-700/50 pt-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Resultado da hipótese</p>
      <div className="flex gap-2 flex-wrap">
        {(["confirmed", "refuted", "inconclusive"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setOutcome(opt)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              outcome === opt ? OUTCOME_BADGES[opt].bg + " " + OUTCOME_BADGES[opt].text : "border-gray-600 text-gray-500 hover:text-gray-300"
            }`}
          >
            {OUTCOME_BADGES[opt].label}
          </button>
        ))}
      </div>
      <textarea
        value={learning}
        onChange={(e) => setLearning(e.target.value)}
        placeholder="O que você aprendeu com isso?"
        rows={2}
        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-sky-500 focus:outline-none resize-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(outcome, learning)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          Salvar resultado
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function KpiHistoryList({ entries, onUpdateEntry, onDeleteEntry }: Props) {
  const [openOutcomeId, setOpenOutcomeId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/60 bg-gray-900/40 px-4 py-6 text-center">
        <p className="text-sm text-gray-500">Nenhuma entrada ainda. Preencha os dados acima e salve.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((entry) => {
        const bench = GENRE_BENCHMARKS[entry.genre];
        const isOpen = openOutcomeId === entry.id;
        const isConfirmDelete = confirmDeleteId === entry.id;

        return (
          <div key={entry.id} className="rounded-xl border border-gray-700/60 bg-gray-900/60 px-4 py-3">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-400">{formatDate(entry.date)}</span>
                <MetricChip label="D1" value={entry.metrics.d1} metrics={entry.metrics} entry={entry} />
                <MetricChip label="D7" value={entry.metrics.d7} metrics={entry.metrics} entry={entry} />
                <MetricChip label="D30" value={entry.metrics.d30} metrics={entry.metrics} entry={entry} />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!isConfirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(entry.id)}
                    className="rounded p-1 text-gray-600 hover:text-rose-400 transition-colors"
                    title="Excluir entrada"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { onDeleteEntry(entry.id); setConfirmDeleteId(null); }}
                      className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Hypothesis */}
            {entry.hypothesis && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-0.5">Hipótese</p>
                <p className="text-sm text-gray-300 line-clamp-2">{entry.hypothesis}</p>
              </div>
            )}

            {/* Outcome / learning */}
            {entry.outcome ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${OUTCOME_BADGES[entry.outcome].bg} ${OUTCOME_BADGES[entry.outcome].text}`}>
                  {OUTCOME_BADGES[entry.outcome].label}
                </span>
                {entry.learning && (
                  <p className="text-xs text-gray-400 line-clamp-1">{entry.learning}</p>
                )}
                <button
                  type="button"
                  onClick={() => setOpenOutcomeId(isOpen ? null : entry.id)}
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Editar resultado
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setOpenOutcomeId(isOpen ? null : entry.id)}
                  className="rounded-lg border border-dashed border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-sky-600 hover:text-sky-400 transition-colors"
                >
                  + Registrar resultado
                </button>
              </div>
            )}

            {/* Outcome form */}
            {isOpen && (
              <OutcomeForm
                entry={entry}
                onSave={(outcome, learning) => {
                  onUpdateEntry(entry.id, { outcome, learning });
                  setOpenOutcomeId(null);
                }}
                onCancel={() => setOpenOutcomeId(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
