"use client";

import { useState, useMemo } from "react";
import type { KpiEntry, GameGenre } from "@/lib/kpi/types";
import { GENRE_BENCHMARKS } from "@/lib/kpi/benchmarks";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  entries: KpiEntry[];
  genre: GameGenre;
}

// ─── Metric definitions ───────────────────────────────────────────────────────

const RETENTION_METRICS = [
  { key: "d1"  as const, playersKey: "d1Players"  as const, label: "D1",  color: "#10b981" },
  { key: "d3"  as const, playersKey: "d3Players"  as const, label: "D3",  color: "#0ea5e9" },
  { key: "d7"  as const, playersKey: "d7Players"  as const, label: "D7",  color: "#8b5cf6" },
  { key: "d14" as const, playersKey: "d14Players" as const, label: "D14", color: "#f59e0b" },
  { key: "d30" as const, playersKey: "d30Players" as const, label: "D30", color: "#f43f5e" },
] as const;

type RetentionKey = typeof RETENTION_METRICS[number]["key"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function buildPath(points: { x: number; y: number | undefined }[]): string {
  let path = "";
  let moved = false;
  for (const p of points) {
    if (p.y === undefined) { moved = false; continue; }
    if (!moved) { path += `M${p.x.toFixed(1)},${p.y.toFixed(1)}`; moved = true; }
    else         { path += ` L${p.x.toFixed(1)},${p.y.toFixed(1)}`; }
  }
  return path;
}

// ─── Trend direction ─────────────────────────────────────────────────────────

type TrendDir = "up" | "stable" | "down";

function calcTrend(values: (number | undefined)[]): TrendDir | undefined {
  const pts = values.map((v, i) => v !== undefined ? { x: i, y: v } : null).filter(Boolean) as { x: number; y: number }[];
  if (pts.length < 2) return undefined;
  const n = pts.length;
  const sumX = pts.reduce((s, p) => s + p.x, 0);
  const sumY = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  if (slope > 1) return "up";
  if (slope < -1) return "down";
  return "stable";
}

const TREND_ICON: Record<TrendDir, string> = { up: "↑", stable: "→", down: "↓" };
const TREND_COLOR: Record<TrendDir, string> = { up: "text-emerald-400", stable: "text-gray-500", down: "text-rose-400" };

// ─── Trend card ───────────────────────────────────────────────────────────────

function TrendCard({ label, color, latest, previous, trend }: {
  label: string; color: string;
  latest: number | undefined;
  previous: number | undefined;
  trend: TrendDir | undefined;
}) {
  const diff = latest !== undefined && previous !== undefined ? latest - previous : undefined;
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-700/60 bg-gray-900/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
        {trend && (
          <span className={`text-sm font-bold leading-none ${TREND_COLOR[trend]}`} title={trend}>
            {TREND_ICON[trend]}
          </span>
        )}
      </div>
      <span className="text-xl font-mono font-bold text-white leading-none">
        {latest !== undefined ? `${latest}%` : "—"}
      </span>
      {diff !== undefined ? (
        <span className={`text-xs font-semibold ${diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-gray-500"}`}>
          {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)} pp
        </span>
      ) : (
        <span className="text-xs text-gray-700">—</span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KpiEvolutionTab({ entries, genre }: Props) {
  const { t } = useI18n();

  const [visible, setVisible] = useState<Set<RetentionKey>>(new Set(["d1", "d7", "d30"]));
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    label: string; value: number; players?: number; date: string; color: string;
  } | null>(null);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [limit, setLimit] = useState(5);

  const LIMIT_OPTIONS = [2, 3, 5, 10] as const;

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)).slice(-limit),
    [entries, limit]
  );

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (sorted.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-700/60 py-16 text-center">
        <svg className="h-8 w-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-gray-400">{t("kpi.evolution.emptyTitle")}</p>
          <p className="text-xs text-gray-600 mt-1">{t("kpi.evolution.emptyHint")}</p>
        </div>
        <div className="mt-1 flex items-center gap-1.5 rounded-full bg-gray-800/60 px-3 py-1.5 text-xs text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
          {sorted.length}/2 {t("kpi.evolution.emptyCount")}
        </div>
      </div>
    );
  }

  // ── Chart math ──────────────────────────────────────────────────────────────

  const n    = sorted.length;
  const W    = 560;
  const H    = 200;
  const PL   = 38;
  const PR   = 16;
  const PT   = 14;
  const PB   = 36;
  const cW   = W - PL - PR;
  const cH   = H - PT - PB;

  const allVals = sorted.flatMap(e =>
    RETENTION_METRICS
      .filter(m => visible.has(m.key))
      .map(m => e.metrics[m.key])
      .filter((v): v is number => v !== undefined)
  );
  const bench = GENRE_BENCHMARKS[genre];
  const benchVals = showBenchmark
    ? RETENTION_METRICS.filter(m => visible.has(m.key)).flatMap(m => [bench[m.key].good])
    : [];
  const maxVal = Math.max(...allVals, ...benchVals, 10);

  function toX(i: number) { return PL + (i / (n - 1)) * cW; }
  function toY(v: number)  { return PT + cH - (v / maxVal) * cH; }

  const yTicks = [0, Math.round(maxVal * 0.5), Math.round(maxVal)];

  function toggleMetric(key: RetentionKey) {
    setVisible(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const last = sorted[n - 1];
  const prev = sorted[n - 2];

  // ── Trend directions ────────────────────────────────────────────────────────

  const trends = useMemo(() =>
    Object.fromEntries(
      RETENTION_METRICS.map(m => [
        m.key,
        calcTrend(sorted.map(e => e.metrics[m.key])),
      ])
    ) as Record<RetentionKey, TrendDir | undefined>,
    [sorted]
  );

  // ── Player count data ───────────────────────────────────────────────────────

  const hasPlayerData = sorted.some(e =>
    RETENTION_METRICS.some(m => e.metrics[m.playersKey] !== undefined)
  );

  return (
    <div className="space-y-5">

      {/* Trend summary cards */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">
          {t("kpi.evolution.trendTitle")}
          <span className="ml-2 normal-case font-normal text-gray-700">
            {shortDate(prev.date)} → {shortDate(last.date)}
          </span>
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {RETENTION_METRICS.map(m => (
            <TrendCard
              key={m.key}
              label={m.label}
              color={m.color}
              latest={last.metrics[m.key]}
              previous={prev.metrics[m.key]}
              trend={trends[m.key]}
            />
          ))}
        </div>
      </div>

      {/* Evolution chart */}
      <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4 space-y-3">
        {/* Chart header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t("kpi.evolution.chartTitle")}</p>
            {/* Limit selector */}
            <div className="flex items-center gap-1">
              {LIMIT_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLimit(n)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    limit === n
                      ? "bg-gray-700 text-gray-200"
                      : "text-gray-600 hover:text-gray-400"
                  }`}
                >
                  {t("kpi.evolution.last")} {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Metric toggles */}
            {RETENTION_METRICS.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleMetric(m.key)}
                className="rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                style={
                  visible.has(m.key)
                    ? { color: m.color, borderColor: m.color + "80", backgroundColor: m.color + "18" }
                    : { color: "#4b5563", borderColor: "#374151" }
                }
              >
                {m.label}
              </button>
            ))}
            {/* Benchmark toggle */}
            <button
              type="button"
              onClick={() => setShowBenchmark(v => !v)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                showBenchmark
                  ? "border-gray-500/50 bg-gray-800/60 text-gray-400"
                  : "border-gray-700 text-gray-600"
              }`}
            >
              {t("kpi.evolution.benchmarkToggle")}
            </button>
          </div>
        </div>

        {/* SVG */}
        <div className="relative" onMouseLeave={() => setTooltip(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>

            {/* Grid lines + Y labels */}
            {yTicks.map(tick => (
              <g key={tick}>
                <line x1={PL} y1={toY(tick)} x2={W - PR} y2={toY(tick)} stroke="#1f2937" strokeWidth={0.8} strokeDasharray="3,3" />
                <text x={PL - 5} y={toY(tick) + 3.5} textAnchor="end" fill="#4b5563" fontSize={8.5}>{tick}%</text>
              </g>
            ))}

            {/* X labels */}
            {sorted.map((e, i) => (
              <text key={e.id} x={toX(i)} y={H - 6} textAnchor="middle" fill="#4b5563" fontSize={8.5}>
                {shortDate(e.date)}
              </text>
            ))}

            {/* Benchmark lines (dashed) */}
            {showBenchmark && RETENTION_METRICS.filter(m => visible.has(m.key)).map(m => {
              const bv = bench[m.key].good;
              return (
                <line
                  key={`bench-${m.key}`}
                  x1={PL} y1={toY(bv)} x2={W - PR} y2={toY(bv)}
                  stroke={m.color} strokeWidth={1} strokeDasharray="4,4" opacity={0.4}
                />
              );
            })}

            {/* Metric lines + dots */}
            {RETENTION_METRICS.filter(m => visible.has(m.key)).map(m => {
              const points = sorted.map((e, i) => ({ x: toX(i), y: e.metrics[m.key] !== undefined ? toY(e.metrics[m.key]!) : undefined }));
              const path = buildPath(points);
              return (
                <g key={m.key}>
                  {path && (
                    <path d={path} fill="none" stroke={m.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  )}
                  {sorted.map((e, i) => {
                    const val = e.metrics[m.key];
                    if (val === undefined) return null;
                    const cx = toX(i);
                    const cy = toY(val);
                    return (
                      <circle
                        key={e.id}
                        cx={cx} cy={cy} r={4}
                        fill={m.color}
                        stroke="#030712" strokeWidth={1.5}
                        className="cursor-pointer"
                        onMouseEnter={() => setTooltip({
                          x: cx, y: cy,
                          label: m.label, value: val,
                          players: e.metrics[m.playersKey],
                          date: e.date, color: m.color,
                        })}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Tooltip */}
            {tooltip && (() => {
              const TW = 130;
              const TH = tooltip.players !== undefined ? 58 : 42;
              const tx = Math.min(Math.max(tooltip.x - TW / 2, PL), W - PR - TW);
              const ty = Math.max(tooltip.y - TH - 10, PT);
              return (
                <g>
                  <rect x={tx} y={ty} width={TW} height={TH} rx={7} fill="#1f2937" stroke="#374151" strokeWidth={1} />
                  <rect x={tx} y={ty} width={4} height={TH} rx={2} fill={tooltip.color} opacity={0.8} />
                  <text x={tx + TW / 2 + 2} y={ty + 14} textAnchor="middle" fill="#9ca3af" fontSize={9}>{shortDate(tooltip.date)}</text>
                  <text x={tx + TW / 2 + 2} y={ty + 30} textAnchor="middle" fill={tooltip.color} fontSize={13} fontWeight="bold">{tooltip.label} {tooltip.value}%</text>
                  {tooltip.players !== undefined && (
                    <>
                      <line x1={tx + 10} y1={ty + 38} x2={tx + TW - 6} y2={ty + 38} stroke="#374151" strokeWidth={0.6} />
                      <text x={tx + TW / 2 + 2} y={ty + 51} textAnchor="middle" fill="#9ca3af" fontSize={9}>{tooltip.players} jogadores</text>
                    </>
                  )}
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-gray-800/60">
          {RETENTION_METRICS.filter(m => visible.has(m.key)).map(m => (
            <span key={m.key} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
              {m.label}
            </span>
          ))}
          {showBenchmark && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-block h-px w-5 border-t border-dashed border-gray-500" />
              {t("kpi.evolution.benchmarkLegend")}
            </span>
          )}
        </div>
      </div>

      {/* Player count table */}
      {hasPlayerData && (
        <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800/60">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t("kpi.evolution.playersTitle")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800/60">
                  <th className="px-4 py-2 text-left font-semibold text-gray-500">{t("kpi.evolution.dateCol")}</th>
                  {RETENTION_METRICS.map(m => (
                    <th key={m.key} className="px-3 py-2 text-center font-semibold" style={{ color: m.color }}>{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.slice().reverse().map(e => {
                  const hasAny = RETENTION_METRICS.some(m => e.metrics[m.playersKey] !== undefined);
                  if (!hasAny) return null;
                  return (
                    <tr key={e.id} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-2 font-mono text-gray-400">{shortDate(e.date)}</td>
                      {RETENTION_METRICS.map(m => {
                        const pct = e.metrics[m.key];
                        const pl  = e.metrics[m.playersKey];
                        return (
                          <td key={m.key} className="px-3 py-2 text-center">
                            {pl !== undefined ? (
                              <span className="flex flex-col items-center gap-0.5">
                                <span className="font-mono text-gray-200">{pl}</span>
                                {pct !== undefined && <span className="text-gray-600">{pct}%</span>}
                              </span>
                            ) : (
                              <span className="text-gray-700">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
