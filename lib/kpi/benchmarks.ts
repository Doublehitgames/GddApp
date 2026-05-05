import type { GameGenre, KpiMetrics } from "./types";

export type MetricStatus = "great" | "ok" | "low" | "critical";

export type GenreBenchmark = {
  label: string;
  d1: { good: number; ok: number };
  d7: { good: number; ok: number };
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
    d7: { good: 20, ok: 12 },
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
    d7: { good: 15, ok: 8 },
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
    d7: { good: 15, ok: 8 },
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
    d7: { good: 20, ok: 12 },
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
    d7: { good: 25, ok: 15 },
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
    d7: { good: 12, ok: 7 },
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
  headline: string;
  detail: string;
  area: "tutorial" | "loop" | "midgame" | "monetization" | "general";
  tips: string[];
  ratioD7D1?: number;
  ratioD30D7?: number;
};

export function diagnose(metrics: KpiMetrics, genre: GameGenre): Diagnosis | null {
  const { d1, d7, d30 } = metrics;
  if (d1 === undefined && d7 === undefined && d30 === undefined) return null;

  const bench = GENRE_BENCHMARKS[genre];
  const ratioD7D1 = d1 && d7 ? d7 / d1 : undefined;
  const ratioD30D7 = d7 && d30 ? d30 / d7 : undefined;

  // Check D1 first — it's the foundation
  if (d1 !== undefined && d1 < bench.d1.ok * 0.75) {
    return {
      priority: "critical",
      headline: "Tutorial quebrando",
      detail: "Jogador não tá chegando nem no D7. Provavelmente sai antes de sentir a graça do jogo.",
      area: "tutorial",
      tips: [
        "Encurte o tutorial — o ideal é menos de 3 minutos",
        "Dê uma recompensa satisfatória antes de terminar o tutorial",
        "Mostre o loop principal (plantar → colher, construir → resultado) na primeira sessão",
        "Remova barreiras de entrada: sem tempo de espera nos primeiros 10 minutos",
      ],
      ratioD7D1,
      ratioD30D7,
    };
  }

  // D1 ok but D7 broken — loop problem
  if (d7 !== undefined && d7 < bench.d7.ok * 0.7 && (ratioD7D1 === undefined || ratioD7D1 < 0.4)) {
    return {
      priority: "critical",
      headline: "Loop não prende",
      detail: "Jogador chega no D1 mas não volta. Não tem motivo claro pra abrir o jogo no D2, D3...",
      area: "loop",
      tips: [
        "Adicione uma recompensa pendente que só pode ser coletada no dia seguinte",
        "Crie um objetivo de curto prazo que não termina na primeira sessão",
        "Notificação push no D1 com algo concreto esperando pelo jogador",
        "Revise o loop básico — está claro o que fazer a seguir?",
      ],
      ratioD7D1,
      ratioD30D7,
    };
  }

  // D7 ok but D30 broken — mid-game problem
  if (d30 !== undefined && d30 < bench.d30.ok * 0.7 && (ratioD30D7 === undefined || ratioD30D7 < 0.4)) {
    return {
      priority: "warning",
      headline: "Mid-game vazio",
      detail: "Jogador fica sem o que fazer por volta dos níveis 20–50. A retenção de longo prazo está caindo.",
      area: "midgame",
      tips: [
        "Verifique se há objetivos de médio prazo (nível 20–50) — metas de construção, coleção, progressão",
        "Eventos sazonais ou conteúdo novo mantêm jogadores veteranos engajados",
        "Features sociais (amigos, cooperativas) criam loop externo de motivação",
        "Revise a progressão de dificuldade — está muito fácil ou travada por paywall?",
      ],
      ratioD7D1,
      ratioD30D7,
    };
  }

  // All retention ok — check monetization
  if (metrics.conversionRate !== undefined && metrics.conversionRate < bench.conversionRate.ok) {
    return {
      priority: "warning",
      headline: "Monetização fraca",
      detail: "Retenção boa, mas jogadores não estão convertendo para pagantes.",
      area: "monetization",
      tips: [
        "Revise os gatilhos de oferta — aparecem num momento de frustração ou desejo?",
        "A primeira oferta (starter pack) precisa parecer um absurdo de vantagem",
        "Teste preços menores com mais frequência de compra vs preço alto e raro",
        "Verifique se há pain points claros sem solução gratuita razoável",
      ],
      ratioD7D1,
      ratioD30D7,
    };
  }

  // Everything looks good
  return {
    priority: "great",
    headline: "Números saudáveis",
    detail: "Seu jogo está dentro ou acima do benchmark pra esse gênero. Continue monitorando.",
    area: "general",
    tips: [
      "Mantenha o ritmo de análise semanal mesmo quando está bem",
      "Hora de pensar em expansão — novos canais de aquisição ou features de engajamento",
    ],
    ratioD7D1,
    ratioD30D7,
  };
}
