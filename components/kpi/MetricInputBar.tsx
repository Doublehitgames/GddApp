"use client";

import { useState } from "react";
import type { MetricStatus } from "@/lib/kpi/benchmarks";
import { getMetricStatus } from "@/lib/kpi/benchmarks";

interface Props {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  benchmark: { good: number; ok: number };
  unit?: string;
  helpText?: string;
}

const STATUS_COLORS: Record<MetricStatus, { bar: string; text: string; label: string }> = {
  great:    { bar: "bg-emerald-500", text: "text-emerald-400", label: "acima da meta" },
  ok:       { bar: "bg-sky-500",     text: "text-sky-400",     label: "ok" },
  low:      { bar: "bg-amber-500",   text: "text-amber-400",   label: "abaixo" },
  critical: { bar: "bg-rose-500",    text: "text-rose-400",    label: "muito abaixo" },
};

function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 text-gray-500 hover:border-sky-500/60 hover:text-sky-400 transition-colors"
        aria-label="Ajuda"
      >
        <span className="text-[9px] font-bold leading-none select-none">?</span>
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-30 w-56 rounded-xl border border-gray-700 bg-gray-800/95 p-3 text-xs leading-relaxed text-gray-300 shadow-2xl backdrop-blur-sm">
          {text}
          <div className="absolute -top-1.5 right-1.5 h-3 w-3 rotate-45 border-l border-t border-gray-700 bg-gray-800" />
        </div>
      )}
    </div>
  );
}

export default function MetricInputBar({ label, value, onChange, benchmark, unit = "%", helpText }: Props) {
  const status: MetricStatus = value !== undefined ? getMetricStatus(value, benchmark) : "critical";
  const colors = STATUS_COLORS[status];
  const maxBar = Math.max(benchmark.good * 1.5, 100);
  const barWidth = value !== undefined ? Math.min((value / maxBar) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-700/60 bg-gray-900/70 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
        {helpText && <HelpTooltip text={helpText} />}
      </div>

      {/* Input */}
      <div className="flex items-baseline gap-1.5">
        <input
          type="number"
          min={0}
          max={unit === "%" ? 100 : undefined}
          step={0.1}
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(undefined);
            } else {
              const num = parseFloat(raw);
              if (!isNaN(num)) onChange(num);
            }
          }}
          placeholder="—"
          className="w-20 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xl font-mono font-bold text-white focus:border-sky-500 focus:outline-none tabular-nums"
        />
        <span className="text-sm text-gray-500">{unit}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${value !== undefined ? colors.bar : "bg-gray-700/40"}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Status */}
      <div className="flex items-center justify-between gap-1">
        {value !== undefined ? (
          <>
            <span className={`text-xs font-medium ${colors.text}`}>
              {colors.label} {status === "great" ? "↑" : status === "ok" ? "→" : "↓"}
            </span>
            <span className="text-xs text-gray-600 tabular-nums">
              meta ≥ {benchmark.good}{unit}
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-600">não preenchido</span>
        )}
      </div>
    </div>
  );
}
