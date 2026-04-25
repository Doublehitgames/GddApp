import type { BalanceAddonDraft } from "@/lib/balance/types";

export type ProgressionTableColumn = {
  id: string;
  name: string;
  libraryRef?: {
    libraryAddonId: string;
    entryId: string;
  };
  generator?: ProgressionColumnGenerator;
  decimals?: number;
  isPercentage?: boolean;
  min?: number;
  max?: number;
};

export type FieldLibraryEntry = {
  id: string;
  key: string;
  label: string;
  description?: string;
};

export type FieldLibraryAddonDraft = {
  id: string;
  name: string;
  entries: FieldLibraryEntry[];
};

/** Opaque BlockNote block — we persist whatever `editor.document` returns. */
export type RichDocBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: RichDocBlock[];
};

export type RichDocAddonDraft = {
  id: string;
  name: string;
  blocks: RichDocBlock[];
  schemaVersion: 1;
};

export type ProgressionColumnGenerator =
  | { mode: "manual" }
  | { mode: "linear"; base: number; step: number; bias?: number }
  | { mode: "exponential"; base: number; growth: number; bias?: number }
  | { mode: "formula"; baseColumnId: string; baseManualValue?: number; expression: string };

export type ProgressionTableRow = {
  level: number;
  values: Record<string, number | string>;
};

export type ProgressionTableAddonDraft = {
  id: string;
  name: string;
  startLevel: number;
  endLevel: number;
  columns: ProgressionTableColumn[];
  rows: ProgressionTableRow[];
  /** Manual cell overrides: overrides[String(level)][columnId] = value */
  overrides?: Record<string, Record<string, number>>;
};

export type EconomyModifierRef = {
  refId: string;
};

export type CurrencyKind = "soft" | "premium" | "event" | "other";

export type CurrencyAddonDraft = {
  id: string;
  name: string;
  code: string;
  displayName: string;
  kind: CurrencyKind;
  decimals: number;
  notes?: string;
};

/** Direction in which a currency exchange entry can be triggered. */
export type CurrencyExchangeDirection = "oneWay" | "bidirectional";

export type CurrencyExchangeEntry = {
  id: string;
  /** Section id of the currency the player spends. */
  fromCurrencyRef?: string;
  /** Amount of the source currency required. */
  fromAmount: number;
  /** Section id of the currency the player receives. */
  toCurrencyRef?: string;
  /** Amount of the target currency received. */
  toAmount: number;
  /** Whether the exchange can also be performed in reverse. */
  direction: CurrencyExchangeDirection;
  /** Optional designer-facing notes (limits, conditions, flavor). */
  notes?: string;
};

export type CurrencyExchangeAddonDraft = {
  id: string;
  name: string;
  entries: CurrencyExchangeEntry[];
};

// ── Skills addon ────────────────────────────────────────────────────

export type SkillKind = "active" | "passive";

/** What a skill costs to use. Each entry covers one currency/attribute/charges payment. */
export type SkillCostType = "currency" | "attribute" | "charges";

export type SkillCost = {
  id: string;
  type: SkillCostType;
  amount: number;
  /** Required when type === "currency". Section ID of a Currency addon. */
  currencyRef?: string;
  /**
   * Required when type === "attribute". Section ID of the AttributeDefinitions
   * page that owns the chosen attribute key. Each cost can target a different
   * definitions page, so a skill can spend (Mana from Combat Stats) AND
   * (Stamina from Stamina Stats) at the same time.
   */
  definitionsRef?: string;
  /** Required when type === "attribute". Key from the linked AttributeDefinitions. */
  attributeKey?: string;
};

/** Reference to one entry of an `attributeModifiers` addon, as a skill effect. */
export type SkillEffectRef = {
  id: string;
  /** Section ID where the source attributeModifiers addon lives. */
  attributeModifiersSectionId: string;
  /** Addon ID inside that section (a section may host multiple). */
  attributeModifiersAddonId: string;
  /** ID of the AttributeModifierEntry inside that addon's `modifiers` list. */
  modifierEntryId: string;
};

export type SkillEntry = {
  id: string;
  name: string;
  description?: string;
  kind: SkillKind;
  /** Only meaningful when kind === "active". */
  cooldownSeconds?: number;
  costs?: SkillCost[];
  effects?: SkillEffectRef[];
  /** Reuses the CraftTableUnlock structure (level + currency + item). */
  unlock?: CraftTableUnlock;
  /** Free-form tags (e.g. "fire", "single-target"). Lower-cased + dedup'd by normalize. */
  tags?: string[];
};

export type SkillsAddonDraft = {
  id: string;
  name: string;
  entries: SkillEntry[];
};

export type GlobalVariableValueType = "percent" | "multiplier" | "flat" | "boolean";
export type GlobalVariableScope = "global" | "mode" | "event" | "season";

export type GlobalVariableAddonDraft = {
  id: string;
  name: string;
  key: string;
  displayName: string;
  valueType: GlobalVariableValueType;
  defaultValue: number | boolean;
  scope: GlobalVariableScope;
  notes?: string;
};

export type InventoryBindType = "none" | "onPickup" | "onEquip";

export type InventoryAddonDraft = {
  id: string;
  name: string;
  weight: number;
  stackable: boolean;
  maxStack: number;
  inventoryCategory: string;
  /** When linked, the category is derived from a Field Library entry's label. */
  categoryLibraryRef?: {
    libraryAddonId: string;
    entryId: string;
  };
  slotSize: number;
  hasDurabilityConfig?: boolean;
  durability: number;
  hasVolumeConfig?: boolean;
  volume?: number;
  maxDurability?: number;
  bindType: InventoryBindType;
  showInShop: boolean;
  consumable: boolean;
  discardable: boolean;
  notes?: string;
};

export type EconomyLinkAddonDraft = {
  id: string;
  name: string;
  hasBuyConfig?: boolean;
  buyCurrencyRef?: string;
  buyValue?: number;
  minBuyValue?: number;
  buyModifiers: EconomyModifierRef[];
  hasSellConfig?: boolean;
  sellCurrencyRef?: string;
  sellValue?: number;
  maxSellValue?: number;
  sellModifiers: EconomyModifierRef[];
  hasProductionConfig?: boolean;
  producedItemRef?: string;
  produceMin?: number;
  produceMax?: number;
  productionTimeSeconds?: number;
  hasUnlockConfig?: boolean;
  unlockRef?: string;
  unlockValue?: number;
  notes?: string;
};

export type ProductionMode = "passive" | "recipe";

export type ProductionIngredient = {
  itemRef: string;
  quantity: number;
};

export type ProductionOutput = {
  itemRef: string;
  quantity: number;
};

export type ProductionProgressionLink = {
  progressionAddonId: string;
  columnId: string;
  columnName: string;
};

export type ProductionAddonDraft = {
  id: string;
  name: string;
  mode: ProductionMode;
  // Passive mode
  outputRef?: string;
  minOutput?: number;
  minOutputProgressionLink?: ProductionProgressionLink;
  maxOutput?: number;
  maxOutputProgressionLink?: ProductionProgressionLink;
  intervalSeconds?: number;
  intervalSecondsProgressionLink?: ProductionProgressionLink;
  requiresCollection?: boolean;
  capacity?: number;
  capacityProgressionLink?: ProductionProgressionLink;
  // Recipe mode
  ingredients: ProductionIngredient[];
  outputs: ProductionOutput[];
  craftTimeSeconds?: number;
  craftTimeSecondsProgressionLink?: ProductionProgressionLink;
  notes?: string;
};

export type CraftTableUnlockLevel = {
  enabled: boolean;
  xpAddonRef?: string;
  level?: number;
};

export type CraftTableUnlockCurrency = {
  enabled: boolean;
  currencyAddonRef?: string;
  amount?: number;
};

export type CraftTableUnlockItem = {
  enabled: boolean;
  itemRef?: string;
  quantity?: number;
};

export type CraftTableUnlock = {
  level?: CraftTableUnlockLevel;
  currency?: CraftTableUnlockCurrency;
  item?: CraftTableUnlockItem;
};

export type CraftTableEntry = {
  id: string;
  productionRef?: string;
  category?: string;
  order: number;
  unlock?: CraftTableUnlock;
  hidden?: boolean;
};

export type CraftTableAddonDraft = {
  id: string;
  name: string;
  entries: CraftTableEntry[];
};

export type DataSchemaValueType = "int" | "float" | "seconds" | "percent" | "boolean" | "string";

export type EconomyLinkFieldKey =
  | "buyValue"
  | "minBuyValue"
  | "sellValue"
  | "maxSellValue"
  | "unlockValue";

export type ProductionFieldKey =
  | "minOutput"
  | "maxOutput"
  | "intervalSeconds"
  | "craftTimeSeconds"
  | "capacity"
  | "outputBuyEffective"
  | "outputMinBuyValue"
  | "outputSellEffective"
  | "outputMaxSellValue"
  | "outputUnlockValue";

export type DataSchemaEntry = {
  id: string;
  key: string;
  label: string;
  /** When linked, `key` and `label` are derived from the Field Library entry. */
  libraryRef?: {
    libraryAddonId: string;
    entryId: string;
  };
  valueType: DataSchemaValueType;
  value: number | boolean | string;
  min?: number;
  max?: number;
  unit?: string;
  unitXpRef?: string;
  /** Reference to an Economy Link addon (section ID that contains it). */
  economyLinkRef?: string;
  /** Which field from the Economy Link addon to pull. */
  economyLinkField?: EconomyLinkFieldKey;
  /** Reference to a Production addon (addon ID in the same section). */
  productionRef?: string;
  /** Which field from the Production addon to pull. */
  productionField?: ProductionFieldKey;
  /** When true, the value comes from the section's dataId field. */
  usePageDataId?: boolean;
  notes?: string;
};

export type DataSchemaAddonDraft = {
  id: string;
  name: string;
  entries: DataSchemaEntry[];
};

export type AttributeValueType = "int" | "float" | "percent" | "boolean";

export type AttributeDefinitionEntry = {
  id: string;
  key: string;
  label: string;
  valueType: AttributeValueType;
  defaultValue: number | boolean;
  min?: number;
  max?: number;
  unit?: string;
};

export type AttributeDefinitionsAddonDraft = {
  id: string;
  name: string;
  attributes: AttributeDefinitionEntry[];
};

export type AttributeProfileValueEntry = {
  id: string;
  attributeKey: string;
  value: number | boolean;
};

export type AttributeProfileAddonDraft = {
  id: string;
  name: string;
  definitionsRef?: string;
  values: AttributeProfileValueEntry[];
};

export type AttributeModifierMode = "add" | "mult" | "set";

export type AttributeModifierStacking = "unique" | "refresh" | "stack";
export type AttributeModifierCategory = "buff" | "debuff" | "neutral";

export type AttributeModifierEntry = {
  id: string;
  /**
   * Optional human-readable name. When set, the UI uses it as the entry's
   * title (Skills effect checklist, ReadOnly headings, ExportSchema bindings).
   * Falls back to the auto-formatted label (e.g. "+10 ATK 30s") when empty.
   */
  name?: string;
  attributeKey: string;
  mode: AttributeModifierMode;
  value: number | boolean;
  /** When true, the modifier is applied temporarily. Absent/false means permanent. */
  temporary?: boolean;
  /** Duration in seconds while `temporary` is true. */
  durationSeconds?: number;
  /** How re-applications are handled. Absent = engine default. */
  stackingRule?: AttributeModifierStacking;
  /**
   * If set (and `temporary` is true), applies `value` every N seconds for the duration.
   * Absent means the modifier is a one-shot that stays active for `durationSeconds`.
   *
   * **Tick convention (trailing).** The first tick fires at t = N (one
   * interval after the cast), not at t = 0. The number of ticks over a
   * `durationSeconds` window is `floor(durationSeconds / tickIntervalSeconds)`.
   *
   * Example: `durationSeconds: 10, tickIntervalSeconds: 1, value: -1` →
   * 10 ticks at t = 1, 2, …, 10 → total `-10`. The Skills cooldown
   * timeline visualisation in the editor and the per-tick math (`N ticks`
   * label) both assume this convention. Game engines reading the export
   * MUST follow trailing semantics or the GDD numbers will lie.
   */
  tickIntervalSeconds?: number;
  /** Gameplay category. Guides UI/AI (e.g. dispel, resistance). */
  category?: AttributeModifierCategory;
  /** Free-form tags (e.g. "poison", "magical", "bleed"). */
  tags?: string[];
};

export type AttributeModifiersAddonDraft = {
  id: string;
  name: string;
  definitionsRef?: string;
  modifiers: AttributeModifierEntry[];
};

// ── Export Schema addon ──────────────────────────────────────────────

export type ExportSchemaArraySource =
  | { type: "progressionTable"; addonId: string; addonName?: string }
  | { type: "craftTable"; addonId: string; addonName?: string }
  /** Iterates the ingredients of the current craft table entry's Production addon. */
  | { type: "productionIngredients" }
  /** Iterates the outputs of the current craft table entry's Production addon. */
  | { type: "productionOutputs" }
  /** Iterates the entries of a Skills addon. */
  | { type: "skills"; addonId: string; addonName?: string }
  /** Iterates the costs of the current Skills entry. Context-dependent — only useful inside a `skills` array. */
  | { type: "skillCosts" }
  /** Iterates the effects of the current Skills entry. Context-dependent. */
  | { type: "skillEffects" };

export type ProductionScalarField =
  | "name"
  | "mode"
  | "craftTimeSeconds"
  | "minOutput"
  | "maxOutput"
  | "intervalSeconds"
  | "capacity"
  | "requiresCollection"
  | "outputRef";

export type ProductionItemField = "itemRef" | "quantity";

export type CraftTableEntryField =
  | "order"
  | "productionRef"
  | "category"
  | "hidden"
  | "unlockLevelEnabled"
  | "unlockLevel"
  | "unlockLevelXpRef"
  | "unlockCurrencyEnabled"
  | "unlockCurrencyAmount"
  | "unlockCurrencyRef"
  | "unlockItemEnabled"
  | "unlockItemQuantity"
  | "unlockItemRef";

/** Scalar fields exposed for a Skills entry (the row that the `skills` array iterates). */
export type SkillEntryField =
  | "id"
  | "name"
  | "kind"
  | "description"
  | "cooldownSeconds"
  | "tagsCsv"
  | "unlockLevelEnabled"
  | "unlockLevel"
  | "unlockLevelXpRef"
  | "unlockCurrencyEnabled"
  | "unlockCurrencyAmount"
  | "unlockCurrencyRef"
  | "unlockItemEnabled"
  | "unlockItemQuantity"
  | "unlockItemRef";

/** Scalar fields exposed for a single SkillCost (inside the `skillCosts` array). */
export type SkillCostField =
  | "id"
  | "type"
  | "amount"
  | "currencyRef"
  | "definitionsRef"
  | "attributeKey";

/**
 * Scalar fields exposed for a single SkillEffect (inside the `skillEffects` array).
 * Fields prefixed with `resolved*` follow the ref into the source AttributeModifiers
 * entry and inline its data, so the consumer doesn't have to cross-resolve.
 */
export type SkillEffectField =
  | "id"
  | "attributeModifiersSectionId"
  | "attributeModifiersAddonId"
  | "modifierEntryId"
  /** User-provided display name from the source modifier entry (empty when unset). */
  | "resolvedName"
  | "resolvedMode"
  | "resolvedAttributeKey"
  /**
   * The dataId of the AttributeDefinitions section that the parent
   * AttributeModifiers addon links to via `definitionsRef`. Useful in
   * Remote Config so the consumer knows WHICH attribute profile owns
   * the `attributeKey` (e.g. "hp"). Empty when the parent modifier addon
   * has no definitionsRef set.
   */
  | "resolvedDefinitionsRef"
  | "resolvedValue"
  | "resolvedTemporary"
  | "resolvedDurationSeconds"
  | "resolvedTickIntervalSeconds"
  /**
   * Stacking rule from the source modifier ("unique" | "refresh" | "stack").
   * Empty string when the modifier didn't set one (engine should fall back
   * to its own default, typically "refresh").
   */
  | "resolvedStacking"
  | "resolvedCategory";

export type ExportSchemaBinding =
  | { source: "manual"; value: string | number | boolean; valueType: "string" | "number" | "boolean" }
  | { source: "dataSchema"; addonId: string; addonName?: string; entryKey: string; entryId?: string }
  | { source: "rowLevel" }
  | { source: "rowColumn"; columnId: string }
  | { source: "entryField"; field: CraftTableEntryField }
  /** Follows the current craft entry's productionRef and reads a scalar field from that Production addon. */
  | { source: "productionField"; field: ProductionScalarField }
  /** Reads a field from the current ingredient/output row (inside productionIngredients/productionOutputs array). */
  | { source: "itemField"; field: ProductionItemField }
  /** Reads a scalar field from the current Skills entry (inside a `skills` array). */
  | { source: "skillField"; field: SkillEntryField }
  /** Reads a scalar field from the current Skill cost (inside a `skillCosts` array). */
  | { source: "skillCostField"; field: SkillCostField }
  /** Reads a scalar field from the current Skill effect (inside a `skillEffects` array). */
  | { source: "skillEffectField"; field: SkillEffectField };

export type ExportSchemaNode = {
  id: string;
  key: string;
  nodeType: "object" | "array" | "value";
  children?: ExportSchemaNode[];
  arraySource?: ExportSchemaArraySource;
  itemTemplate?: ExportSchemaNode[];
  binding?: ExportSchemaBinding;
  /** Apply Math.abs to the resolved value (value nodes only). */
  abs?: boolean;
  /** Multiply the resolved value by this factor (value nodes only). */
  multiplier?: number;
};

export type ExportSchemaArrayFormat =
  | "rowMajor"
  | "columnMajor"
  | "keyedByLevel"
  | "matrix";

export type ExportSchemaAddonDraft = {
  id: string;
  name: string;
  nodes: ExportSchemaNode[];
  /** Formato de saída para nós `array`. Default: "rowMajor". */
  arrayFormat?: ExportSchemaArrayFormat;
};

// Legacy aliases: keep old type names to avoid broad refactors.
export type GenericStatValueType = DataSchemaValueType;
export type GenericStatEntry = DataSchemaEntry;
export type GenericStatsAddonDraft = DataSchemaAddonDraft;

export type SectionAddonType =
  | "xpBalance"
  | "progressionTable"
  | "economyLink"
  | "currency"
  | "globalVariable"
  | "inventory"
  | "production"
  | "craftTable"
  | "dataSchema"
  | "attributeDefinitions"
  | "attributeProfile"
  | "attributeModifiers"
  | "fieldLibrary"
  | "exportSchema"
  | "richDoc"
  | "currencyExchange"
  | "skills"
  // legacy type kept for compatibility/migration
  | "genericStats";
export type LegacySectionAddonType = "balance";

export type XpBalanceSectionAddon = {
  id: string;
  type: "xpBalance";
  name: string;
  group?: string;
  data: BalanceAddonDraft;
};

export type ProgressionTableSectionAddon = {
  id: string;
  type: "progressionTable";
  name: string;
  group?: string;
  data: ProgressionTableAddonDraft;
};

export type EconomyLinkSectionAddon = {
  id: string;
  type: "economyLink";
  name: string;
  group?: string;
  data: EconomyLinkAddonDraft;
};

export type CurrencySectionAddon = {
  id: string;
  type: "currency";
  name: string;
  group?: string;
  data: CurrencyAddonDraft;
};

export type CurrencyExchangeSectionAddon = {
  id: string;
  type: "currencyExchange";
  name: string;
  group?: string;
  data: CurrencyExchangeAddonDraft;
};

export type GlobalVariableSectionAddon = {
  id: string;
  type: "globalVariable";
  name: string;
  group?: string;
  data: GlobalVariableAddonDraft;
};

export type InventorySectionAddon = {
  id: string;
  type: "inventory";
  name: string;
  group?: string;
  data: InventoryAddonDraft;
};

export type ProductionSectionAddon = {
  id: string;
  type: "production";
  name: string;
  group?: string;
  data: ProductionAddonDraft;
};

export type CraftTableSectionAddon = {
  id: string;
  type: "craftTable";
  name: string;
  group?: string;
  data: CraftTableAddonDraft;
};

export type DataSchemaSectionAddon = {
  id: string;
  type: "dataSchema";
  name: string;
  group?: string;
  data: DataSchemaAddonDraft;
};

export type AttributeDefinitionsSectionAddon = {
  id: string;
  type: "attributeDefinitions";
  name: string;
  group?: string;
  data: AttributeDefinitionsAddonDraft;
};

export type AttributeProfileSectionAddon = {
  id: string;
  type: "attributeProfile";
  name: string;
  group?: string;
  data: AttributeProfileAddonDraft;
};

export type AttributeModifiersSectionAddon = {
  id: string;
  type: "attributeModifiers";
  name: string;
  group?: string;
  data: AttributeModifiersAddonDraft;
};

export type FieldLibrarySectionAddon = {
  id: string;
  type: "fieldLibrary";
  name: string;
  group?: string;
  data: FieldLibraryAddonDraft;
};

export type ExportSchemaSectionAddon = {
  id: string;
  type: "exportSchema";
  name: string;
  group?: string;
  data: ExportSchemaAddonDraft;
};

export type RichDocSectionAddon = {
  id: string;
  type: "richDoc";
  name: string;
  group?: string;
  data: RichDocAddonDraft;
};

export type SkillsSectionAddon = {
  id: string;
  type: "skills";
  name: string;
  group?: string;
  data: SkillsAddonDraft;
};

// Legacy addon shape kept for compatibility in normalize/migration flows.
export type GenericStatsSectionAddon = {
  id: string;
  type: "genericStats";
  name: string;
  group?: string;
  data: DataSchemaAddonDraft;
};

export type SectionAddon =
  | XpBalanceSectionAddon
  | ProgressionTableSectionAddon
  | EconomyLinkSectionAddon
  | CurrencySectionAddon
  | CurrencyExchangeSectionAddon
  | GlobalVariableSectionAddon
  | InventorySectionAddon
  | ProductionSectionAddon
  | CraftTableSectionAddon
  | DataSchemaSectionAddon
  | AttributeDefinitionsSectionAddon
  | AttributeProfileSectionAddon
  | AttributeModifiersSectionAddon
  | FieldLibrarySectionAddon
  | ExportSchemaSectionAddon
  | RichDocSectionAddon
  | SkillsSectionAddon
  | GenericStatsSectionAddon;

function createDefaultRows(
  startLevel: number,
  endLevel: number,
  columns: ProgressionTableColumn[]
): ProgressionTableRow[] {
  const normalizedStart = Math.max(1, Math.floor(startLevel || 1));
  const normalizedEnd = Math.max(normalizedStart, Math.floor(endLevel || normalizedStart));
  const rows: ProgressionTableRow[] = [];
  for (let level = normalizedStart; level <= normalizedEnd; level += 1) {
    const values: Record<string, number | string> = {};
    for (const column of columns) {
      values[column.id] = 0;
    }
    rows.push({ level, values });
  }
  return rows;
}

export function createDefaultProgressionTableAddon(addonId: string): ProgressionTableSectionAddon {
  const columns: ProgressionTableColumn[] = [
    {
      id: "value",
      name: "Valor",
      generator: { mode: "manual" },
      decimals: 0,
    },
  ];
  const startLevel = 1;
  const endLevel = 20;
  return {
    id: addonId,
    type: "progressionTable",
    name: "Tabela de Balanceamento",
    data: {
      id: addonId,
      name: "Tabela de Balanceamento",
      startLevel,
      endLevel,
      columns,
      rows: createDefaultRows(startLevel, endLevel, columns),
    },
  };
}

export function createDefaultEconomyLinkAddon(addonId: string): EconomyLinkSectionAddon {
  return {
    id: addonId,
    type: "economyLink",
    name: "Economy Link",
    data: {
      id: addonId,
      name: "Economy Link",
      hasBuyConfig: true,
      buyModifiers: [],
      hasSellConfig: true,
      sellModifiers: [],
      hasProductionConfig: false,
      hasUnlockConfig: false,
    },
  };
}

export function createDefaultCurrencyAddon(addonId: string): CurrencySectionAddon {
  return {
    id: addonId,
    type: "currency",
    name: "Currency",
    data: {
      id: addonId,
      name: "Currency",
      code: "",
      displayName: "",
      kind: "soft",
      decimals: 0,
    },
  };
}

export function createDefaultCurrencyExchangeAddon(addonId: string): CurrencyExchangeSectionAddon {
  return {
    id: addonId,
    type: "currencyExchange",
    name: "Currency Exchange",
    data: {
      id: addonId,
      name: "Currency Exchange",
      entries: [],
    },
  };
}

export function createDefaultGlobalVariableAddon(addonId: string): GlobalVariableSectionAddon {
  return {
    id: addonId,
    type: "globalVariable",
    name: "Global Variable",
    data: {
      id: addonId,
      name: "Global Variable",
      key: "",
      displayName: "",
      valueType: "percent",
      defaultValue: 0,
      scope: "global",
    },
  };
}

export function createDefaultInventoryAddon(addonId: string): InventorySectionAddon {
  return {
    id: addonId,
    type: "inventory",
    name: "Inventory",
    data: {
      id: addonId,
      name: "Inventory",
      weight: 0,
      stackable: true,
      maxStack: 99,
      inventoryCategory: "",
      slotSize: 1,
      hasDurabilityConfig: false,
      durability: 0,
      hasVolumeConfig: false,
      volume: 0,
      maxDurability: 0,
      bindType: "none",
      showInShop: true,
      consumable: false,
      discardable: true,
    },
  };
}

export function createDefaultProductionAddon(addonId: string): ProductionSectionAddon {
  return {
    id: addonId,
    type: "production",
    name: "Production",
    data: {
      id: addonId,
      name: "Production",
      mode: "passive",
      minOutput: 1,
      maxOutput: 1,
      intervalSeconds: 60,
      requiresCollection: false,
      ingredients: [],
      outputs: [],
      craftTimeSeconds: 60,
    },
  };
}

export function createDefaultCraftTableAddon(addonId: string): CraftTableSectionAddon {
  return {
    id: addonId,
    type: "craftTable",
    name: "Mesa de Produção",
    data: {
      id: addonId,
      name: "Mesa de Produção",
      entries: [],
    },
  };
}

export function createDefaultDataSchemaAddon(addonId: string): DataSchemaSectionAddon {
  return {
    id: addonId,
    type: "dataSchema",
    name: "Schema de Dados",
    data: {
      id: addonId,
      name: "Schema de Dados",
      entries: [
        {
          id: `stat-${Date.now()}-a`,
          key: "stat_key",
          label: "Stat Label",
          valueType: "int",
          value: 0,
        },
        {
          id: `stat-${Date.now()}-b`,
          key: "other_stat",
          label: "Other Stat",
          valueType: "float",
          value: 0,
        },
      ],
    },
  };
}

export function createDefaultAttributeDefinitionsAddon(addonId: string): AttributeDefinitionsSectionAddon {
  return {
    id: addonId,
    type: "attributeDefinitions",
    name: "Definições de Atributos",
    data: {
      id: addonId,
      name: "Definições de Atributos",
      attributes: [
        {
          id: `attr-${Date.now()}-a`,
          key: "strength",
          label: "Força",
          valueType: "int",
          defaultValue: 0,
          min: 0,
        },
      ],
    },
  };
}

export function createDefaultAttributeProfileAddon(addonId: string): AttributeProfileSectionAddon {
  return {
    id: addonId,
    type: "attributeProfile",
    name: "Perfil de Atributos",
    data: {
      id: addonId,
      name: "Perfil de Atributos",
      values: [],
    },
  };
}

export function createDefaultAttributeModifiersAddon(addonId: string): AttributeModifiersSectionAddon {
  return {
    id: addonId,
    type: "attributeModifiers",
    name: "Modificadores de Atributos",
    data: {
      id: addonId,
      name: "Modificadores de Atributos",
      modifiers: [],
    },
  };
}

export function createDefaultFieldLibraryAddon(addonId: string): FieldLibrarySectionAddon {
  const now = Date.now();
  return {
    id: addonId,
    type: "fieldLibrary",
    name: "Biblioteca de Campos",
    data: {
      id: addonId,
      name: "Biblioteca de Campos",
      entries: [
        {
          id: `field-${now}-a`,
          key: "field_key",
          label: "Campo",
          description: "",
        },
      ],
    },
  };
}

export function createDefaultRichDocAddon(addonId: string): RichDocSectionAddon {
  return {
    id: addonId,
    type: "richDoc",
    name: "Documento",
    data: {
      id: addonId,
      name: "Documento",
      blocks: [],
      schemaVersion: 1,
    },
  };
}

export function createDefaultSkillsAddon(addonId: string): SkillsSectionAddon {
  return {
    id: addonId,
    type: "skills",
    name: "Skills",
    data: {
      id: addonId,
      name: "Skills",
      entries: [],
    },
  };
}

export function createDefaultExportSchemaAddon(addonId: string): ExportSchemaSectionAddon {
  return {
    id: addonId,
    type: "exportSchema",
    name: "Remote Config",
    data: {
      id: addonId,
      name: "Remote Config",
      nodes: [],
    },
  };
}

// Legacy alias: prefer createDefaultDataSchemaAddon in new code.
export const createDefaultGenericStatsAddon = createDefaultDataSchemaAddon;

export function buildProgressionRowsFromRange(
  startLevel: number,
  endLevel: number,
  columns: ProgressionTableColumn[]
): ProgressionTableRow[] {
  return createDefaultRows(startLevel, endLevel, columns);
}

export function balanceDraftToSectionAddon(draft: BalanceAddonDraft): XpBalanceSectionAddon {
  return {
    id: draft.id,
    type: "xpBalance",
    name: draft.name,
    data: draft,
  };
}

export function sectionAddonToBalanceDraft(addon: SectionAddon): BalanceAddonDraft {
  if (addon.type !== "xpBalance") {
    throw new Error("Addon nao e do tipo xpBalance.");
  }
  return {
    ...addon.data,
    id: addon.id,
    name: addon.name,
  };
}

