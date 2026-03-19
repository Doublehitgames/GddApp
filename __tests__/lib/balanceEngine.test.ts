import {
  calculateCurveMetrics,
  createDefaultBalanceAddon,
  createProfileDefaults,
  generateBalanceCurve,
  simulateProgressionBySession,
  suggestTargetTuning,
} from "@/lib/balance/formulaEngine";

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
