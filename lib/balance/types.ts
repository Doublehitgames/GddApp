export type BalanceFormulaMode = "preset" | "advanced";

export type BalancePresetId =
  | "linear"
  | "exponential"
  | "tiered"
  | "softCap"
  | "hardCap"
  | "diminishingReturns"
  | "piecewise";

export type BalanceGenreProfileId = "rpg" | "idle" | "roguelite" | "casual";

export interface BalanceFormulaParams {
  base: number;
  growth: number;
  offset: number;
  tierStep: number;
  tierMultiplier: number;
  capValue: number;
  capStrength: number;
  plateauStartLevel: number;
  plateauFactor: number;
}

export interface BalancePoint {
  level: number;
  value: number;
}

export interface BalanceCurveResult {
  points: BalancePoint[];
  minValue: number;
  maxValue: number;
}

export interface BalanceCurveMetrics {
  averageStep: number;
  averageGrowthPercent: number;
  cumulativeValue: number;
  spikeLevels: number[];
  plateauLevels: number[];
  regressionLevels: number[];
  milestones: Array<{ level: number; value: number }>;
}

export interface BalanceCurveInput {
  mode: BalanceFormulaMode;
  preset: BalancePresetId;
  expression: string;
  startLevel: number;
  endLevel: number;
  decimals: number;
  clampMin?: number;
  clampMax?: number;
  params: BalanceFormulaParams;
}

export interface BalanceSimulationInput {
  mode?: "continuous" | "sessionBased";
  xpRateMode?: "fixed" | "byLevelRange";
  xpPerMinute: number;
  xpRanges?: Array<{
    fromLevel: number;
    toLevel: number;
    xpPerMinute: number;
  }>;
  winRate: number;
  matchDurationMinutes: number;
  sessionsPerDay?: number;
  bonusMultiplier: number;
}

export interface BalanceSimulationResult {
  minutesPerLevel: Array<{ level: number; minutes: number }>;
  hoursToMilestones: Array<{ level: number; hours: number; calendarDays?: number }>;
}

export interface BalanceTargetInput {
  targetLevel: number;
  /** Mantido para compatibilidade com dados antigos */
  targetHours?: number;
  /** Valor da meta na unidade indicada em targetUnit */
  targetValue?: number;
  targetUnit?: "hours" | "days";
}

export interface BalanceTargetSuggestion {
  message: string;
  recommendedGrowthDeltaPercent: number;
  recommendedAdjustments: Partial<BalanceFormulaParams>;
}

export interface BalanceAddonDraft {
  id: string;
  name: string;
  mode: BalanceFormulaMode;
  preset: BalancePresetId;
  expression: string;
  startLevel: number;
  endLevel: number;
  decimals: number;
  clampMin?: number;
  clampMax?: number;
  params: BalanceFormulaParams;
  profile?: BalanceGenreProfileId;
  comparisonBaseline?: BalancePoint[];
  simulationInput?: BalanceSimulationInput;
  target?: BalanceTargetInput;
}
