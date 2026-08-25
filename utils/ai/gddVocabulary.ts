// utils/ai/gddVocabulary.ts
//
// Blocos de vocabulário de GDD compartilhados pelos prompts de IA. Os
// domínios vêm de GAME_DESIGN_DOMAIN_IDS, então acrescentar um domínio
// ensina todos os endpoints de uma vez — sem prompt drift.

import { GAME_DESIGN_DOMAIN_IDS } from "@/lib/gameDesignDomains";

// ────────────────────────────────────────────────────────────────────────────
// CALLOUTS — 4 variantes
// ────────────────────────────────────────────────────────────────────────────

export const CALLOUTS_PROMPT_BLOCK = `**CALLOUTS na descrição da página** (4 variantes — use intencionalmente, 3-5 por página):

- \`note\` (💡) — informação contextual, nota lateral, curiosidade
- \`warning\` (⚠️) — explicar jargão técnico ("o que é USP / pity timer / core loop") OU lembrar "este é exemplo, substitua pelos elementos do SEU jogo"
- \`design-decision\` (🎯) — documentar tradeoff que foi tomado ("escolhi 3 facções em vez de 2 porque…")
- \`balance-note\` (⚖️) — concern de playtest ou tuning ("cuidado: este valor pode virar exploit se X")

**Em markdown**, use a sintaxe GitHub-style que o editor de descrição importa:
\`\`\`markdown
> [!note]
> Texto do callout aqui.

> [!warning]
> Explicação de jargão ou lembrete.

> [!design-decision]
> Tradeoff documentado.

> [!balance-note]
> Concern de balanceamento.
\`\`\`

Densidade alvo: 3-5 callouts por página narrativa. Não exagere (1 por parágrafo vira ruído) nem omita (sem callouts, perde valor educativo).`;

// ────────────────────────────────────────────────────────────────────────────
// FIVE-GROUP HIERARCHY — canonical GDD structure
// ────────────────────────────────────────────────────────────────────────────

export const FIVE_GROUP_HIERARCHY_PROMPT_BLOCK = `**HIERARQUIA CANÔNICA DE 5 GRUPOS** (um GDD profissional se organiza assim, nesta ordem):

1. **📖 Visão Geral** — capa: pitch, público-alvo, USP, diferencial
2. **🎮 Design de Jogo** — container com: Core Loop, Mecânicas Centrais, Progressão
3. **📦 Conteúdo do Jogo** — container com: personagens, itens, combate, narrativa, economia (específico do gênero)
4. **🎨 Apresentação** — container com: Controles/Acessibilidade, UX/UI, Arte, Áudio
5. **🏭 Produção** — container com: Tecnologia, Roadmap, Riscos, KPIs, Monetização, QA

Containers são seções pai que agrupam subseções. Novos conceitos devem encontrar SEU LUGAR nessa hierarquia em vez de virar seção flat na raiz.`;

// ────────────────────────────────────────────────────────────────────────────
// DOMAINS — derived from GAME_DESIGN_DOMAIN_IDS
// ────────────────────────────────────────────────────────────────────────────

const DOMAIN_DESCRIPTIONS: Record<(typeof GAME_DESIGN_DOMAIN_IDS)[number], string> = {
  combat: "combate, dano, inimigos, armas, habilidades de luta",
  economy: "moeda, preços, inflação, compra/venda, recursos",
  progression: "XP, níveis, unlocks, progressão do jogador, metas",
  crafting: "fabricação, receitas, materiais, crafting system",
  items: "itens, inventário, equipamentos, consumíveis, loot",
  characters: "personagens, classes, heróis, inimigos individuais, NPCs",
  world: "mundo, mapas, ambientes, level design, exploração",
  narrative: "história, personagens, diálogos, quests narrativas",
  audio: "música, SFX, voz, ambiência",
  ui: "interface, HUD, menus, feedback visual",
  technology: "engine, plataforma, performance, rede",
  other: "quando não se encaixa nos demais",
};

export const DOMAINS_PROMPT_BLOCK: string = (() => {
  const rows = GAME_DESIGN_DOMAIN_IDS.map(
    (id) => `- \`${id}\`: ${DOMAIN_DESCRIPTIONS[id]}`
  ).join("\n");
  return `**DOMÍNIOS VÁLIDOS (use apenas estes IDs, em minúsculo):**

${rows}`;
})();

// ────────────────────────────────────────────────────────────────────────────
// Convenience: the "base vocabulary" a prompt needs to know GDD semantics.
// ────────────────────────────────────────────────────────────────────────────

export const GDD_VOCAB_FULL: string = [
  FIVE_GROUP_HIERARCHY_PROMPT_BLOCK,
  CALLOUTS_PROMPT_BLOCK,
  DOMAINS_PROMPT_BLOCK,
].join("\n\n");
