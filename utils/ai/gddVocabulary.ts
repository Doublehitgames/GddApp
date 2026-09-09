// utils/ai/gddVocabulary.ts
//
// Blocos de vocabulário de GDD compartilhados pelos prompts de IA. Os
// domínios vêm de GAME_DESIGN_DOMAIN_IDS, então acrescentar um domínio
// ensina todos os endpoints de uma vez — sem prompt drift.

import { GAME_DESIGN_DOMAIN_IDS } from "@/lib/gameDesignDomains";

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

