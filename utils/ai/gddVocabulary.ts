// utils/ai/gddVocabulary.ts
//
// Shared GDD vocabulary blocks for AI prompts. Derived from the actual
// registries (PAGE_TYPES, GAME_DESIGN_DOMAIN_IDS) so that every time we
// add a page type / domain, every in-page AI endpoint learns about it
// automatically — no prompt drift.
//
// Addon descriptions are hand-tuned for prompts (different purpose than
// UI labels), but keyed by the same SectionAddonType union so TypeScript
// catches drift at compile time.

import { PAGE_TYPES, type PageTypeId } from "@/lib/pageTypes/registry";
import { GAME_DESIGN_DOMAIN_IDS } from "@/lib/gameDesignDomains";
import type { SectionAddonType } from "@/lib/addons/types";

// ────────────────────────────────────────────────────────────────────────────
// PAGE TYPES — derived from registry
// ────────────────────────────────────────────────────────────────────────────

export const PAGE_TYPES_PROMPT_BLOCK: string = (() => {
  const rows = PAGE_TYPES.map((p) => {
    const addonSummary = p.addons.length
      ? p.addons.map((a) => a.type).join(", ")
      : "—";
    const tagSummary = p.tags?.length ? p.tags.join(", ") : "—";
    return `| \`${p.id}\` | ${p.emoji} ${p.label} | ${p.description} | ${addonSummary} | ${tagSummary} |`;
  }).join("\n");

  return `**TIPOS DE PÁGINA DISPONÍVEIS** (atribua \`pageType.id\` quando fizer sentido; a maioria das páginas deve ser \`narrative\`):

| id | label | quando usar | addons seedados | domínios |
|----|-------|-------------|-----------------|----------|
${rows}`;
})();

/** Compact variant — id + label + one-line description. Use when prompt budget is tight. */
export const PAGE_TYPES_COMPACT_BLOCK: string = (() => {
  const lines = PAGE_TYPES.map(
    (p) => `- \`${p.id}\` ${p.emoji} ${p.label}: ${p.description}`
  ).join("\n");
  return `**TIPOS DE PÁGINA** (atribua \`pageType.id\`; default \`narrative\`):\n${lines}`;
})();

// ────────────────────────────────────────────────────────────────────────────
// ADDON TYPES — hand-tuned prompt descriptions, keyed by SectionAddonType
// ────────────────────────────────────────────────────────────────────────────

type AddonPromptInfo = {
  label: string;
  whenToUse: string;
};

const ADDON_PROMPT_INFO: Record<Exclude<SectionAddonType, "genericStats">, AddonPromptInfo> = {
  currency: {
    label: "Currency (Moeda)",
    whenToUse: "Moeda do jogo (ouro, gemas, energia). Uma por seção de tipo economy.",
  },
  globalVariable: {
    label: "Global Variable",
    whenToUse: "Variável global reutilizável (taxa de venda, bônus, multiplicador).",
  },
  economyLink: {
    label: "Economy Link",
    whenToUse: "Preço de compra/venda de um item. Referencia uma currency existente.",
  },
  xpBalance: {
    label: "XP Balance (Curva de XP)",
    whenToUse: "Curva de XP por nível (linear, exponencial, preset). Base para progressionTable.",
  },
  progressionTable: {
    label: "Progression Table",
    whenToUse: "Tabela de níveis com valores por nível (HP, ATK, unlocks, etc).",
  },
  inventory: {
    label: "Inventory (Item)",
    whenToUse: "Declara um item stackável (semente, arma, consumível). Tem categoria e maxStack.",
  },
  production: {
    label: "Production (Receita)",
    whenToUse: "Receita: ingredientes entram, outputs saem. Modo receipt ou passive (geração passiva).",
  },
  craftTable: {
    label: "Craft Table (Mesa de Produção)",
    whenToUse: "Estação que agrega várias receitas (Serraria, Forja, Bancada).",
  },
  dataSchema: {
    label: "Data Schema",
    whenToUse: "Dados tipados específicos da seção (key/label/valueType/value). Ex: dados de uma semente.",
  },
  attributeDefinitions: {
    label: "Attribute Definitions",
    whenToUse: "Catálogo reutilizável de atributos (HP, ATK, DEF, SPD). Referenciado por attributeProfile/Modifiers.",
  },
  attributeProfile: {
    label: "Attribute Profile",
    whenToUse: "Valores de atributos para um personagem específico. Precisa de attributeDefinitions.",
  },
  attributeModifiers: {
    label: "Attribute Modifiers",
    whenToUse: "Modificadores de atributos (+5 ATK, x1.2 SPD) para equipamentos/buffs.",
  },
  fieldLibrary: {
    label: "Field Library",
    whenToUse: "Biblioteca compartilhada de keys/labels para progressionTable, dataSchema, inventory.category.",
  },
  exportSchema: {
    label: "Export Schema (Remote Config)",
    whenToUse: "Schema de exportação pra remote config (JSON/CSV por linha/coluna/chave/matriz).",
  },
  richDoc: {
    label: "Rich Doc (Documento Rico)",
    whenToUse: "Blocos ricos BlockNote (heading/paragraph/bulletListItem/callout). Primary addon de seções narrative.",
  },
};

export const ADDON_TYPES_PROMPT_BLOCK: string = (() => {
  const rows = (Object.entries(ADDON_PROMPT_INFO) as Array<[SectionAddonType, AddonPromptInfo]>)
    .map(([type, info]) => `- \`${type}\` — ${info.label}: ${info.whenToUse}`)
    .join("\n");

  return `**TIPOS DE ADDON DISPONÍVEIS** (cada seção pode ter múltiplos addons; são dados estruturados, não texto):

${rows}`;
})();

/** Compact one-liner for a single addon type (used inline in context blocks). */
export function describeAddonType(type: SectionAddonType): string {
  const key = type === "genericStats" ? "dataSchema" : type;
  const info = ADDON_PROMPT_INFO[key as keyof typeof ADDON_PROMPT_INFO];
  return info ? `${info.label} — ${info.whenToUse}` : type;
}

// ────────────────────────────────────────────────────────────────────────────
// RICH DOC CALLOUTS — 4 variants
// ────────────────────────────────────────────────────────────────────────────

export const RICH_DOC_CALLOUTS_PROMPT_BLOCK = `**CALLOUTS em richDoc** (4 variantes — use intencionalmente, 3-5 por página):

- \`note\` (💡) — informação contextual, nota lateral, curiosidade
- \`warning\` (⚠️) — explicar jargão técnico ("o que é USP / pity timer / core loop") OU lembrar "este é exemplo, substitua pelos elementos do SEU jogo"
- \`design-decision\` (🎯) — documentar tradeoff que foi tomado ("escolhi 3 facções em vez de 2 porque…")
- \`balance-note\` (⚖️) — concern de playtest ou tuning ("cuidado: este valor pode virar exploit se X")

**Em markdown**, use a sintaxe GitHub-style que o editor richDoc importa:
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
  PAGE_TYPES_PROMPT_BLOCK,
  ADDON_TYPES_PROMPT_BLOCK,
  RICH_DOC_CALLOUTS_PROMPT_BLOCK,
  DOMAINS_PROMPT_BLOCK,
].join("\n\n");

/** Compact variant — page types + addons only. Use when prompt budget is tight. */
export const GDD_VOCAB_COMPACT: string = [
  PAGE_TYPES_PROMPT_BLOCK,
  ADDON_TYPES_PROMPT_BLOCK,
].join("\n\n");

/** Valid page type ids exported so callers can validate LLM output. */
export const VALID_PAGE_TYPE_IDS: ReadonlyArray<PageTypeId> = PAGE_TYPES.map((p) => p.id);
