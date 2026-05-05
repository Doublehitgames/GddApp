import type { GameGenre, KpiMetrics, KpiGameProfile } from "./types";

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

// ─── Tip pools por área e perfil ─────────────────────────────────────────────

function getTutorialTips(profile?: KpiGameProfile): string[] {
  if (!profile?.hasTutorial) {
    return [
      "Sem tutorial formal, a primeira sessão precisa ser autoexplicativa",
      "Coloque o jogador fazendo algo satisfatório nos primeiros 60 segundos",
      "Use UI hints contextuais para guiar sem interromper",
      "Dê uma recompensa clara após a primeira ação bem-sucedida",
      "Teste com alguém que nunca viu o jogo — observe onde ela trava",
    ];
  }
  return [
    "Encurte o tutorial — o ideal é menos de 3 minutos",
    "Dê uma recompensa satisfatória antes de terminar o tutorial",
    "Mostre o loop principal na primeira sessão, sem enrolação",
    "Remova barreiras de entrada: sem tempo de espera nos primeiros 10 minutos",
    "Deixe o jogador errar e corrigir — não bloqueie o progresso por falha",
  ];
}

function getLoopTips(profile?: KpiGameProfile): string[] {
  const base: string[] = [
    "Adicione uma recompensa pendente que só pode ser coletada no dia seguinte",
    "Crie um objetivo de curto prazo que não termina na primeira sessão",
    "Notificação push no D1 com algo concreto esperando pelo jogador",
  ];

  if (profile?.loopType === "pvp") {
    return [
      ...base,
      "Loop PvP precisa de progressão visível mesmo em derrota (XP, ranking, shard)",
      "Verifique matchmaking — desequilíbrio excessivo destrói a retenção",
      "Cada partida deve terminar com um ganho perceptível (skin, moeda, progresso)",
    ];
  }
  if (profile?.loopType === "sandbox") {
    return [
      ...base,
      "Em sandbox, o loop inicial deve mostrar possibilidades, não obrigações",
      "Dê um objetivo sugerido (não forçado) para guiar os primeiros dias",
      "Estrutura social (ver criações de outros) cria motivação externa poderosa",
    ];
  }
  if (profile?.loopType === "progression") {
    return [
      ...base,
      "A curva de progressão deve ter picos de satisfação a cada 2–3 sessões",
      "Deixe o jogador perceber sua evolução com comparações visuais (antes/depois)",
      "Desbloqueios de conteúdo são mais motivadores que aumentos de número puro",
    ];
  }
  // levels (default)
  return [
    ...base,
    "Revise o loop básico — está claro o que fazer a seguir?",
    "A curva de dificuldade das fases deve ser suave nos primeiros 10 níveis",
  ];
}

function getMidgameTips(profile?: KpiGameProfile): string[] {
  const base = [
    "Eventos sazonais ou conteúdo novo mantêm jogadores veteranos engajados",
    "Revise a progressão de dificuldade — está travada por paywall?",
  ];
  if (profile?.loopType === "pvp") {
    return [
      "Liga ou temporada com recompensas exclusivas cria urgência de longo prazo",
      "Clãs e guilds criam compromisso social que segura o jogador no mid-game",
      ...base,
    ];
  }
  return [
    "Verifique se há objetivos de médio prazo — metas de construção, coleção, progressão",
    "Features sociais (amigos, cooperativas) criam loop externo de motivação",
    ...base,
  ];
}

function getMonetizationTips(profile?: KpiGameProfile): string[] {
  if (profile?.monetization === "ads") {
    return [
      "Com modelo de anúncios, foco deve ser em sessões frequentes e duração média alta",
      "Rewarded ads (assistir para ganhar) têm aceitação muito maior que banners forçados",
      "Limite a frequência de interstitials — muitos anúncios destroem a retenção",
      "Ofereça opção de remover anúncios como único IAP — converte bem",
    ];
  }
  if (profile?.monetization === "premium") {
    return [
      "Jogo premium não tem conversão recorrente — foco em avaliações e boca a boca",
      "DLCs e expansões são o principal vetor de receita adicional",
      "Alta retenção gera reviews positivos que alimentam aquisição orgânica",
    ];
  }
  // iap or iap_ads
  return [
    "Revise os gatilhos de oferta — aparecem num momento de frustração ou desejo?",
    "A primeira oferta (starter pack) precisa parecer um absurdo de vantagem",
    "Teste preços menores com mais frequência vs preço alto e raro",
    "Verifique se há pain points claros sem solução gratuita razoável",
  ];
}

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
      headline: hasTutorial ? "Tutorial quebrando" : "Primeira sessão não convence",
      detail: hasTutorial
        ? "Jogador não está chegando nem no D7. Provavelmente sai antes de sentir a graça do jogo."
        : "Sem tutorial formal, o jogador não está entendendo o que fazer logo de início e abandona cedo.",
      area: "tutorial",
      tips: getTutorialTips(profile),
      ratioD7D1,
      ratioD30D7,
    };
  }

  // ── D1 ok mas D7 caiu muito → loop não prende ─────────────────────────────
  if (d7 !== undefined && d7 < bench.d7.ok * 0.7 && (ratioD7D1 === undefined || ratioD7D1 < 0.4)) {
    const loopLabel =
      profile?.loopType === "pvp" ? "PvP não mantém engajamento entre partidas" :
      profile?.loopType === "sandbox" ? "Sandbox sem direção perde o jogador rápido" :
      "Loop não prende";
    return {
      priority: "critical",
      headline: loopLabel,
      detail: "Jogador chega no D1 mas não volta. Não tem motivo concreto para abrir o jogo no D2, D3...",
      area: "loop",
      tips: getLoopTips(profile),
      ratioD7D1,
      ratioD30D7,
    };
  }

  // ── D7 ok mas D30 caiu → mid-game vazio ───────────────────────────────────
  if (d30 !== undefined && d30 < bench.d30.ok * 0.7 && (ratioD30D7 === undefined || ratioD30D7 < 0.4)) {
    return {
      priority: "warning",
      headline: "Mid-game vazio",
      detail: "Jogador fica sem o que fazer por volta dos níveis intermediários. Retenção de longo prazo está caindo.",
      area: "midgame",
      tips: getMidgameTips(profile),
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
      headline: "Monetização fraca",
      detail: "Retenção boa, mas jogadores não estão convertendo para pagantes.",
      area: "monetization",
      tips: getMonetizationTips(profile),
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
        headline: monetization === "ads" ? "Engajamento baixo afeta receita de anúncios" : "Engajamento abaixo do esperado",
        detail: "Com modelo baseado em sessões, a frequência e duração do jogo são seu principal indicador de receita.",
        area: "loop",
        tips: getMonetizationTips(profile),
        ratioD7D1,
        ratioD30D7,
      };
    }
  }

  // Tudo ok
  return {
    priority: "great",
    headline: "Números saudáveis",
    detail: "Seu jogo está dentro ou acima do benchmark para esse gênero. Continue monitorando.",
    area: "general",
    tips: [
      "Mantenha o ritmo de análise semanal mesmo quando está bem",
      "Hora de pensar em expansão — novos canais de aquisição ou features de engajamento",
    ],
    ratioD7D1,
    ratioD30D7,
  };
}
