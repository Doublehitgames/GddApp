"use client";

import { useMemo } from "react";

interface MiniLineChartProps {
  values: number[];
  startLevel: number;
  /** Explicit height in px. If omitted, chart fills its container (use with h-full parent). */
  height?: number;
  /** Tailwind stroke class for the line */
  strokeClass?: string;
  /** Tailwind fill class for the area under the line */
  fillClass?: string;
}

/**
 * Lightweight SVG line chart for progression table values.
 *
 * Uses preserveAspectRatio="xMidYMid meet" so text isn't stretched.
 * Shows intermediate tick labels on both axes.
 */
export function MiniLineChart({
  values,
  startLevel,
  height,
  strokeClass = "stroke-emerald-400",
  fillClass = "fill-emerald-400/10",
}: MiniLineChartProps) {
  const chart = useMemo(() => {
    if (values.length < 2) return null;

    // ViewBox aspect ratio matches typical container (wide + tall)
    const vbWidth = 600;
    const vbHeight = 380;
    const padLeft = 56;
    const padRight = 16;
    const padTop = 14;
    const padBottom = 26;

    const plotW = vbWidth - padLeft - padRight;
    const plotH = vbHeight - padTop - padBottom;

    const minY = Math.min(...values);
    const maxY = Math.max(...values);

    // If all values are negative, plot magnitude so curve reads upward = bigger effect
    const allNegative = maxY <= 0 && minY < 0;
    const plotValues = allNegative ? values.map((v) => -v) : values;
    const plotMin = Math.min(...plotValues);
    const plotMax = Math.max(...plotValues);
    const rangeY = Math.max(1e-9, plotMax - plotMin);

    const n = values.length;
    const xStep = plotW / (n - 1);
    const endLevel = startLevel + n - 1;

    const points = plotValues.map((pv, i) => {
      const x = padLeft + i * xStep;
      const y = padTop + plotH - ((pv - plotMin) / rangeY) * plotH;
      return { x, y, v: values[i], level: startLevel + i };
    });

    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    const areaD = `${pathD} L${points[points.length - 1].x.toFixed(2)},${(padTop + plotH).toFixed(2)} L${points[0].x.toFixed(2)},${(padTop + plotH).toFixed(2)} Z`;

    const peakIdx = allNegative ? values.indexOf(minY) : values.indexOf(maxY);
    const troughIdx = allNegative ? values.indexOf(maxY) : values.indexOf(minY);
    const topLabel = allNegative ? minY : maxY;
    const bottomLabel = allNegative ? maxY : minY;

    // X-axis ticks: pick 4-5 nicely spaced levels (including start/end)
    const xTicks = pickTicks(startLevel, endLevel, 5);
    const xTickPositions = xTicks.map((level) => {
      const idx = level - startLevel;
      return { level, x: padLeft + idx * xStep };
    });

    // Y-axis ticks: pick 4-5 intermediate values between top and bottom label
    const yTickCount = 4;
    const yTicks: Array<{ value: number; y: number }> = [];
    for (let i = 0; i <= yTickCount; i++) {
      const t = i / yTickCount;
      const plotVal = plotMax - t * rangeY;
      const actualVal = allNegative ? -plotVal : plotVal;
      const y = padTop + t * plotH;
      yTicks.push({ value: actualVal, y });
    }

    return {
      vbWidth,
      vbHeight,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      pathD,
      areaD,
      points,
      topLabel,
      bottomLabel,
      peakIdx,
      troughIdx,
      xTickPositions,
      yTicks,
    };
  }, [values, startLevel]);

  if (!chart) return null;

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 1,
      notation: Math.abs(v) >= 10000 ? "compact" : "standard",
    }).format(v);

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-1 h-full">
      <svg
        viewBox={`0 0 ${chart.vbWidth} ${chart.vbHeight}`}
        preserveAspectRatio="none"
        width="100%"
        height={height ?? "100%"}
        style={{ display: "block" }}
      >
        {/* Horizontal grid lines (one per Y tick) */}
        {chart.yTicks.map((tick, i) => (
          <line
            key={`ygrid-${i}`}
            x1={chart.padLeft}
            x2={chart.vbWidth - chart.padRight}
            y1={tick.y}
            y2={tick.y}
            className="stroke-gray-700"
            strokeWidth={0.5}
            strokeDasharray={i === 0 || i === chart.yTicks.length - 1 ? undefined : "2 3"}
          />
        ))}

        {/* Vertical grid lines at X ticks */}
        {chart.xTickPositions.map((tick, i) => (
          <line
            key={`xgrid-${i}`}
            x1={tick.x}
            x2={tick.x}
            y1={chart.padTop}
            y2={chart.padTop + chart.plotH}
            className="stroke-gray-700/50"
            strokeWidth={0.5}
            strokeDasharray="2 3"
          />
        ))}

        {/* Area under line */}
        <path d={chart.areaD} className={fillClass} />

        {/* Line */}
        <path
          d={chart.pathD}
          fill="none"
          className={strokeClass}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Peak point */}
        {chart.peakIdx >= 0 && (
          <circle
            cx={chart.points[chart.peakIdx].x}
            cy={chart.points[chart.peakIdx].y}
            r={3.5}
            className="fill-emerald-300"
          >
            <title>
              Lv {chart.points[chart.peakIdx].level}: {chart.points[chart.peakIdx].v}
            </title>
          </circle>
        )}

        {/* Trough point */}
        {chart.troughIdx >= 0 && chart.troughIdx !== chart.peakIdx && (
          <circle
            cx={chart.points[chart.troughIdx].x}
            cy={chart.points[chart.troughIdx].y}
            r={3.5}
            className="fill-amber-300"
          >
            <title>
              Lv {chart.points[chart.troughIdx].level}: {chart.points[chart.troughIdx].v}
            </title>
          </circle>
        )}

        {/* Y-axis labels */}
        {chart.yTicks.map((tick, i) => (
          <text
            key={`ylabel-${i}`}
            x={chart.padLeft - 6}
            y={tick.y + 3}
            textAnchor="end"
            className="fill-gray-400"
            fontSize={11}
          >
            {fmt(tick.value)}
          </text>
        ))}

        {/* X-axis labels */}
        {chart.xTickPositions.map((tick, i) => (
          <text
            key={`xlabel-${i}`}
            x={tick.x}
            y={chart.vbHeight - 8}
            textAnchor={i === 0 ? "start" : i === chart.xTickPositions.length - 1 ? "end" : "middle"}
            className="fill-gray-400"
            fontSize={11}
          >
            Lv {tick.level}
          </text>
        ))}
      </svg>
    </div>
  );
}

/**
 * Pick a set of nicely-spaced integer tick positions between start and end (inclusive).
 * Always includes start and end. Returns at most `count` ticks.
 */
function pickTicks(start: number, end: number, count: number): number[] {
  const range = end - start;
  if (range <= 0) return [start];
  if (count <= 2 || range + 1 <= count) {
    // Small range: return every integer
    const out: number[] = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }

  // Find a "nice" step size
  const rawStep = range / (count - 1);
  const step = niceStep(rawStep);

  const ticks: number[] = [start];
  // Start from the first multiple of step >= start+step
  let next = Math.ceil((start + 1) / step) * step;
  while (next < end) {
    if (next > ticks[ticks.length - 1]) ticks.push(next);
    next += step;
  }
  if (end !== ticks[ticks.length - 1]) ticks.push(end);
  return ticks;
}

/**
 * Round step to a "nice" number like 1, 2, 5, 10, 20, 25, 50, 100, etc.
 */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / mag;
  let nice: number;
  if (normalized < 1.5) nice = 1;
  else if (normalized < 3) nice = 2;
  else if (normalized < 7) nice = 5;
  else nice = 10;
  return Math.max(1, nice * mag);
}
