import type {
  AttributeDefinitionEntry,
  AttributeProfileAddonDraft,
  CraftTableEntry,
  EconomyLinkAddonDraft,
  GlobalVariableSectionAddon,
  ProductionIngredient,
  ProductionOutput,
  ProgressionTableColumn,
  RichDocBlock,
  SectionAddon,
  SectionAddonType,
} from "@/lib/addons/types";
import { buildProgressionRowsFromRange, createDefaultRichDocAddon } from "@/lib/addons/types";
import { generateAllProgressionColumnValues } from "@/lib/addons/progressionTableGenerator";
import { getAddonRegistryEntry } from "@/lib/addons/registry";
import type { GameDesignDomainId } from "@/lib/gameDesignDomains";

export type PageTypeId =
  | "blank"
  | "items"
  | "equipmentItem"
  | "characters"
  | "attributeDefinitions"
  | "economy"
  | "currencyExchange"
  | "progression"
  | "recipe"
  | "craftTable"
  | "narrative";

/**
 * Semantic dependencies a page type can declare. Each kind is resolved by
 * the sidebar via a dedicated modal flow (link-existing / create-new / skip)
 * and wired into the seeded addons at build time.
 */
export type RequirementKind =
  | "attributeDefinitions"
  | "currency"
  | "itemIngredient"
  | "itemOutput";

/** Which page type to create when the user picks "create new" for each kind. */
export const REQUIREMENT_KIND_TO_PAGE_TYPE: Record<RequirementKind, PageTypeId> = {
  attributeDefinitions: "attributeDefinitions",
  currency: "economy",
  itemIngredient: "items",
  itemOutput: "items",
};

export type PageTypeAddon = {
  type: SectionAddonType;
  role: "primary" | "recommended";
  /** Override the default name used by the seeded addon (pt-BR fallback). */
  nameOverride?: string;
  /** i18n key for the localized nameOverride. Takes precedence over `nameOverride` when a translator is available. */
  nameOverrideKey?: string;
  /** Post-create tweak (e.g. preload attribute list with HP/ATK/DEF). */
  customize?: (addon: SectionAddon, options?: BuildPageTypeAddonsOptions) => SectionAddon;
};

/** Lightweight translator type (matches the `t` returned by `useI18n()`). */
export type Translator = (key: string, fallback?: string) => string;

export type PageType = {
  id: PageTypeId;
  label: string;
  description: string;
  emoji: string;
  addons: PageTypeAddon[];
  /** Semantic dependencies resolved by the requires dialog, in declared order. */
  requires?: RequirementKind[];
  /**
   * Fallback section title used when this page type is auto-created by
   * another flow (e.g. the requires-dialog "create new" path). When absent,
   * the picker's `label` is used.
   */
  defaultSectionTitle?: string;
  /** Domain tags applied to sections created with this page type. */
  tags?: GameDesignDomainId[];
};

/** Sentinel keys that identify auto-created economy-modifier globalVariables. */
export const BUY_DISCOUNT_VAR_KEY = "item_buy_discount";
export const SELL_MARKUP_VAR_KEY = "item_sell_markup";

/**
 * Preset attributes used by the default `attributeDefinitions` seed.
 * Exposed so the character-settings UI can offer checkboxes for them.
 */
export const PRESET_ATTRIBUTES: ReadonlyArray<{
  key: string;
  label: string;
  valueType: AttributeDefinitionEntry["valueType"];
  defaultValue: number;
  min?: number;
}> = [
  { key: "hp", label: "HP", valueType: "int", defaultValue: 100, min: 0 },
  { key: "atk", label: "ATK", valueType: "int", defaultValue: 10, min: 0 },
  { key: "def", label: "DEF", valueType: "int", defaultValue: 5, min: 0 },
  { key: "spd", label: "SPD", valueType: "int", defaultValue: 5, min: 0 },
];

/**
 * Stable `{key,label}` projection of PRESET_ATTRIBUTES. Callers that feed
 * the attribute-slots picker UI should reference this constant so the
 * array identity is stable across renders (prevents unnecessary re-renders
 * in child pickers).
 */
export const PRESET_ATTRIBUTES_DISPLAY: ReadonlyArray<{ key: string; label: string }> =
  PRESET_ATTRIBUTES.map((p) => ({ key: p.key, label: p.label }));

const seedDefaultCurrency = (addon: SectionAddon): SectionAddon => {
  if (addon.type !== "currency") return addon;
  return {
    ...addon,
    data: {
      ...addon.data,
      code: "COINS",
      displayName: "Coins",
    },
  };
};

const seedCurrencyExchangeFromOptions = (
  addon: SectionAddon,
  options?: BuildPageTypeAddonsOptions
): SectionAddon => {
  if (addon.type !== "currencyExchange") return addon;
  const seed = options?.seedCurrencyExchange;
  if (!seed) return addon;
  if (!seed.fromCurrencyRef || !seed.toCurrencyRef) return addon;
  if (seed.fromCurrencyRef === seed.toCurrencyRef) return addon;
  const entryId = `cex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    ...addon,
    data: {
      ...addon.data,
      entries: [
        {
          id: entryId,
          fromCurrencyRef: seed.fromCurrencyRef,
          fromAmount: Math.max(0, seed.fromAmount || 0),
          toCurrencyRef: seed.toCurrencyRef,
          toAmount: Math.max(0, seed.toAmount || 0),
          direction: seed.direction === "bidirectional" ? "bidirectional" : "oneWay",
        },
      ],
    },
  };
};

const seedAttributeDefinitions = (
  addon: SectionAddon,
  options?: BuildPageTypeAddonsOptions
): SectionAddon => {
  if (addon.type !== "attributeDefinitions") return addon;
  const now = Date.now();
  const override = options?.attributeDefinitionsOverrides?.attributes;
  const source = override && override.length > 0 ? override : PRESET_ATTRIBUTES;
  const attributes: AttributeDefinitionEntry[] = source.map((attr, idx) => ({
    id: `attr-${now}-${idx}-${attr.key}`,
    key: attr.key,
    label: attr.label,
    valueType: attr.valueType,
    defaultValue: attr.defaultValue,
    ...(typeof attr.min === "number" ? { min: attr.min } : {}),
  }));
  return {
    ...addon,
    data: {
      ...addon.data,
      attributes,
    },
  };
};

export const PAGE_TYPES: PageType[] = [
  {
    id: "blank",
    label: "Em branco",
    description: "Página vazia, sem addons pré-configurados.",
    emoji: "📄",
    addons: [],
  },
  {
    id: "items",
    label: "Itens",
    description: "Lista de itens do seu jogo (madeira, poção, chave). Já vem com inventário e preço de compra/venda.",
    emoji: "🎒",
    addons: [
      { type: "inventory", role: "primary", nameOverride: "Inventário", nameOverrideKey: "pageTypes.addonNames.inventory" },
      { type: "economyLink", role: "recommended", nameOverride: "Economia", nameOverrideKey: "pageTypes.addonNames.economy" },
    ],
    requires: ["currency"],
    tags: ["items", "economy"],
  },
  {
    id: "equipmentItem",
    label: "Itens com Efeito",
    description: "Itens que mudam atributos quando equipados ou usados (armadura, amuleto, poção). Já vem com inventário, preço e bônus de atributos.",
    emoji: "⚔️",
    addons: [
      { type: "inventory", role: "primary", nameOverride: "Inventário", nameOverrideKey: "pageTypes.addonNames.inventory" },
      { type: "economyLink", role: "recommended", nameOverride: "Economia", nameOverrideKey: "pageTypes.addonNames.economy" },
      { type: "attributeModifiers", role: "recommended", nameOverride: "Efeitos", nameOverrideKey: "pageTypes.addonNames.equipmentEffects" },
    ],
    requires: ["currency", "attributeDefinitions"],
    tags: ["items", "economy", "combat"],
  },
  {
    id: "characters",
    label: "Personagens",
    description: "Personagens do jogo com atributos (HP, ATK, DEF...) e progressão por nível. Funciona pra heróis, inimigos ou NPCs.",
    emoji: "👤",
    addons: [
      { type: "attributeProfile", role: "primary" },
      { type: "xpBalance", role: "recommended", nameOverride: "Curva de XP", nameOverrideKey: "pageTypes.addonNames.xpCurve" },
      { type: "progressionTable", role: "recommended" },
      { type: "attributeModifiers", role: "recommended", nameOverride: "Efeitos por personagem", nameOverrideKey: "pageTypes.addonNames.variantModifiers" },
    ],
    requires: ["attributeDefinitions"],
    tags: ["characters", "combat", "progression"],
  },
  {
    id: "attributeDefinitions",
    label: "Atributos",
    description: "Lista de atributos (HP, ATK, DEF...) que pode ser reaproveitada por vários personagens.",
    emoji: "🎯",
    addons: [
      {
        type: "attributeDefinitions",
        role: "primary",
        nameOverride: "Atributos base",
        nameOverrideKey: "pageTypes.addonNames.attributeDefinitionsBase",
        customize: seedAttributeDefinitions,
      },
      {
        type: "fieldLibrary",
        role: "recommended",
        nameOverride: "Biblioteca de Campos",
        nameOverrideKey: "pageTypes.addonNames.fieldLibrary",
      },
    ],
    tags: ["combat", "progression"],
  },
  {
    id: "economy",
    label: "Economia",
    description: "Moeda do jogo (ouro, gemas, energia). Define o nome, o símbolo e regras básicas.",
    emoji: "🪙",
    defaultSectionTitle: "Coin",
    addons: [
      {
        type: "currency",
        role: "primary",
        nameOverride: "Moeda",
        nameOverrideKey: "pageTypes.addonNames.currency",
        customize: seedDefaultCurrency,
      },
    ],
    tags: ["economy"],
  },
  {
    id: "currencyExchange",
    label: "Casa de Câmbio",
    description: "Página de conversões entre moedas: define quanto de uma moeda compra outra (ex.: 100 GOLD ⇄ 1 GEM).",
    emoji: "💱",
    defaultSectionTitle: "Casa de Câmbio",
    addons: [
      {
        type: "currencyExchange",
        role: "primary",
        nameOverride: "Casa de Câmbio",
        nameOverrideKey: "pageTypes.addonNames.currencyExchange",
        customize: seedCurrencyExchangeFromOptions,
      },
    ],
    tags: ["economy"],
  },
  {
    id: "progression",
    label: "Progressão",
    description: "Tabela de XP e níveis — quanto XP precisa pra subir de nível e o que cada nível entrega.",
    emoji: "📈",
    addons: [
      { type: "xpBalance", role: "primary" },
      { type: "progressionTable", role: "recommended" },
    ],
    tags: ["progression"],
  },
  {
    id: "recipe",
    label: "Receita",
    description: "Uma receita: ingredientes entram, item sai. Ex.: '2 Madeiras → 1 Tábua'.",
    emoji: "📜",
    addons: [
      {
        type: "production",
        role: "primary",
        nameOverride: "Produção",
        nameOverrideKey: "pageTypes.addonNames.production",
      },
    ],
    requires: ["itemIngredient", "itemOutput"],
    tags: ["crafting", "items"],
  },
  {
    id: "craftTable",
    label: "Mesa de Craft",
    description: "Uma estação que agrupa várias receitas (Serraria, Forja, Bancada). Você escolhe quais receitas ela produz.",
    emoji: "🏭",
    addons: [
      {
        type: "craftTable",
        role: "primary",
        nameOverride: "Mesa de Produção",
        nameOverrideKey: "pageTypes.addonNames.craftTable",
      },
    ],
    tags: ["crafting"],
  },
  {
    id: "narrative",
    label: "Narrativa",
    description: "Texto corrido pra lore, roteiro ou descrição — tipo um documento de texto.",
    emoji: "📖",
    addons: [{ type: "richDoc", role: "primary" }],
    tags: ["narrative"],
  },
];

/** Legacy page type IDs that were merged/renamed — mapped to their current equivalents. */
const LEGACY_PAGE_TYPE_ID_MAP: Record<string, PageTypeId> = {
  charactersPlayable: "characters",
  enemies: "characters",
};

export function getPageType(id: PageTypeId | string | undefined): PageType | undefined {
  if (!id) return undefined;
  const resolvedId = LEGACY_PAGE_TYPE_ID_MAP[id] ?? id;
  return PAGE_TYPES.find((p) => p.id === resolvedId);
}

// ─── i18n helpers ────────────────────────────────────────────────────────

/** Returns the localized label for a page type, with pt-BR fallback. */
export function getPageTypeLabel(pt: PageType, t?: Translator): string {
  if (!t) return pt.label;
  return t(`pageTypes.ids.${pt.id}.label`, pt.label);
}

/** Returns the localized description for a page type, with pt-BR fallback. */
export function getPageTypeDescription(pt: PageType, t?: Translator): string {
  if (!t) return pt.description;
  return t(`pageTypes.ids.${pt.id}.description`, pt.description);
}

/**
 * Returns the localized `defaultSectionTitle` for a page type, falling back
 * to its label when no default title is declared.
 */
export function getPageTypeDefaultSectionTitle(pt: PageType, t?: Translator): string {
  const fallback = pt.defaultSectionTitle || pt.label;
  if (!t) return fallback;
  if (pt.defaultSectionTitle) {
    return t(`pageTypes.ids.${pt.id}.defaultSectionTitle`, pt.defaultSectionTitle);
  }
  return t(`pageTypes.ids.${pt.id}.label`, pt.label);
}

/**
 * Resolves the addon name used when seeding a page type's addons. Prefers
 * the localized `nameOverrideKey` when a translator is available; otherwise
 * returns the pt-BR `nameOverride` or an empty string.
 */
export function resolveAddonName(entry: PageTypeAddon, t?: Translator): string | undefined {
  if (!entry.nameOverride && !entry.nameOverrideKey) return undefined;
  if (t && entry.nameOverrideKey) {
    return t(entry.nameOverrideKey, entry.nameOverride ?? "");
  }
  return entry.nameOverride;
}

// ─── Candidates ──────────────────────────────────────────────────────────

export type RequiresCandidateKind =
  | "attributeDefinitions"
  | "currency"
  | "item"
  | "recipe";

/** Generic candidate presented in the requires dialog. */
export type RequiresCandidate = {
  kind: RequiresCandidateKind;
  sectionId: string;
  sectionTitle: string;
  addonId: string;
  addonName: string;
  /** Filled when kind === "attributeDefinitions". */
  attributes?: AttributeDefinitionEntry[];
  /** Filled when kind === "currency". */
  currency?: {
    code?: string;
    displayName?: string;
    kind?: string;
  };
  /** Filled when kind === "item": raw item metadata used for preview. */
  item?: {
    inventoryName?: string;
    category?: string;
    stackable?: boolean;
    maxStack?: number;
  };
  /** Filled when kind === "recipe": output summary used for preview. */
  recipe?: {
    mode: "passive" | "recipe";
    ingredientsCount: number;
    outputsCount: number;
    craftTimeSeconds?: number;
  };
};

/** Backward-compat alias (v1 public name). */
export type AttributeDefinitionsCandidate = RequiresCandidate;

type SectionLike = {
  id: string;
  title: string;
  addons?: SectionAddon[];
};

export function findAttributeDefinitionsCandidates(
  sections: SectionLike[]
): RequiresCandidate[] {
  const out: RequiresCandidate[] = [];
  for (const section of sections) {
    for (const addon of section.addons || []) {
      if (addon.type !== "attributeDefinitions") continue;
      out.push({
        kind: "attributeDefinitions",
        sectionId: section.id,
        sectionTitle: section.title || section.id,
        addonId: addon.id,
        addonName: addon.name || addon.data.name || "Definições de atributos",
        attributes: addon.data.attributes || [],
      });
    }
  }
  return out;
}

/**
 * Locates the first `fieldLibrary` addon inside a section and builds a
 * lookup from attribute key → library entry id, matching entries whose
 * key follows the `{attrKey}_progression` convention.
 */
export function extractFieldLibraryRefForAttrs(
  section: SectionLike | undefined,
  attrKeys: string[]
): { libraryAddonId: string; entryIdByAttrKey: Record<string, string> } | undefined {
  if (!section) return undefined;
  const library = (section.addons || []).find((a) => a.type === "fieldLibrary");
  if (!library || library.type !== "fieldLibrary") return undefined;
  const entries = library.data.entries || [];
  const entryIdByAttrKey: Record<string, string> = {};
  for (const attrKey of attrKeys) {
    const expected = `${attrKey}_progression`;
    const match = entries.find((e) => e.key === expected);
    if (match) entryIdByAttrKey[attrKey] = match.id;
  }
  if (Object.keys(entryIdByAttrKey).length === 0) return undefined;
  return { libraryAddonId: library.id, entryIdByAttrKey };
}

export function findItemCandidates(sections: SectionLike[]): RequiresCandidate[] {
  const out: RequiresCandidate[] = [];
  for (const section of sections) {
    for (const addon of section.addons || []) {
      if (addon.type !== "inventory") continue;
      out.push({
        kind: "item",
        sectionId: section.id,
        sectionTitle: section.title || section.id,
        addonId: addon.id,
        addonName: addon.name || addon.data.name || "Item",
        item: {
          inventoryName: addon.data.name,
          category: addon.data.inventoryCategory,
          stackable: addon.data.stackable,
          maxStack: addon.data.maxStack,
        },
      });
    }
  }
  return out;
}

export function findRecipeCandidates(sections: SectionLike[]): RequiresCandidate[] {
  const out: RequiresCandidate[] = [];
  for (const section of sections) {
    for (const addon of section.addons || []) {
      if (addon.type !== "production") continue;
      if (addon.data.mode !== "recipe") continue;
      out.push({
        kind: "recipe",
        sectionId: section.id,
        sectionTitle: section.title || section.id,
        addonId: addon.id,
        addonName: addon.name || addon.data.name || "Receita",
        recipe: {
          mode: addon.data.mode,
          ingredientsCount: (addon.data.ingredients || []).length,
          outputsCount: (addon.data.outputs || []).length,
          craftTimeSeconds: addon.data.craftTimeSeconds,
        },
      });
    }
  }
  return out;
}

export function findCurrencyCandidates(sections: SectionLike[]): RequiresCandidate[] {
  const out: RequiresCandidate[] = [];
  for (const section of sections) {
    for (const addon of section.addons || []) {
      if (addon.type !== "currency") continue;
      out.push({
        kind: "currency",
        sectionId: section.id,
        sectionTitle: section.title || section.id,
        addonId: addon.id,
        addonName: addon.name || addon.data.name || "Moeda",
        currency: {
          code: addon.data.code?.trim(),
          displayName: addon.data.displayName?.trim(),
          kind: addon.data.kind,
        },
      });
    }
  }
  return out;
}

/**
 * Locates the first pair of economy-modifier globalVariable sections
 * (buy-discount + sell-markup). Accepts any key whose prefix matches the
 * sentinel — this lets per-item variants (e.g. `item_buy_discount_premium`)
 * also count as an existing pair.
 */
export function findEconomyModifierSectionIds(sections: SectionLike[]): {
  buyDiscountSectionId: string | null;
  sellMarkupSectionId: string | null;
} {
  let buy: string | null = null;
  let sell: string | null = null;
  for (const section of sections) {
    for (const addon of section.addons || []) {
      if (addon.type !== "globalVariable") continue;
      const key = addon.data.key;
      if (!key) continue;
      if (!buy && (key === BUY_DISCOUNT_VAR_KEY || key.startsWith(`${BUY_DISCOUNT_VAR_KEY}_`))) {
        buy = section.id;
      } else if (!sell && (key === SELL_MARKUP_VAR_KEY || key.startsWith(`${SELL_MARKUP_VAR_KEY}_`))) {
        sell = section.id;
      }
    }
  }
  return { buyDiscountSectionId: buy, sellMarkupSectionId: sell };
}

export type EconomyModifierCandidate = {
  sectionId: string;
  sectionTitle: string;
  addonName: string;
  percent: number;
};

/**
 * Returns ALL economy-modifier globalVariable sections grouped into discount
 * and markup buckets. Used by the currency modal to let the user pick zero,
 * one or many modifiers to stack on an item's economyLink.
 */
export function findAllEconomyModifierCandidates(sections: SectionLike[]): {
  discounts: EconomyModifierCandidate[];
  markups: EconomyModifierCandidate[];
} {
  const discounts: EconomyModifierCandidate[] = [];
  const markups: EconomyModifierCandidate[] = [];
  for (const section of sections) {
    for (const addon of section.addons || []) {
      if (addon.type !== "globalVariable") continue;
      const key = addon.data.key;
      if (!key) continue;
      const percent =
        typeof addon.data.defaultValue === "number" ? addon.data.defaultValue : 0;
      const candidate: EconomyModifierCandidate = {
        sectionId: section.id,
        sectionTitle: section.title || section.id,
        addonName: addon.name || addon.data.displayName || addon.data.name || key,
        percent,
      };
      // Filter by sign: a discount must reduce price (≤ 0), a bonus must increase it (≥ 0).
      // GVs with the wrong sign are skipped so the picker only surfaces semantically valid ones.
      if ((key === BUY_DISCOUNT_VAR_KEY || key.startsWith(`${BUY_DISCOUNT_VAR_KEY}_`)) && percent <= 0) {
        discounts.push(candidate);
      } else if ((key === SELL_MARKUP_VAR_KEY || key.startsWith(`${SELL_MARKUP_VAR_KEY}_`)) && percent >= 0) {
        markups.push(candidate);
      }
    }
  }
  return { discounts, markups };
}

// ─── Seeded globalVariable factories (used only by the sidebar flow) ─────

export function createBuyDiscountGlobalVariableAddon(
  addonId: string,
  labels?: { displayName?: string; notes?: string; defaultValue?: number; key?: string }
): GlobalVariableSectionAddon {
  const displayName = labels?.displayName || "Desconto de Compra";
  const notes = labels?.notes || "Reduz o valor de compra de itens em 10%.";
  const defaultValue = typeof labels?.defaultValue === "number" ? labels.defaultValue : -10;
  const key = labels?.key || BUY_DISCOUNT_VAR_KEY;
  return {
    id: addonId,
    type: "globalVariable",
    name: displayName,
    data: {
      id: addonId,
      name: displayName,
      key,
      displayName,
      valueType: "percent",
      defaultValue,
      scope: "global",
      notes,
    },
  };
}

export function createSellMarkupGlobalVariableAddon(
  addonId: string,
  labels?: { displayName?: string; notes?: string; defaultValue?: number; key?: string }
): GlobalVariableSectionAddon {
  const displayName = labels?.displayName || "Bônus de Venda";
  const notes = labels?.notes || "Aumenta o valor de venda de itens em 10%.";
  const defaultValue = typeof labels?.defaultValue === "number" ? labels.defaultValue : 10;
  const key = labels?.key || SELL_MARKUP_VAR_KEY;
  return {
    id: addonId,
    type: "globalVariable",
    name: displayName,
    data: {
      id: addonId,
      name: displayName,
      key,
      displayName,
      valueType: "percent",
      defaultValue,
      scope: "global",
      notes,
    },
  };
}

// ─── Build seeded addons for a page type ─────────────────────────────────

export type BuildPageTypeAddonsOptions = {
  linkAttributeDefinitions?: {
    sectionId: string;
    attributes: Array<Pick<AttributeDefinitionEntry, "key" | "defaultValue"> & {
      label?: string;
    }>;
    /**
     * Optional field library located on the same section as the
     * attributeDefinitions. When present, progression-table columns are
     * linked to the corresponding library entries via `libraryRef`.
     */
    fieldLibrary?: {
      libraryAddonId: string;
      entryIdByAttrKey: Record<string, string>;
    };
    /**
     * Overrides for the seeded progressionTable (level range + growth rate).
     * Used by the Characters flow so the user can pick these values in the wizard.
     */
    progressionOverrides?: {
      startLevel?: number;
      endLevel?: number;
      growthRate?: number;
    };
  };
  /** Links any seeded `economyLink` addon's buy/sell currency refs. */
  linkCurrency?: {
    sectionId: string;
  };
  /** Adds modifier refs to any seeded `economyLink` addon's buy/sell arrays. */
  linkEconomyModifiers?: {
    /** Section IDs of globalVariable discount pages to stack as buyModifiers. */
    buySectionIds?: string[];
    /** Section IDs of globalVariable markup pages to stack as sellModifiers. */
    sellSectionIds?: string[];
  };
  /** Seed base values on the economyLink so the modifier effect is visible. */
  economyLinkBaseValues?: {
    buyValue?: number;
    sellValue?: number;
  };
  /**
   * Pre-populates any seeded `attributeModifiers` addon with user-authored
   * entries collected in the create wizard. Each entry targets one attribute
   * key from the linked attributeDefinitions page.
   */
  attributeModifiersSeed?: Array<{
    attributeKey: string;
    mode: "add" | "mult" | "set";
    value: number | boolean;
  }>;
  /**
   * Overrides the default attribute list seeded into an `attributeDefinitions`
   * addon (falls back to PRESET_ATTRIBUTES when absent/empty).
   */
  attributeDefinitionsOverrides?: {
    attributes?: Array<{
      key: string;
      label: string;
      valueType: AttributeDefinitionEntry["valueType"];
      defaultValue: number;
      min?: number;
    }>;
  };
  /** Wires a seeded `production` addon to recipe-mode with ingredient/output items. */
  linkRecipe?: {
    ingredientSectionId?: string;
    outputSectionId?: string;
    ingredientQuantity?: number;
    outputQuantity?: number;
    craftTimeSeconds?: number;
  };
  /**
   * Replaces the empty default blocks of any seeded `richDoc` addon with
   * pre-authored content. Used by the template system to ship starter-kit
   * projects that open with real narrative and callouts already in place.
   */
  richDocBlocks?: RichDocBlock[];
  /** Pre-populates a seeded `craftTable` addon with entries referencing recipe sections. */
  linkCraftTableRecipes?: {
    recipeSectionIds: string[];
  };
  /**
   * Seeds a single first conversion entry into a `currencyExchange` addon.
   * Used by the Casa de Câmbio create-wizard so the new page already has
   * one ready-to-go conversion between the picked currencies.
   */
  seedCurrencyExchange?: {
    fromCurrencyRef: string;
    fromAmount: number;
    toCurrencyRef: string;
    toAmount: number;
    direction: "oneWay" | "bidirectional";
  };
};

export function buildPageTypeAddons(
  pageTypeId: PageTypeId,
  options: BuildPageTypeAddonsOptions = {},
  t?: Translator
): SectionAddon[] {
  const pt = getPageType(pageTypeId);
  if (!pt || pt.addons.length === 0) return [];
  let out: SectionAddon[] = [];
  for (const entry of pt.addons) {
    const registry = getAddonRegistryEntry(entry.type);
    if (!registry) continue;
    let addon = registry.createDefault();
    const resolvedName = resolveAddonName(entry, t);
    if (resolvedName) {
      addon = { ...addon, name: resolvedName };
    }
    if (entry.customize) {
      addon = entry.customize(addon, options);
    }
    if (options.linkAttributeDefinitions) {
      if (addon.type === "attributeProfile") {
        addon = linkAttributeProfile(addon, options.linkAttributeDefinitions);
      } else if (addon.type === "attributeModifiers") {
        addon = linkAttributeModifiers(
          addon,
          options.linkAttributeDefinitions,
          options.attributeModifiersSeed
        );
      } else if (addon.type === "progressionTable" && options.linkAttributeDefinitions.attributes.length > 0) {
        addon = customizeProgressionTableForAttributes(addon, options.linkAttributeDefinitions);
      }
    }
    if (addon.type === "economyLink") {
      addon = applyEconomyLinkOptions(addon, options);
    }
    if (addon.type === "production" && options.linkRecipe) {
      addon = applyRecipeOptions(addon, options.linkRecipe);
    }
    if (addon.type === "craftTable" && options.linkCraftTableRecipes) {
      addon = applyCraftTableRecipes(addon, options.linkCraftTableRecipes);
    }
    if (addon.type === "richDoc" && options.richDocBlocks && options.richDocBlocks.length > 0) {
      addon = { ...addon, data: { ...addon.data, blocks: options.richDocBlocks } };
    }
    out.push(addon);
  }
  // If richDocBlocks were provided but the page type has no native richDoc
  // addon, append one carrying the blocks. This lets template authors attach
  // narrative + callouts to typed pages (characters, equipmentItem, etc.)
  // without forcing richDoc into every page type's default addon list.
  if (options.richDocBlocks && options.richDocBlocks.length > 0 && !out.some((a) => a.type === "richDoc")) {
    const addonId = `rich-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const richDoc = createDefaultRichDocAddon(addonId);
    const namedRichDoc = t
      ? { ...richDoc, name: t("pageTypes.addonNames.richDocNotes", richDoc.name) }
      : richDoc;
    out.push({
      ...namedRichDoc,
      data: { ...namedRichDoc.data, blocks: options.richDocBlocks },
    });
  }
  // Post-process: if the output contains both attributeDefinitions and
  // fieldLibrary, populate the library entries from the attrs (one per
  // attribute, with progression-field naming).
  out = seedFieldLibraryFromAttrDefs(out);
  return out;
}

/**
 * When the output contains both attributeDefinitions and fieldLibrary
 * addons, fills the library's entries with one field per attribute using
 * the `{key}_progression` / `{label} - Progression` naming convention.
 */
function seedFieldLibraryFromAttrDefs(addons: SectionAddon[]): SectionAddon[] {
  const attrDefs = addons.find((a) => a.type === "attributeDefinitions");
  const library = addons.find((a) => a.type === "fieldLibrary");
  if (!attrDefs || attrDefs.type !== "attributeDefinitions") return addons;
  if (!library || library.type !== "fieldLibrary") return addons;
  const attrs = attrDefs.data.attributes || [];
  if (attrs.length === 0) return addons;
  const now = Date.now();
  const entries = attrs.map((attr, idx) => ({
    id: `field-${attr.key || idx}-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    key: `${attr.key}_progression`,
    label: `${attr.label || attr.key} - Progression`,
    description: `Progressão por nível do atributo ${attr.label || attr.key}.`,
  }));
  return addons.map((a) => {
    if (a !== library) return a;
    return { ...a, data: { ...a.data, entries } };
  });
}

function linkAttributeProfile(
  addon: Extract<SectionAddon, { type: "attributeProfile" }>,
  link: NonNullable<BuildPageTypeAddonsOptions["linkAttributeDefinitions"]>
): Extract<SectionAddon, { type: "attributeProfile" }> {
  const now = Date.now();
  const values: AttributeProfileAddonDraft["values"] = link.attributes.map((attr, idx) => ({
    id: `attr-profile-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    attributeKey: attr.key,
    value: attr.defaultValue,
  }));
  return {
    ...addon,
    data: {
      ...addon.data,
      definitionsRef: link.sectionId,
      values,
    },
  };
}

function linkAttributeModifiers(
  addon: Extract<SectionAddon, { type: "attributeModifiers" }>,
  link: NonNullable<BuildPageTypeAddonsOptions["linkAttributeDefinitions"]>,
  seed?: BuildPageTypeAddonsOptions["attributeModifiersSeed"]
): Extract<SectionAddon, { type: "attributeModifiers" }> {
  // Build the initial modifier entries from the wizard seed. Only attrs that
  // actually exist in the linked attributeDefinitions are kept — that guards
  // against stale keys.
  const knownKeys = new Set((link.attributes || []).map((a) => a.key));
  const now = Date.now();
  const modifiers = (seed || [])
    .filter((s) => knownKeys.has(s.attributeKey))
    .map((s, idx) => ({
      id: `attr-mod-${now}-${idx}-${s.attributeKey}`,
      attributeKey: s.attributeKey,
      mode: s.mode,
      value: s.value,
    }));
  return {
    ...addon,
    data: {
      ...addon.data,
      definitionsRef: link.sectionId,
      ...(modifiers.length > 0 ? { modifiers } : {}),
    },
  };
}

/**
 * Rebuilds the progressionTable addon so it has one column per linked
 * attribute, a 1-100 level range, and a basic exponential generator per
 * column with base=attribute's defaultValue (or 10 if non-numeric) and
 * growth=1.15. Values are pre-computed so the user sees effects immediately.
 */
function customizeProgressionTableForAttributes(
  addon: Extract<SectionAddon, { type: "progressionTable" }>,
  link: NonNullable<BuildPageTypeAddonsOptions["linkAttributeDefinitions"]>
): Extract<SectionAddon, { type: "progressionTable" }> {
  const { attributes, fieldLibrary, progressionOverrides } = link;
  const startLevel = Math.max(1, Math.floor(progressionOverrides?.startLevel ?? 1));
  const endLevel = Math.max(startLevel, Math.floor(progressionOverrides?.endLevel ?? 100));
  const growth =
    typeof progressionOverrides?.growthRate === "number" && Number.isFinite(progressionOverrides.growthRate)
      ? progressionOverrides.growthRate
      : 1.15;
  const now = Date.now();
  const columns: ProgressionTableColumn[] = attributes.map((attr, idx) => {
    const base = typeof attr.defaultValue === "number" && Number.isFinite(attr.defaultValue) && attr.defaultValue !== 0
      ? attr.defaultValue
      : 10;
    const displayName = attr.label?.trim() || attr.key || `Coluna ${idx + 1}`;
    const libraryEntryId = fieldLibrary?.entryIdByAttrKey[attr.key];
    return {
      id: `col-${attr.key || idx}-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${displayName} - Progression`,
      ...(fieldLibrary && libraryEntryId
        ? {
            libraryRef: {
              libraryAddonId: fieldLibrary.libraryAddonId,
              entryId: libraryEntryId,
            },
          }
        : {}),
      generator: { mode: "exponential", base, growth },
      decimals: 0,
    };
  });
  const emptyRows = buildProgressionRowsFromRange(startLevel, endLevel, columns);
  const rows = generateAllProgressionColumnValues({
    rows: emptyRows,
    columns,
    startLevel,
    endLevel,
  });
  return {
    ...addon,
    data: {
      ...addon.data,
      startLevel,
      endLevel,
      columns,
      rows,
    },
  };
}

function applyRecipeOptions(
  addon: Extract<SectionAddon, { type: "production" }>,
  link: NonNullable<BuildPageTypeAddonsOptions["linkRecipe"]>
): Extract<SectionAddon, { type: "production" }> {
  const ingredients: ProductionIngredient[] = link.ingredientSectionId
    ? [{ itemRef: link.ingredientSectionId, quantity: link.ingredientQuantity ?? 10 }]
    : addon.data.ingredients || [];
  const outputs: ProductionOutput[] = link.outputSectionId
    ? [{ itemRef: link.outputSectionId, quantity: link.outputQuantity ?? 1 }]
    : addon.data.outputs || [];
  return {
    ...addon,
    data: {
      ...addon.data,
      mode: "recipe",
      ingredients,
      outputs,
      craftTimeSeconds: link.craftTimeSeconds ?? addon.data.craftTimeSeconds ?? 60,
    },
  };
}

function applyCraftTableRecipes(
  addon: Extract<SectionAddon, { type: "craftTable" }>,
  link: NonNullable<BuildPageTypeAddonsOptions["linkCraftTableRecipes"]>
): Extract<SectionAddon, { type: "craftTable" }> {
  const now = Date.now();
  const existingCount = (addon.data.entries || []).length;
  const newEntries: CraftTableEntry[] = link.recipeSectionIds.map((sectionId, idx) => ({
    id: `craft-entry-${now}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    productionRef: sectionId,
    order: existingCount + idx,
  }));
  return {
    ...addon,
    data: {
      ...addon.data,
      entries: [...(addon.data.entries || []), ...newEntries],
    },
  };
}

function applyEconomyLinkOptions(
  addon: Extract<SectionAddon, { type: "economyLink" }>,
  options: BuildPageTypeAddonsOptions
): Extract<SectionAddon, { type: "economyLink" }> {
  const data: EconomyLinkAddonDraft = { ...addon.data };
  if (options.linkCurrency) {
    data.buyCurrencyRef = options.linkCurrency.sectionId;
    data.sellCurrencyRef = options.linkCurrency.sectionId;
  }
  const buyIds = options.linkEconomyModifiers?.buySectionIds || [];
  if (buyIds.length > 0) {
    data.buyModifiers = [
      ...(data.buyModifiers || []),
      ...buyIds.map((refId) => ({ refId })),
    ];
  }
  const sellIds = options.linkEconomyModifiers?.sellSectionIds || [];
  if (sellIds.length > 0) {
    data.sellModifiers = [
      ...(data.sellModifiers || []),
      ...sellIds.map((refId) => ({ refId })),
    ];
  }
  if (options.economyLinkBaseValues) {
    if (typeof options.economyLinkBaseValues.buyValue === "number") {
      data.buyValue = options.economyLinkBaseValues.buyValue;
    }
    if (typeof options.economyLinkBaseValues.sellValue === "number") {
      data.sellValue = options.economyLinkBaseValues.sellValue;
    }
  }
  return { ...addon, data };
}

