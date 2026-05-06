"use client";

import { useState } from "react";
import type { GameGenre, KpiGameProfile, KpiCustomBenchmarks, MonetizationType, LoopType } from "@/lib/kpi/types";
import type { GenreBenchmark } from "@/lib/kpi/benchmarks";
import { GENRE_BENCHMARKS } from "@/lib/kpi/benchmarks";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  genre: GameGenre;
  profile?: KpiGameProfile;
  customBenchmarks?: KpiCustomBenchmarks;
  onSetGenre: (genre: GameGenre) => void;
  onUpdateProfile: (profile: KpiGameProfile) => void;
  onUpdateCustomBenchmarks: (b: KpiCustomBenchmarks) => void;
}

const GENRE_IDS: { id: GameGenre; emoji: string }[] = [
  { id: "farm",    emoji: "🌾" },
  { id: "casual",  emoji: "🎮" },
  { id: "rpg",     emoji: "⚔️" },
  { id: "puzzle",  emoji: "🧩" },
  { id: "idle",    emoji: "⏱" },
  { id: "shooter", emoji: "🎯" },
];

const MONETIZATION_IDS: MonetizationType[] = ["iap", "ads", "iap_ads", "premium", "none"];
const LOOP_TYPE_IDS: LoopType[] = ["levels", "sandbox", "pvp", "progression"];

const DEFAULT_PROFILE: KpiGameProfile = {
  hasTutorial: true,
  monetization: "iap",
  loopType: "levels",
};

function BenchmarkField({
  label, unit, defaultValue, customValue, onChange, goalLabel, minLabel, resetLabel,
}: {
  label: string;
  unit: string;
  defaultValue: { good: number; ok: number };
  customValue?: { good: number; ok: number };
  onChange: (v: { good: number; ok: number } | undefined) => void;
  goalLabel: string;
  minLabel: string;
  resetLabel: string;
}) {
  const isCustom = !!customValue;
  const current = customValue ?? defaultValue;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        {isCustom && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[10px] text-gray-600 hover:text-rose-400 transition-colors"
          >
            {resetLabel}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 flex-1">
          <span className="text-[10px] text-gray-600">{goalLabel}</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={current.good}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange({ good: v, ok: current.ok });
            }}
            className="w-full rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <span className="text-[10px] text-gray-600">{minLabel}</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={current.ok}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange({ good: current.good, ok: v });
            }}
            className="w-full rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none tabular-nums"
          />
        </div>
        <span className="text-xs text-gray-600 pt-4">{unit}</span>
      </div>
    </div>
  );
}

export default function KpiConfigPanel({
  genre, profile, customBenchmarks,
  onSetGenre, onUpdateProfile, onUpdateCustomBenchmarks,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(!profile); // open by default until first config
  const [benchOpen, setBenchOpen] = useState(false);

  const p = profile ?? DEFAULT_PROFILE;
  const baseBench = GENRE_BENCHMARKS[genre];

  function summarize(): string {
    const g = t("kpi.config.genres." + genre);
    if (!profile) return g;
    const m = t("kpi.config.monetization." + profile.monetization);
    const l = t("kpi.config.loop." + profile.loopType);
    const tutLabel = profile.hasTutorial ? t("kpi.config.hasTutorial") : t("kpi.config.noTutorial");
    return `${g} · ${m} · ${tutLabel} · ${l}`;
  }

  function patchProfile(patch: Partial<KpiGameProfile>) {
    onUpdateProfile({ ...p, ...patch });
  }

  function patchBenchmark(key: keyof KpiCustomBenchmarks, value: { good: number; ok: number } | undefined) {
    const next = { ...(customBenchmarks ?? {}) };
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onUpdateCustomBenchmarks(next);
  }

  const hasCustom = customBenchmarks && Object.keys(customBenchmarks).length > 0;

  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-semibold text-white">{t("kpi.config.title")}</span>
          {!open && (
            <span className="text-xs text-gray-500 truncate max-w-[260px]">{summarize()}</span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-gray-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-5 border-t border-gray-800/60">

          {/* Gênero */}
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">{t("kpi.config.genreSection")}</p>
            <div className="flex flex-wrap gap-2">
              {GENRE_IDS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSetGenre(g.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    genre === g.id
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                      : "border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
                  }`}
                >
                  <span>{g.emoji}</span>
                  {t("kpi.config.genres." + g.id)}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-600">{t("kpi.config.genreLabels." + genre)}</p>
          </div>

          {/* Tutorial */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">{t("kpi.config.tutorialSection")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => patchProfile({ hasTutorial: true })}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  p.hasTutorial
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                    : "border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
                }`}
              >
                {t("kpi.config.hasTutorial")}
              </button>
              <button
                type="button"
                onClick={() => patchProfile({ hasTutorial: false })}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  !p.hasTutorial
                    ? "border-amber-500 bg-amber-500/20 text-amber-300"
                    : "border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
                }`}
              >
                {t("kpi.config.noTutorial")}
              </button>
            </div>
          </div>

          {/* Monetização */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">{t("kpi.config.monetizationSection")}</p>
            <div className="flex flex-wrap gap-2">
              {MONETIZATION_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patchProfile({ monetization: id })}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    p.monetization === id
                      ? "border-sky-500 bg-sky-500/20 text-sky-300"
                      : "border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
                  }`}
                >
                  {t("kpi.config.monetization." + id)}
                </button>
              ))}
            </div>
          </div>

          {/* Loop */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">{t("kpi.config.loopSection")}</p>
            <div className="flex flex-wrap gap-2">
              {LOOP_TYPE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patchProfile({ loopType: id })}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    p.loopType === id
                      ? "border-violet-500 bg-violet-500/20 text-violet-300"
                      : "border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200"
                  }`}
                >
                  {t("kpi.config.loop." + id)}
                </button>
              ))}
            </div>
          </div>

          {/* Benchmarks avançados */}
          <div className="rounded-xl border border-gray-700/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setBenchOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-800/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400">{t("kpi.config.benchmarksTitle")}</span>
                {hasCustom && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    {t("kpi.config.benchmarksCustomized")}
                  </span>
                )}
              </div>
              <svg
                className={`h-3.5 w-3.5 text-gray-600 shrink-0 transition-transform ${benchOpen ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {benchOpen && (
              <div className="px-3 pb-3 border-t border-gray-800/40">
                <p className="py-2 text-xs text-gray-600">
                  {t("kpi.config.benchmarksHint")}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <BenchmarkField label="D1" unit="%" defaultValue={baseBench.d1} customValue={customBenchmarks?.d1} onChange={(v) => patchBenchmark("d1", v)} goalLabel={t("kpi.config.benchmarkGoal")} minLabel={t("kpi.config.benchmarkMin")} resetLabel={t("kpi.config.benchmarkReset")} />
                  <BenchmarkField label="D7" unit="%" defaultValue={baseBench.d7} customValue={customBenchmarks?.d7} onChange={(v) => patchBenchmark("d7", v)} goalLabel={t("kpi.config.benchmarkGoal")} minLabel={t("kpi.config.benchmarkMin")} resetLabel={t("kpi.config.benchmarkReset")} />
                  <BenchmarkField label="D30" unit="%" defaultValue={baseBench.d30} customValue={customBenchmarks?.d30} onChange={(v) => patchBenchmark("d30", v)} goalLabel={t("kpi.config.benchmarkGoal")} minLabel={t("kpi.config.benchmarkMin")} resetLabel={t("kpi.config.benchmarkReset")} />
                  <BenchmarkField label={t("kpi.metrics.sessionsLabel")} unit="x" defaultValue={baseBench.sessionsPerDay} customValue={customBenchmarks?.sessionsPerDay} onChange={(v) => patchBenchmark("sessionsPerDay", v)} goalLabel={t("kpi.config.benchmarkGoal")} minLabel={t("kpi.config.benchmarkMin")} resetLabel={t("kpi.config.benchmarkReset")} />
                  <BenchmarkField label={t("kpi.metrics.durationLabel")} unit="min" defaultValue={baseBench.sessionDuration} customValue={customBenchmarks?.sessionDuration} onChange={(v) => patchBenchmark("sessionDuration", v)} goalLabel={t("kpi.config.benchmarkGoal")} minLabel={t("kpi.config.benchmarkMin")} resetLabel={t("kpi.config.benchmarkReset")} />
                  <BenchmarkField label={t("kpi.metrics.conversionLabel")} unit="%" defaultValue={baseBench.conversionRate} customValue={customBenchmarks?.conversionRate} onChange={(v) => patchBenchmark("conversionRate", v)} goalLabel={t("kpi.config.benchmarkGoal")} minLabel={t("kpi.config.benchmarkMin")} resetLabel={t("kpi.config.benchmarkReset")} />
                </div>
                {hasCustom && (
                  <button
                    type="button"
                    onClick={() => onUpdateCustomBenchmarks({})}
                    className="mt-3 text-xs text-gray-600 hover:text-rose-400 transition-colors"
                  >
                    {t("kpi.config.benchmarkResetAll")}
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
