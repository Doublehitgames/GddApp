"use client";

import { useState, useMemo } from "react";
import type { GameGenre, KpiEntry, KpiMetrics, KpiGameProfile, KpiCustomBenchmarks, KpiProjectConfig } from "@/lib/kpi/types";
import { GENRE_BENCHMARKS, diagnose } from "@/lib/kpi/benchmarks";
import type { GenreBenchmark } from "@/lib/kpi/benchmarks";
import MetricInputBar from "./MetricInputBar";
import DiagnosisBlock from "./DiagnosisBlock";
import RetentionChart from "./RetentionChart";
import KpiHistoryList from "./KpiHistoryList";
import KpiConfigPanel from "./KpiConfigPanel";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  projectId: string;
  genre: GameGenre;
  profile?: KpiGameProfile;
  customBenchmarks?: KpiCustomBenchmarks;
  entries: KpiEntry[];
  onSetGenre: (genre: GameGenre) => void;
  onUpdateConfig: (patch: Partial<Omit<KpiProjectConfig, "genre">>) => void;
  onAddEntry: (entry: Omit<KpiEntry, "id" | "createdAt">) => string;
  onUpdateEntry: (id: string, patch: Partial<Pick<KpiEntry, "hypothesis" | "hypothesisArea" | "outcome" | "learning" | "metrics">>) => void;
  onDeleteEntry: (id: string) => void;
}

const HYPOTHESIS_AREA_IDS: KpiEntry["hypothesisArea"][] = ["tutorial", "loop", "midgame", "monetization", "other"];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function effectiveBench(base: GenreBenchmark, custom?: KpiCustomBenchmarks): GenreBenchmark {
  if (!custom) return base;
  return {
    ...base,
    d1: custom.d1 ?? base.d1,
    d3: custom.d3 ?? base.d3,
    d7: custom.d7 ?? base.d7,
    d14: custom.d14 ?? base.d14,
    d30: custom.d30 ?? base.d30,
    sessionsPerDay: custom.sessionsPerDay ?? base.sessionsPerDay,
    sessionDuration: custom.sessionDuration ?? base.sessionDuration,
    conversionRate: custom.conversionRate ?? base.conversionRate,
  };
}

export default function KpiMainTab({
  projectId, genre, profile, customBenchmarks, entries,
  onSetGenre, onUpdateConfig, onAddEntry, onUpdateEntry, onDeleteEntry,
}: Props) {
  const { t } = useI18n();
  const bench = effectiveBench(GENRE_BENCHMARKS[genre], customBenchmarks);

  // Form starts open only when there's no history yet
  const [formOpen, setFormOpen] = useState(entries.length === 0);

  const [date, setDate] = useState(todayISO);
  const [d1, setD1] = useState<number | undefined>(undefined);
  const [d1Players, setD1Players] = useState<number | undefined>(undefined);
  const [d3, setD3] = useState<number | undefined>(undefined);
  const [d3Players, setD3Players] = useState<number | undefined>(undefined);
  const [d7, setD7] = useState<number | undefined>(undefined);
  const [d7Players, setD7Players] = useState<number | undefined>(undefined);
  const [d14, setD14] = useState<number | undefined>(undefined);
  const [d14Players, setD14Players] = useState<number | undefined>(undefined);
  const [d30, setD30] = useState<number | undefined>(undefined);
  const [d30Players, setD30Players] = useState<number | undefined>(undefined);
  const [sessionsPerDay, setSessionsPerDay] = useState<number | undefined>(undefined);
  const [sessionDuration, setSessionDuration] = useState<number | undefined>(undefined);
  const [conversionRate, setConversionRate] = useState<number | undefined>(undefined);
  const [hypothesis, setHypothesis] = useState("");
  const [hypothesisArea, setHypothesisArea] = useState<KpiEntry["hypothesisArea"]>("tutorial");
  const [saved, setSaved] = useState(false);

  const currentMetrics: KpiMetrics = {
    d1, d1Players,
    d3, d3Players,
    d7, d7Players,
    d14, d14Players,
    d30, d30Players,
    sessionsPerDay, sessionDuration, conversionRate,
  };
  const diagnosis = useMemo(
    () => diagnose(currentMetrics, genre, profile),
    [d1, d3, d7, d14, d30, conversionRate, genre, profile]
  );

  const showConversion =
    !profile ||
    profile.monetization === "iap" ||
    profile.monetization === "iap_ads";

  function handleSave() {
    const entry: Omit<KpiEntry, "id" | "createdAt"> = {
      projectId,
      date,
      genre,
      metrics: currentMetrics,
      hypothesis: hypothesis.trim() || undefined,
      hypothesisArea: hypothesis.trim() ? hypothesisArea : undefined,
    };
    onAddEntry(entry);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setD1(undefined); setD1Players(undefined);
    setD3(undefined); setD3Players(undefined);
    setD7(undefined); setD7Players(undefined);
    setD14(undefined); setD14Players(undefined);
    setD30(undefined); setD30Players(undefined);
    setSessionsPerDay(undefined);
    setSessionDuration(undefined);
    setConversionRate(undefined);
    setHypothesis("");
    setDate(todayISO());
    setFormOpen(false);
  }

  const hasData = d1 !== undefined || d3 !== undefined || d7 !== undefined || d14 !== undefined || d30 !== undefined;

  return (
    <div className="space-y-4">
      {/* Config panel */}
      <KpiConfigPanel
        genre={genre}
        profile={profile}
        customBenchmarks={customBenchmarks}
        onSetGenre={onSetGenre}
        onUpdateProfile={(p) => onUpdateConfig({ profile: p })}
        onUpdateCustomBenchmarks={(b) => onUpdateConfig({ customBenchmarks: b })}
      />

      {/* ── Toggle button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setFormOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
          formOpen
            ? "border-emerald-600/60 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/40"
            : "border-dashed border-emerald-700/50 bg-emerald-950/10 text-emerald-400 hover:border-emerald-500/70 hover:bg-emerald-950/20"
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {formOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            }
          </svg>
          {formOpen ? t("kpi.main.hideForm") : t("kpi.main.newEntry")}
        </span>
        {!formOpen && (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
            {t("kpi.main.newEntryHint")}
          </span>
        )}
      </button>

      {/* ── Entry form (collapsible) ───────────────────────────────────────── */}
      {formOpen && (
        <div className="rounded-xl border border-emerald-700/30 bg-gray-900/60 p-4 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">{t("kpi.main.newEntry")}</p>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-gray-300 focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <MetricInputBar
              label={t("kpi.metrics.d1Label")}
              value={d1} onChange={setD1}
              benchmark={bench.d1} unit="%"
              helpText={t("kpi.metrics.d1Help")}
              playerCount={d1Players} onPlayerCountChange={setD1Players}
            />
            <MetricInputBar
              label={t("kpi.metrics.d3Label")}
              value={d3} onChange={setD3}
              benchmark={bench.d3} unit="%"
              helpText={t("kpi.metrics.d3Help")}
              playerCount={d3Players} onPlayerCountChange={setD3Players}
            />
            <MetricInputBar
              label={t("kpi.metrics.d7Label")}
              value={d7} onChange={setD7}
              benchmark={bench.d7} unit="%"
              helpText={t("kpi.metrics.d7Help")}
              playerCount={d7Players} onPlayerCountChange={setD7Players}
            />
            <MetricInputBar
              label={t("kpi.metrics.d14Label")}
              value={d14} onChange={setD14}
              benchmark={bench.d14} unit="%"
              helpText={t("kpi.metrics.d14Help")}
              playerCount={d14Players} onPlayerCountChange={setD14Players}
            />
            <MetricInputBar
              label={t("kpi.metrics.d30Label")}
              value={d30} onChange={setD30}
              benchmark={bench.d30} unit="%"
              helpText={t("kpi.metrics.d30Help")}
              playerCount={d30Players} onPlayerCountChange={setD30Players}
            />
            <MetricInputBar
              label={t("kpi.metrics.sessionsLabel")}
              value={sessionsPerDay} onChange={setSessionsPerDay}
              benchmark={bench.sessionsPerDay} unit="x"
              helpText={t("kpi.metrics.sessionsHelp")}
            />
            <MetricInputBar
              label={t("kpi.metrics.durationLabel")}
              value={sessionDuration} onChange={setSessionDuration}
              benchmark={bench.sessionDuration} unit="min"
              helpText={t("kpi.metrics.durationHelp")}
            />
            {showConversion && (
              <MetricInputBar
                label={t("kpi.metrics.conversionLabel")}
                value={conversionRate} onChange={setConversionRate}
                benchmark={bench.conversionRate} unit="%"
                helpText={t("kpi.metrics.conversionHelp")}
              />
            )}
          </div>

          {/* Diagnosis */}
          {hasData && <DiagnosisBlock diagnosis={diagnosis} />}

          {/* Retention chart */}
          {hasData && (
            <div className="rounded-xl border border-gray-700/40 bg-gray-950/50 p-3">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-widest">{t("kpi.main.retentionChart")}</p>
              <RetentionChart metrics={currentMetrics} benchmark={bench} />
            </div>
          )}

          {/* Hypothesis */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">{t("kpi.main.hypothesisTitle")}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {HYPOTHESIS_AREA_IDS.map((areaId) => (
                <button
                  key={areaId}
                  type="button"
                  onClick={() => setHypothesisArea(areaId)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    hypothesisArea === areaId
                      ? "border-sky-500 bg-sky-500/20 text-sky-300"
                      : "border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300"
                  }`}
                >
                  {t("kpi.main.areas." + areaId)}
                </button>
              ))}
            </div>
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder={t("kpi.main.hypothesisPlaceholder")}
              rows={3}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-sky-500 focus:outline-none resize-none"
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasData}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t("kpi.main.save")}
            </button>
            {saved && <span className="text-sm text-emerald-400">{t("kpi.main.saved")}</span>}
          </div>
        </div>
      )}

      {/* ── History ───────────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t("kpi.main.historyTitle")}</p>
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-500">
              {entries.length}
            </span>
          </div>
          <KpiHistoryList
            entries={entries}
            onUpdateEntry={onUpdateEntry}
            onDeleteEntry={onDeleteEntry}
          />
        </div>
      )}
    </div>
  );
}
