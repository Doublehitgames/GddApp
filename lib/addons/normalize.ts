import type { BalanceAddonDraft } from "@/lib/balance/types";
import type {
  AttributeDefinitionsAddonDraft,
  AttributeModifiersAddonDraft,
  AttributeProfileAddonDraft,
  CurrencyAddonDraft,
  DataSchemaAddonDraft,
  EconomyLinkAddonDraft,
  ExportSchemaAddonDraft,
  ExportSchemaBinding,
  ExportSchemaNode,
  GlobalVariableAddonDraft,
  InventoryAddonDraft,
  LegacySectionAddonType,
  ProductionAddonDraft,
  ProductionFieldKey,
  ProgressionTableAddonDraft,
  ProgressionTableColumn,
  ProgressionTableRow,
  SectionAddon,
} from "@/lib/addons/types";
import { balanceDraftToSectionAddon, buildProgressionRowsFromRange } from "@/lib/addons/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asBalanceDraft(value: unknown): BalanceAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  return value as unknown as BalanceAddonDraft;
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeColumnId(raw: unknown, fallbackIndex: number): string {
  const base = typeof raw === "string" && raw.trim() ? raw.trim() : `col_${fallbackIndex + 1}`;
  return base.replace(/\s+/g, "_");
}

function normalizeProgressionColumns(rawColumns: unknown[]): ProgressionTableColumn[] {
  const columns: ProgressionTableColumn[] = [];
  const usedIds = new Set<string>();
  for (let index = 0; index < rawColumns.length; index += 1) {
    const rawColumn = rawColumns[index];
    if (!isObject(rawColumn)) continue;
    const initialId = normalizeColumnId(rawColumn.id, index);
    let id = initialId;
    let dedupe = 2;
    while (usedIds.has(id)) {
      id = `${initialId}_${dedupe}`;
      dedupe += 1;
    }
    usedIds.add(id);
    const name = typeof rawColumn.name === "string" ? rawColumn.name : "Value";
    const decimalsValue = asFiniteNumber(rawColumn.decimals);
    const minValue = asFiniteNumber(rawColumn.min);
    const maxValue = asFiniteNumber(rawColumn.max);
    const isPercentage =
      typeof rawColumn.isPercentage === "boolean"
        ? rawColumn.isPercentage
        : String(rawColumn.isPercentage ?? "").trim().toLowerCase() === "true";
    const column: ProgressionTableColumn = {
      id,
      name,
      generator: isObject(rawColumn.generator) ? (rawColumn.generator as ProgressionTableColumn["generator"]) : { mode: "manual" },
      decimals: decimalsValue == null ? 0 : Math.max(0, Math.min(6, Math.floor(decimalsValue))),
      isPercentage,
      min: minValue == null ? undefined : minValue,
      max: maxValue == null ? undefined : maxValue,
    };
    columns.push(column);
  }
  if (columns.length > 0) return columns;
  return [{ id: "value", name: "Value", generator: { mode: "manual" }, decimals: 0, isPercentage: false }];
}

function normalizeProgressionRows(rawRows: unknown[], columns: ProgressionTableColumn[]): ProgressionTableRow[] {
  const normalizedRows: ProgressionTableRow[] = [];
  for (const rawRow of rawRows) {
    if (!isObject(rawRow)) continue;
    const level = asFiniteNumber(rawRow.level);
    if (level == null) continue;
    const valuesObj = isObject(rawRow.values) ? rawRow.values : {};
    const values: Record<string, number | string> = {};
    for (const column of columns) {
      const rawValue = valuesObj[column.id];
      const parsed = asFiniteNumber(rawValue);
      values[column.id] = parsed == null ? 0 : parsed;
    }
    normalizedRows.push({ level: Math.max(1, Math.floor(level)), values });
  }
  return normalizedRows.sort((a, b) => a.level - b.level);
}

function normalizeModifierRefs(raw: unknown): Array<{ refId: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ refId: string }> = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const refId = item.trim();
      if (refId) out.push({ refId });
      continue;
    }
    if (!isObject(item)) continue;
    if (typeof item.refId !== "string") continue;
    const refId = item.refId.trim();
    if (!refId) continue;
    out.push({ refId });
  }
  return out;
}

function asPositiveIntegerOrUndefined(value: unknown): number | undefined {
  const parsed = asFiniteNumber(value);
  if (parsed == null) return undefined;
  return Math.max(0, Math.floor(parsed));
}

function asBooleanLoose(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  }
  return Boolean(value);
}

function normalizeEconomyLinkDraft(value: unknown): EconomyLinkAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;

  const buyValue = asPositiveIntegerOrUndefined(value.buyValue);
  const minBuyValue = asPositiveIntegerOrUndefined(value.minBuyValue);
  const sellValue = asPositiveIntegerOrUndefined(value.sellValue);
  const maxSellValue = asPositiveIntegerOrUndefined(value.maxSellValue);
  const produceMin = asPositiveIntegerOrUndefined(value.produceMin);
  const produceMax = asPositiveIntegerOrUndefined(value.produceMax);
  const normalizedProduceMin = produceMin == null ? undefined : produceMin;
  const normalizedProduceMax =
    produceMax == null
      ? undefined
      : normalizedProduceMin == null
        ? produceMax
        : Math.max(normalizedProduceMin, produceMax);

  const buyCurrencyRef = typeof value.buyCurrencyRef === "string" ? value.buyCurrencyRef.trim() : "";
  const sellCurrencyRef = typeof value.sellCurrencyRef === "string" ? value.sellCurrencyRef.trim() : "";
  const producedItemRef = typeof value.producedItemRef === "string" ? value.producedItemRef.trim() : "";
  const unlockRef = typeof value.unlockRef === "string" ? value.unlockRef.trim() : "";
  const notes = typeof value.notes === "string" ? value.notes : "";
  const buyModifiers = normalizeModifierRefs(value.buyModifiers);
  const sellModifiers = normalizeModifierRefs(value.sellModifiers);
  const hasBuyConfig =
    typeof value.hasBuyConfig === "boolean"
      ? value.hasBuyConfig
      : Boolean(buyCurrencyRef || buyValue != null || buyModifiers.length > 0);
  const hasSellConfig =
    typeof value.hasSellConfig === "boolean"
      ? value.hasSellConfig
      : Boolean(sellCurrencyRef || sellValue != null || sellModifiers.length > 0);
  const hasProductionConfig =
    typeof value.hasProductionConfig === "boolean"
      ? value.hasProductionConfig
      : Boolean(
          producedItemRef ||
            produceMin != null ||
            produceMax != null ||
            asPositiveIntegerOrUndefined(value.productionTimeSeconds) != null
        );
  const unlockValue = asPositiveIntegerOrUndefined(value.unlockValue);
  const hasUnlockConfig =
    typeof value.hasUnlockConfig === "boolean"
      ? value.hasUnlockConfig
      : Boolean(unlockRef || unlockValue != null);

  return {
    id: value.id,
    name: value.name,
    hasBuyConfig,
    buyCurrencyRef: buyCurrencyRef || undefined,
    buyValue,
    minBuyValue,
    buyModifiers,
    hasSellConfig,
    sellCurrencyRef: sellCurrencyRef || undefined,
    sellValue,
    maxSellValue,
    sellModifiers,
    hasProductionConfig,
    producedItemRef: producedItemRef || undefined,
    produceMin: normalizedProduceMin,
    produceMax: normalizedProduceMax,
    productionTimeSeconds: asPositiveIntegerOrUndefined(value.productionTimeSeconds),
    hasUnlockConfig,
    unlockRef: unlockRef || undefined,
    unlockValue,
    notes: notes || undefined,
  };
}

function normalizeCurrencyDraft(value: unknown): CurrencyAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;

  const code = typeof value.code === "string" ? value.code.trim().toUpperCase() : "";
  const displayName = typeof value.displayName === "string" ? value.displayName : "";
  const rawKind = typeof value.kind === "string" ? value.kind : "other";
  const kind = rawKind === "soft" || rawKind === "premium" || rawKind === "event" || rawKind === "other" ? rawKind : "other";
  const decimals = asPositiveIntegerOrUndefined(value.decimals) ?? 0;
  const notes = typeof value.notes === "string" ? value.notes : "";

  return {
    id: value.id,
    name: value.name,
    code,
    displayName,
    kind,
    decimals,
    notes: notes || undefined,
  };
}

function normalizeGlobalVariableDraft(value: unknown): GlobalVariableAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;

  const keyRaw = typeof value.key === "string" ? value.key : "";
  const key = keyRaw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-\s]+/g, "")
    .replace(/\s+/g, "_");
  const displayName = typeof value.displayName === "string" ? value.displayName : "";

  const rawValueType = typeof value.valueType === "string" ? value.valueType : "percent";
  const valueType =
    rawValueType === "percent" || rawValueType === "multiplier" || rawValueType === "flat" || rawValueType === "boolean"
      ? rawValueType
      : "percent";

  let defaultValue: number | boolean;
  if (valueType === "boolean") {
    defaultValue = Boolean(value.defaultValue);
  } else {
    defaultValue = asFiniteNumber(value.defaultValue) ?? 0;
  }

  const rawScope = typeof value.scope === "string" ? value.scope : "global";
  const scope = rawScope === "global" || rawScope === "mode" || rawScope === "event" || rawScope === "season" ? rawScope : "global";
  const notes = typeof value.notes === "string" ? value.notes : "";

  return {
    id: value.id,
    name: value.name,
    key,
    displayName,
    valueType,
    defaultValue,
    scope,
    notes: notes || undefined,
  };
}

function normalizeInventoryDraft(value: unknown): InventoryAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;

  const weight = asFiniteNumber(value.weight) ?? 0;
  const stackable = Boolean(value.stackable);
  const maxStackRaw = asPositiveIntegerOrUndefined(value.maxStack) ?? 1;
  const maxStack = stackable ? Math.max(1, maxStackRaw) : 1;
  const inventoryCategory = typeof value.inventoryCategory === "string" ? value.inventoryCategory : "";
  const slotSize = asFiniteNumber(value.slotSize) ?? 0;
  const durability = Math.max(0, asFiniteNumber(value.durability) ?? 0);
  const volume = asFiniteNumber(value.volume);
  const maxDurability = asFiniteNumber(value.maxDurability);
  const hasDurabilityConfig =
    typeof value.hasDurabilityConfig === "boolean" || typeof value.hasDurabilityConfig === "string"
      ? asBooleanLoose(value.hasDurabilityConfig)
      : durability > 0 || (maxDurability != null && maxDurability > 0);
  const hasVolumeConfig =
    typeof value.hasVolumeConfig === "boolean" || typeof value.hasVolumeConfig === "string"
      ? asBooleanLoose(value.hasVolumeConfig)
      : volume != null && volume > 0;
  const bindTypeRaw = typeof value.bindType === "string" ? value.bindType : "none";
  const bindType = bindTypeRaw === "none" || bindTypeRaw === "onPickup" || bindTypeRaw === "onEquip" ? bindTypeRaw : "none";
  let showInShop = true;
  if (value.showInShop != null) showInShop = asBooleanLoose(value.showInShop);
  const consumable = asBooleanLoose(value.consumable);
  const discardable = value.discardable == null ? true : asBooleanLoose(value.discardable);
  const notes = typeof value.notes === "string" ? value.notes : "";

  return {
    id: value.id,
    name: value.name,
    weight: Math.max(0, weight),
    stackable,
    maxStack,
    inventoryCategory,
    slotSize: Math.max(0, slotSize),
    hasDurabilityConfig,
    durability: hasDurabilityConfig ? durability : 0,
    hasVolumeConfig,
    volume: hasVolumeConfig ? (volume == null ? 0 : Math.max(0, volume)) : undefined,
    maxDurability: hasDurabilityConfig ? (maxDurability == null ? 0 : Math.max(0, maxDurability)) : undefined,
    bindType,
    showInShop,
    consumable,
    discardable,
    notes: notes || undefined,
  };
}

function normalizeProductionItems(raw: unknown): Array<{ itemRef: string; quantity: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ itemRef: string; quantity: number }> = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const itemRef = typeof item.itemRef === "string" ? item.itemRef.trim() : "";
    const quantity = Math.max(1, asPositiveIntegerOrUndefined(item.quantity) ?? 1);
    out.push({ itemRef, quantity });
  }
  return out;
}

function normalizeProductionProgressionLink(
  value: unknown
): { progressionAddonId: string; columnId: string; columnName: string } | undefined {
  if (!isObject(value)) return undefined;
  const progressionAddonId =
    typeof value.progressionAddonId === "string" ? value.progressionAddonId.trim() : "";
  const columnId = typeof value.columnId === "string" ? value.columnId.trim() : "";
  const columnName = typeof value.columnName === "string" ? value.columnName.trim() : "";
  if (!progressionAddonId || !columnId || !columnName) return undefined;
  return {
    progressionAddonId,
    columnId,
    columnName,
  };
}

function normalizeProductionDraft(value: unknown): ProductionAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;

  const mode = value.mode === "recipe" ? "recipe" : "passive";
  const outputRef = typeof value.outputRef === "string" ? value.outputRef.trim() : "";
  const minOutput = asPositiveIntegerOrUndefined(value.minOutput);
  const maxOutputRaw = asPositiveIntegerOrUndefined(value.maxOutput);
  const maxOutput = maxOutputRaw == null ? undefined : minOutput == null ? maxOutputRaw : Math.max(minOutput, maxOutputRaw);
  const minOutputProgressionLink = normalizeProductionProgressionLink(value.minOutputProgressionLink);
  const maxOutputProgressionLink = normalizeProductionProgressionLink(value.maxOutputProgressionLink);
  const intervalSeconds = asPositiveIntegerOrUndefined(value.intervalSeconds);
  const requiresCollection = value.requiresCollection == null ? false : asBooleanLoose(value.requiresCollection);
  const capacity = asPositiveIntegerOrUndefined(value.capacity);
  const ingredients = normalizeProductionItems(value.ingredients);
  const outputs = normalizeProductionItems(value.outputs);
  const craftTimeSeconds = asPositiveIntegerOrUndefined(value.craftTimeSeconds);
  const intervalSecondsProgressionLink = normalizeProductionProgressionLink(value.intervalSecondsProgressionLink);
  const craftTimeSecondsProgressionLink = normalizeProductionProgressionLink(value.craftTimeSecondsProgressionLink);
  const notes = typeof value.notes === "string" ? value.notes : "";

  return {
    id: value.id,
    name: value.name,
    mode,
    outputRef: outputRef || undefined,
    minOutput,
    minOutputProgressionLink,
    maxOutput,
    maxOutputProgressionLink,
    intervalSeconds,
    intervalSecondsProgressionLink,
    requiresCollection,
    capacity,
    ingredients,
    outputs,
    craftTimeSeconds,
    craftTimeSecondsProgressionLink,
    notes: notes || undefined,
  };
}

function normalizeDataSchemaDraft(value: unknown): DataSchemaAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  const rawEntries = Array.isArray(value.entries) ? value.entries : [];
  const normalizedEntries: DataSchemaAddonDraft["entries"] = [];
  const seenKeys = new Set<string>();
  for (let index = 0; index < rawEntries.length; index += 1) {
    const rawEntry = rawEntries[index];
    if (!isObject(rawEntry)) continue;
    const entryId = typeof rawEntry.id === "string" && rawEntry.id.trim() ? rawEntry.id.trim() : `stat_${index + 1}`;
    const keyRaw = typeof rawEntry.key === "string" ? rawEntry.key : "";
    const key = keyRaw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\s-]/g, "")
      .replace(/[\s-]+/g, "_")
      .replace(/_+/g, "_");
    if (!key) continue;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const label = typeof rawEntry.label === "string" ? rawEntry.label : key;
    const valueTypeRaw = typeof rawEntry.valueType === "string" ? rawEntry.valueType : "int";
    const valueType =
      valueTypeRaw === "int" ||
      valueTypeRaw === "float" ||
      valueTypeRaw === "seconds" ||
      valueTypeRaw === "percent" ||
      valueTypeRaw === "boolean" ||
      valueTypeRaw === "string"
        ? valueTypeRaw
        : "int";
    const min = asFiniteNumber(rawEntry.min) ?? undefined;
    const max = asFiniteNumber(rawEntry.max) ?? undefined;
    const unit = typeof rawEntry.unit === "string" && rawEntry.unit.trim() ? rawEntry.unit.trim() : undefined;
    const unitXpRef = typeof rawEntry.unitXpRef === "string" && rawEntry.unitXpRef.trim() ? rawEntry.unitXpRef.trim() : undefined;
    const economyLinkRef = typeof rawEntry.economyLinkRef === "string" && rawEntry.economyLinkRef.trim() ? rawEntry.economyLinkRef.trim() : undefined;
    const rawEconomyField = typeof rawEntry.economyLinkField === "string" ? rawEntry.economyLinkField : undefined;
    const economyLinkField =
      rawEconomyField === "buyValue" || rawEconomyField === "minBuyValue" || rawEconomyField === "sellValue" || rawEconomyField === "maxSellValue" || rawEconomyField === "unlockValue"
        ? rawEconomyField
        : undefined;
    const productionRef = typeof rawEntry.productionRef === "string" && rawEntry.productionRef.trim() ? rawEntry.productionRef.trim() : undefined;
    const rawProductionField = typeof rawEntry.productionField === "string" ? rawEntry.productionField : undefined;
    const validProductionFields = new Set(["minOutput", "maxOutput", "intervalSeconds", "craftTimeSeconds", "capacity", "outputBuyEffective", "outputMinBuyValue", "outputSellEffective", "outputMaxSellValue", "outputUnlockValue"]);
    const productionField: ProductionFieldKey | undefined = rawProductionField && validProductionFields.has(rawProductionField) ? (rawProductionField as ProductionFieldKey) : undefined;
    const notes = typeof rawEntry.notes === "string" && rawEntry.notes.trim() ? rawEntry.notes : undefined;
    let normalizedValue: number | boolean | string = 0;
    if (valueType === "boolean") {
      normalizedValue = asBooleanLoose(rawEntry.value);
    } else if (valueType === "string") {
      normalizedValue = typeof rawEntry.value === "string" ? rawEntry.value : "";
    } else {
      const rawNumber = asFiniteNumber(rawEntry.value) ?? 0;
      let safeNumber = valueType === "float" ? rawNumber : Math.floor(rawNumber);
      if (min != null) safeNumber = Math.max(min, safeNumber);
      if (max != null) safeNumber = Math.min(max, safeNumber);
      normalizedValue = safeNumber;
    }
    normalizedEntries.push({
      id: entryId,
      key,
      label,
      valueType,
      value: normalizedValue,
      min: valueType === "boolean" || valueType === "string" ? undefined : min,
      max: valueType === "boolean" || valueType === "string" ? undefined : max,
      unit,
      unitXpRef,
      economyLinkRef,
      economyLinkField: economyLinkRef ? economyLinkField : undefined,
      productionRef,
      productionField: productionRef ? productionField : undefined,
      usePageDataId: asBooleanLoose(rawEntry.usePageDataId) || undefined,
      notes,
    });
  }

  return {
    id: value.id,
    name: value.name,
    entries: normalizedEntries,
  };
}

function normalizeAttributeKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function normalizeAttributeValueType(raw: unknown): "int" | "float" | "percent" | "boolean" {
  if (raw === "int" || raw === "float" || raw === "percent" || raw === "boolean") return raw;
  return "int";
}

function normalizeAttributeDefinitionsDraft(value: unknown): AttributeDefinitionsAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  const rawAttributes = Array.isArray(value.attributes) ? value.attributes : [];
  const seen = new Set<string>();
  const attributes: AttributeDefinitionsAddonDraft["attributes"] = [];
  for (let index = 0; index < rawAttributes.length; index += 1) {
    const item = rawAttributes[index];
    if (!isObject(item)) continue;
    const key = normalizeAttributeKey(item.key);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const valueType = normalizeAttributeValueType(item.valueType);
    const min = asFiniteNumber(item.min) ?? undefined;
    const max = asFiniteNumber(item.max) ?? undefined;
    let defaultValue: number | boolean;
    if (valueType === "boolean") {
      defaultValue = asBooleanLoose(item.defaultValue);
    } else {
      const parsed = asFiniteNumber(item.defaultValue) ?? 0;
      defaultValue = valueType === "int" ? Math.floor(parsed) : parsed;
    }
    const boundedDefault =
      typeof defaultValue === "number"
        ? Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, defaultValue))
        : defaultValue;
    attributes.push({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `attr_${index + 1}`,
      key,
      label: typeof item.label === "string" && item.label.trim() ? item.label : key,
      valueType,
      defaultValue: boundedDefault,
      min: valueType === "boolean" ? undefined : min,
      max: valueType === "boolean" ? undefined : max,
      unit: typeof item.unit === "string" && item.unit.trim() ? item.unit.trim() : undefined,
    });
  }
  return {
    id: value.id,
    name: value.name,
    attributes,
  };
}

function normalizeAttributeProfileDraft(value: unknown): AttributeProfileAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  const definitionsRef =
    typeof value.definitionsRef === "string" && value.definitionsRef.trim() ? value.definitionsRef.trim() : undefined;
  const rawValues = Array.isArray(value.values) ? value.values : [];
  const values: AttributeProfileAddonDraft["values"] = [];
  for (let index = 0; index < rawValues.length; index += 1) {
    const item = rawValues[index];
    if (!isObject(item)) continue;
    const attributeKey = normalizeAttributeKey(item.attributeKey);
    if (!attributeKey) continue;
    const numeric = asFiniteNumber(item.value);
    const normalizedValue = numeric == null ? asBooleanLoose(item.value) : numeric;
    values.push({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `attr_profile_${index + 1}`,
      attributeKey,
      value: normalizedValue,
    });
  }
  return {
    id: value.id,
    name: value.name,
    definitionsRef,
    values,
  };
}

function normalizeAttributeModifiersDraft(value: unknown): AttributeModifiersAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  const definitionsRef =
    typeof value.definitionsRef === "string" && value.definitionsRef.trim() ? value.definitionsRef.trim() : undefined;
  const rawModifiers = Array.isArray(value.modifiers) ? value.modifiers : [];
  const modifiers: AttributeModifiersAddonDraft["modifiers"] = [];
  for (let index = 0; index < rawModifiers.length; index += 1) {
    const item = rawModifiers[index];
    if (!isObject(item)) continue;
    const attributeKey = normalizeAttributeKey(item.attributeKey);
    if (!attributeKey) continue;
    const mode = item.mode === "mult" || item.mode === "set" ? item.mode : "add";
    const numeric = asFiniteNumber(item.value);
    const normalizedValue = numeric == null ? asBooleanLoose(item.value) : numeric;
    modifiers.push({
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `attr_mod_${index + 1}`,
      attributeKey,
      mode,
      value: normalizedValue,
    });
  }
  return {
    id: value.id,
    name: value.name,
    definitionsRef,
    modifiers,
  };
}

function shouldMigrateEconomyProduction(draft: EconomyLinkAddonDraft): boolean {
  return Boolean(
    draft.hasProductionConfig &&
      (draft.producedItemRef || draft.produceMin != null || draft.produceMax != null || draft.productionTimeSeconds != null)
  );
}

function buildProductionFromEconomy(draft: EconomyLinkAddonDraft): ProductionAddonDraft {
  return {
    id: `production-${draft.id}`,
    name: "Production",
    mode: "passive",
    outputRef: draft.producedItemRef,
    minOutput: draft.produceMin,
    maxOutput: draft.produceMax,
    intervalSeconds: draft.productionTimeSeconds,
    requiresCollection: false,
    ingredients: [],
    outputs: [],
    craftTimeSeconds: draft.productionTimeSeconds,
  };
}

function normalizeExportSchemaBinding(raw: unknown): ExportSchemaBinding | undefined {
  if (!isObject(raw)) return undefined;
  const source = raw.source;
  if (source === "manual") {
    const valueType = raw.valueType === "string" || raw.valueType === "number" || raw.valueType === "boolean"
      ? raw.valueType : "string";
    let value: string | number | boolean = "";
    if (valueType === "number") value = asFiniteNumber(raw.value) ?? 0;
    else if (valueType === "boolean") value = asBooleanLoose(raw.value);
    else value = typeof raw.value === "string" ? raw.value : String(raw.value ?? "");
    return { source: "manual", value, valueType };
  }
  if (source === "dataSchema") {
    const addonId = typeof raw.addonId === "string" ? raw.addonId.trim() : "";
    const addonName = typeof raw.addonName === "string" && raw.addonName.trim() ? raw.addonName.trim() : undefined;
    const entryKey = typeof raw.entryKey === "string" ? raw.entryKey.trim() : "";
    const entryId = typeof raw.entryId === "string" && raw.entryId.trim() ? raw.entryId.trim() : undefined;
    if ((!addonId && !addonName) || !entryKey) return undefined;
    return { source: "dataSchema", addonId, addonName, entryKey, entryId };
  }
  if (source === "rowLevel") return { source: "rowLevel" };
  if (source === "rowColumn") {
    const columnId = typeof raw.columnId === "string" ? raw.columnId.trim() : "";
    if (!columnId) return undefined;
    return { source: "rowColumn", columnId };
  }
  return undefined;
}

function normalizeExportSchemaNodes(rawNodes: unknown[]): ExportSchemaNode[] {
  const nodes: ExportSchemaNode[] = [];
  for (const rawNode of rawNodes) {
    if (!isObject(rawNode)) continue;
    const id = typeof rawNode.id === "string" && rawNode.id.trim() ? rawNode.id.trim() : `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const key = typeof rawNode.key === "string" ? rawNode.key.trim() : "";
    if (!key) continue;
    const nodeType = rawNode.nodeType === "object" || rawNode.nodeType === "array" || rawNode.nodeType === "value"
      ? rawNode.nodeType : "value";
    const node: ExportSchemaNode = { id, key, nodeType };
    if (nodeType === "object") {
      node.children = Array.isArray(rawNode.children) ? normalizeExportSchemaNodes(rawNode.children) : [];
    }
    if (nodeType === "array") {
      if (isObject(rawNode.arraySource) && rawNode.arraySource.type === "progressionTable" && typeof rawNode.arraySource.addonId === "string") {
        const arrAddonName = typeof rawNode.arraySource.addonName === "string" && rawNode.arraySource.addonName.trim() ? rawNode.arraySource.addonName.trim() : undefined;
        node.arraySource = { type: "progressionTable", addonId: rawNode.arraySource.addonId.trim(), addonName: arrAddonName };
      }
      node.itemTemplate = Array.isArray(rawNode.itemTemplate) ? normalizeExportSchemaNodes(rawNode.itemTemplate) : [];
    }
    if (nodeType === "value") {
      node.binding = normalizeExportSchemaBinding(rawNode.binding);
      if (rawNode.abs === true) node.abs = true;
      const rawMult = typeof rawNode.multiplier === "number" && Number.isFinite(rawNode.multiplier) ? rawNode.multiplier : undefined;
      if (rawMult != null) node.multiplier = rawMult;
    }
    nodes.push(node);
  }
  return nodes;
}

function normalizeExportSchemaDraft(value: unknown): ExportSchemaAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  const rawNodes = Array.isArray(value.nodes) ? value.nodes : [];
  const result: ExportSchemaAddonDraft = {
    id: value.id,
    name: value.name,
    nodes: normalizeExportSchemaNodes(rawNodes),
  };
  if (
    value.arrayFormat === "rowMajor" ||
    value.arrayFormat === "columnMajor" ||
    value.arrayFormat === "keyedByLevel" ||
    value.arrayFormat === "matrix"
  ) {
    result.arrayFormat = value.arrayFormat;
  }
  return result;
}

function asSectionAddon(value: unknown): SectionAddon | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  if (
    value.type !== "xpBalance" &&
    value.type !== "progressionTable" &&
    value.type !== "economyLink" &&
    value.type !== "currency" &&
    value.type !== "globalVariable" &&
    value.type !== "inventory" &&
    value.type !== "production" &&
    value.type !== "dataSchema" &&
    value.type !== "attributeDefinitions" &&
    value.type !== "attributeProfile" &&
    value.type !== "attributeModifiers" &&
    value.type !== "exportSchema" &&
    value.type !== "genericStats"
  ) {
    return null;
  }
  if (!isObject(value.data)) return null;
  return value as unknown as SectionAddon;
}

function asLegacySectionAddon(value: unknown): SectionAddon | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  const legacyType = value.type as LegacySectionAddonType;
  if (legacyType !== "balance") return null;
  if (!isObject(value.data)) return null;
  const legacyData = asBalanceDraft(value.data);
  if (!legacyData) return null;
  return balanceDraftToSectionAddon({
    ...legacyData,
    id: value.id,
    name: value.name,
  });
}

function normalizeProgressionTableDraft(value: unknown): ProgressionTableAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  if (!Array.isArray(value.columns) || !Array.isArray(value.rows)) return null;
  const columns = normalizeProgressionColumns(value.columns);
  const normalizedRows = normalizeProgressionRows(value.rows, columns);
  const startLevelCandidate = asFiniteNumber(value.startLevel);
  const endLevelCandidate = asFiniteNumber(value.endLevel);
  const minRowLevel = normalizedRows.length > 0 ? normalizedRows[0].level : 1;
  const maxRowLevel = normalizedRows.length > 0 ? normalizedRows[normalizedRows.length - 1].level : minRowLevel;
  const startLevel = Math.max(1, Math.floor(startLevelCandidate ?? minRowLevel));
  const endLevel = Math.max(startLevel, Math.floor(endLevelCandidate ?? maxRowLevel));
  const rangeRows = buildProgressionRowsFromRange(startLevel, endLevel, columns);
  const byLevel = new Map(normalizedRows.map((row) => [row.level, row]));
  const rows = rangeRows.map((baseRow) => {
    const fromInput = byLevel.get(baseRow.level);
    if (!fromInput) return baseRow;
    return {
      level: baseRow.level,
      values: columns.reduce<Record<string, number | string>>((acc, column) => {
        const parsed = asFiniteNumber(fromInput.values[column.id]);
        acc[column.id] = parsed == null ? 0 : parsed;
        return acc;
      }, {}),
    };
  });
  return {
    id: value.id,
    name: value.name,
    startLevel,
    endLevel,
    columns,
    rows,
  };
}

export function normalizeSectionAddons(raw: unknown): SectionAddon[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const hasExplicitProductionAddon = raw.some((item) => isObject(item) && item.type === "production");
  const out: SectionAddon[] = [];
  let migratedProductionFromEconomy = false;
  for (const item of raw) {
    const addon = asSectionAddon(item);
    if (addon) {
      if (addon.type === "progressionTable") {
        const draft = normalizeProgressionTableDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      if (addon.type === "economyLink") {
        const draft = normalizeEconomyLinkDraft(addon.data);
        if (!draft) continue;
        let migratedProductionAddon: ProductionAddonDraft | null = null;
        if (!hasExplicitProductionAddon && !migratedProductionFromEconomy && shouldMigrateEconomyProduction(draft)) {
          migratedProductionAddon = buildProductionFromEconomy(draft);
        }

        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: {
            ...draft,
            hasProductionConfig: false,
            producedItemRef: undefined,
            produceMin: undefined,
            produceMax: undefined,
            productionTimeSeconds: undefined,
          },
        });

        if (migratedProductionAddon) {
          const baseId = migratedProductionAddon.id || `production-${addon.id}`;
          let nextId = baseId;
          let dedupe = 2;
          while (out.some((existing) => existing.id === nextId)) {
            nextId = `${baseId}_${dedupe}`;
            dedupe += 1;
          }
          out.push({
            id: nextId,
            type: "production",
            name: migratedProductionAddon.name,
            data: {
              ...migratedProductionAddon,
              id: nextId,
            },
          });
          migratedProductionFromEconomy = true;
        }
        continue;
      }
      if (addon.type === "currency") {
        const draft = normalizeCurrencyDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      if (addon.type === "globalVariable") {
        const draft = normalizeGlobalVariableDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      if (addon.type === "inventory") {
        const draft = normalizeInventoryDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      if (addon.type === "production") {
        const draft = normalizeProductionDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      if (addon.type === "dataSchema" || addon.type === "genericStats") {
        const draft = normalizeDataSchemaDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          type: "dataSchema",
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      if (addon.type === "attributeDefinitions") {
        const draft = normalizeAttributeDefinitionsDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      if (addon.type === "attributeProfile") {
        const draft = normalizeAttributeProfileDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      if (addon.type === "attributeModifiers") {
        const draft = normalizeAttributeModifiersDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      if (addon.type === "exportSchema") {
        const draft = normalizeExportSchemaDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      out.push({
        ...addon,
        name: addon.name.trim() || addon.name,
      });
      continue;
    }
    const legacyAddon = asLegacySectionAddon(item);
    if (legacyAddon) {
      const rawGroup = isObject(item) && typeof item.group === "string" ? item.group : undefined;
      out.push(rawGroup ? { ...legacyAddon, group: rawGroup } : legacyAddon);
      continue;
    }
    const maybeLegacyDraft = asBalanceDraft(item);
    if (maybeLegacyDraft) {
      const converted = balanceDraftToSectionAddon(maybeLegacyDraft);
      const rawGroup = isObject(item) && typeof item.group === "string" ? item.group : undefined;
      out.push(rawGroup ? { ...converted, group: rawGroup } : converted);
    }
  }
  if (out.length === 0) return undefined;

  // Local integrity pass: when a reference matches a definitions addon id present in the same payload,
  // remove orphaned keys from profile/modifiers.
  const localDefinitionKeysByRef = new Map<string, Set<string>>();
  for (const addon of out) {
    if (addon.type !== "attributeDefinitions") continue;
    const keys = new Set((addon.data.attributes || []).map((item) => item.key));
    localDefinitionKeysByRef.set(addon.id, keys);
    localDefinitionKeysByRef.set(addon.data.id, keys);
  }
  const sanitized = out.map((addon) => {
    if (addon.type !== "attributeProfile" && addon.type !== "attributeModifiers") return addon;
    const ref = addon.data.definitionsRef;
    if (!ref) return addon;
    const validKeys = localDefinitionKeysByRef.get(ref);
    if (!validKeys) return addon;
    if (addon.type === "attributeProfile") {
      return {
        ...addon,
        data: {
          ...addon.data,
          values: (addon.data.values || []).filter((item) => validKeys.has(item.attributeKey)),
        },
      };
    }
    return {
      ...addon,
      data: {
        ...addon.data,
        modifiers: (addon.data.modifiers || []).filter((item) => validKeys.has(item.attributeKey)),
      },
    };
  });
  return sanitized;
}

export function stableAddonsForCompare(raw: unknown): string {
  const normalized = normalizeSectionAddons(raw) || [];
  const sorted = [...normalized].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted);
}

