import type {
  AttributeDefinitionEntry,
  AttributeProfileAddonDraft,
  EconomyLinkAddonDraft,
  GlobalVariableSectionAddon,
  ProgressionTableColumn,
  SectionAddon,
  SectionAddonType,
} from "@/lib/addons/types";
import { buildProgressionRowsFromRange } from "@/lib/addons/types";
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
  | "progression"
  | "narrative";

export type PageTypeAddon = {
  type: SectionAddonType;
  role: "primary" | "recommended";
  /** Override the default name used by the seeded addon (pt-BR fallback). */
  nameOverride?: string;
  /** i18n key for the localized nameOverride. Takes precedence over `nameOverride` when a translator is available. */
  nameOverrideKey?: string;
  /** Post-create tweak (e.g. preload attribute list with HP/ATK/DEF). */
  customize?: (addon: SectionAddon) => SectionAddon;
};

/** Lightweight translator type (matches the `t` returned by `useI18n()`). */
export type Translator = (key: string, fallback?: string) => string;

export type PageType = {
  id: PageTypeId;
  label: string;
  description: string;
  emoji: string;
  addons: PageTypeAddon[];
  /** Other page types this one expects to exist in the project. */
  requires?: PageTypeId[];
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

const seedAttributeDefinitions = (addon: SectionAddon): SectionAddon => {
  if (addon.type !== "attributeDefinitions") return addon;
  const now = Date.now();
  return {
    ...addon,
    data: {
      ...addon.data,
      attributes: [
        { id: `attr-${now}-hp`, key: "hp", label: "HP", valueType: "int", defaultValue: 100, min: 0 },
        { id: `attr-${now}-atk`, key: "atk", label: "ATK", valueType: "int", defaultValue: 10, min: 0 },
        { id: `attr-${now}-def`, key: "def", label: "DEF", valueType: "int", defaultValue: 5, min: 0 },
        { id: `attr-${now}-spd`, key: "spd", label: "SPD", valueType: "int", defaultValue: 5, min: 0 },
      ],
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
    description: "Catálogo de itens do jogo. Inclui inventário e ligação com economia.",
    emoji: "🎒",
    addons: [
      { type: "inventory", role: "primary", nameOverride: "Inventário", nameOverrideKey: "pageTypes.addonNames.inventory" },
      { type: "economyLink", role: "recommended", nameOverride: "Economia", nameOverrideKey: "pageTypes.addonNames.economy" },
    ],
    requires: ["economy"],
    tags: ["items", "economy"],
  },
  {
    id: "equipmentItem",
    label: "Itens com Efeito",
    description: "Itens que também modificam atributos (espada, poção, armadura). Inclui inventário, economia e modificadores de atributos.",
    emoji: "⚔️",
    addons: [
      { type: "inventory", role: "primary", nameOverride: "Inventário", nameOverrideKey: "pageTypes.addonNames.inventory" },
      { type: "economyLink", role: "recommended", nameOverride: "Economia", nameOverrideKey: "pageTypes.addonNames.economy" },
      { type: "attributeModifiers", role: "recommended", nameOverride: "Efeitos", nameOverrideKey: "pageTypes.addonNames.equipmentEffects" },
    ],
    requires: ["economy", "attributeDefinitions"],
    tags: ["items", "economy", "combat"],
  },
  {
    id: "characters",
    label: "Personagens",
    description: "Personagens do jogo (jogáveis ou inimigos) com perfil de atributos, curva de XP, progressão por nível e modificadores por variante.",
    emoji: "👤",
    addons: [
      { type: "attributeProfile", role: "primary" },
      { type: "xpBalance", role: "recommended", nameOverride: "Curva de XP", nameOverrideKey: "pageTypes.addonNames.xpCurve" },
      { type: "progressionTable", role: "recommended" },
      { type: "attributeModifiers", role: "recommended", nameOverride: "Modificadores por variante", nameOverrideKey: "pageTypes.addonNames.variantModifiers" },
    ],
    requires: ["attributeDefinitions"],
    tags: ["characters", "combat", "progression"],
  },
  {
    id: "attributeDefinitions",
    label: "Definições de Atributos Base",
    description: "Define um conjunto de atributos (HP, ATK, DEF, etc.) + biblioteca de campos com as chaves de progressão pré-preenchidas.",
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
    description: "Moeda ou recurso econômico do jogo.",
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
    id: "progression",
    label: "Progressão",
    description: "Tabelas de XP, níveis e curvas de progressão.",
    emoji: "📈",
    addons: [
      { type: "xpBalance", role: "primary" },
      { type: "progressionTable", role: "recommended" },
    ],
    tags: ["progression"],
  },
  {
    id: "narrative",
    label: "Narrativa",
    description: "Páginas de lore, roteiro ou descrição em texto rico.",
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

export type RequiresCandidateKind = "attributeDefinitions" | "currency";

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
 * Locates the two economy-modifier globalVariable sections by sentinel key.
 * Returns nulls when they don't exist yet — the sidebar then creates them.
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
      if (!buy && key === BUY_DISCOUNT_VAR_KEY) buy = section.id;
      else if (!sell && key === SELL_MARKUP_VAR_KEY) sell = section.id;
    }
  }
  return { buyDiscountSectionId: buy, sellMarkupSectionId: sell };
}

// ─── Seeded globalVariable factories (used only by the sidebar flow) ─────

export function createBuyDiscountGlobalVariableAddon(
  addonId: string,
  labels?: { displayName?: string; notes?: string }
): GlobalVariableSectionAddon {
  const displayName = labels?.displayName || "Desconto de Compra";
  const notes = labels?.notes || "Reduz o valor de compra de itens em 10%.";
  return {
    id: addonId,
    type: "globalVariable",
    name: displayName,
    data: {
      id: addonId,
      name: displayName,
      key: BUY_DISCOUNT_VAR_KEY,
      displayName,
      valueType: "percent",
      defaultValue: -10,
      scope: "global",
      notes,
    },
  };
}

export function createSellMarkupGlobalVariableAddon(
  addonId: string,
  labels?: { displayName?: string; notes?: string }
): GlobalVariableSectionAddon {
  const displayName = labels?.displayName || "Bônus de Venda";
  const notes = labels?.notes || "Aumenta o valor de venda de itens em 10%.";
  return {
    id: addonId,
    type: "globalVariable",
    name: displayName,
    data: {
      id: addonId,
      name: displayName,
      key: SELL_MARKUP_VAR_KEY,
      displayName,
      valueType: "percent",
      defaultValue: 10,
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
  };
  /** Links any seeded `economyLink` addon's buy/sell currency refs. */
  linkCurrency?: {
    sectionId: string;
  };
  /** Adds modifier refs to any seeded `economyLink` addon's buy/sell arrays. */
  linkEconomyModifiers?: {
    buySectionId?: string;
    sellSectionId?: string;
  };
  /** Seed base values on the economyLink so the modifier effect is visible. */
  economyLinkBaseValues?: {
    buyValue?: number;
    sellValue?: number;
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
      addon = entry.customize(addon);
    }
    if (options.linkAttributeDefinitions) {
      if (addon.type === "attributeProfile") {
        addon = linkAttributeProfile(addon, options.linkAttributeDefinitions);
      } else if (addon.type === "attributeModifiers") {
        addon = linkAttributeModifiers(addon, options.linkAttributeDefinitions);
      } else if (addon.type === "progressionTable" && options.linkAttributeDefinitions.attributes.length > 0) {
        addon = customizeProgressionTableForAttributes(addon, options.linkAttributeDefinitions);
      }
    }
    if (addon.type === "economyLink") {
      addon = applyEconomyLinkOptions(addon, options);
    }
    out.push(addon);
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
  link: NonNullable<BuildPageTypeAddonsOptions["linkAttributeDefinitions"]>
): Extract<SectionAddon, { type: "attributeModifiers" }> {
  return {
    ...addon,
    data: {
      ...addon.data,
      definitionsRef: link.sectionId,
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
  const { attributes, fieldLibrary } = link;
  const startLevel = 1;
  const endLevel = 100;
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
      generator: { mode: "exponential", base, growth: 1.15 },
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

function applyEconomyLinkOptions(
  addon: Extract<SectionAddon, { type: "economyLink" }>,
  options: BuildPageTypeAddonsOptions
): Extract<SectionAddon, { type: "economyLink" }> {
  const data: EconomyLinkAddonDraft = { ...addon.data };
  if (options.linkCurrency) {
    data.buyCurrencyRef = options.linkCurrency.sectionId;
    data.sellCurrencyRef = options.linkCurrency.sectionId;
  }
  if (options.linkEconomyModifiers?.buySectionId) {
    data.buyModifiers = [
      ...(data.buyModifiers || []),
      { refId: options.linkEconomyModifiers.buySectionId },
    ];
  }
  if (options.linkEconomyModifiers?.sellSectionId) {
    data.sellModifiers = [
      ...(data.sellModifiers || []),
      { refId: options.linkEconomyModifiers.sellSectionId },
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

export function missingRequiredPageTypes(
  pageTypeId: PageTypeId,
  existingPageTypeIds: Array<PageTypeId | string | undefined>
): PageType[] {
  const pt = getPageType(pageTypeId);
  if (!pt?.requires?.length) return [];
  const existing = new Set(existingPageTypeIds.filter(Boolean) as string[]);
  return pt.requires
    .filter((req) => !existing.has(req))
    .map((req) => getPageType(req))
    .filter((x): x is PageType => !!x);
}
