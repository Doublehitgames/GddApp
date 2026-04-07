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
  addonId: string
): DataSchemaAddonDraft | undefined {
  for (const addon of addons) {
    if ((addon.type === "dataSchema" || addon.type === "genericStats") && addon.id === addonId) {
      return addon.data as DataSchemaAddonDraft;
    }
  }
  return undefined;
}

function findProgressionTableAddon(
  addons: SectionAddon[],
  addonId: string
): ProgressionTableAddonDraft | undefined {
  for (const addon of addons) {
    if (addon.type === "progressionTable" && addon.id === addonId) {
      return addon.data as ProgressionTableAddonDraft;
    }
  }
  return undefined;
}

function resolveBinding(
  binding: ExportSchemaBinding,
  ctx: ResolveContext
): string | number | boolean | null {
  switch (binding.source) {
    case "manual":
      return binding.value;

    case "dataSchema": {
      const schema = findDataSchemaAddon(ctx.sectionAddons, binding.addonId);
      if (!schema) return null;
      const entry = schema.entries.find((e) => e.key === binding.entryKey);
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

function resolveNode(
  node: ExportSchemaNode,
  ctx: ResolveContext
): unknown {
  switch (node.nodeType) {
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const child of node.children ?? []) {
        obj[child.key] = resolveNode(child, ctx);
      }
      return obj;
    }

    case "array": {
      if (!node.arraySource || !node.itemTemplate) return [];
      const table = findProgressionTableAddon(
        ctx.sectionAddons,
        node.arraySource.addonId
      );
      if (!table) return [];
      return table.rows.map((row) => {
        const itemObj: Record<string, unknown> = {};
        for (const tmpl of node.itemTemplate!) {
          itemObj[tmpl.key] = resolveNode(tmpl, { ...ctx, row });
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
    result[node.key] = resolveNode(node, ctx);
  }
  return result;
}
