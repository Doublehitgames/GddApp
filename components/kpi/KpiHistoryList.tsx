"use client";

import { useState } from "react";
import type { KpiEntry, KpiMetrics } from "@/lib/kpi/types";
import type { MetricStatus } from "@/lib/kpi/benchmarks";
import { GENRE_BENCHMARKS, getMetricStatus } from "@/lib/kpi/benchmarks";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  entries: KpiEntry[];
  readOnly?: boolean;
  onUpdateEntry: (id: string, patch: Partial<Pick<KpiEntry, "hypothesis" | "hypothesisArea" | "outcome" | "learning" | "metrics">>) => void;
  onDeleteEntry: (id: string) => void;
}

const STATUS_CHIP: Record<MetricStatus, { bg: string; text: string; arrow: string }> = {
  great:    { bg: "bg-emerald-500/20 border-emerald-700/60", text: "text-emerald-300", arrow: "↑" },
  ok:       { bg: "bg-sky-500/20 border-sky-700/60",         text: "text-sky-300",     arrow: "→" },
  low:      { bg: "bg-amber-500/20 border-amber-700/60",     text: "text-amber-300",   arrow: "↓" },
  critical: { bg: "bg-rose-500/20 border-rose-700/60",       text: "text-rose-300",    arrow: "↓↓" },
};

const OUTCOME_STYLES = {
  confirmed:    { bg: "bg-emerald-500/20 border-emerald-700/60", text: "text-emerald-300" },
  refuted:      { bg: "bg-rose-500/20 border-rose-700/60",       text: "text-rose-300" },
  inconclusive: { bg: "bg-gray-700/60 border-gray-600/60",       text: "text-gray-400" },
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

function MetricChip({ label, value, playerCount, entry }: { label: string; value: number | undefined; playerCount?: number; entry: KpiEntry }) {
  if (value === undefined) return null;
  const bench = GENRE_BENCHMARKS[entry.genre];
  const benchKey = label.toLowerCase() as "d1" | "d3" | "d7" | "d14" | "d30";
  const status = getMetricStatus(value, bench[benchKey]);
  const chip = STATUS_CHIP[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-mono font-semibold ${chip.bg} ${chip.text}`}>
      {label} {value}%{playerCount !== undefined ? ` · ${playerCount}` : ""} {chip.arrow}
    </span>
  );
}

// ─── Compact field used inside the edit form ──────────────────────────────────

function MetricField({
  label, value, onChange, unit = "%", players, onPlayersChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  unit?: string;
  players?: number;
  onPlayersChange?: (v: number | undefined) => void;
}) {
  function parse(raw: string, integer = false) {
    if (raw === "") return undefined;
    const n = integer ? parseInt(raw, 10) : parseFloat(raw);
    return isNaN(n) ? undefined : n;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={unit === "%" ? 100 : undefined}
          step={0.1}
          value={value ?? ""}
          onChange={(e) => onChange(parse(e.target.value))}
          placeholder="—"
          className="w-14 rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm font-mono text-white focus:border-sky-500 focus:outline-none tabular-nums"
        />
        <span className="text-xs text-gray-600">{unit}</span>
      </div>
      {onPlayersChange !== undefined && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-600">👥</span>
          <input
            type="number"
            min={0}
            step={1}
            value={players ?? ""}
            onChange={(e) => onPlayersChange(parse(e.target.value, true))}
            placeholder="—"
            className="w-14 rounded border border-gray-700/60 bg-gray-950 px-2 py-1 text-xs font-mono text-gray-300 focus:border-sky-500 focus:outline-none tabular-nums"
          />
        </div>
      )}
    </div>
  );
}

// ─── Edit entry form ──────────────────────────────────────────────────────────

const HYPOTHESIS_AREAS: KpiEntry["hypothesisArea"][] = ["tutorial", "loop", "midgame", "monetization", "other"];

function EditEntryForm({
  entry, onSave, onCancel,
}: {
  entry: KpiEntry;
  onSave: (patch: Partial<Pick<KpiEntry, "metrics" | "hypothesis" | "hypothesisArea">>) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();

  const [d1, setD1]               = useState(entry.metrics.d1);
  const [d1Players, setD1Players] = useState(entry.metrics.d1Players);
  const [d3, setD3]               = useState(entry.metrics.d3);
  const [d3Players, setD3Players] = useState(entry.metrics.d3Players);
  const [d7, setD7]               = useState(entry.metrics.d7);
  const [d7Players, setD7Players] = useState(entry.metrics.d7Players);
  const [d14, setD14]             = useState(entry.metrics.d14);
  const [d14Players, setD14Players] = useState(entry.metrics.d14Players);
  const [d30, setD30]             = useState(entry.metrics.d30);
  const [d30Players, setD30Players] = useState(entry.metrics.d30Players);
  const [sessionsPerDay, setSessionsPerDay]   = useState(entry.metrics.sessionsPerDay);
  const [sessionDuration, setSessionDuration] = useState(entry.metrics.sessionDuration);
  const [conversionRate, setConversionRate]   = useState(entry.metrics.conversionRate);
  const [hypothesis, setHypothesis]           = useState(entry.hypothesis ?? "");
  const [hypothesisArea, setHypothesisArea]   = useState<KpiEntry["hypothesisArea"]>(entry.hypothesisArea ?? "tutorial");

  function handleSave() {
    const metrics: KpiMetrics = {
      d1, d1Players,
      d3, d3Players,
      d7, d7Players,
      d14, d14Players,
      d30, d30Players,
      sessionsPerDay,
      sessionDuration,
      conversionRate,
    };
    onSave({
      metrics,
      hypothesis: hypothesis.trim() || undefined,
      hypothesisArea: hypothesis.trim() ? hypothesisArea : undefined,
    });
  }

  return (
    <div className="mt-3 space-y-4 border-t border-gray-700/50 pt-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{t("kpi.history.editTitle")}</p>

      {/* Retenção */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">{t("kpi.history.retentionSection")}</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <MetricField label="D1"  value={d1}  onChange={setD1}  players={d1Players}  onPlayersChange={setD1Players} />
          <MetricField label="D3"  value={d3}  onChange={setD3}  players={d3Players}  onPlayersChange={setD3Players} />
          <MetricField label="D7"  value={d7}  onChange={setD7}  players={d7Players}  onPlayersChange={setD7Players} />
          <MetricField label="D14" value={d14} onChange={setD14} players={d14Players} onPlayersChange={setD14Players} />
          <MetricField label="D30" value={d30} onChange={setD30} players={d30Players} onPlayersChange={setD30Players} />
        </div>
      </div>

      {/* Engajamento */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">{t("kpi.history.engagementSection")}</p>
        <div className="grid grid-cols-3 gap-3">
          <MetricField label={t("kpi.metrics.sessionsLabel")} value={sessionsPerDay}   onChange={setSessionsPerDay}   unit="x" />
          <MetricField label={t("kpi.metrics.durationLabel")} value={sessionDuration}  onChange={setSessionDuration}  unit="min" />
          <MetricField label={t("kpi.metrics.conversionLabel")} value={conversionRate} onChange={setConversionRate}   unit="%" />
        </div>
      </div>

      {/* Hipótese */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">{t("kpi.history.hypothesisLabel")}</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {HYPOTHESIS_AREAS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => setHypothesisArea(area)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                hypothesisArea === area
                  ? "border-sky-500 bg-sky-500/20 text-sky-300"
                  : "border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300"
              }`}
            >
              {t("kpi.main.areas." + area)}
            </button>
          ))}
        </div>
        <textarea
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder={t("kpi.main.hypothesisPlaceholder")}
          rows={2}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-sky-500 focus:outline-none resize-none"
        />
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors"
        >
          {t("kpi.history.saveEdit")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
        >
          {t("kpi.history.cancel")}
        </button>
      </div>
    </div>
  );
}

// ─── Outcome form ─────────────────────────────────────────────────────────────

function OutcomeForm({ entry, onSave, onCancel }: { entry: KpiEntry; onSave: (outcome: KpiEntry["outcome"], learning: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [outcome, setOutcome] = useState<KpiEntry["outcome"]>(entry.outcome ?? "confirmed");
  const [learning, setLearning] = useState(entry.learning ?? "");
  const OUTCOME_KEYS = ["confirmed", "refuted", "inconclusive"] as const;

  return (
    <div className="mt-3 space-y-3 border-t border-gray-700/50 pt-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{t("kpi.history.outcomeTitle")}</p>
      <div className="flex gap-2 flex-wrap">
        {OUTCOME_KEYS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setOutcome(opt)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              outcome === opt ? OUTCOME_STYLES[opt].bg + " " + OUTCOME_STYLES[opt].text : "border-gray-600 text-gray-500 hover:text-gray-300"
            }`}
          >
            {t("kpi.history.outcomes." + opt)}
          </button>
        ))}
      </div>
      <textarea
        value={learning}
        onChange={(e) => setLearning(e.target.value)}
        placeholder={t("kpi.history.learningPlaceholder")}
        rows={2}
        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-sky-500 focus:outline-none resize-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(outcome, learning)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          {t("kpi.history.saveOutcome")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
        >
          {t("kpi.history.cancel")}
        </button>
      </div>
    </div>
  );
}

// ─── Main list ────────────────────────────────────────────────────────────────

export default function KpiHistoryList({ entries, readOnly, onUpdateEntry, onDeleteEntry }: Props) {
  const { t } = useI18n();
  const [openOutcomeId, setOpenOutcomeId]           = useState<string | null>(null);
  const [editingId, setEditingId]                   = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId]        = useState<string | null>(null);
  const [expandedHypothesisId, setExpandedHypothesisId] = useState<string | null>(null);

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  function formatDaysAgo(isoDate: string): string {
    const d = new Date(isoDate + "T00:00:00");
    const n = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (n === 0) return t("kpi.history.today");
    if (n === 1) return t("kpi.history.daysAgo1");
    return t("kpi.history.daysAgoN").replace("{count}", String(n));
  }

  function openEdit(id: string) {
    setEditingId(id);
    setOpenOutcomeId(null);
    setConfirmDeleteId(null);
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/60 bg-gray-900/40 px-4 py-6 text-center">
        <p className="text-sm text-gray-500">{t("kpi.history.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((entry) => {
        const isEditing           = editingId === entry.id;
        const isOutcomeOpen       = openOutcomeId === entry.id;
        const isConfirmDelete     = confirmDeleteId === entry.id;
        const isHypothesisExpanded = expandedHypothesisId === entry.id;
        const isPendingOutcome    = !!entry.hypothesis && !entry.outcome;

        return (
          <div
            key={entry.id}
            className={`rounded-xl border bg-gray-900/60 px-4 py-3 ${
              isEditing
                ? "border-sky-700/50"
                : isPendingOutcome
                ? "border-amber-700/50"
                : "border-gray-700/60"
            }`}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-400">{formatDate(entry.date)}</span>
                {isPendingOutcome && !isEditing && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-700/50 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    resultado pendente
                  </span>
                )}
                {!isEditing && (
                  <>
                    <MetricChip label="D1"  value={entry.metrics.d1}  playerCount={entry.metrics.d1Players}  entry={entry} />
                    <MetricChip label="D3"  value={entry.metrics.d3}  playerCount={entry.metrics.d3Players}  entry={entry} />
                    <MetricChip label="D7"  value={entry.metrics.d7}  playerCount={entry.metrics.d7Players}  entry={entry} />
                    <MetricChip label="D14" value={entry.metrics.d14} playerCount={entry.metrics.d14Players} entry={entry} />
                    <MetricChip label="D30" value={entry.metrics.d30} playerCount={entry.metrics.d30Players} entry={entry} />
                  </>
                )}
                {isEditing && (
                  <span className="text-xs font-medium text-sky-400">{t("kpi.history.editTitle")}</span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!readOnly && !isConfirmDelete && !isEditing && (
                  <>
                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => openEdit(entry.id)}
                      className="rounded p-1 text-gray-600 hover:text-sky-400 transition-colors"
                      title={t("kpi.history.editEntry")}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(entry.id)}
                      className="rounded p-1 text-gray-600 hover:text-rose-400 transition-colors"
                      title={t("kpi.history.delete")}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}

                {isConfirmDelete && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { onDeleteEntry(entry.id); setConfirmDeleteId(null); }}
                      className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      {t("kpi.history.delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                    >
                      {t("kpi.history.cancel")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Edit form */}
            {isEditing && (
              <EditEntryForm
                entry={entry}
                onSave={(patch) => {
                  onUpdateEntry(entry.id, patch);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            )}

            {/* Hypothesis (read mode) */}
            {!isEditing && entry.hypothesis && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-1">{t("kpi.history.hypothesisLabel")}</p>
                <p className={`text-sm text-gray-300 ${isHypothesisExpanded ? "" : "line-clamp-2"}`}>
                  {entry.hypothesis}
                </p>
                {entry.hypothesis.length > 120 && (
                  <button
                    type="button"
                    onClick={() => setExpandedHypothesisId(isHypothesisExpanded ? null : entry.id)}
                    className="mt-0.5 text-xs text-sky-500 hover:text-sky-300 transition-colors"
                  >
                    {isHypothesisExpanded ? "ver menos ↑" : "ver mais ↓"}
                  </button>
                )}
              </div>
            )}

            {/* Outcome / learning (read mode) */}
            {!isEditing && (
              entry.outcome ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${OUTCOME_STYLES[entry.outcome].bg} ${OUTCOME_STYLES[entry.outcome].text}`}>
                    {t("kpi.history.outcomes." + entry.outcome)}
                  </span>
                  {entry.learning && (
                    <p className="text-xs text-gray-400 line-clamp-1">{entry.learning}</p>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setOpenOutcomeId(isOutcomeOpen ? null : entry.id)}
                      className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      {t("kpi.history.editOutcome")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-1.5">
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => setOpenOutcomeId(isOutcomeOpen ? null : entry.id)}
                        className="self-start rounded-lg border border-dashed border-amber-700/60 px-3 py-1.5 text-xs font-medium text-amber-500 hover:border-amber-500 hover:text-amber-300 transition-colors"
                      >
                        {t("kpi.history.recordOutcome")}
                      </button>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                        {t("kpi.history.outcomeHint")}
                      </p>
                    </>
                  )}
                </div>
              )
            )}

            {/* Outcome form */}
            {!isEditing && isOutcomeOpen && (
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
