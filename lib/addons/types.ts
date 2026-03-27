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
  | { mode: "formula"; baseColumnId: string; expression: string };

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
  notes?: string;
};

export type DataSchemaAddonDraft = {
  id: string;
  name: string;
  entries: DataSchemaEntry[];
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

