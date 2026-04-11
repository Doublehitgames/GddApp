import type {
  ExportSchemaNode,
  ExportSchemaBinding,
  ExportSchemaArrayFormat,
  SectionAddon,
  DataSchemaAddonDraft,
  DataSchemaEntry,
  EconomyLinkAddonDraft,
  ProductionAddonDraft,
  ProgressionTableAddonDraft,
  ProgressionTableRow,
} from "@/lib/addons/types";

type ResolveContext = {
  sectionAddons: SectionAddon[];
  sectionDataId?: string;
  row?: ProgressionTableRow;
  arrayFormat?: ExportSchemaArrayFormat;
};

function findDataSchemaAddon(
  addons: SectionAddon[],
  addonId: string,
  addonName?: string
): DataSchemaAddonDraft | undefined {
  // Try by ID first
  for (const addon of addons) {
    if ((addon.type === "dataSchema" || addon.type === "genericStats") && addon.id === addonId) {
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

function findProgressionTableAddon(
  addons: SectionAddon[],
  addonId: string,
  addonName?: string
): ProgressionTableAddonDraft | undefined {
  // Try by ID first
  for (const addon of addons) {
    if (addon.type === "progressionTable" && addon.id === addonId) {
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
    if (entry) return entry.key;
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

function resolveNode(
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
      const table = findProgressionTableAddon(
        ctx.sectionAddons,
        node.arraySource.addonId,
        node.arraySource.addonName
      );
      if (!table) return [];
      const format = ctx.arrayFormat ?? "rowMajor";
      switch (format) {
        case "columnMajor":
          return buildColumnMajor(table, node.itemTemplate, ctx);
        case "keyedByLevel":
          return buildKeyedByLevel(table, node.itemTemplate, ctx);
        case "matrix":
          return buildMatrix(table, node.itemTemplate, ctx);
        case "rowMajor":
        default:
          return buildRowMajor(table, node.itemTemplate, ctx);
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
  arrayFormat: ExportSchemaArrayFormat = "rowMajor"
): Record<string, unknown> {
  const ctx: ResolveContext = { sectionAddons, sectionDataId, arrayFormat };
  const result: Record<string, unknown> = {};
  for (const node of nodes) {
    result[resolveNodeKey(node, ctx)] = resolveNode(node, ctx);
  }
  return result;
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

