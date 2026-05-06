"use client";

import type { GameGenre } from "@/lib/kpi/types";
import { GENRE_BENCHMARKS } from "@/lib/kpi/benchmarks";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  genre: GameGenre;
}

export default function KpiFunnelTab({ genre }: Props) {
  const { t, tArr } = useI18n();
  const bench = GENRE_BENCHMARKS[genre];
  const d1Tips = tArr("kpi.funnel.tips." + genre + ".d1");
  const d7d30Tips = tArr("kpi.funnel.tips." + genre + ".d7d30");
  const maxValue = 100;
  const genreLabel = t("kpi.config.genreLabels." + genre);

  return (
    <div className="space-y-6">
      {/* Info box */}
      <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-4 py-3">
        <p className="text-sm text-emerald-200 font-medium mb-1">{t("kpi.funnel.howToUseTitle")}</p>
        <p className="text-sm text-emerald-300/80">
          {t("kpi.funnel.howToUseText").replace("{genre}", genreLabel)}
        </p>
      </div>

      {/* Funnel bars */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t("kpi.funnel.typicalFunnel")} — {genreLabel}</p>
        {bench.funnel.map((step) => (
          <div key={step.label} className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-xs text-gray-400 text-right leading-tight">{step.label}</span>
            <div className="flex-1 h-6 rounded-md bg-gray-800 overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${(step.value / maxValue) * 100}%`, backgroundColor: step.color }}
              />
              <span className="absolute inset-y-0 right-2 flex items-center text-xs font-mono font-semibold text-white/80">
                {step.value}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">{t("kpi.funnel.d1CausesTitle")}</p>
          <ul className="space-y-1.5">
            {d1Tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/70" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-rose-700/40 bg-rose-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-400 mb-3">{t("kpi.funnel.d7d30CausesTitle")}</p>
          <ul className="space-y-1.5">
            {d7d30Tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500/70" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
