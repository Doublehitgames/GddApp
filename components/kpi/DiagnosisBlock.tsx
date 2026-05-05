"use client";

import { useState } from "react";
import type { Diagnosis } from "@/lib/kpi/benchmarks";

interface Props {
  diagnosis: Diagnosis | null;
}

const PRIORITY_STYLES = {
  great:    { card: "border-emerald-700/60 bg-emerald-950/40", icon: "text-emerald-400", iconBg: "bg-emerald-500/20", iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  warning:  { card: "border-amber-700/60 bg-amber-950/40",     icon: "text-amber-400",   iconBg: "bg-amber-500/20",   iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  critical: { card: "border-rose-700/60 bg-rose-950/40",       icon: "text-rose-400",    iconBg: "bg-rose-500/20",    iconPath: "M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" },
};

export default function DiagnosisBlock({ diagnosis }: Props) {
  const [tipsOpen, setTipsOpen] = useState(false);

  if (!diagnosis) {
    return (
      <div className="rounded-xl border border-gray-700/60 bg-gray-900/40 px-4 py-5 text-center">
        <p className="text-sm text-gray-500">Preencha D1, D7 ou D30 acima para ver o diagnóstico.</p>
      </div>
    );
  }

  const styles = PRIORITY_STYLES[diagnosis.priority];

  return (
    <div className={`rounded-xl border px-4 py-4 ${styles.card}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${styles.iconBg}`}>
          <svg className={`h-4 w-4 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={styles.iconPath} />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-white text-base leading-tight">{diagnosis.headline}</p>
          <p className="text-sm text-gray-300 mt-0.5">{diagnosis.detail}</p>
        </div>
      </div>

      {/* Ratios */}
      {(diagnosis.ratioD7D1 !== undefined || diagnosis.ratioD30D7 !== undefined) && (
        <div className="mt-3 flex flex-wrap gap-3 border-t border-gray-700/50 pt-3">
          {diagnosis.ratioD7D1 !== undefined && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Ratio D7/D1</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">{diagnosis.ratioD7D1.toFixed(2)}</span>
                <div className="h-1.5 w-20 rounded-full bg-gray-800">
                  <div
                    className={`h-full rounded-full ${diagnosis.ratioD7D1 >= 0.5 ? "bg-emerald-500" : diagnosis.ratioD7D1 >= 0.35 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.min(diagnosis.ratioD7D1 * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-600">ideal ≥ 0.5</span>
              </div>
            </div>
          )}
          {diagnosis.ratioD30D7 !== undefined && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Ratio D30/D7</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">{diagnosis.ratioD30D7.toFixed(2)}</span>
                <div className="h-1.5 w-20 rounded-full bg-gray-800">
                  <div
                    className={`h-full rounded-full ${diagnosis.ratioD30D7 >= 0.5 ? "bg-emerald-500" : diagnosis.ratioD30D7 >= 0.35 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.min(diagnosis.ratioD30D7 * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-600">ideal ≥ 0.5</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      {diagnosis.tips.length > 0 && (
        <div className="mt-3 border-t border-gray-700/50 pt-3">
          <button
            type="button"
            onClick={() => setTipsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span>O que fazer</span>
            <svg
              className={`h-3.5 w-3.5 transition-transform ${tipsOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {tipsOpen && (
            <ul className="mt-2 space-y-1.5">
              {diagnosis.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-500" />
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
