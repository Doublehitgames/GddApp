import type { BalanceAddonDraft } from "@/lib/balance/types";

export type ProgressionTableColumn = {
  id: string;
  name: string;
  generator?: ProgressionColumnGenerator;
  decimals?: number;
  isPercentage?: boolean;
  min?: number;
  max?: number;
};

export type ProgressionColumnGenerator =
  | { mode: "manual" }
  | { mode: "linear"; base: number; step: number }
  | { mode: "exponential"; base: number; growth: number }
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
  // Recipe mode
  ingredients: ProductionIngredient[];
  outputs: ProductionOutput[];
  craftTimeSeconds?: number;
  craftTimeSecondsProgressionLink?: ProductionProgressionLink;
  notes?: string;
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

export type AttributeModifierEntry = {
  id: string;
  attributeKey: string;
  mode: AttributeModifierMode;
  value: number | boolean;
};

export type AttributeModifiersAddonDraft = {
  id: string;
  name: string;
  definitionsRef?: string;
  modifiers: AttributeModifierEntry[];
};

// ── Export Schema addon ──────────────────────────────────────────────

export type ExportSchemaArraySource = {
  type: "progressionTable";
  addonId: string;
  addonName?: string;
};

export type ExportSchemaBinding =
  | { source: "manual"; value: string | number | boolean; valueType: "string" | "number" | "boolean" }
  | { source: "dataSchema"; addonId: string; addonName?: string; entryKey: string; entryId?: string }
  | { source: "rowLevel" }
  | { source: "rowColumn"; columnId: string };

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

export type ExportSchemaAddonDraft = {
  id: string;
  name: string;
  nodes: ExportSchemaNode[];
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
  | "dataSchema"
  | "attributeDefinitions"
  | "attributeProfile"
  | "attributeModifiers"
  | "exportSchema"
  // legacy type kept for compatibility/migration
  | "genericStats";
export type LegacySectionAddonType = "balance";

export type XpBalanceSectionAddon = {
  id: string;
  type: "xpBalance";
  name: string;
  data: BalanceAddonDraft;
};

export type ProgressionTableSectionAddon = {
  id: string;
  type: "progressionTable";
  name: string;
  data: ProgressionTableAddonDraft;
};

export type EconomyLinkSectionAddon = {
  id: string;
  type: "economyLink";
  name: string;
  data: EconomyLinkAddonDraft;
};

export type CurrencySectionAddon = {
  id: string;
  type: "currency";
  name: string;
  data: CurrencyAddonDraft;
};

export type GlobalVariableSectionAddon = {
  id: string;
  type: "globalVariable";
  name: string;
  data: GlobalVariableAddonDraft;
};

export type InventorySectionAddon = {
  id: string;
  type: "inventory";
  name: string;
  data: InventoryAddonDraft;
};

export type ProductionSectionAddon = {
  id: string;
  type: "production";
  name: string;
  data: ProductionAddonDraft;
};

export type DataSchemaSectionAddon = {
  id: string;
  type: "dataSchema";
  name: string;
  data: DataSchemaAddonDraft;
};

export type AttributeDefinitionsSectionAddon = {
  id: string;
  type: "attributeDefinitions";
  name: string;
  data: AttributeDefinitionsAddonDraft;
};

export type AttributeProfileSectionAddon = {
  id: string;
  type: "attributeProfile";
  name: string;
  data: AttributeProfileAddonDraft;
};

export type AttributeModifiersSectionAddon = {
  id: string;
  type: "attributeModifiers";
  name: string;
  data: AttributeModifiersAddonDraft;
};

export type ExportSchemaSectionAddon = {
  id: string;
  type: "exportSchema";
  name: string;
  data: ExportSchemaAddonDraft;
};

// Legacy addon shape kept for compatibility in normalize/migration flows.
export type GenericStatsSectionAddon = {
  id: string;
  type: "genericStats";
  name: string;
  data: DataSchemaAddonDraft;
};

export type SectionAddon =
  | XpBalanceSectionAddon
  | ProgressionTableSectionAddon
  | EconomyLinkSectionAddon
  | CurrencySectionAddon
  | GlobalVariableSectionAddon
  | InventorySectionAddon
  | ProductionSectionAddon
  | DataSchemaSectionAddon
  | AttributeDefinitionsSectionAddon
  | AttributeProfileSectionAddon
  | AttributeModifiersSectionAddon
  | ExportSchemaSectionAddon
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

