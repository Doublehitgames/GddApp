"use client";

import { useState } from "react";
import type { KpiMetrics } from "@/lib/kpi/types";
import type { GenreBenchmark } from "@/lib/kpi/benchmarks";

interface Props {
  metrics: KpiMetrics;
  benchmark: GenreBenchmark;
}

const DAYS = ["D1", "D7", "D30"];

export default function RetentionChart({ metrics, benchmark }: Props) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: string } | null>(null);

  const userValues = [metrics.d1, metrics.d7, metrics.d30];
  const benchValues = [benchmark.d1.good, benchmark.d7.good, benchmark.d30.good];

  const hasUserData = userValues.some((v) => v !== undefined);

  const maxVal = Math.max(
    ...benchValues,
    ...userValues.filter((v): v is number => v !== undefined),
    10
  );

  const PAD_LEFT = 36;
  const PAD_RIGHT = 12;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 28;
  const W = 300;
  const H = 160;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  function toX(i: number) {
    return PAD_LEFT + (i / (DAYS.length - 1)) * chartW;
  }
  function toY(val: number) {
    return PAD_TOP + chartH - (val / maxVal) * chartH;
  }

  function benchPath() {
    return benchValues.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(v)}`).join(" ");
  }

  function userPath() {
    const defined = userValues.map((v, i) => ({ v, i })).filter(({ v }) => v !== undefined);
    if (defined.length < 2) return null;
    return defined.map(({ v, i }, idx) => `${idx === 0 ? "M" : "L"}${toX(i)},${toY(v!)}`).join(" ");
  }

  const yTicks = [0, Math.round(maxVal * 0.5), Math.round(maxVal)];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 180 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y axis ticks */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              y1={toY(tick)}
              x2={W - PAD_RIGHT}
              y2={toY(tick)}
              stroke="#374151"
              strokeWidth={0.5}
              strokeDasharray="2,3"
            />
            <text
              x={PAD_LEFT - 4}
              y={toY(tick) + 3}
              textAnchor="end"
              fill="#6b7280"
              fontSize={8}
            >
              {tick}%
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {DAYS.map((day, i) => (
          <text
            key={day}
            x={toX(i)}
            y={H - 6}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={9}
          >
            {day}
          </text>
        ))}

        {/* Benchmark line — dashed green */}
        <path
          d={benchPath()}
          fill="none"
          stroke="#10b981"
          strokeWidth={1.5}
          strokeDasharray="4,3"
          opacity={0.7}
        />

        {/* User line — solid sky */}
        {hasUserData && userPath() && (
          <path
            d={userPath()!}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth={2}
          />
        )}

        {/* Benchmark dots */}
        {benchValues.map((v, i) => (
          <circle
            key={`bench-${i}`}
            cx={toX(i)}
            cy={toY(v)}
            r={3}
            fill="#10b981"
            opacity={0.7}
            className="cursor-pointer"
            onMouseEnter={() =>
              setTooltip({ x: toX(i), y: toY(v), label: `Benchmark ${DAYS[i]}`, value: `${v}%` })
            }
          />
        ))}

        {/* User dots */}
        {userValues.map((v, i) => {
          if (v === undefined) return null;
          return (
            <circle
              key={`user-${i}`}
              cx={toX(i)}
              cy={toY(v)}
              r={4}
              fill="#0ea5e9"
              className="cursor-pointer"
              onMouseEnter={() =>
                setTooltip({ x: toX(i), y: toY(v), label: `Seu jogo ${DAYS[i]}`, value: `${v}%` })
              }
            />
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 40, W - PAD_RIGHT - 80)}
              y={Math.max(tooltip.y - 30, PAD_TOP)}
              width={80}
              height={22}
              rx={4}
              fill="#1f2937"
              stroke="#374151"
              strokeWidth={0.5}
            />
            <text
              x={Math.min(tooltip.x - 40, W - PAD_RIGHT - 80) + 40}
              y={Math.max(tooltip.y - 30, PAD_TOP) + 9}
              textAnchor="middle"
              fill="#e5e7eb"
              fontSize={7.5}
            >
              {tooltip.label}
            </text>
            <text
              x={Math.min(tooltip.x - 40, W - PAD_RIGHT - 80) + 40}
              y={Math.max(tooltip.y - 30, PAD_TOP) + 18}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={9}
              fontWeight="bold"
            >
              {tooltip.value}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-1 flex items-center justify-center gap-5 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-5 rounded-full bg-emerald-500 opacity-70" style={{ backgroundImage: "repeating-linear-gradient(90deg, #10b981 0, #10b981 4px, transparent 4px, transparent 7px)" }} />
          Benchmark
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-5 rounded-full bg-sky-500" />
          Seu jogo
        </span>
      </div>
    </div>
  );
}
