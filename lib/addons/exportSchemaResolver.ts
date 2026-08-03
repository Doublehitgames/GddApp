import type {
  FieldLibraryAddonDraft,
  ExportSchemaNode,
  ExportSchemaBinding,
  ExportSchemaArrayFormat,
  SectionAddon,
  SectionAddonType,
  CraftTableAddonDraft,
  CraftTableEntry,
  DataSchemaAddonDraft,
  DataSchemaEntry,
  EconomyLinkAddonDraft,
  ProductionAddonDraft,
  ProductionIngredient,
  ProductionOutput,
  ProductionScalarField,
  ProgressionTableAddonDraft,
  ProgressionTableRow,
  SkillsAddonDraft,
  SkillEntry,
  SkillCost,
  SkillEffectRef,
  SkillEntryField,
  SkillCostField,
  SkillEffectField,
  AttributeModifierEntry,
  AttributeModifiersAddonDraft,
  CropAddonDraft,
  InventoryAddonDraft,
} from "@/lib/addons/types";
import { resolveCropFieldValue } from "@/lib/addons/cropFields";
import { resolveInventoryFieldValue } from "@/lib/addons/inventoryFields";
import { sectionAddonToBalanceDraft } from "@/lib/addons/types";
import { generateBalanceCurve } from "@/lib/balance/formulaEngine";

export type SectionLookupEntry = {
  dataId?: string | null;
  addons: SectionAddon[];
  /** Parent section id (null/undefined for root sections). Used by the `sections` array source. */
  parentId?: string | null;
  /** Tree order among siblings. Used to sort children deterministically. */
  order?: number;
  /** Section title, for editor pickers. */
  title?: string;
};

export type SectionLookup = Map<string, SectionLookupEntry>;

type ResolveContext = {
  sectionAddons: SectionAddon[];
  sectionDataId?: string;
  sectionLookup?: SectionLookup;
  row?: ProgressionTableRow;
  entry?: CraftTableEntry;
  /** Current production addon resolved from entry.productionRef (cached per iteration). */
  currentProduction?: ProductionAddonDraft;
  /** Current ingredient/output row (inside productionIngredients/productionOutputs array). */
  currentItem?: ProductionIngredient | ProductionOutput;
  /** Current Skills entry (set during a `skills` array iteration). */
  currentSkill?: SkillEntry;
  /** Current Skill cost (set during a `skillCosts` array iteration). */
  currentSkillCost?: SkillCost;
  /** Current Skill effect + the resolved AttributeModifier entry (set during `skillEffects` iteration). */
  currentSkillEffect?: SkillEffectRef;
  currentSkillEffectResolved?: AttributeModifierEntry;
  /**
   * `definitionsRef` (section ID) from the parent AttributeModifiers addon
   * of the current effect. Stored as raw section id; resolved to dataId
   * lazily when binding `resolvedDefinitionsRef` is read.
   */
  currentSkillEffectDefinitionsRef?: string;
  arrayFormat?: ExportSchemaArrayFormat;
  currentTable?: ProgressionTableAddonDraft;
  /** When provided, the resolver writes every node's computed value here
   *  (first iteration wins for template nodes inside arrays). Used by the
   *  editor to show inline previews. */
  nodeValueMap?: Map<string, unknown>;
};

/** Resolves a section-ID ref to the target section's dataId. Returns empty string when missing. */
function resolveRefToDataId(sectionId: string | undefined, lookup?: SectionLookup): string {
  if (!sectionId || !lookup) return "";
  const meta = lookup.get(sectionId);
  if (!meta) return "";
  const dataId = meta.dataId;
  return typeof dataId === "string" && dataId.trim() ? dataId.trim() : "";
}

/**
 * Finds a Production addon by its own addon id (or fallback by name, then by
 * type). Mirrors findCraftTableAddon — used by the standalone Production export
 * sources (`productionIngredients`/`productionOutputs`/`productionField` with an
 * `addonId`). The by-type fallback keeps a `sections` iteration resolving each
 * child's own Production addon even when the sampled id/name don't match.
 */
function findProductionAddon(
  addons: SectionAddon[],
  addonId: string,
  addonName?: string
): ProductionAddonDraft | undefined {
  for (const addon of addons) {
    if (addon.type !== "production") continue;
    if (addon.id === addonId || addon.data?.id === addonId) return addon.data as ProductionAddonDraft;
  }
  if (addonName) {
    for (const addon of addons) {
      if (addon.type === "production" && addon.name === addonName) return addon.data as ProductionAddonDraft;
    }
  }
  const byType = addons.find((a) => a.type === "production");
  if (byType) return byType.data as ProductionAddonDraft;
  return undefined;
}

/** Finds a Production addon by section-ID ref (the section that contains it). */
function findProductionByRef(
  sectionRef: string | undefined,
  lookup?: SectionLookup
): ProductionAddonDraft | undefined {
  if (!sectionRef || !lookup) return undefined;
  const meta = lookup.get(sectionRef);
  if (!meta) return undefined;
  for (const addon of meta.addons) {
    if (addon.type === "production") return addon.data as ProductionAddonDraft;
  }
  return undefined;
}

/**
 * Resolves the effective column id for a `rowColumn` binding against a given
 * table. Prefers a direct id match; falls back to matching by the captured
 * `columnName` when the id is absent (e.g. a sibling page whose progression
 * table shares column names but has different column ids). Returns the binding
 * id unchanged when no match is found.
 */
function resolveColumnId(
  binding: Extract<ExportSchemaBinding, { source: "rowColumn" }>,
  table?: ProgressionTableAddonDraft
): string {
  if (!table) return binding.columnId;
  if (table.columns.some((c) => c.id === binding.columnId)) return binding.columnId;
  if (binding.columnName) {
    const byName = table.columns.find((c) => c.name === binding.columnName);
    if (byName) return byName.id;
  }
  return binding.columnId;
}

/**
 * Finds a Field Library addon by id. Field libraries are referenced
 * cross-section by libraryRef, so we look in the current section first and
 * then fall back to every section via the lookup (mirrors buildSectionsRowMajor).
 */
function findFieldLibraryAddon(
  libraryAddonId: string,
  sectionAddons: SectionAddon[],
  sectionLookup?: SectionLookup
): FieldLibraryAddonDraft | undefined {
  const local = sectionAddons.find(
    (a) => a.type === "fieldLibrary" && a.id === libraryAddonId
  );
  if (local) return local.data as FieldLibraryAddonDraft;
  if (sectionLookup) {
    for (const [, entry] of sectionLookup) {
      const found = entry.addons.find(
        (a) => a.type === "fieldLibrary" && a.id === libraryAddonId
      );
      if (found) return found.data as FieldLibraryAddonDraft;
    }
  }
  return undefined;
}

function resolveColumnExportKey(
  columnId: string,
  table: ProgressionTableAddonDraft,
  sectionAddons: SectionAddon[],
  sectionLookup?: SectionLookup
): string | undefined {
  const column = table.columns.find((c) => c.id === columnId);
  if (!column) return undefined;
  if (column.libraryRef) {
    const data = findFieldLibraryAddon(
      column.libraryRef.libraryAddonId,
      sectionAddons,
      sectionLookup
    );
    if (data) {
      const entry = data.entries.find((e) => e.id === column.libraryRef!.entryId);
      if (entry?.key) return entry.key;
    }
  }
  return undefined;
}

function findDataSchemaAddon(
  addons: SectionAddon[],
  addonId: string,
  addonName?: string
): DataSchemaAddonDraft | undefined {
  // Try by outer addon id or inner data.id (they sometimes diverge between store and DB)
  for (const addon of addons) {
    if (addon.type !== "dataSchema" && addon.type !== "genericStats") continue;
    if (addon.id === addonId || addon.data?.id === addonId) {
      return addon.data as DataSchemaAddonDraft;
    }
  }
  // Fallback: match by name (for templates)
  if (addonName) {
    for (const addon of addons) {
      if ((addon.type === "dataSchema" || addon.type === "genericStats") && addon.name === addonName) {
        return addon.data as DataSchemaAddonDraft;
      }
    }
  }
  // Cross-section fallback (sections iteration): dataSchema is a singleton per
  // section, so resolve by type when the sampled id/name don't match a sibling.
  const byType = addons.find((a) => a.type === "dataSchema" || a.type === "genericStats");
  if (byType) return byType.data as DataSchemaAddonDraft;
  return undefined;
}

function findCraftTableAddon(
  addons: SectionAddon[],
  addonId: string,
  addonName?: string
): CraftTableAddonDraft | undefined {
  for (const addon of addons) {
    if (addon.type !== "craftTable") continue;
    if (addon.id === addonId || addon.data?.id === addonId) {
      return addon.data as CraftTableAddonDraft;
    }
  }
  if (addonName) {
    for (const addon of addons) {
      if (addon.type === "craftTable" && addon.name === addonName) {
        return addon.data as CraftTableAddonDraft;
      }
    }
  }
  // Cross-section fallback (sections iteration): craftTable is a singleton per
  // section, so resolve by type when the sampled id/name don't match a sibling.
  const byType = addons.find((a) => a.type === "craftTable");
  if (byType) return byType.data as CraftTableAddonDraft;
  return undefined;
}

function resolveEntryField(
  entry: CraftTableEntry,
  field: Extract<ExportSchemaBinding, { source: "entryField" }>["field"],
  lookup?: SectionLookup
): string | number | boolean | null {
  switch (field) {
    case "order":
      return entry.order ?? 0;
    case "productionRef":
      return resolveRefToDataId(entry.productionRef, lookup);
    case "category":
      return entry.category ?? "";
    case "hidden":
      return Boolean(entry.hidden);
    case "unlockLevelEnabled":
      return Boolean(entry.unlock?.level?.enabled);
    case "unlockLevel":
      return entry.unlock?.level?.level ?? 0;
    case "unlockLevelXpRef":
      return resolveRefToDataId(entry.unlock?.level?.xpAddonRef, lookup);
    case "unlockCurrencyEnabled":
      return Boolean(entry.unlock?.currency?.enabled);
    case "unlockCurrencyAmount":
      return entry.unlock?.currency?.amount ?? 0;
    case "unlockCurrencyRef":
      return resolveRefToDataId(entry.unlock?.currency?.currencyAddonRef, lookup);
    case "unlockItemEnabled":
      return Boolean(entry.unlock?.item?.enabled);
    case "unlockItemQuantity":
      return entry.unlock?.item?.quantity ?? 0;
    case "unlockItemRef":
      return resolveRefToDataId(entry.unlock?.item?.itemRef, lookup);
    default:
      return null;
  }
}

function resolveProductionField(
  prod: ProductionAddonDraft | undefined,
  field: ProductionScalarField,
  lookup?: SectionLookup
): string | number | boolean | null {
  if (!prod) {
    // Sensible zero-ish defaults so exports don't render `null`s when a ref is missing.
    switch (field) {
      case "name":
      case "mode":
      case "outputRef":
      case "outputItemRef":
        return "";
      case "requiresCollection":
        return false;
      default:
        return 0;
    }
  }
  switch (field) {
    case "name":
      return prod.name ?? "";
    case "mode":
      return prod.mode ?? "passive";
    case "craftTimeSeconds":
      return prod.craftTimeSeconds ?? 0;
    case "craftTimeSecondsMin":
      return prod.craftTimeSecondsMin ?? 0;
    case "craftTimeSecondsMax":
      return prod.craftTimeSecondsMax ?? 0;
    case "minOutput":
      return prod.minOutput ?? 0;
    case "maxOutput":
      return prod.maxOutput ?? 0;
    case "intervalSeconds":
      return prod.intervalSeconds ?? 0;
    case "intervalSecondsMin":
      return prod.intervalSecondsMin ?? 0;
    case "intervalSecondsMax":
      return prod.intervalSecondsMax ?? 0;
    case "capacity":
      return prod.capacity ?? 0;
    case "capacityMin":
      return prod.capacityMin ?? 0;
    case "capacityMax":
      return prod.capacityMax ?? 0;
    case "requiresCollection":
      return Boolean(prod.requiresCollection);
    case "outputRef":
      return resolveRefToDataId(prod.outputRef, lookup);
    case "outputItemRef":
      return resolveRefToDataId(prod.outputs?.[0]?.itemRef, lookup);
    case "outputQuantity":
      return prod.outputs?.[0]?.quantity ?? 0;
    default:
      return null;
  }
}

function resolveItemField(
  item: ProductionIngredient | ProductionOutput | undefined,
  field: "itemRef" | "quantity",
  lookup?: SectionLookup
): string | number | null {
  if (!item) return field === "quantity" ? 0 : "";
  if (field === "quantity") return item.quantity ?? 0;
  return resolveRefToDataId(item.itemRef, lookup);
}

/** Finds a Skills addon in the section by addon id (or fallback by name). */
function findSkillsAddon(
  addons: SectionAddon[],
  addonId: string,
  addonName?: string
): SkillsAddonDraft | undefined {
  for (const addon of addons) {
    if (addon.type !== "skills") continue;
    if (addon.id === addonId || addon.data?.id === addonId) return addon.data as SkillsAddonDraft;
  }
  if (addonName) {
    for (const addon of addons) {
      if (addon.type === "skills" && addon.name === addonName) {
        return addon.data as SkillsAddonDraft;
      }
    }
  }
  // Cross-section fallback (sections iteration): skills is a singleton per
  // section, so resolve by type when the sampled id/name don't match a sibling.
  const byType = addons.find((a) => a.type === "skills");
  if (byType) return byType.data as SkillsAddonDraft;
  return undefined;
}

/**
 * Finds an AttributeModifier entry across the project by section id +
 * addon id + entry id, and ALSO returns the parent addon's `definitionsRef`
 * (the section ID of the AttributeDefinitions page that defines the
 * attribute keys). Used by `skillEffects` to expose `resolvedDefinitionsRef`
 * so consumers can identify WHICH attribute profile owns the key.
 */
function findAttributeModifierEntry(
  effect: SkillEffectRef,
  lookup?: SectionLookup
): { entry?: AttributeModifierEntry; definitionsRef?: string } | undefined {
  if (!lookup) return undefined;
  const meta = lookup.get(effect.attributeModifiersSectionId);
  if (!meta) return undefined;
  for (const addon of meta.addons) {
    if (addon.type !== "attributeModifiers") continue;
    if (addon.id !== effect.attributeModifiersAddonId && addon.data?.id !== effect.attributeModifiersAddonId) continue;
    const data = addon.data as AttributeModifiersAddonDraft;
    return {
      entry: (data.modifiers || []).find((m) => m.id === effect.modifierEntryId),
      definitionsRef: data.definitionsRef,
    };
  }
  return undefined;
}

function resolveSkillField(
  skill: SkillEntry | undefined,
  field: SkillEntryField,
  lookup?: SectionLookup
): string | number | boolean | null {
  if (!skill) {
    switch (field) {
      case "id":
      case "name":
      case "kind":
      case "description":
      case "tagsCsv":
      case "unlockLevelXpRef":
      case "unlockCurrencyRef":
      case "unlockItemRef":
        return "";
      case "unlockLevelEnabled":
      case "unlockCurrencyEnabled":
      case "unlockItemEnabled":
        return false;
      default:
        return 0;
    }
  }
  switch (field) {
    case "id":
      return skill.id ?? "";
    case "name":
      return skill.name ?? "";
    case "kind":
      return skill.kind ?? "active";
    case "description":
      return skill.description ?? "";
    case "cooldownSeconds":
      return skill.cooldownSeconds ?? 0;
    case "tagsCsv":
      return (skill.tags || []).join(",");
    case "unlockLevelEnabled":
      return Boolean(skill.unlock?.level?.enabled);
    case "unlockLevel":
      return skill.unlock?.level?.level ?? 0;
    case "unlockLevelXpRef":
      return resolveRefToDataId(skill.unlock?.level?.xpAddonRef, lookup);
    case "unlockCurrencyEnabled":
      return Boolean(skill.unlock?.currency?.enabled);
    case "unlockCurrencyAmount":
      return skill.unlock?.currency?.amount ?? 0;
    case "unlockCurrencyRef":
      return resolveRefToDataId(skill.unlock?.currency?.currencyAddonRef, lookup);
    case "unlockItemEnabled":
      return Boolean(skill.unlock?.item?.enabled);
    case "unlockItemQuantity":
      return skill.unlock?.item?.quantity ?? 0;
    case "unlockItemRef":
      return resolveRefToDataId(skill.unlock?.item?.itemRef, lookup);
    default:
      return null;
  }
}

function resolveSkillCostField(
  cost: SkillCost | undefined,
  field: SkillCostField,
  lookup?: SectionLookup
): string | number | null {
  if (!cost) {
    switch (field) {
      case "amount":
        return 0;
      default:
        return "";
    }
  }
  switch (field) {
    case "id":
      return cost.id ?? "";
    case "type":
      return cost.type ?? "";
    case "amount":
      return cost.amount ?? 0;
    case "currencyRef":
      return resolveRefToDataId(cost.currencyRef, lookup);
    case "definitionsRef":
      return resolveRefToDataId(cost.definitionsRef, lookup);
    case "attributeKey":
      return cost.attributeKey ?? "";
    default:
      return null;
  }
}

function resolveSkillEffectField(
  effect: SkillEffectRef | undefined,
  resolved: AttributeModifierEntry | undefined,
  field: SkillEffectField,
  lookup?: SectionLookup,
  /**
   * Section ID stored in the parent AttributeModifiers addon as
   * `definitionsRef`. Resolved to the section's `dataId` here so the
   * exported value points at a stable, human-curated identifier.
   */
  definitionsRef?: string
): string | number | boolean | null {
  if (!effect) {
    switch (field) {
      case "resolvedTemporary":
        return false;
      case "resolvedDurationSeconds":
      case "resolvedTickIntervalSeconds":
      case "resolvedValue":
        return 0;
      default:
        return "";
    }
  }
  switch (field) {
    case "id":
      return effect.id ?? "";
    case "attributeModifiersSectionId":
      return resolveRefToDataId(effect.attributeModifiersSectionId, lookup);
    case "attributeModifiersAddonId":
      return effect.attributeModifiersAddonId ?? "";
    case "modifierEntryId":
      return effect.modifierEntryId ?? "";
    case "resolvedName":
      return resolved?.name?.trim() ?? "";
    case "resolvedMode":
      return resolved?.mode ?? "";
    case "resolvedAttributeKey":
      return resolved?.attributeKey ?? "";
    case "resolvedDefinitionsRef":
      return resolveRefToDataId(definitionsRef, lookup);
    case "resolvedValue": {
      const v = resolved?.value;
      if (typeof v === "boolean") return v ? 1 : 0;
      return typeof v === "number" ? v : 0;
    }
    case "resolvedTemporary":
      return Boolean(resolved?.temporary);
    case "resolvedDurationSeconds":
      return resolved?.durationSeconds ?? 0;
    case "resolvedTickIntervalSeconds":
      return resolved?.tickIntervalSeconds ?? 0;
    case "resolvedStacking":
      return resolved?.stackingRule ?? "";
    case "resolvedCategory":
      return resolved?.category ?? "";
    default:
      return null;
  }
}

function findProgressionTableAddon(
  addons: SectionAddon[],
  addonId: string,
  addonName?: string
): ProgressionTableAddonDraft | undefined {
  // Try by outer addon id or inner data.id (they sometimes diverge between store and DB)
  for (const addon of addons) {
    if (addon.type !== "progressionTable") continue;
    if (addon.id === addonId || addon.data?.id === addonId) {
      return addon.data as ProgressionTableAddonDraft;
    }
  }
  // Fallback: match by name (for templates)
  if (addonName) {
    for (const addon of addons) {
      if (addon.type === "progressionTable" && addon.name === addonName) {
        return addon.data as ProgressionTableAddonDraft;
      }
    }
  }
  // Cross-section fallback (sections iteration over siblings): the source was
  // sampled from one child, so neither the id nor the user-given (cosmetic)
  // name match here. progressionTable is a singleton per section, so the type
  // alone identifies it — resolve by type regardless of name. This keeps
  // per-child curves working even when each child renamed its table.
  const byType = addons.find((a) => a.type === "progressionTable");
  if (byType) return byType.data as ProgressionTableAddonDraft;
  return undefined;
}

/** Stable column id for the single value column of an XpBalance source. */
const XP_VALUE_COLUMN_ID = "value";

/**
 * Locates an XpBalance addon by id, then by name, then by type. Mirrors
 * findProgressionTableAddon — xpBalance is a singleton per section, so the
 * type alone identifies it for the cross-section (`sections`) fallback.
 */
function findXpBalanceAddon(
  addons: SectionAddon[],
  addonId: string,
  addonName?: string
): SectionAddon | undefined {
  for (const addon of addons) {
    if (addon.type !== "xpBalance") continue;
    if (addon.id === addonId || addon.data?.id === addonId) return addon;
  }
  if (addonName) {
    const byName = addons.find((a) => a.type === "xpBalance" && a.name === addonName);
    if (byName) return byName;
  }
  return addons.find((a) => a.type === "xpBalance");
}

/**
 * Projects an XpBalance addon's computed level→value curve into a synthetic
 * ProgressionTableAddonDraft (single numeric column "value"). This lets the XP
 * source reuse the full progression-table machinery — all four array formats
 * plus the rowLevel / rowColumn bindings — instead of a bespoke export path.
 */
function buildXpBalanceTable(addon: SectionAddon): ProgressionTableAddonDraft {
  const draft = sectionAddonToBalanceDraft(addon);
  const curve = generateBalanceCurve({
    mode: draft.mode,
    preset: draft.preset,
    expression: draft.expression,
    startLevel: draft.startLevel,
    endLevel: draft.endLevel,
    decimals: draft.decimals,
    clampMin: draft.clampMin,
    clampMax: draft.clampMax,
    params: draft.params,
    startAtZero: draft.startAtZero,
  });
  return {
    id: draft.id,
    name: draft.name || "XP",
    startLevel: draft.startLevel,
    endLevel: draft.endLevel,
    columns: [
      {
        id: XP_VALUE_COLUMN_ID,
        name: draft.name || "XP",
        valueType: "number",
        decimals: draft.decimals,
      },
    ],
    rows: curve.points.map((p) => ({
      level: p.level,
      values: { [XP_VALUE_COLUMN_ID]: p.value },
    })),
  };
}

function findDataSchemaEntry(
  addons: SectionAddon[],
  binding: Extract<ExportSchemaBinding, { source: "dataSchema" }>
) {
  const schema = findDataSchemaAddon(addons, binding.addonId, binding.addonName);
  if (!schema) return undefined;
  // Prefer lookup by entryId (stable), fallback to entryKey
  if (binding.entryId) {
    const byId = schema.entries.find((e) => e.id === binding.entryId);
    if (byId) return byId;
  }
  return schema.entries.find((e) => e.key === binding.entryKey);
}

/**
 * Resolves the effective value of a Data Schema entry.
 * If the entry has an active binding, the value is computed live from the source addon.
 */
function resolveEntryEffectiveValue(
  entry: DataSchemaEntry,
  allAddons: SectionAddon[],
  sectionDataId?: string,
  sectionLookup?: SectionLookup
): string | number | boolean {
  const binding = entry.binding;

  if (binding?.source === "pageDataId") {
    return sectionDataId ?? "";
  }

  if (binding?.source === "economyLink") {
    const sectionEntry = sectionLookup?.get(binding.sectionId);
    const elAddon = sectionEntry?.addons.find((a) => a.type === "economyLink")
      ?? allAddons.find((a) => a.type === "economyLink" && a.id === binding.sectionId);
    if (elAddon) {
      const el = elAddon.data as EconomyLinkAddonDraft;
      const field = binding.field;
      if (field === "buyCurrencyRef" || field === "sellCurrencyRef") {
        const currencySecId = el[field === "buyCurrencyRef" ? "buyCurrencyRef" : "sellCurrencyRef"];
        return resolveRefToDataId(currencySecId, sectionLookup);
      }
      if (field === "buyCurrencyKey" || field === "sellCurrencyKey") {
        const currencySecId = el[field === "buyCurrencyKey" ? "buyCurrencyRef" : "sellCurrencyRef"];
        if (!currencySecId || !sectionLookup) return entry.value;
        const currSec = sectionLookup.get(currencySecId);
        if (!currSec) return entry.value;
        const currAddon = currSec.addons.find((a) => a.type === "currency");
        return (currAddon?.data as any)?.code ?? entry.value;
      }
      // Numeric fields: resolve via the EconomyLink addon's own *Binding, then apply priceMultiplier
      let elFieldBinding: typeof el.buyValueBinding | undefined;
      if (field === "buyValue") elFieldBinding = el.buyValueBinding;
      else if (field === "minBuyValue") elFieldBinding = el.minBuyValueBinding;
      else if (field === "maxBuyValue") elFieldBinding = el.maxBuyValueBinding;
      else if (field === "sellValue") elFieldBinding = el.sellValueBinding;
      else if (field === "minSellValue") elFieldBinding = el.minSellValueBinding;
      else if (field === "maxSellValue") elFieldBinding = el.maxSellValueBinding;
      if (elFieldBinding !== undefined) {
        const multiplier = typeof el.priceMultiplier === "number" && el.priceMultiplier > 0 ? el.priceMultiplier : 1;
        if (elFieldBinding.source === "progressionColumn" && el.unlockValue != null) {
          let progAddon = allAddons.find((a) => a.type === "progressionTable" && a.id === elFieldBinding.progressionAddonId);
          if (!progAddon && sectionLookup) {
            for (const se of sectionLookup.values()) {
              const found = se.addons.find((a) => a.type === "progressionTable" && a.id === elFieldBinding.progressionAddonId);
              if (found) { progAddon = found; break; }
            }
          }
          if (progAddon) {
            const row = ((progAddon.data as any).rows || []).find((r: any) => r.level === el.unlockValue);
            const colVal = row?.values?.[elFieldBinding.columnId];
            if (typeof colVal === "number") return Math.floor(colVal * multiplier);
          }
        }
        const directValue = el[field as keyof EconomyLinkAddonDraft];
        if (typeof directValue === "number") return multiplier !== 1 ? Math.floor(directValue * multiplier) : directValue;
      }
      const directValue = el[field as keyof EconomyLinkAddonDraft];
      if (typeof directValue === "number") return directValue;
    }
  }

  if (binding?.source === "production") {
    const prodAddon = allAddons.find((a) => a.type === "production" && a.id === binding.addonId);
    if (prodAddon) {
      const prod = prodAddon.data as ProductionAddonDraft;
      const field = binding.field;
      const directFields: Record<string, keyof ProductionAddonDraft> = {
        minOutput: "minOutput", outputMin: "outputMin", maxOutput: "maxOutput",
        intervalSeconds: "intervalSeconds", intervalSecondsMin: "intervalSecondsMin", intervalSecondsMax: "intervalSecondsMax",
        craftTimeSeconds: "craftTimeSeconds", craftTimeSecondsMin: "craftTimeSecondsMin", craftTimeSecondsMax: "craftTimeSecondsMax",
        capacity: "capacity", capacityMin: "capacityMin", capacityMax: "capacityMax",
      };
      if (field in directFields) {
        const v = prod[directFields[field]];
        if (typeof v === "number") return v;
        return 0;
      }
      // output* fields cross-section: value is pre-computed and stored in entry.value
      if (field.startsWith("output") && prod.outputRef) return entry.value;
    }
  }

  if (binding?.source === "crop") {
    const cropAddon = allAddons.find((a) => a.type === "crop" && a.id === binding.addonId);
    if (cropAddon) {
      const resolved = resolveCropFieldValue(cropAddon.data as CropAddonDraft, binding.field, binding.outputId);
      if (typeof resolved === "number") return resolved;
      return 0;
    }
  }

  if (binding?.source === "inventory") {
    const invAddon = allAddons.find((a) => a.type === "inventory" && a.id === binding.addonId);
    if (invAddon) {
      const resolved = resolveInventoryFieldValue(invAddon.data as InventoryAddonDraft, binding.field);
      if (resolved !== undefined) return resolved;
    }
  }

  return entry.value;
}

function resolveBinding(
  binding: ExportSchemaBinding,
  ctx: ResolveContext
): string | number | boolean | null {
  switch (binding.source) {
    case "manual":
      return binding.value;

    case "dataSchema": {
      const entry = findDataSchemaEntry(ctx.sectionAddons, binding);
      if (!entry) return null;
      return resolveEntryEffectiveValue(entry, ctx.sectionAddons, ctx.sectionDataId, ctx.sectionLookup);
    }

    case "rowLevel":
      return ctx.row ? ctx.row.level : null;

    case "rowColumn": {
      if (!ctx.row) return null;
      const colId = resolveColumnId(binding, ctx.currentTable);
      return ctx.row.values[colId] ?? null;
    }

    case "entryField":
      if (!ctx.entry) return null;
      return resolveEntryField(ctx.entry, binding.field, ctx.sectionLookup);

    case "productionField": {
      const prod = binding.addonId
        ? findProductionAddon(ctx.sectionAddons, binding.addonId, binding.addonName)
        : ctx.currentProduction;
      return resolveProductionField(prod, binding.field, ctx.sectionLookup);
    }

    case "itemField":
      return resolveItemField(ctx.currentItem, binding.field, ctx.sectionLookup);

    case "skillField":
      return resolveSkillField(ctx.currentSkill, binding.field, ctx.sectionLookup);

    case "skillCostField":
      return resolveSkillCostField(ctx.currentSkillCost, binding.field, ctx.sectionLookup);

    case "skillEffectField":
      return resolveSkillEffectField(
        ctx.currentSkillEffect,
        ctx.currentSkillEffectResolved,
        binding.field,
        ctx.sectionLookup,
        ctx.currentSkillEffectDefinitionsRef
      );

    default:
      return null;
  }
}

/**
 * Resolves the effective JSON property key for a node.
 * For bound nodes, the key comes live from the source data.
 */
function resolveNodeKey(node: ExportSchemaNode, ctx: ResolveContext): string {
  if (node.binding?.source === "dataSchema") {
    const entry = findDataSchemaEntry(ctx.sectionAddons, node.binding);
    if (entry) {
      // If entry is linked to a field library, use the library entry's key.
      // Libraries may live in another section, so consult the lookup too.
      if (entry.libraryRef) {
        const libData = findFieldLibraryAddon(
          entry.libraryRef.libraryAddonId,
          ctx.sectionAddons,
          ctx.sectionLookup
        );
        if (libData) {
          const libEntry = libData.entries.find((e) => e.id === entry.libraryRef!.entryId);
          if (libEntry?.key) return libEntry.key;
        }
      }
      return entry.key;
    }
  }
  if (node.binding?.source === "rowColumn" && ctx.currentTable) {
    const colId = resolveColumnId(node.binding, ctx.currentTable);
    const libKey = resolveColumnExportKey(colId, ctx.currentTable, ctx.sectionAddons, ctx.sectionLookup);
    if (libKey) return libKey;
  }
  return node.key;
}

/**
 * Row-major: array of objects, one per level.
 * [{ level: 1, priceA: 10, priceB: 20 }, { level: 2, ... }]
 */
function buildRowMajor(
  table: ProgressionTableAddonDraft,
  itemTemplate: ExportSchemaNode[],
  ctx: ResolveContext
): unknown[] {
  return table.rows.map((row) => {
    const rowCtx = { ...ctx, row };
    const itemObj: Record<string, unknown> = {};
    for (const tmpl of itemTemplate) {
      itemObj[resolveNodeKey(tmpl, rowCtx)] = resolveNode(tmpl, rowCtx);
    }
    return itemObj;
  });
}

/**
 * Column-major: object of arrays, one array per template node.
 * { level: [1, 2, 3], priceA: [10, 20, 30], priceB: [...] }
 */
function buildColumnMajor(
  table: ProgressionTableAddonDraft,
  itemTemplate: ExportSchemaNode[],
  ctx: ResolveContext
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const firstRow = table.rows[0];
  for (const tmpl of itemTemplate) {
    const key = firstRow
      ? resolveNodeKey(tmpl, { ...ctx, row: firstRow })
      : tmpl.key;
    const values: unknown[] = [];
    for (const row of table.rows) {
      values.push(resolveNode(tmpl, { ...ctx, row }));
    }
    obj[key] = values;
  }
  return obj;
}

/**
 * Keyed by level: object indexed by row.level. The rowLevel binding is used
 * as the outer key and removed from each item body.
 * { "1": { priceA: 10, priceB: 20 }, "2": {...} }
 */
function buildKeyedByLevel(
  table: ProgressionTableAddonDraft,
  itemTemplate: ExportSchemaNode[],
  ctx: ResolveContext
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const row of table.rows) {
    const rowCtx = { ...ctx, row };
    const item: Record<string, unknown> = {};
    for (const tmpl of itemTemplate) {
      if (tmpl.binding?.source === "rowLevel") continue;
      item[resolveNodeKey(tmpl, rowCtx)] = resolveNode(tmpl, rowCtx);
    }
    obj[String(row.level)] = item;
  }
  return obj;
}

/**
 * Matrix: { headers: [...], rows: [[...], [...]] }.
 * Respects itemTemplate order for both headers and row cells.
 */
function buildMatrix(
  table: ProgressionTableAddonDraft,
  itemTemplate: ExportSchemaNode[],
  ctx: ResolveContext
): { headers: string[]; rows: unknown[][] } {
  const firstRow = table.rows[0];
  const headers = itemTemplate.map((tmpl) =>
    firstRow ? resolveNodeKey(tmpl, { ...ctx, row: firstRow }) : tmpl.key
  );
  const rows: unknown[][] = table.rows.map((row) => {
    const rowCtx = { ...ctx, row };
    return itemTemplate.map((tmpl) => resolveNode(tmpl, rowCtx));
  });
  return { headers, rows };
}

/**
 * Row-major iteration over Craft Table entries (sorted by `order`).
 * Craft Table only supports rowMajor — other formats assume rows × columns
 * which doesn't apply here.
 */
function buildCraftTableRowMajor(
  craft: CraftTableAddonDraft,
  itemTemplate: ExportSchemaNode[],
  ctx: ResolveContext
): unknown[] {
  const sorted = [...(craft.entries || [])].sort((a, b) => a.order - b.order);
  return sorted.map((entry) => {
    const currentProduction = findProductionByRef(entry.productionRef, ctx.sectionLookup);
    const entryCtx: ResolveContext = { ...ctx, entry, currentProduction };
    const itemObj: Record<string, unknown> = {};
    for (const tmpl of itemTemplate) {
      itemObj[resolveNodeKey(tmpl, entryCtx)] = resolveNode(tmpl, entryCtx);
    }
    return itemObj;
  });
}

function buildProductionItemRowMajor(
  items: Array<ProductionIngredient | ProductionOutput>,
  itemTemplate: ExportSchemaNode[],
  ctx: ResolveContext
): unknown[] {
  return items.map((item) => {
    const itemCtx: ResolveContext = { ...ctx, currentItem: item };
    const out: Record<string, unknown> = {};
    for (const tmpl of itemTemplate) {
      out[resolveNodeKey(tmpl, itemCtx)] = resolveNode(tmpl, itemCtx);
    }
    return out;
  });
}

/** Row-major iteration over Skills entries. */
function buildSkillsRowMajor(
  skills: SkillsAddonDraft,
  itemTemplate: ExportSchemaNode[],
  ctx: ResolveContext
): unknown[] {
  return (skills.entries || []).map((skill) => {
    const skillCtx: ResolveContext = { ...ctx, currentSkill: skill };
    const out: Record<string, unknown> = {};
    for (const tmpl of itemTemplate) {
      out[resolveNodeKey(tmpl, skillCtx)] = resolveNode(tmpl, skillCtx);
    }
    return out;
  });
}

function buildSkillCostsRowMajor(
  costs: SkillCost[],
  itemTemplate: ExportSchemaNode[],
  ctx: ResolveContext
): unknown[] {
  return costs.map((cost) => {
    const costCtx: ResolveContext = { ...ctx, currentSkillCost: cost };
    const out: Record<string, unknown> = {};
    for (const tmpl of itemTemplate) {
      out[resolveNodeKey(tmpl, costCtx)] = resolveNode(tmpl, costCtx);
    }
    return out;
  });
}

function buildSkillEffectsRowMajor(
  effects: SkillEffectRef[],
  itemTemplate: ExportSchemaNode[],
  ctx: ResolveContext
): unknown[] {
  return effects.map((effect) => {
    const found = findAttributeModifierEntry(effect, ctx.sectionLookup);
    const effectCtx: ResolveContext = {
      ...ctx,
      currentSkillEffect: effect,
      currentSkillEffectResolved: found?.entry,
      currentSkillEffectDefinitionsRef: found?.definitionsRef,
    };
    const out: Record<string, unknown> = {};
    for (const tmpl of itemTemplate) {
      out[resolveNodeKey(tmpl, effectCtx)] = resolveNode(tmpl, effectCtx);
    }
    return out;
  });
}

/**
 * Row-major iteration over the child sections of a parent. For each child the
 * context is swapped to that section's own addons + dataId, so the same item
 * template resolves once per page. Field Library addons are merged from the
 * whole project (they're cross-section) so library-backed keys still resolve.
 */
function buildSectionsRowMajor(
  parentSectionId: string,
  itemTemplate: ExportSchemaNode[],
  ctx: ResolveContext
): unknown[] {
  if (!ctx.sectionLookup) return [];
  const children = getChildSections(parentSectionId, ctx.sectionLookup);
  if (children.length === 0) return [];

  // Collect all Field Library addons across the project once — they are
  // referenced cross-section by libraryRef and must be visible in each child ctx.
  const globalLibraries: SectionAddon[] = [];
  const seenLib = new Set<string>();
  for (const [, entry] of ctx.sectionLookup) {
    for (const a of entry.addons) {
      if (a.type === "fieldLibrary" && !seenLib.has(a.id)) {
        seenLib.add(a.id);
        globalLibraries.push(a);
      }
    }
  }

  return children.map((child) => {
    const childAddons = [
      ...child.addons,
      ...globalLibraries.filter((lib) => !child.addons.some((a) => a.id === lib.id)),
    ];
    const childCtx: ResolveContext = {
      ...ctx,
      sectionAddons: childAddons,
      sectionDataId: child.dataId ?? undefined,
      // Clear iteration-scoped context that doesn't carry across sections.
      row: undefined,
      entry: undefined,
      currentProduction: undefined,
      currentItem: undefined,
      currentSkill: undefined,
      currentSkillCost: undefined,
      currentSkillEffect: undefined,
      currentSkillEffectResolved: undefined,
      currentSkillEffectDefinitionsRef: undefined,
      currentTable: undefined,
    };
    const out: Record<string, unknown> = {};
    for (const tmpl of itemTemplate) {
      out[resolveNodeKey(tmpl, childCtx)] = resolveNode(tmpl, childCtx);
    }
    return out;
  });
}

function resolveNode(
  node: ExportSchemaNode,
  ctx: ResolveContext
): unknown {
  const value = resolveNodeInner(node, ctx);
  // First-wins: inside array iterations, only the first iteration's resolution
  // reaches here for a given template-node id because subsequent calls see the
  // id already present and skip writing.
  if (ctx.nodeValueMap && !ctx.nodeValueMap.has(node.id)) {
    ctx.nodeValueMap.set(node.id, value);
  }
  return value;
}

function resolveNodeInner(
  node: ExportSchemaNode,
  ctx: ResolveContext
): unknown {
  switch (node.nodeType) {
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const child of node.children ?? []) {
        obj[resolveNodeKey(child, ctx)] = resolveNode(child, ctx);
      }
      return obj;
    }

    case "array": {
      if (!node.arraySource || !node.itemTemplate) return [];
      if (node.arraySource.type === "craftTable") {
        const craft = findCraftTableAddon(
          ctx.sectionAddons,
          node.arraySource.addonId,
          node.arraySource.addonName
        );
        if (!craft) return [];
        return buildCraftTableRowMajor(craft, node.itemTemplate, ctx);
      }
      if (node.arraySource.type === "productionIngredients") {
        // Standalone (addonId set) reads that Production directly; otherwise
        // falls back to the current craft table entry's production.
        const prod = node.arraySource.addonId
          ? findProductionAddon(ctx.sectionAddons, node.arraySource.addonId, node.arraySource.addonName)
          : ctx.currentProduction;
        const items = prod?.ingredients || [];
        const itemCtx = node.arraySource.addonId ? { ...ctx, currentProduction: prod } : ctx;
        return buildProductionItemRowMajor(items, node.itemTemplate, itemCtx);
      }
      if (node.arraySource.type === "productionOutputs") {
        const prod = node.arraySource.addonId
          ? findProductionAddon(ctx.sectionAddons, node.arraySource.addonId, node.arraySource.addonName)
          : ctx.currentProduction;
        const items = prod?.outputs || [];
        const itemCtx = node.arraySource.addonId ? { ...ctx, currentProduction: prod } : ctx;
        return buildProductionItemRowMajor(items, node.itemTemplate, itemCtx);
      }
      if (node.arraySource.type === "skills") {
        const skills = findSkillsAddon(
          ctx.sectionAddons,
          node.arraySource.addonId,
          node.arraySource.addonName
        );
        if (!skills) return [];
        return buildSkillsRowMajor(skills, node.itemTemplate, ctx);
      }
      if (node.arraySource.type === "skillCosts") {
        const costs = ctx.currentSkill?.costs || [];
        return buildSkillCostsRowMajor(costs, node.itemTemplate, ctx);
      }
      if (node.arraySource.type === "skillEffects") {
        const effects = ctx.currentSkill?.effects || [];
        return buildSkillEffectsRowMajor(effects, node.itemTemplate, ctx);
      }
      if (node.arraySource.type === "sections") {
        return buildSectionsRowMajor(node.arraySource.parentSectionId, node.itemTemplate, ctx);
      }
      let table: ProgressionTableAddonDraft | undefined;
      if (node.arraySource.type === "xpBalance") {
        const xpAddon = findXpBalanceAddon(
          ctx.sectionAddons,
          node.arraySource.addonId,
          node.arraySource.addonName
        );
        table = xpAddon ? buildXpBalanceTable(xpAddon) : undefined;
      } else {
        table = findProgressionTableAddon(
          ctx.sectionAddons,
          node.arraySource.addonId,
          node.arraySource.addonName
        );
      }
      if (!table) return [];
      const tableCtx = { ...ctx, currentTable: table };
      const format = ctx.arrayFormat ?? "rowMajor";
      switch (format) {
        case "columnMajor":
          return buildColumnMajor(table, node.itemTemplate, tableCtx);
        case "keyedByLevel":
          return buildKeyedByLevel(table, node.itemTemplate, tableCtx);
        case "matrix":
          return buildMatrix(table, node.itemTemplate, tableCtx);
        case "rowMajor":
        default:
          return buildRowMajor(table, node.itemTemplate, tableCtx);
      }
    }

    case "value": {
      if (!node.binding) return null;
      let val = resolveBinding(node.binding, ctx);
      if (typeof val === "number") {
        if (node.abs) val = Math.abs(val);
        if (node.multiplier != null && Number.isFinite(node.multiplier)) val = val * node.multiplier;
      }
      return val;
    }

    default:
      return null;
  }
}

export function resolveExportSchema(
  nodes: ExportSchemaNode[],
  sectionAddons: SectionAddon[],
  sectionDataId?: string,
  arrayFormat: ExportSchemaArrayFormat = "rowMajor",
  sectionLookup?: SectionLookup
): Record<string, unknown> {
  const ctx: ResolveContext = { sectionAddons, sectionDataId, arrayFormat, sectionLookup };
  const result: Record<string, unknown> = {};
  for (const node of nodes) {
    result[resolveNodeKey(node, ctx)] = resolveNode(node, ctx);
  }
  return result;
}

/**
 * Same as `resolveExportSchema` but also returns a map of nodeId → resolved value,
 * useful for the editor to render inline previews next to each node.
 * Inside array iterations, the FIRST iteration's value is recorded for each
 * template node.
 */
export function resolveExportSchemaWithPreview(
  nodes: ExportSchemaNode[],
  sectionAddons: SectionAddon[],
  sectionDataId?: string,
  arrayFormat: ExportSchemaArrayFormat = "rowMajor",
  sectionLookup?: SectionLookup
): { result: Record<string, unknown>; nodeValueMap: Map<string, unknown> } {
  const nodeValueMap = new Map<string, unknown>();
  const ctx: ResolveContext = { sectionAddons, sectionDataId, arrayFormat, sectionLookup, nodeValueMap };
  const result: Record<string, unknown> = {};
  for (const node of nodes) {
    result[resolveNodeKey(node, ctx)] = resolveNode(node, ctx);
  }
  return { result, nodeValueMap };
}

/** Helper: builds a SectionLookup from a list of projects (each containing sections with addons). */
export function buildSectionLookup(
  projects: Array<{
    sections?: Array<{
      id: string;
      dataId?: string | null;
      addons?: SectionAddon[];
      parentId?: string | null;
      order?: number;
      title?: string;
    }>;
  }>
): SectionLookup {
  const map: SectionLookup = new Map();
  for (const project of projects || []) {
    for (const sec of project.sections || []) {
      map.set(sec.id, {
        dataId: sec.dataId ?? null,
        addons: sec.addons ?? [],
        parentId: sec.parentId ?? null,
        order: sec.order,
        title: sec.title,
      });
    }
  }
  return map;
}

/**
 * Returns the child sections of `parentSectionId`, sorted by tree order
 * (falling back to insertion order when `order` is absent). Each entry keeps
 * its section id so the resolver can swap context per child.
 */
export function getChildSections(
  parentSectionId: string,
  lookup: SectionLookup
): Array<{ id: string } & SectionLookupEntry> {
  const children: Array<{ id: string } & SectionLookupEntry> = [];
  for (const [id, entry] of lookup) {
    if (entry.parentId === parentSectionId) children.push({ id, ...entry });
  }
  children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return children;
}

// ── Coverage check for the `sections` source ───────────────────────
// A `sections` array iterates the child pages and resolves the same item
// template against each one. If a child is missing an addon the template needs
// (e.g. a pet without a Tabela de Balanceamento), that part of its JSON comes
// out empty/zero with no other signal. This walk reports those gaps so the UI
// can warn instead of exporting silent holes.

export type SectionsCoverageIssue = {
  parentSectionId: string;
  childId: string;
  childTitle: string;
  /** Addon types the item template needs but this child doesn't have. */
  missingTypes: SectionAddonType[];
};

/** Collects the addon types an item template depends on (by source/binding). */
function collectRequiredAddonTypes(nodes: ExportSchemaNode[]): Set<SectionAddonType> {
  const types = new Set<SectionAddonType>();
  const walk = (ns: ExportSchemaNode[]) => {
    for (const n of ns) {
      if (n.nodeType === "value" && n.binding?.source === "dataSchema") types.add("dataSchema");
      if (n.nodeType === "array" && n.arraySource) {
        const t = n.arraySource.type;
        if (t === "progressionTable" || t === "xpBalance" || t === "craftTable" || t === "skills") types.add(t);
        // Standalone production sources (addonId set) depend on a Production addon
        // in each iterated page; context-based ones (no addonId) do not.
        if ((t === "productionIngredients" || t === "productionOutputs") && n.arraySource.addonId) types.add("production");
      }
      if (n.nodeType === "value" && n.binding?.source === "productionField" && n.binding.addonId) types.add("production");
      if (n.children) walk(n.children);
      if (n.itemTemplate) walk(n.itemTemplate);
    }
  };
  walk(nodes);
  return types;
}

function childHasAddonType(addons: SectionAddon[], type: SectionAddonType): boolean {
  return addons.some(
    (a) => a.type === type || (type === "dataSchema" && a.type === "genericStats")
  );
}

/**
 * Walks the schema for `sections` arrays and reports, per child page, which
 * required addon types are missing. Empty array = full coverage. UI-free so it
 * can be unit-tested and reused by both editor and read-only panels.
 */
export function findSectionsCoverageIssues(
  nodes: ExportSchemaNode[],
  lookup: SectionLookup | undefined
): SectionsCoverageIssue[] {
  if (!lookup) return [];
  const issues: SectionsCoverageIssue[] = [];
  const walk = (ns: ExportSchemaNode[]) => {
    for (const n of ns) {
      if (n.nodeType === "array" && n.arraySource?.type === "sections") {
        const required = collectRequiredAddonTypes(n.itemTemplate ?? []);
        if (required.size > 0) {
          for (const child of getChildSections(n.arraySource.parentSectionId, lookup)) {
            const missingTypes = [...required].filter((t) => !childHasAddonType(child.addons, t));
            if (missingTypes.length > 0) {
              issues.push({
                parentSectionId: n.arraySource.parentSectionId,
                childId: child.id,
                childTitle: child.title ?? "(sem título)",
                missingTypes,
              });
            }
          }
        }
      }
      if (n.children) walk(n.children);
      if (n.itemTemplate) walk(n.itemTemplate);
    }
  };
  walk(nodes);
  return issues;
}

// ── Pretty-printer ─────────────────────────────────────────────────
// Like JSON.stringify(v, null, indent), but collapses arrays whose elements
// are all primitives onto a single line. Keeps column-major, matrix row
// cells, and "headers" tidy:
//
//   "level": [1, 2, 3, 4]
//   "headers": ["level", "coinUpgradePrice"]
//   "rows": [
//       [1, 500, 42],
//       [2, 694, 58]
//   ]

function isJsonPrimitive(v: unknown): boolean {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

function formatJsonValue(value: unknown, depth: number, indent: number): string {
  // Treat undefined like JSON.stringify does inside arrays (→ null).
  if (value === undefined || value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  const pad = " ".repeat(indent * depth);
  const childPad = " ".repeat(indent * (depth + 1));

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every(isJsonPrimitive)) {
      return "[" + value.map((v) => JSON.stringify(v ?? null)).join(", ") + "]";
    }
    const parts = value.map((v) => childPad + formatJsonValue(v, depth + 1, indent));
    return "[\n" + parts.join(",\n") + "\n" + pad + "]";
  }

  // Plain object
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined
  );
  if (entries.length === 0) return "{}";
  const parts = entries.map(
    ([k, v]) => childPad + JSON.stringify(k) + ": " + formatJsonValue(v, depth + 1, indent)
  );
  return "{\n" + parts.join(",\n") + "\n" + pad + "}";
}

/**
 * Pretty-print the resolved Remote Config output. Arrays of primitives are
 * collapsed onto a single line; everything else is indented like
 * JSON.stringify(v, null, indent).
 */
export function stringifyExportJson(value: unknown, indent: number = 4): string {
  return formatJsonValue(value, 0, indent);
}

