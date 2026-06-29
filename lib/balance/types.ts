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
  /**
   * When true, the first level costs 0 XP and the formula shifts one step:
   * value[startLevel] = 0, value[startLevel+1] = f(1), value[startLevel+2] = f(2)…
   * Models "value = XP to reach this level from the previous one" — the player
   * starts at level 1 with nothing to grind. Default false (formula at f(level)).
   */
  startAtZero?: boolean;
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

/**
 * Result of solving the curve parameters that hit a progression target in one
 * shot (vs. the single damped step of suggestTargetTuning). The solver bisects
 * growthDeltaPercent until the measured time matches the target within
 * tolerance, or reports it can't be reached within the parameter bounds.
 */
export interface BalanceTargetSolution {
  /** Full param set to apply (already merged with the solved adjustments). */
  params: BalanceFormulaParams;
  /** True when the measured time landed within tolerance of the target. */
  converged: boolean;
  /** True when the target lies outside the feasible range — we returned the closest bound. */
  atBound: boolean;
  /** Measured time-to-target for the solved params, in `unit`. */
  measuredValue: number;
  /** The target time being solved for, in `unit`. */
  targetValue: number;
  /** Unit of measuredValue/targetValue: active hours (continuous) or calendar days (sessions). */
  unit: "hours" | "days";
  /** Bisection iterations consumed. */
  iterations: number;
  /** Human-readable summary of the outcome. */
  message: string;
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
  /** See BalanceCurveInput.startAtZero — first level costs 0 XP and the curve shifts one step. */
  startAtZero?: boolean;
}
