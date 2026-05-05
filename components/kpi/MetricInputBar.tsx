"use client";

import type { MetricStatus } from "@/lib/kpi/benchmarks";
import { getMetricStatus } from "@/lib/kpi/benchmarks";

interface Props {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  benchmark: { good: number; ok: number };
  unit?: string;
}

const STATUS_COLORS: Record<MetricStatus, { bar: string; text: string; label: string }> = {
  great: { bar: "bg-emerald-500", text: "text-emerald-400", label: "acima da meta" },
  ok:    { bar: "bg-sky-500",     text: "text-sky-400",     label: "ok" },
  low:   { bar: "bg-amber-500",   text: "text-amber-400",   label: "abaixo" },
  critical: { bar: "bg-rose-500", text: "text-rose-400",    label: "muito abaixo" },
};

export default function MetricInputBar({ label, value, onChange, benchmark, unit = "%" }: Props) {
  const status: MetricStatus = value !== undefined ? getMetricStatus(value, benchmark) : "critical";
  const colors = STATUS_COLORS[status];
  const maxBar = Math.max(benchmark.good * 1.5, 100);
  const barWidth = value !== undefined ? Math.min((value / maxBar) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
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
          className="w-20 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xl font-mono font-bold text-white focus:border-sky-500 focus:outline-none tabular-nums"
        />
        <span className="text-gray-500 text-sm">{unit}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${value !== undefined ? colors.bar : "bg-gray-700"}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Status text */}
      <div className="flex items-center justify-between">
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
