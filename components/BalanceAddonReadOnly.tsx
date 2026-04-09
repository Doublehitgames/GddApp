"use client";

import { useMemo } from "react";
import { calculateCurveMetrics, generateBalanceCurve, simulateProgressionBySession } from "@/lib/balance/formulaEngine";
import type { BalanceAddonDraft } from "@/lib/balance/types";

interface BalanceAddonReadOnlyProps {
  addon: BalanceAddonDraft;
  compact?: boolean;
  showChart?: boolean;
  maxRows?: number;
  theme?: "dark" | "light";
  layout?: "stack" | "sideBySide";
  showSummary?: boolean;
  showTable?: boolean;
}

export function BalanceAddonReadOnly({
  addon,
  compact = false,
  showChart = true,
  maxRows = 20,
  theme = "dark",
  layout = "stack",
  showSummary = false,
  showTable = true,
}: BalanceAddonReadOnlyProps) {
  const curveState = useMemo(() => {
    try {
      const curve = generateBalanceCurve({
        mode: addon.mode,
        preset: addon.preset,
        expression: addon.expression,
        startLevel: addon.startLevel,
        endLevel: addon.endLevel,
        decimals: addon.decimals,
        clampMin: addon.clampMin,
        clampMax: addon.clampMax,
        params: addon.params,
      });
      return { points: curve.points, error: "" };
    } catch (error) {
      return {
        points: [] as Array<{ level: number; value: number }>,
        error: error instanceof Error ? error.message : "Falha ao calcular curva.",
      };
    }
  }, [addon]);

  const rows = curveState.points.slice(0, Math.max(1, maxRows));
  const isLight = theme === "light";
  const sideBySide = layout === "sideBySide" && showTable;
  const metrics = useMemo(() => calculateCurveMetrics(curveState.points), [curveState.points]);
  const simulationInput = useMemo(
    () =>
      addon.simulationInput || {
        mode: "continuous" as const,
        xpRateMode: "fixed" as const,
        xpPerMinute: 220,
        winRate: 0.72,
        matchDurationMinutes: 8,
        sessionsPerDay: 3,
        bonusMultiplier: 1,
      },
    [addon.simulationInput]
  );
  const simulation = useMemo(() => simulateProgressionBySession(curveState.points, simulationInput), [curveState.points, simulationInput]);

  return (
    <div
      className={`rounded-xl p-3 ${
        isLight ? "border border-gray-300 bg-white" : "border border-cyan-700/40 bg-cyan-950/10"
      }`}
    >
      <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-cyan-200"}`}>
        {addon.name || "Balanceamento XP"}
      </h5>
      {curveState.error ? (
        <p className="mt-2 text-xs text-amber-300">{curveState.error}</p>
      ) : (
        <>
          <div className={sideBySide ? "mt-2 grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-start" : "mt-2 space-y-2"}>
            {showTable && (
              <div
                className={`overflow-auto rounded-lg ${
                  isLight ? "border border-gray-300 bg-white" : "border border-gray-700"
                }`}
              >
                <table className="w-full text-left text-xs">
                  <thead className={isLight ? "bg-gray-100 text-gray-800" : "bg-gray-900 text-gray-300"}>
                    <tr>
                      <th className="px-2 py-1.5">LV</th>
                      <th className="px-2 py-1.5">XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((point) => (
                      <tr
                        key={point.level}
                        className={isLight ? "border-t border-gray-200 text-gray-900" : "border-t border-gray-800 text-gray-200"}
                      >
                        <td className="px-2 py-1">{point.level}</td>
                        <td className="px-2 py-1">{point.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {sideBySide && (showChart || showSummary) && (
              <div className="space-y-3">
                {showChart && curveState.points.length > 1 && (
                  <div>
                    <MiniChart
                      points={curveState.points}
                      compact={compact}
                      theme={theme}
                      simulation={simulation}
                      simulationInput={simulationInput}
                    />
                  </div>
                )}
                {showSummary && (
                  <SummaryBlock
                    isLight={isLight}
                    metrics={metrics}
                    simulation={simulation}
                    simulationInput={simulationInput}
                  />
                )}
              </div>
            )}
            {!sideBySide && showChart && curveState.points.length > 1 && (
              <div>
                <MiniChart
                  points={curveState.points}
                  compact={compact}
                  theme={theme}
                  simulation={simulation}
                  simulationInput={simulationInput}
                />
              </div>
            )}
          </div>
          {showTable && curveState.points.length > rows.length && (
            <p className={`mt-1 text-[11px] ${isLight ? "text-gray-600" : "text-gray-400"}`}>
              Mostrando {rows.length} de {curveState.points.length} niveis.
            </p>
          )}
          {!sideBySide && showSummary && (
            <SummaryBlock
              isLight={isLight}
              metrics={metrics}
              simulation={simulation}
              simulationInput={simulationInput}
            />
          )}
        </>
      )}
    </div>
  );
}

function SummaryBlock({
  isLight,
  metrics,
  simulation,
  simulationInput,
}: {
  isLight: boolean;
  metrics: ReturnType<typeof calculateCurveMetrics>;
  simulation: ReturnType<typeof simulateProgressionBySession>;
  simulationInput: NonNullable<BalanceAddonDraft["simulationInput"]>;
}) {
  const mode = simulationInput.mode || "continuous";
  const sessionsPerDay = Math.max(1, Math.floor(Number(simulationInput.sessionsPerDay || 1)));
  const minutesPerSession = Math.max(0.1, Number(simulationInput.matchDurationMinutes || 1));
  const dailyMinutes = minutesPerSession * sessionsPerDay;
  const bonus = Math.max(0.1, Number(simulationInput.bonusMultiplier || 1));
  const winRatePercent = Math.round(Math.max(0, Math.min(1, Number(simulationInput.winRate || 0.5))) * 100);
  const xpRhythmDetails = buildHumanXpRhythmDetails(simulationInput);

  return (
    <div
      className={`rounded-lg p-3 ${
        isLight ? "border border-gray-300 bg-gray-50 text-gray-800" : "border border-gray-700 bg-gray-900/40 text-gray-200"
      }`}
    >
      <div className={`rounded-lg p-2.5 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/50"}`}>
        <h6 className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-gray-900" : "text-gray-100"}`}>Resumo</h6>
        <div className="mt-2 grid gap-2 md:grid-cols-2 text-xs">
          <p>
            <strong>Subida media por level:</strong> {formatReadableNumber(metrics.averageStep)}
          </p>
          <p>
            <strong>Ritmo medio de crescimento:</strong> {metrics.averageGrowthPercent}%
          </p>
          <p>
            <strong>Total acumulado da faixa:</strong> {formatReadableNumber(metrics.cumulativeValue)}
          </p>
          <p>
            <strong>Risco de friccao:</strong> {metrics.spikeLevels.length > 0 ? `${metrics.spikeLevels.length} picos bruscos` : "Sem picos bruscos relevantes"}
          </p>
        </div>
        <p className="mt-2 text-xs font-medium">Simulacao de progresso (marcos):</p>
        <div className="mt-1 space-y-1 text-xs">
          {simulation.hoursToMilestones.map((milestone) => (
            <p key={milestone.level}>
              Lv {milestone.level}:{" "}
              {mode === "sessionBased" && milestone.calendarDays != null
                ? `${formatCalendarDaysHuman(milestone.calendarDays)} (calendario real) | ${formatHoursHuman(
                    milestone.hours
                  )} de jogo ativo`
                : formatHoursHuman(milestone.hours)}
            </p>
          ))}
        </div>
      </div>

      <div className={`mt-2 rounded-lg p-2.5 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/50"}`}>
        <h6 className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-gray-900" : "text-gray-100"}`}>Contexto da simulacao</h6>
        <div className="mt-1 space-y-1 text-xs">
          {mode === "sessionBased" ? (
            <p>
              Jogadores que jogam em media <strong>{formatMinutesHuman(dailyMinutes)}</strong> por dia ({sessionsPerDay} sessoes/dia de{" "}
              {formatMinutesHuman(minutesPerSession)}).
            </p>
          ) : (
            <p>
              Simulacao continua com partidas de <strong>{formatMinutesHuman(minutesPerSession)}</strong> e progressao em tempo de jogo ativo.
            </p>
          )}
          <p>
            Taxa de vitoria considerada: <strong>{winRatePercent}%</strong>.
          </p>
          <p>
            Bonus aplicado durante o teste: <strong>{bonus === 1 ? "sem bonus (x1)" : `x${bonus.toFixed(2)}`}</strong>.
          </p>
        </div>
      </div>

      <div className={`mt-2 rounded-lg p-2.5 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/50"}`}>
        <h6 className={`text-xs font-semibold uppercase tracking-wide ${isLight ? "text-gray-900" : "text-gray-100"}`}>Ganho de XP</h6>
        <div className="mt-2 space-y-2 text-xs">
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 items-start">
            <p className={`${isLight ? "text-gray-600" : "text-gray-400"}`}>Ritmo:</p>
            <p>
              <strong>
                {simulationInput.xpRateMode === "byLevelRange"
                  ? `variavel por faixas (${(simulationInput.xpRanges || []).length} faixa(s))`
                  : "fixo por minuto"}
              </strong>
              .
            </p>
          </div>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 items-start">
            <p className={`${isLight ? "text-gray-600" : "text-gray-400"}`}>Configuracao:</p>
            <div className="space-y-1">
              {xpRhythmDetails.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 items-start">
            <p className={`${isLight ? "text-gray-600" : "text-gray-400"}`}>Leitura:</p>
            <p className={`${isLight ? "text-gray-600" : "text-gray-400"}`}>
              Use os marcos e o ritmo para validar onboarding (Lv 10/25), midgame (Lv 50) e pacing de longo prazo (Lv 100).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniChart({
  points,
  compact,
  theme,
  simulation,
  simulationInput,
}: {
  points: Array<{ level: number; value: number }>;
  compact: boolean;
  theme: "dark" | "light";
  simulation: ReturnType<typeof simulateProgressionBySession>;
  simulationInput: NonNullable<BalanceAddonDraft["simulationInput"]>;
}) {
  const width = compact ? 520 : 820;
  const height = compact ? 250 : 320;
  const plot = { left: 76, right: 18, top: 22, bottom: 44 };
  const minY = Math.min(...points.map((point) => point.value));
  const maxY = Math.max(...points.map((point) => point.value));
  const yRange = maxY - minY || 1;
  const xRange = Math.max(1, points.length - 1);
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const xTicks = buildIndexTicks(points.length, compact ? 4 : 5);
  const yTicks = buildValueTicks(minY, maxY, compact ? 4 : 5);
  const rangeTiming = buildRangeTimingSegments({
    points,
    minutesPerLevel: simulation.minutesPerLevel,
    mode: simulationInput.mode,
    matchDurationMinutes: simulationInput.matchDurationMinutes,
    sessionsPerDay: simulationInput.sessionsPerDay,
    tickCount: compact ? 4 : 5,
  });

  const path = points
    .map((point, index) => {
      const x = plot.left + (index / xRange) * plotWidth;
      const y = plot.top + (1 - (point.value - minY) / yRange) * plotHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const light = theme === "light";

  return (
    <div
      className={`w-full rounded-lg p-2 ${
        light ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-950/70"
      }`}
    >
      <div
        className={`mb-2 rounded-md px-2 py-1 text-[11px] ${
          light ? "border border-gray-300 bg-gray-50 text-gray-700" : "border border-gray-700 bg-gray-900/70 text-gray-300"
        }`}
      >
        <strong className={light ? "text-gray-900" : "text-gray-100"}>Legenda:</strong> linha azul = XP por level.
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto"
        role="img"
        aria-label="Grafico da curva LV para XP"
      >
        {yTicks.map((tick, idx) => {
          const y = plot.top + (1 - (tick - minY) / yRange) * plotHeight;
          return (
            <g key={`y-${idx}-${tick}`}>
              <line
                x1={plot.left}
                y1={y}
                x2={width - plot.right}
                y2={y}
                stroke={light ? "#e5e7eb" : "#334155"}
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text x={plot.left - 6} y={y + 4} textAnchor="end" fill={light ? "#6b7280" : "#94a3b8"} fontSize="10">
                {formatAxisNumber(tick)}
              </text>
            </g>
          );
        })}
        {xTicks.map((idx) => {
          const x = plot.left + (idx / xRange) * plotWidth;
          const levelLabel = points[idx]?.level ?? points[0].level;
          return (
            <g key={`x-${idx}`}>
              <line x1={x} y1={plot.top} x2={x} y2={height - plot.bottom} stroke={light ? "#f3f4f6" : "#1f2937"} strokeWidth="1" />
              <text x={x} y={height - plot.bottom + 14} textAnchor="middle" fill={light ? "#6b7280" : "#94a3b8"} fontSize="10">
                Lv {levelLabel}
              </text>
            </g>
          );
        })}
        <line
          x1={plot.left}
          y1={height - plot.bottom}
          x2={width - plot.right}
          y2={height - plot.bottom}
          stroke={light ? "#6b7280" : "#475569"}
          strokeWidth="1"
        />
        <line x1={plot.left} y1={plot.top} x2={plot.left} y2={height - plot.bottom} stroke={light ? "#6b7280" : "#475569"} strokeWidth="1" />
        <path d={path} fill="none" stroke={light ? "#0ea5e9" : "#22d3ee"} strokeWidth="2.2" />
        {rangeTiming.map((entry, idx) => {
          const startX = plot.left + (entry.startIndex / xRange) * plotWidth;
          const endX = plot.left + (entry.endIndex / xRange) * plotWidth;
          const x = (startX + endX) / 2;
          const y = 10;
          const labelWidth = Math.max(40, entry.durationLabel.length * 6);
          return (
            <g key={`${entry.startLevel}-${entry.endLevel}`}>
              <rect
                x={x - labelWidth / 2}
                y={y - 10}
                width={labelWidth}
                height={14}
                rx={4}
                fill={light ? "#ffffff" : "#020617"}
                fillOpacity={light ? 0.88 : 0.72}
                stroke={light ? "#cbd5e1" : "#334155"}
                strokeWidth="1"
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                fill={light ? "#1f2937" : "#e2e8f0"}
                fontSize="9.5"
              >
                {entry.durationLabel}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => {
          const x = plot.left + (index / xRange) * plotWidth;
          const y = plot.top + (1 - (point.value - minY) / yRange) * plotHeight;
          return (
            <circle key={`pt-${point.level}`} cx={x} cy={y} r={2} fill={light ? "#0284c7" : "#22d3ee"}>
              <title>{`Lv ${point.level}: ${point.value} XP`}</title>
            </circle>
          );
        })}
        {xTicks.map((idx) => {
          const point = points[idx];
          if (!point) return null;
          const x = plot.left + (idx / xRange) * plotWidth;
          const y = plot.top + (1 - (point.value - minY) / yRange) * plotHeight;
          const label = `${formatAxisNumber(point.value)} XP`;
          const labelWidth = Math.max(44, label.length * 5.8);
          const labelY = Math.max(plot.top + 28, y - 14);
          return (
            <g key={`xp-label-${point.level}`}>
              <rect
                x={x - labelWidth / 2}
                y={labelY - 9}
                width={labelWidth}
                height={13}
                rx={4}
                fill={light ? "#ffffff" : "#020617"}
                fillOpacity={light ? 0.92 : 0.78}
                stroke={light ? "#cbd5e1" : "#334155"}
                strokeWidth="1"
              />
              <text x={x} y={labelY} textAnchor="middle" fill={light ? "#111827" : "#e2e8f0"} fontSize="9">
                {label}
              </text>
            </g>
          );
        })}
        {!compact && (
          <>
            <text x={width / 2} y={height - 5} textAnchor="middle" fill={light ? "#374151" : "#cbd5e1"} fontSize="11">
              Eixo X: Level (Lv)
            </text>
            <text x={20} y={height / 2} transform={`rotate(-90 20 ${height / 2})`} textAnchor="middle" fill={light ? "#374151" : "#cbd5e1"} fontSize="11">
              Eixo Y: XP por level
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

function buildIndexTicks(length: number, tickCount: number): number[] {
  if (length <= 1) return [0];
  const last = length - 1;
  const out = new Set<number>([0, last]);
  for (let i = 1; i < tickCount - 1; i += 1) {
    out.add(Math.round((i / (tickCount - 1)) * last));
  }
  return [...out].sort((a, b) => a - b);
}

function buildValueTicks(min: number, max: number, tickCount: number): number[] {
  if (tickCount <= 1 || min === max) return [min, max];
  const step = (max - min) / (tickCount - 1);
  return Array.from({ length: tickCount }, (_, idx) => min + step * idx);
}

function formatAxisNumber(value: number): string {
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatReadableNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function buildRangeTimingSegments({
  points,
  minutesPerLevel,
  mode,
  matchDurationMinutes,
  sessionsPerDay,
  tickCount,
}: {
  points: Array<{ level: number; value: number }>;
  minutesPerLevel: Array<{ level: number; minutes: number }>;
  mode: "continuous" | "sessionBased" | undefined;
  matchDurationMinutes: number;
  sessionsPerDay?: number;
  tickCount: number;
}): Array<{ startLevel: number; endLevel: number; startIndex: number; endIndex: number; durationLabel: string }> {
  if (points.length < 2 || minutesPerLevel.length === 0) return [];
  const ticks = buildIndexTicks(points.length, tickCount);
  if (ticks.length < 2) return [];

  const cumulativeByLevel = new Map<number, number>();
  let running = 0;
  for (const item of minutesPerLevel) {
    running += Math.max(0, Number(item.minutes) || 0);
    cumulativeByLevel.set(item.level, running);
  }

  const safePerDay = Math.max(1, Number(matchDurationMinutes || 1) * Math.max(1, Math.floor(Number(sessionsPerDay || 1))));
  const out: Array<{ startLevel: number; endLevel: number; startIndex: number; endIndex: number; durationLabel: string }> = [];

  for (let i = 1; i < ticks.length; i += 1) {
    const startIndex = ticks[i - 1];
    const endIndex = ticks[i];
    const startLevel = points[startIndex]?.level;
    const endLevel = points[endIndex]?.level;
    if (startLevel == null || endLevel == null) continue;
    const endCum = cumulativeByLevel.get(endLevel) ?? 0;
    const startCum = i === 1 ? 0 : cumulativeByLevel.get(startLevel) ?? 0;
    const segmentMinutes = Math.max(0, endCum - startCum);
    const activeHours = segmentMinutes / 60;
    const durationLabel =
      mode === "sessionBased"
        ? `${formatCalendarDaysHuman(segmentMinutes / safePerDay)} real | ${formatHoursHuman(activeHours)} ativo`
        : formatHoursHuman(activeHours);
    out.push({ startLevel, endLevel, startIndex, endIndex, durationLabel });
  }
  return out;
}

function formatHoursHuman(hours: number): string {
  const safeHours = Math.max(0, Number(hours) || 0);
  const totalMinutes = Math.round(safeHours * 60);

  if (totalMinutes < 60) return `${totalMinutes} min`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (totalHours < 24) return minutes > 0 ? `${totalHours}h ${minutes}min` : `${totalHours}h`;

  const days = Math.floor(totalHours / 24);
  const hoursRemainder = totalHours % 24;

  if (hoursRemainder === 0 && minutes === 0) return `${days}d`;
  if (minutes === 0) return `${days}d ${hoursRemainder}h`;
  return `${days}d ${hoursRemainder}h ${minutes}min`;
}

function formatCalendarDaysHuman(daysValue: number): string {
  const safeDays = Math.max(0, Number(daysValue) || 0);
  const totalMinutes = Math.round(safeDays * 24 * 60);

  if (totalMinutes < 60) return `${totalMinutes} min`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (totalHours < 24) return minutes > 0 ? `${totalHours}h ${minutes}min` : `${totalHours}h`;

  const days = Math.floor(totalHours / 24);
  const hoursRemainder = totalHours % 24;

  if (hoursRemainder === 0 && minutes === 0) return `${days}d`;
  if (minutes === 0) return `${days}d ${hoursRemainder}h`;
  return `${days}d ${hoursRemainder}h ${minutes}min`;
}

function formatMinutesHuman(minutesValue: number): string {
  const safeMinutes = Math.max(0, Number(minutesValue) || 0);
  const roundedMinutes = Math.round(safeMinutes);
  if (roundedMinutes < 60) return `${roundedMinutes} min`;
  const hours = Math.floor(roundedMinutes / 60);
  const mins = roundedMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

function buildHumanXpRhythmDetails(input: NonNullable<BalanceAddonDraft["simulationInput"]>): string[] {
  const mode = input.xpRateMode || "fixed";
  const fixedXp = Math.max(0.1, Number(input.xpPerMinute || 1));

  if (mode !== "byLevelRange" || !Array.isArray(input.xpRanges) || input.xpRanges.length === 0) {
    return [`Ganho estavel em ${formatReadableNumber(fixedXp)} XP/min durante toda a progressao.`];
  }

  const ranges = [...input.xpRanges]
    .filter((entry) => Number.isFinite(entry.fromLevel) && Number.isFinite(entry.toLevel) && Number.isFinite(entry.xpPerMinute))
    .map((entry) => ({
      fromLevel: Math.max(1, Math.floor(entry.fromLevel)),
      toLevel: Math.max(1, Math.floor(entry.toLevel)),
      xpPerMinute: Math.max(0.1, Number(entry.xpPerMinute)),
    }))
    .sort((a, b) => a.fromLevel - b.fromLevel);

  if (ranges.length === 0) {
    return [`Ganho estavel em ${formatReadableNumber(fixedXp)} XP/min durante toda a progressao.`];
  }

  const first = ranges[0];
  const middle = ranges[Math.floor((ranges.length - 1) / 2)];
  const last = ranges[ranges.length - 1];
  const minXp = Math.min(...ranges.map((range) => range.xpPerMinute));
  const maxXp = Math.max(...ranges.map((range) => range.xpPerMinute));

  let trend: string;
  if (last.xpPerMinute > first.xpPerMinute * 1.08) {
    trend = "com aceleracao ao longo dos levels";
  } else if (last.xpPerMinute < first.xpPerMinute * 0.92) {
    trend = "com desaceleracao ao longo dos levels";
  } else {
    trend = "com ritmo relativamente estavel entre as etapas";
  }

  return [
    `Ganho variavel por etapa, ${trend}.`,
    `Inicio (Lv ${first.fromLevel}-${first.toLevel}): ${formatReadableNumber(first.xpPerMinute)} XP/min.`,
    `Meio: ${formatReadableNumber(middle.xpPerMinute)} XP/min.`,
    `Final (Lv ${last.fromLevel}-${last.toLevel}): ${formatReadableNumber(last.xpPerMinute)} XP/min.`,
    `Faixa total observada: ${formatReadableNumber(minXp)}-${formatReadableNumber(maxXp)} XP/min.`,
  ];
}

