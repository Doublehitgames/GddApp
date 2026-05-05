"use client";

import type { GameGenre } from "@/lib/kpi/types";
import { GENRE_BENCHMARKS } from "@/lib/kpi/benchmarks";

interface Props {
  genre: GameGenre;
}

const FUNNEL_TIPS: Record<GameGenre, { d1: string[]; d7d30: string[] }> = {
  farm: {
    d1: [
      "Tutorial longo ou entediante antes de sentir o loop",
      "Tempo de espera muito cedo (culturas demoram horas)",
      "Falta de recompensa clara na primeira sessão",
    ],
    d7d30: [
      "Falta de objetivo de médio prazo (ex.: construir algo grande)",
      "Loop repetitivo sem novidade a partir do nível 15",
      "Ausência de eventos ou conteúdo sazonal",
    ],
  },
  casual: {
    d1: [
      "Tutorial muito restritivo — jogador quer jogar logo",
      "Primeira fase muito fácil e sem graça",
      "Onboarding com muito texto",
    ],
    d7d30: [
      "Falta de novas mecânicas após os primeiros 20 níveis",
      "Dificuldade empaca o jogador sem explicação",
      "Sem streak ou recompensa diária visível",
    ],
  },
  rpg: {
    d1: [
      "Cutscene ou intro longa antes da ação",
      "Sistema de stats confuso para quem não é do gênero",
      "Primeiro combate chato ou desequilibrado",
    ],
    d7d30: [
      "Progressão de personagem freia por paywall",
      "Falta de narrativa contínua para engajar",
      "Guild / social inexistente na fase inicial",
    ],
  },
  puzzle: {
    d1: [
      "Primeiros níveis fáceis demais — sem desafio nem satisfação",
      "Mecânica principal não explicada com clareza visual",
      "Interface confusa",
    ],
    d7d30: [
      "Curva de dificuldade irregular — picos frustrantes",
      "Falta de variação de mecânica após alguns níveis",
      "Sem recompensa de progresso visível (mapas, mundos)",
    ],
  },
  idle: {
    d1: [
      "Primeira sessão não demonstra o loop idle com clareza",
      "Números crescem muito devagar no início",
      "Sem evento de prestige ou loop mais longo visível",
    ],
    d7d30: [
      "Jogo fica parado — sem novidade para voltar e ver",
      "Sem notificação ou incentivo para reabrir",
      "Falta de nova camada de automação ou mecânica",
    ],
  },
  shooter: {
    d1: [
      "Tutorial de controle muito lento para o gênero",
      "Primeiro match desbalanceado (jogador toma muita porrada)",
      "Falta de personalização de personagem cedo",
    ],
    d7d30: [
      "Progressão de armas trava por falta de moeda/farm",
      "Modos de jogo repetitivos",
      "Sem conteúdo de temporada ou novidade periódica",
    ],
  },
};

export default function KpiFunnelTab({ genre }: Props) {
  const bench = GENRE_BENCHMARKS[genre];
  const tips = FUNNEL_TIPS[genre];
  const maxValue = 100;

  return (
    <div className="space-y-6">
      {/* Info box */}
      <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-4 py-3">
        <p className="text-sm text-emerald-200 font-medium mb-1">Como usar esse funil</p>
        <p className="text-sm text-emerald-300/80">
          Você precisa mapear onde o seu funil quebra. Abaixo é o padrão do setor para <strong>{bench.label}</strong> — compare e identifique onde vocês estão abaixo.
        </p>
      </div>

      {/* Funnel bars */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Funil típico — {bench.label}</p>
        {bench.funnel.map((step) => (
          <div key={step.label} className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-xs text-gray-400 text-right leading-tight">{step.label}</span>
            <div className="flex-1 h-6 rounded-md bg-gray-800 overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${(step.value / maxValue) * 100}%`, backgroundColor: step.color }}
              />
              <span className="absolute inset-y-0 right-2 flex items-center text-xs font-mono font-semibold text-white/80">
                {step.value}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">Causas comuns de queda no D1</p>
          <ul className="space-y-1.5">
            {tips.d1.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/70" />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-rose-700/40 bg-rose-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-400 mb-3">Causas comuns de queda D7–D30</p>
          <ul className="space-y-1.5">
            {tips.d7d30.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500/70" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
