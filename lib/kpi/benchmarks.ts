import type { GameGenre, KpiMetrics, KpiGameProfile } from "./types";

export type MetricStatus = "great" | "ok" | "low" | "critical";

export type GenreBenchmark = {
  label: string;
  d1: { good: number; ok: number };
  d3: { good: number; ok: number };
  d7: { good: number; ok: number };
  d14: { good: number; ok: number };
  d30: { good: number; ok: number };
  sessionsPerDay: { good: number; ok: number };
  sessionDuration: { good: number; ok: number };
  conversionRate: { good: number; ok: number };
  funnel: { label: string; value: number; color: string }[];
};

export const GENRE_BENCHMARKS: Record<GameGenre, GenreBenchmark> = {
  farm: {
    label: "Farm / Simulação",
    d1: { good: 40, ok: 30 },
    d3: { good: 28, ok: 20 },
    d7: { good: 20, ok: 12 },
    d14: { good: 14, ok: 9 },
    d30: { good: 10, ok: 6 },
    sessionsPerDay: { good: 3, ok: 2 },
    sessionDuration: { good: 8, ok: 5 },
    conversionRate: { good: 2, ok: 1 },
    funnel: [
      { label: "Instala o jogo", value: 100, color: "#10b981" },
      { label: "Completa tutorial", value: 70, color: "#10b981" },
      { label: "Retorna D1", value: 40, color: "#f59e0b" },
      { label: "Retorna D7", value: 20, color: "#f59e0b" },
      { label: "Retorna D30", value: 10, color: "#ef4444" },
      { label: "1ª compra", value: 2.5, color: "#ef4444" },
    ],
  },
  casual: {
    label: "Casual / Hyper-casual",
    d1: { good: 35, ok: 25 },
    d3: { good: 22, ok: 15 },
    d7: { good: 15, ok: 8 },
    d14: { good: 10, ok: 6 },
    d30: { good: 7, ok: 4 },
    sessionsPerDay: { good: 5, ok: 3 },
    sessionDuration: { good: 5, ok: 3 },
    conversionRate: { good: 1.5, ok: 0.8 },
    funnel: [
      { label: "Instala o jogo", value: 100, color: "#10b981" },
      { label: "Completa tutorial", value: 80, color: "#10b981" },
      { label: "Retorna D1", value: 35, color: "#f59e0b" },
      { label: "Retorna D7", value: 15, color: "#f59e0b" },
      { label: "Retorna D30", value: 7, color: "#ef4444" },
      { label: "1ª compra", value: 1.5, color: "#ef4444" },
    ],
  },
  rpg: {
    label: "RPG / Mid-core",
    d1: { good: 30, ok: 20 },
    d3: { good: 20, ok: 13 },
    d7: { good: 15, ok: 8 },
    d14: { good: 11, ok: 6 },
    d30: { good: 8, ok: 4 },
    sessionsPerDay: { good: 2, ok: 1.5 },
    sessionDuration: { good: 20, ok: 12 },
    conversionRate: { good: 3, ok: 1.5 },
    funnel: [
      { label: "Instala o jogo", value: 100, color: "#10b981" },
      { label: "Completa tutorial", value: 60, color: "#10b981" },
      { label: "Retorna D1", value: 30, color: "#f59e0b" },
      { label: "Retorna D7", value: 15, color: "#f59e0b" },
      { label: "Retorna D30", value: 8, color: "#ef4444" },
      { label: "1ª compra", value: 3, color: "#ef4444" },
    ],
  },
  puzzle: {
    label: "Puzzle",
    d1: { good: 40, ok: 28 },
    d3: { good: 28, ok: 18 },
    d7: { good: 20, ok: 12 },
    d14: { good: 13, ok: 8 },
    d30: { good: 8, ok: 5 },
    sessionsPerDay: { good: 5, ok: 3 },
    sessionDuration: { good: 7, ok: 4 },
    conversionRate: { good: 1, ok: 0.5 },
    funnel: [
      { label: "Instala o jogo", value: 100, color: "#10b981" },
      { label: "Completa tutorial", value: 75, color: "#10b981" },
      { label: "Retorna D1", value: 40, color: "#f59e0b" },
      { label: "Retorna D7", value: 20, color: "#f59e0b" },
      { label: "Retorna D30", value: 8, color: "#ef4444" },
      { label: "1ª compra", value: 1, color: "#ef4444" },
    ],
  },
  idle: {
    label: "Idle / Clicker",
    d1: { good: 45, ok: 35 },
    d3: { good: 32, ok: 22 },
    d7: { good: 25, ok: 15 },
    d14: { good: 17, ok: 10 },
    d30: { good: 12, ok: 7 },
    sessionsPerDay: { good: 6, ok: 4 },
    sessionDuration: { good: 3, ok: 2 },
    conversionRate: { good: 2, ok: 1 },
    funnel: [
      { label: "Instala o jogo", value: 100, color: "#10b981" },
      { label: "Completa tutorial", value: 85, color: "#10b981" },
      { label: "Retorna D1", value: 45, color: "#f59e0b" },
      { label: "Retorna D7", value: 25, color: "#f59e0b" },
      { label: "Retorna D30", value: 12, color: "#ef4444" },
      { label: "1ª compra", value: 2, color: "#ef4444" },
    ],
  },
  shooter: {
    label: "Shooter / Action",
    d1: { good: 25, ok: 18 },
    d3: { good: 17, ok: 11 },
    d7: { good: 12, ok: 7 },
    d14: { good: 8, ok: 5 },
    d30: { good: 5, ok: 3 },
    sessionsPerDay: { good: 3, ok: 2 },
    sessionDuration: { good: 20, ok: 15 },
    conversionRate: { good: 4, ok: 2 },
    funnel: [
      { label: "Instala o jogo", value: 100, color: "#10b981" },
      { label: "Completa tutorial", value: 55, color: "#10b981" },
      { label: "Retorna D1", value: 25, color: "#f59e0b" },
      { label: "Retorna D7", value: 12, color: "#f59e0b" },
      { label: "Retorna D30", value: 5, color: "#ef4444" },
      { label: "1ª compra", value: 4, color: "#ef4444" },
    ],
  },
};

export function getMetricStatus(value: number, benchmark: { good: number; ok: number }): MetricStatus {
  if (value >= benchmark.good) return "great";
  if (value >= benchmark.ok) return "ok";
  if (value >= benchmark.ok * 0.6) return "low";
  return "critical";
}

export type Diagnosis = {
  priority: "great" | "warning" | "critical";
  textKey: string;
  ratioD7D1?: number;
  ratioD30D7?: number;
};

// ─── Diagnose principal ───────────────────────────────────────────────────────

export function diagnose(
  metrics: KpiMetrics,
  genre: GameGenre,
  profile?: KpiGameProfile
): Diagnosis | null {
  const { d1, d7, d30 } = metrics;
  if (d1 === undefined && d7 === undefined && d30 === undefined) return null;

  const bench = GENRE_BENCHMARKS[genre];
  const ratioD7D1 = d1 && d7 ? d7 / d1 : undefined;
  const ratioD30D7 = d7 && d30 ? d30 / d7 : undefined;

  // ── D1 muito baixo → problema na entrada do jogo ──────────────────────────
  if (d1 !== undefined && d1 < bench.d1.ok * 0.75) {
    const hasTutorial = profile?.hasTutorial ?? true;
    return {
      priority: "critical",
      textKey: hasTutorial ? "kpi.diag.tutorial.withTutorial" : "kpi.diag.tutorial.noTutorial",
      ratioD7D1,
      ratioD30D7,
    };
  }

  // ── D1 ok mas D7 caiu muito → loop não prende ─────────────────────────────
  if (d7 !== undefined && d7 < bench.d7.ok * 0.7 && (ratioD7D1 === undefined || ratioD7D1 < 0.4)) {
    const loopKey =
      profile?.loopType === "pvp" ? "kpi.diag.loop.pvp" :
      profile?.loopType === "sandbox" ? "kpi.diag.loop.sandbox" :
      profile?.loopType === "progression" ? "kpi.diag.loop.progression" :
      "kpi.diag.loop.default";
    return {
      priority: "critical",
      textKey: loopKey,
      ratioD7D1,
      ratioD30D7,
    };
  }

  // ── D7 ok mas D30 caiu → mid-game vazio ───────────────────────────────────
  if (d30 !== undefined && d30 < bench.d30.ok * 0.7 && (ratioD30D7 === undefined || ratioD30D7 < 0.4)) {
    const midgameKey = profile?.loopType === "pvp" ? "kpi.diag.midgame.pvp" : "kpi.diag.midgame.default";
    return {
      priority: "warning",
      textKey: midgameKey,
      ratioD7D1,
      ratioD30D7,
    };
  }

  // ── Retenção ok, verificar monetização ───────────────────────────────────
  const monetization = profile?.monetization ?? "iap";
  const monetizationHasConversion = monetization === "iap" || monetization === "iap_ads";

  if (
    monetizationHasConversion &&
    metrics.conversionRate !== undefined &&
    metrics.conversionRate < bench.conversionRate.ok
  ) {
    return {
      priority: "warning",
      textKey: "kpi.diag.monetization.default",
      ratioD7D1,
      ratioD30D7,
    };
  }

  // Modelo sem conversão direta — checar engajamento de sessão
  if (!monetizationHasConversion && monetization !== "none") {
    if (
      (metrics.sessionsPerDay !== undefined && metrics.sessionsPerDay < bench.sessionsPerDay.ok * 0.7) ||
      (metrics.sessionDuration !== undefined && metrics.sessionDuration < bench.sessionDuration.ok * 0.6)
    ) {
      return {
        priority: "warning",
        textKey: monetization === "ads" ? "kpi.diag.sessionEngagement.ads" : "kpi.diag.sessionEngagement.default",
        ratioD7D1,
        ratioD30D7,
      };
    }
  }

  // Tudo ok
  return {
    priority: "great",
    textKey: "kpi.diag.great",
    ratioD7D1,
    ratioD30D7,
  };
}
