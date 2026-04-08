import type {
  ExportSchemaNode,
  ExportSchemaBinding,
  SectionAddon,
  DataSchemaAddonDraft,
  ProgressionTableAddonDraft,
  ProgressionTableRow,
} from "@/lib/addons/types";

type ResolveContext = {
  sectionAddons: SectionAddon[];
  row?: ProgressionTableRow;
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

function resolveBinding(
  binding: ExportSchemaBinding,
  ctx: ResolveContext
): string | number | boolean | null {
  switch (binding.source) {
    case "manual":
      return binding.value;

    case "dataSchema": {
      const entry = findDataSchemaEntry(ctx.sectionAddons, binding);
      return entry ? entry.value : null;
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
      return table.rows.map((row) => {
        const rowCtx = { ...ctx, row };
        const itemObj: Record<string, unknown> = {};
        for (const tmpl of node.itemTemplate!) {
          itemObj[resolveNodeKey(tmpl, rowCtx)] = resolveNode(tmpl, rowCtx);
        }
        return itemObj;
      });
    }

    case "value": {
      if (!node.binding) return null;
      return resolveBinding(node.binding, ctx);
    }

    default:
      return null;
  }
}

export function resolveExportSchema(
  nodes: ExportSchemaNode[],
  sectionAddons: SectionAddon[]
): Record<string, unknown> {
  const ctx: ResolveContext = { sectionAddons };
  const result: Record<string, unknown> = {};
  for (const node of nodes) {
    result[resolveNodeKey(node, ctx)] = resolveNode(node, ctx);
  }
  return result;
}

