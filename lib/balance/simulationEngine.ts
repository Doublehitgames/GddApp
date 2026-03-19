import type { BalancePoint } from "@/lib/balance/types";

export interface CurveComparisonPoint {
  level: number;
  baseValue: number;
  candidateValue: number;
  absoluteDelta: number;
  percentDelta: number;
}

export interface SensitivityResult {
  parameter: "base" | "growth" | "offset";
  percentChange: number;
  topAffectedLevels: Array<{ level: number; impactPercent: number }>;
}

export function compareCurves(base: BalancePoint[], candidate: BalancePoint[]): CurveComparisonPoint[] {
  const byLevel = new Map(base.map((point) => [point.level, point.value]));
  return candidate
    .filter((point) => byLevel.has(point.level))
    .map((point) => {
      const baseValue = Number(byLevel.get(point.level) ?? 0);
      const absoluteDelta = point.value - baseValue;
      const percentDelta = baseValue === 0 ? 0 : (absoluteDelta / Math.abs(baseValue)) * 100;
      return {
        level: point.level,
        baseValue,
        candidateValue: point.value,
        absoluteDelta,
        percentDelta,
      };
    });
}

export function calculateSensitivity(
  baseCurve: BalancePoint[],
  changedCurve: BalancePoint[],
  parameter: "base" | "growth" | "offset",
  percentChange: number
): SensitivityResult {
  const comparison = compareCurves(baseCurve, changedCurve);
  const topAffectedLevels = comparison
    .map((row) => ({ level: row.level, impactPercent: Math.abs(row.percentDelta) }))
    .sort((a, b) => b.impactPercent - a.impactPercent)
    .slice(0, 8);
  return { parameter, percentChange, topAffectedLevels };
}
