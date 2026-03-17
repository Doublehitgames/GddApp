/**
 * Modelo de domínio para Game Design: taxonomia de sistemas/conceitos que a IA e o app usam
 * para entender e conectar seções do GDD (relações, consistência, sugestões).
 *
 * Cada seção pode ter uma ou mais tags; isso permite:
 * - Sugerir relações (ex.: Combate ↔ Itens)
 * - Análise de consistência entre sistemas
 * - Prompts de IA mais precisos
 */

export const GAME_DESIGN_DOMAIN_IDS = [
  "combat",
  "economy",
  "progression",
  "crafting",
  "items",
  "world",
  "narrative",
  "audio",
  "ui",
  "technology",
  "other",
] as const;

export type GameDesignDomainId = (typeof GAME_DESIGN_DOMAIN_IDS)[number];

/** Chave de tradução para cada domínio (sectionDetail.domain.* ou domain.*) */
export const DOMAIN_I18N_KEYS: Record<GameDesignDomainId, string> = {
  combat: "sectionDetail.domain.combat",
  economy: "sectionDetail.domain.economy",
  progression: "sectionDetail.domain.progression",
  crafting: "sectionDetail.domain.crafting",
  items: "sectionDetail.domain.items",
  world: "sectionDetail.domain.world",
  narrative: "sectionDetail.domain.narrative",
  audio: "sectionDetail.domain.audio",
  ui: "sectionDetail.domain.ui",
  technology: "sectionDetail.domain.technology",
  other: "sectionDetail.domain.other",
};

export function isValidDomainId(id: string): id is GameDesignDomainId {
  return (GAME_DESIGN_DOMAIN_IDS as readonly string[]).includes(id);
}

export function normalizeDomainTags(tags: string[] | undefined): GameDesignDomainId[] {
  if (!tags?.length) return [];
  const seen = new Set<GameDesignDomainId>();
  const out: GameDesignDomainId[] = [];
  for (const t of tags) {
    const id = t.trim().toLowerCase();
    if (isValidDomainId(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
