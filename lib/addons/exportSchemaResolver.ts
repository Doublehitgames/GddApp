import type {
  FieldLibraryAddonDraft,
  ExportSchemaNode,
  ExportSchemaBinding,
  ExportSchemaArrayFormat,
  SectionAddon,
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
} from "@/lib/addons/types";

export type SectionLookupEntry = {
  dataId?: string | null;
  addons: SectionAddon[];
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

function resolveColumnExportKey(
  columnId: string,
  table: ProgressionTableAddonDraft,
  sectionAddons: SectionAddon[]
): string | undefined {
  const column = table.columns.find((c) => c.id === columnId);
  if (!column) return undefined;
  if (column.libraryRef) {
    const lib = sectionAddons.find(
      (a) => a.type === "fieldLibrary" && a.id === column.libraryRef!.libraryAddonId
    );
    if (lib) {
      const data = lib.data as FieldLibraryAddonDraft;
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
    case "minOutput":
      return prod.minOutput ?? 0;
    case "maxOutput":
      return prod.maxOutput ?? 0;
    case "intervalSeconds":
      return prod.intervalSeconds ?? 0;
    case "capacity":
      return prod.capacity ?? 0;
    case "requiresCollection":
      return Boolean(prod.requiresCollection);
    case "outputRef":
      return resolveRefToDataId(prod.outputRef, lookup);
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
  return undefined;
}

/**
 * Finds an AttributeModifier entry across the project by section id +
 * addon id + entry id. Used to resolve `skillEffects` references.
 */
function findAttributeModifierEntry(
  effect: SkillEffectRef,
  lookup?: SectionLookup
): AttributeModifierEntry | undefined {
  if (!lookup) return undefined;
  const meta = lookup.get(effect.attributeModifiersSectionId);
  if (!meta) return undefined;
  for (const addon of meta.addons) {
    if (addon.type !== "attributeModifiers") continue;
    if (addon.id !== effect.attributeModifiersAddonId && addon.data?.id !== effect.attributeModifiersAddonId) continue;
    const data = addon.data as AttributeModifiersAddonDraft;
    return (data.modifiers || []).find((m) => m.id === effect.modifierEntryId);
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
  lookup?: SectionLookup
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
    case "resolvedMode":
      return resolved?.mode ?? "";
    case "resolvedAttributeKey":
      return resolved?.attributeKey ?? "";
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
  return undefined;
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
 * If the entry has an active binding (economyLinkRef or productionRef),
 * the value is computed live from the source addon instead of using the stored entry.value.
 */
function resolveEntryEffectiveValue(
  entry: DataSchemaEntry,
  allAddons: SectionAddon[],
  sectionDataId?: string
): string | number | boolean {
  // Page DataID binding
  if (entry.usePageDataId) {
    return sectionDataId ?? "";
  }

  // Economy Link binding
  if (entry.economyLinkRef && entry.economyLinkField) {
    const elAddon = allAddons.find((a) => a.type === "economyLink" && a.id === entry.economyLinkRef);
    if (elAddon) {
      const el = elAddon.data as EconomyLinkAddonDraft;
      const directValue = el[entry.economyLinkField as keyof EconomyLinkAddonDraft];
      if (typeof directValue === "number") return directValue;
    }
  }

  // Production binding
  if (entry.productionRef && entry.productionField) {
    const prodAddon = allAddons.find((a) => a.type === "production" && a.id === entry.productionRef);
    if (prodAddon) {
      const prod = prodAddon.data as ProductionAddonDraft;
      const field = entry.productionField;

      // Direct production fields
      const directFields: Record<string, keyof ProductionAddonDraft> = {
        minOutput: "minOutput", maxOutput: "maxOutput",
        intervalSeconds: "intervalSeconds", craftTimeSeconds: "craftTimeSeconds", capacity: "capacity",
      };
      if (field in directFields) {
        const v = prod[directFields[field]];
        if (typeof v === "number") return v;
        return 0;
      }

      // Output item economy fields: follow Production.outputRef → section → Economy Link
      if (field.startsWith("output") && prod.outputRef) {
        // Find the Economy Link on the produced item's section
        // We need to search all projects, but we only have addons from the current section
        // The outputRef is a section ID, so we can't resolve cross-section here directly.
        // However, the DataSchemaAddonPanel already computes and stores the value in entry.value
        // for these cross-section lookups. So we fall back to entry.value for output* fields.
        return entry.value;
      }
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
      return resolveEntryEffectiveValue(entry, ctx.sectionAddons, ctx.sectionDataId);
    }

    case "rowLevel":
      return ctx.row ? ctx.row.level : null;

    case "rowColumn":
      if (!ctx.row) return null;
      return ctx.row.values[binding.columnId] ?? null;

    case "entryField":
      if (!ctx.entry) return null;
      return resolveEntryField(ctx.entry, binding.field, ctx.sectionLookup);

    case "productionField":
      return resolveProductionField(ctx.currentProduction, binding.field, ctx.sectionLookup);

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
        ctx.sectionLookup
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
      if (entry.libraryRef) {
        const lib = ctx.sectionAddons.find(
          (a) => a.type === "fieldLibrary" && a.id === entry.libraryRef!.libraryAddonId
        );
        if (lib) {
          const libData = lib.data as FieldLibraryAddonDraft;
          const libEntry = libData.entries.find((e) => e.id === entry.libraryRef!.entryId);
          if (libEntry?.key) return libEntry.key;
        }
      }
      return entry.key;
    }
  }
  if (node.binding?.source === "rowColumn" && ctx.currentTable) {
    const libKey = resolveColumnExportKey(node.binding.columnId, ctx.currentTable, ctx.sectionAddons);
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
    const resolved = findAttributeModifierEntry(effect, ctx.sectionLookup);
    const effectCtx: ResolveContext = {
      ...ctx,
      currentSkillEffect: effect,
      currentSkillEffectResolved: resolved,
    };
    const out: Record<string, unknown> = {};
    for (const tmpl of itemTemplate) {
      out[resolveNodeKey(tmpl, effectCtx)] = resolveNode(tmpl, effectCtx);
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
        const items = ctx.currentProduction?.ingredients || [];
        return buildProductionItemRowMajor(items, node.itemTemplate, ctx);
      }
      if (node.arraySource.type === "productionOutputs") {
        const items = ctx.currentProduction?.outputs || [];
        return buildProductionItemRowMajor(items, node.itemTemplate, ctx);
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
      const table = findProgressionTableAddon(
        ctx.sectionAddons,
        node.arraySource.addonId,
        node.arraySource.addonName
      );
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
    sections?: Array<{ id: string; dataId?: string | null; addons?: SectionAddon[] }>;
  }>
): SectionLookup {
  const map: SectionLookup = new Map();
  for (const project of projects || []) {
    for (const sec of project.sections || []) {
      map.set(sec.id, { dataId: sec.dataId ?? null, addons: sec.addons ?? [] });
    }
  }
  return map;
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

