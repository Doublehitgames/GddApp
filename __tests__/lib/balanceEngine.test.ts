import {
  calculateCurveMetrics,
  createDefaultBalanceAddon,
  createProfileDefaults,
  generateBalanceCurve,
  simulateProgressionBySession,
  suggestTargetTuning,
  cumulativeTimeToLevel,
  solveTargetTuning,
} from "@/lib/balance/formulaEngine";
import type { BalanceSimulationInput } from "@/lib/balance/types";

describe("balance formula engine", () => {
  it("supports professional presets and generates stable curves", () => {
    const addon = createDefaultBalanceAddon("a1");
    const softCapCurve = generateBalanceCurve({
      ...addon,
      preset: "softCap",
      mode: "preset",
      params: { ...addon.params, capValue: 5000, capStrength: 0.08 },
    });
    const hardCapCurve = generateBalanceCurve({
      ...addon,
      preset: "hardCap",
      mode: "preset",
      params: { ...addon.params, capValue: 1800 },
    });

    expect(softCapCurve.points.length).toBe(100);
    expect(softCapCurve.maxValue).toBeLessThanOrEqual(5000);
    expect(hardCapCurve.maxValue).toBeLessThanOrEqual(1800);
  });

  it("computes health metrics and milestones", () => {
    const addon = createDefaultBalanceAddon("a2");
    const curve = generateBalanceCurve(addon);
    const metrics = calculateCurveMetrics(curve.points);

    expect(metrics.cumulativeValue).toBeGreaterThan(0);
    expect(metrics.milestones.length).toBeGreaterThan(0);
    expect(Array.isArray(metrics.spikeLevels)).toBe(true);
  });

  it("simulates session and suggests target tuning", () => {
    const addon = createDefaultBalanceAddon("a3");
    const curve = generateBalanceCurve(addon);
    const simulation = simulateProgressionBySession(curve.points, {
      xpPerMinute: 200,
      winRate: 0.7,
      matchDurationMinutes: 10,
      bonusMultiplier: 1.1,
    });
    const suggestion = suggestTargetTuning(
      curve.points,
      { targetLevel: 50, targetHours: 10 },
      { xpPerMinute: 200, winRate: 0.7, matchDurationMinutes: 10, bonusMultiplier: 1.1 },
      addon.preset,
      addon.params
    );

    expect(simulation.hoursToMilestones.length).toBeGreaterThan(0);
    expect(typeof suggestion.message).toBe("string");
    expect(Number.isFinite(suggestion.recommendedGrowthDeltaPercent)).toBe(true);
    expect(typeof suggestion.recommendedAdjustments).toBe("object");
  });

  it("uses days target in sessionBased mode", () => {
    const addon = createDefaultBalanceAddon("a4");
    const curve = generateBalanceCurve(addon);
    const simulation = simulateProgressionBySession(curve.points, {
      mode: "sessionBased",
      xpPerMinute: 220,
      winRate: 0.8,
      matchDurationMinutes: 3,
      sessionsPerDay: 3,
      bonusMultiplier: 1,
    });
    const suggestion = suggestTargetTuning(
      curve.points,
      { targetLevel: 50, targetValue: 30, targetUnit: "days" },
      {
        mode: "sessionBased",
        xpPerMinute: 220,
        winRate: 0.8,
        matchDurationMinutes: 3,
        sessionsPerDay: 3,
        bonusMultiplier: 1,
      },
      addon.preset,
      addon.params
    );

    expect(simulation.hoursToMilestones.some((entry) => typeof entry.calendarDays === "number")).toBe(true);
    expect(suggestion.message.toLowerCase()).toContain("dias reais");
  });

  it("keeps same milestones when ranges mirror fixed XP/min", () => {
    const addon = createDefaultBalanceAddon("a5");
    const curve = generateBalanceCurve(addon);
    const fixed = simulateProgressionBySession(curve.points, {
      xpRateMode: "fixed",
      xpPerMinute: 200,
      winRate: 0.7,
      matchDurationMinutes: 10,
      bonusMultiplier: 1,
    });
    const byRange = simulateProgressionBySession(curve.points, {
      xpRateMode: "byLevelRange",
      xpPerMinute: 200,
      xpRanges: [{ fromLevel: 1, toLevel: 100, xpPerMinute: 200 }],
      winRate: 0.7,
      matchDurationMinutes: 10,
      bonusMultiplier: 1,
    });

    expect(byRange.hoursToMilestones).toEqual(fixed.hoursToMilestones);
  });

  it("slows later milestones with lower XP/min in higher ranges", () => {
    const addon = createDefaultBalanceAddon("a6");
    const curve = generateBalanceCurve(addon);
    const fixed = simulateProgressionBySession(curve.points, {
      xpRateMode: "fixed",
      xpPerMinute: 220,
      winRate: 0.75,
      matchDurationMinutes: 8,
      bonusMultiplier: 1,
    });
    const byRange = simulateProgressionBySession(curve.points, {
      xpRateMode: "byLevelRange",
      xpPerMinute: 220,
      xpRanges: [
        { fromLevel: 1, toLevel: 25, xpPerMinute: 240 },
        { fromLevel: 26, toLevel: 50, xpPerMinute: 180 },
        { fromLevel: 51, toLevel: 100, xpPerMinute: 120 },
      ],
      winRate: 0.75,
      matchDurationMinutes: 8,
      bonusMultiplier: 1,
    });

    const lv50Fixed = fixed.hoursToMilestones.find((entry) => entry.level === 50)?.hours ?? 0;
    const lv100Fixed = fixed.hoursToMilestones.find((entry) => entry.level === 100)?.hours ?? 0;
    const lv50Range = byRange.hoursToMilestones.find((entry) => entry.level === 50)?.hours ?? 0;
    const lv100Range = byRange.hoursToMilestones.find((entry) => entry.level === 100)?.hours ?? 0;

    expect(lv50Range).toBeGreaterThan(lv50Fixed);
    expect(lv100Range).toBeGreaterThan(lv100Fixed);
  });

  it("uses range simulation in target suggestion for session mode", () => {
    const addon = createDefaultBalanceAddon("a7");
    const curve = generateBalanceCurve(addon);
    const suggestion = suggestTargetTuning(
      curve.points,
      { targetLevel: 50, targetValue: 20, targetUnit: "days" },
      {
        mode: "sessionBased",
        xpRateMode: "byLevelRange",
        xpPerMinute: 220,
        xpRanges: [
          { fromLevel: 1, toLevel: 20, xpPerMinute: 250 },
          { fromLevel: 21, toLevel: 100, xpPerMinute: 130 },
        ],
        winRate: 0.8,
        matchDurationMinutes: 3,
        sessionsPerDay: 3,
        bonusMultiplier: 1,
      },
      addon.preset,
      addon.params
    );

    expect(suggestion.message.toLowerCase()).toContain("dias reais");
    expect(suggestion.message.toLowerCase()).toContain("faixas de level");
  });

  it("applies profile defaults for genre quick start", () => {
    const idle = createProfileDefaults("idle");
    const casual = createProfileDefaults("casual");

    expect(idle.growth).toBeGreaterThan(casual.growth);
    expect(idle.capValue).toBeGreaterThan(casual.capValue);
  });
});

describe("target solver (one-shot convergence)", () => {
  const addon = createDefaultBalanceAddon("solve");
  const curveInput = { ...addon };
  const hoursSim: BalanceSimulationInput = {
    xpPerMinute: 200,
    winRate: 0.7,
    matchDurationMinutes: 10,
    bonusMultiplier: 1,
  };

  it("cumulativeTimeToLevel matches the milestone simulation and works at arbitrary levels", () => {
    const curve = generateBalanceCurve(curveInput);
    const milestone50 = simulateProgressionBySession(curve.points, hoursSim).hoursToMilestones.find(
      (m) => m.level === 50
    );
    const direct50 = cumulativeTimeToLevel(curve.points, hoursSim, 50);
    expect(direct50?.hours).toBeCloseTo(milestone50!.hours, 5);

    // A non-milestone level (30) used to be unsupported (milestone-only path → null).
    const at30 = cumulativeTimeToLevel(curve.points, hoursSim, 30);
    expect(at30 && Number.isFinite(at30.hours)).toBe(true);

    // Out-of-range level returns null.
    expect(cumulativeTimeToLevel(curve.points, hoursSim, 999)).toBeNull();
  });

  it("converges to a reachable target at a non-milestone level in one shot (hours)", () => {
    const curve = generateBalanceCurve(curveInput);
    const baseline = cumulativeTimeToLevel(curve.points, hoursSim, 30)!.hours;
    const targetHours = baseline * 2; // slower → needs more growth, comfortably within bounds

    const result = solveTargetTuning(
      curveInput,
      { targetLevel: 30, targetValue: targetHours, targetUnit: "hours" },
      hoursSim
    );

    expect(result.unit).toBe("hours");
    expect(result.converged).toBe(true);
    expect(result.atBound).toBe(false);
    expect(Math.abs((result.measuredValue - targetHours) / targetHours)).toBeLessThanOrEqual(0.02);
    expect(result.params.growth).toBeGreaterThan(addon.params.growth);
  });

  it("converges in sessionBased (days) mode at a non-milestone level", () => {
    const daysSim: BalanceSimulationInput = {
      mode: "sessionBased",
      xpPerMinute: 220,
      winRate: 0.8,
      matchDurationMinutes: 3,
      sessionsPerDay: 3,
      bonusMultiplier: 1,
    };
    const curve = generateBalanceCurve(curveInput);
    const baseline = cumulativeTimeToLevel(curve.points, daysSim, 75)!.calendarDays!;
    const targetDays = baseline * 0.5; // faster → needs less growth

    const result = solveTargetTuning(
      curveInput,
      { targetLevel: 75, targetValue: targetDays, targetUnit: "days" },
      daysSim
    );

    expect(result.unit).toBe("days");
    expect(result.converged).toBe(true);
    expect(Math.abs((result.measuredValue - targetDays) / targetDays)).toBeLessThanOrEqual(0.02);
    expect(result.params.growth).toBeLessThan(addon.params.growth);
  });

  it("reports atBound when the target is impossible within the parameter limits", () => {
    const result = solveTargetTuning(
      curveInput,
      { targetLevel: 50, targetValue: 0.001, targetUnit: "hours" },
      hoursSim
    );
    expect(result.atBound).toBe(true);
    expect(result.converged).toBe(false);
  });
});

describe("startAtZero (first level = 0, curve shifts one step)", () => {
  const baseAddon = createDefaultBalanceAddon("z");
  const linear = {
    ...baseAddon,
    mode: "preset" as const,
    preset: "linear" as const,
    startLevel: 1,
    endLevel: 5,
    decimals: 0,
    params: { ...baseAddon.params, base: 0, growth: 100, offset: 0 }, // f(level) = 100 * level
  };

  it("keeps the formula at f(level) when off (default, unchanged behaviour)", () => {
    const curve = generateBalanceCurve(linear);
    expect(curve.points[0]).toEqual({ level: 1, value: 100 }); // f(1)
    expect(curve.points[1]).toEqual({ level: 2, value: 200 }); // f(2)
  });

  it("forces level 1 to 0 and shifts the curve when on", () => {
    const curve = generateBalanceCurve({ ...linear, startAtZero: true });
    expect(curve.points[0]).toEqual({ level: 1, value: 0 });
    expect(curve.points[1]).toEqual({ level: 2, value: 100 }); // f(1) lands on lv2
    expect(curve.points[2]).toEqual({ level: 3, value: 200 }); // f(2) lands on lv3
    expect(curve.minValue).toBe(0);
  });

  it("makes the simulation spend no time on the first level", () => {
    const curve = generateBalanceCurve({ ...linear, startAtZero: true });
    const sim = simulateProgressionBySession(curve.points, {
      xpPerMinute: 100,
      winRate: 1,
      matchDurationMinutes: 10,
      bonusMultiplier: 1,
    });
    expect(sim.minutesPerLevel[0]).toEqual({ level: 1, minutes: 0 });
    expect(sim.minutesPerLevel[1].minutes).toBeGreaterThan(0);
  });

  it("keeps the structural zero even when clampMin would raise it", () => {
    const curve = generateBalanceCurve({ ...linear, startAtZero: true, clampMin: 50 });
    expect(curve.points[0].value).toBe(0); // not clamped up to 50
    expect(curve.points[1].value).toBe(100); // f(1), clamp leaves it untouched
  });
});
