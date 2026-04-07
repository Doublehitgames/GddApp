import type {
  ExportSchemaNode,
  SectionAddon,
  DataSchemaSectionAddon,
  DataSchemaEntry,
  DataSchemaValueType,
  ProgressionTableSectionAddon,
  ProgressionTableColumn,
  ProgressionTableRow,
  ExportSchemaSectionAddon,
} from "@/lib/addons/types";

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function inferDataSchemaValueType(value: unknown): DataSchemaValueType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "int" : "float";
  }
  return "string";
}

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

/**
 * Detects if an array looks like a progression table:
 * - All items are objects
 * - There's a numeric field that increments (likely "level")
 * - Remaining fields are numeric
 */
function detectProgressionArray(
  arr: unknown[]
): { levelKey: string; columns: string[] } | null {
  if (arr.length < 2) return null;
  if (!arr.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))) return null;

  const first = arr[0] as Record<string, unknown>;
  const keys = Object.keys(first);

  // Find the "level" key: numeric field that increments sequentially
  let levelKey: string | null = null;
  for (const key of keys) {
    const allNumeric = arr.every((item) => typeof (item as Record<string, unknown>)[key] === "number");
    if (!allNumeric) continue;
    const values = arr.map((item) => (item as Record<string, unknown>)[key] as number);
    const isIncrementing = values.every((v, i) => i === 0 || v > values[i - 1]);
    if (isIncrementing) {
      levelKey = key;
      break;
    }
  }

  if (!levelKey) return null;

  const columns = keys.filter((k) => k !== levelKey);
  // All columns should be numeric in at least the first row
  const hasNumericColumns = columns.length > 0 && columns.every((col) => {
    const val = first[col];
    return typeof val === "number";
  });

  if (!hasNumericColumns) return null;

  return { levelKey, columns };
}

type ImportResult = {
  newAddons: SectionAddon[];
  exportSchemaNodes: ExportSchemaNode[];
};

/**
 * Analyzes a JSON object and produces addons + export schema nodes.
 *
 * Strategy:
 * - Top-level flat objects → Data Schema addon (one per object)
 * - Top-level arrays of leveled objects → Progression Table addon
 * - Top-level primitives → grouped into a "base" Data Schema
 * - Nested objects/arrays that don't match patterns → manual values in schema
 */
export function importJsonToAddons(json: Record<string, unknown>): ImportResult {
  const newAddons: SectionAddon[] = [];
  const exportSchemaNodes: ExportSchemaNode[] = [];
  const topLevelPrimitives: Array<{ key: string; value: unknown }> = [];

  for (const [topKey, topValue] of Object.entries(json)) {
    // Case 1: Array → try Progression Table
    if (Array.isArray(topValue)) {
      const detection = detectProgressionArray(topValue);
      if (detection) {
        const ptResult = buildProgressionTableFromArray(topKey, topValue, detection);
        newAddons.push(ptResult.addon);
        exportSchemaNodes.push(ptResult.schemaNode);
        continue;
      }
      // Non-progression array: store as manual JSON value
      exportSchemaNodes.push({
        id: uid("n"),
        key: topKey,
        nodeType: "value",
        binding: { source: "manual", value: JSON.stringify(topValue), valueType: "string" },
      });
      continue;
    }

    // Case 2: Flat object → Data Schema
    if (typeof topValue === "object" && topValue !== null) {
      const obj = topValue as Record<string, unknown>;
      const entries = Object.entries(obj);
      const allPrimitive = entries.every(([, v]) => typeof v !== "object" || v === null);

      if (allPrimitive && entries.length > 0) {
        const dsResult = buildDataSchemaFromObject(topKey, obj);
        newAddons.push(dsResult.addon);
        exportSchemaNodes.push(dsResult.schemaNode);
        continue;
      }

      // Complex nested object: create an object node with manual children
      const children: ExportSchemaNode[] = [];
      for (const [childKey, childValue] of entries) {
        if (typeof childValue !== "object" || childValue === null) {
          children.push({
            id: uid("n"),
            key: childKey,
            nodeType: "value",
            binding: {
              source: "manual",
              value: childValue as string | number | boolean,
              valueType: typeof childValue === "number" ? "number" : typeof childValue === "boolean" ? "boolean" : "string",
            },
          });
        }
      }
      exportSchemaNodes.push({
        id: uid("n"),
        key: topKey,
        nodeType: "object",
        children,
      });
      continue;
    }

    // Case 3: Primitive at top level
    topLevelPrimitives.push({ key: topKey, value: topValue });
  }

  // Group top-level primitives into a Data Schema if any exist
  if (topLevelPrimitives.length > 0) {
    const dsAddonId = uid("data-schema");
    const entries: DataSchemaEntry[] = topLevelPrimitives.map(({ key, value }) => ({
      id: uid("stat"),
      key: normalizeKey(key),
      label: key,
      valueType: inferDataSchemaValueType(value),
      value: value as string | number | boolean,
    }));

    const addon: DataSchemaSectionAddon = {
      id: dsAddonId,
      type: "dataSchema",
      name: "Base Properties",
      data: { id: dsAddonId, name: "Base Properties", entries },
    };
    newAddons.push(addon);

    for (const { key } of topLevelPrimitives) {
      exportSchemaNodes.push({
        id: uid("n"),
        key,
        nodeType: "value",
        binding: { source: "dataSchema", addonId: dsAddonId, entryKey: normalizeKey(key) },
      });
    }
  }

  return { newAddons, exportSchemaNodes };
}

function buildDataSchemaFromObject(
  groupName: string,
  obj: Record<string, unknown>
): { addon: DataSchemaSectionAddon; schemaNode: ExportSchemaNode } {
  const dsAddonId = uid("data-schema");
  const entries: DataSchemaEntry[] = [];
  const children: ExportSchemaNode[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = normalizeKey(key);
    entries.push({
      id: uid("stat"),
      key: normalizedKey,
      label: key,
      valueType: inferDataSchemaValueType(value),
      value: (value ?? "") as string | number | boolean,
    });
    children.push({
      id: uid("n"),
      key,
      nodeType: "value",
      binding: { source: "dataSchema", addonId: dsAddonId, entryKey: normalizedKey },
    });
  }

  const addon: DataSchemaSectionAddon = {
    id: dsAddonId,
    type: "dataSchema",
    name: groupName,
    data: { id: dsAddonId, name: groupName, entries },
  };

  const schemaNode: ExportSchemaNode = {
    id: uid("n"),
    key: groupName,
    nodeType: "object",
    children,
  };

  return { addon, schemaNode };
}

function buildProgressionTableFromArray(
  arrayKey: string,
  arr: unknown[],
  detection: { levelKey: string; columns: string[] }
): { addon: ProgressionTableSectionAddon; schemaNode: ExportSchemaNode } {
  const ptAddonId = uid("progression");
  const { levelKey, columns: colKeys } = detection;

  const items = arr as Array<Record<string, number>>;
  const startLevel = items[0][levelKey];
  const endLevel = items[items.length - 1][levelKey];

  // Detect decimal precision per column
  function detectDecimals(values: number[]): number {
    let maxDecimals = 0;
    for (const v of values) {
      const s = String(v);
      const dot = s.indexOf(".");
      if (dot >= 0) maxDecimals = Math.max(maxDecimals, s.length - dot - 1);
    }
    return Math.min(maxDecimals, 6);
  }

  const columns: ProgressionTableColumn[] = colKeys.map((colKey) => {
    const values = items.map((item) => item[colKey] ?? 0);
    return {
      id: colKey,
      name: colKey,
      generator: { mode: "manual" as const },
      decimals: detectDecimals(values),
    };
  });

  const rows: ProgressionTableRow[] = items.map((item) => {
    const values: Record<string, number | string> = {};
    for (const col of columns) {
      values[col.id] = item[col.id] ?? 0;
    }
    return { level: item[levelKey], values };
  });

  const addon: ProgressionTableSectionAddon = {
    id: ptAddonId,
    type: "progressionTable",
    name: arrayKey,
    data: {
      id: ptAddonId,
      name: arrayKey,
      startLevel,
      endLevel,
      columns,
      rows,
    },
  };

  // Build item template for export schema
  const itemTemplate: ExportSchemaNode[] = [
    {
      id: uid("n"),
      key: levelKey,
      nodeType: "value",
      binding: { source: "rowLevel" },
    },
    ...colKeys.map((colKey) => ({
      id: uid("n"),
      key: colKey,
      nodeType: "value" as const,
      binding: { source: "rowColumn" as const, columnId: colKey },
    })),
  ];

  const schemaNode: ExportSchemaNode = {
    id: uid("n"),
    key: arrayKey,
    nodeType: "array",
    arraySource: { type: "progressionTable" as const, addonId: ptAddonId },
    itemTemplate,
  };

  return { addon, schemaNode };
}
