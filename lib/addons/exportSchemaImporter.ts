import type {
  ExportSchemaArrayFormat,
  ExportSchemaNode,
  SectionAddon,
  DataSchemaSectionAddon,
  DataSchemaEntry,
  DataSchemaValueType,
  ProgressionTableSectionAddon,
  ProgressionTableColumn,
  ProgressionTableRow,
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStrictlyIncreasing(values: number[]): boolean {
  return values.every((v, i) => i === 0 || v > values[i - 1]);
}

/**
 * Detects a matrix-format table: { headers: string[], rows: unknown[][] }.
 * Extra keys on the object are tolerated and ignored. If no header column
 * is strictly increasing, levelKey is undefined and the caller will
 * synthesize levels 1..N.
 */
function detectMatrix(
  obj: Record<string, unknown>
): { levelKey: string | undefined; headers: string[]; rows: unknown[][] } | null {
  const headers = obj.headers;
  const rows = obj.rows;
  if (!Array.isArray(headers) || headers.length === 0) return null;
  if (!headers.every((h): h is string => typeof h === "string")) return null;
  if (!Array.isArray(rows)) return null;
  if (!rows.every((r): r is unknown[] => Array.isArray(r) && r.length === headers.length)) return null;

  // Find a level axis: a column of numbers strictly increasing across rows.
  let levelKey: string | undefined;
  if (rows.length >= 2) {
    for (let i = 0; i < headers.length; i++) {
      const col = rows.map((r) => (r as unknown[])[i]);
      if (col.every((v) => typeof v === "number")) {
        if (isStrictlyIncreasing(col as number[])) {
          levelKey = headers[i];
          break;
        }
      }
    }
  } else if (rows.length === 1) {
    // Single-row matrix: first numeric column becomes level axis (arbitrary
    // but gives us a stable round-trip for degenerate tables).
    for (let i = 0; i < headers.length; i++) {
      if (typeof (rows[0] as unknown[])[i] === "number") {
        levelKey = headers[i];
        break;
      }
    }
  }

  return { levelKey, headers, rows };
}

function buildPTFromMatrix(
  arrayKey: string,
  detection: { levelKey: string | undefined; headers: string[]; rows: unknown[][] }
): { addon: ProgressionTableSectionAddon; schemaNode: ExportSchemaNode } {
  const { headers, rows } = detection;
  const levelIdx = detection.levelKey ? headers.indexOf(detection.levelKey) : -1;
  const effectiveLevelKey = detection.levelKey ?? "level";
  const columnKeys = headers.filter((_, i) => i !== levelIdx);

  const rowsData: ProgressionTableRow[] = rows.map((row, rowIdx) => {
    const level = levelIdx >= 0 ? Number(row[levelIdx]) : rowIdx + 1;
    const values: Record<string, number | string> = {};
    for (let j = 0; j < headers.length; j++) {
      if (j === levelIdx) continue;
      const cell = row[j];
      values[headers[j]] =
        typeof cell === "number" || typeof cell === "string" ? cell : 0;
    }
    return { level, values };
  });

  return buildPTAndSchemaNode(arrayKey, effectiveLevelKey, columnKeys, rowsData);
}

/**
 * Detects a column-major table: object whose values are all arrays of the
 * same length, with at least one numeric strictly-increasing column (the
 * level axis). Requires an explicit level axis to avoid false positives on
 * generic objects-of-arrays.
 */
function detectColumnMajor(
  obj: Record<string, unknown>
): { levelKey: string; columnKeys: string[] } | null {
  const keys = Object.keys(obj);
  if (keys.length < 2) return null; // need at least level + 1 column

  // All values must be non-empty arrays of equal length.
  const firstVal = obj[keys[0]];
  if (!Array.isArray(firstVal) || firstVal.length === 0) return null;
  const length = firstVal.length;
  for (const k of keys) {
    const v = obj[k];
    if (!Array.isArray(v) || v.length !== length) return null;
  }

  // Find level axis (numeric strictly increasing, or any numeric column for length=1).
  let levelKey: string | null = null;
  for (const k of keys) {
    const arr = obj[k] as unknown[];
    if (!arr.every((v) => typeof v === "number")) continue;
    if (length === 1 || isStrictlyIncreasing(arr as number[])) {
      levelKey = k;
      break;
    }
  }
  if (!levelKey) return null;

  // Remaining columns must be arrays of primitives (numbers preferred, strings tolerated).
  const columnKeys = keys.filter((k) => k !== levelKey);
  const allPrimitive = columnKeys.every((k) =>
    (obj[k] as unknown[]).every((v) => typeof v === "number" || typeof v === "string")
  );
  if (!allPrimitive) return null;

  return { levelKey, columnKeys };
}

function buildPTFromColumnMajor(
  arrayKey: string,
  obj: Record<string, unknown>,
  detection: { levelKey: string; columnKeys: string[] }
): { addon: ProgressionTableSectionAddon; schemaNode: ExportSchemaNode } {
  const { levelKey, columnKeys } = detection;
  const levels = obj[levelKey] as number[];

  const rowsData: ProgressionTableRow[] = levels.map((level, i) => {
    const values: Record<string, number | string> = {};
    for (const colKey of columnKeys) {
      const cell = (obj[colKey] as unknown[])[i];
      values[colKey] = typeof cell === "number" || typeof cell === "string" ? cell : 0;
    }
    return { level, values };
  });

  return buildPTAndSchemaNode(arrayKey, levelKey, columnKeys, rowsData);
}

/**
 * Detects a keyed-by-level table: object whose keys are stringified
 * non-negative integers mapping to item objects. Requires at least 1 level.
 */
function detectKeyedByLevel(
  obj: Record<string, unknown>
): { levels: number[]; columnKeys: string[] } | null {
  const rawKeys = Object.keys(obj);
  if (rawKeys.length === 0) return null;

  const levels: number[] = [];
  for (const k of rawKeys) {
    const parsed = Number.parseInt(k, 10);
    // Reject "01", "1.0", "-1", "abc", etc.
    if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== k) return null;
    levels.push(parsed);
  }

  // Every value must be a plain object.
  for (const k of rawKeys) {
    if (!isPlainObject(obj[k])) return null;
  }

  // Column keys come from the first item; all items should share the shape.
  const first = obj[rawKeys[0]] as Record<string, unknown>;
  const columnKeys = Object.keys(first);
  if (columnKeys.length === 0) return null;

  // Item fields must be primitives (numbers or strings).
  for (const k of rawKeys) {
    const item = obj[k] as Record<string, unknown>;
    for (const col of columnKeys) {
      const v = item[col];
      if (v != null && typeof v !== "number" && typeof v !== "string" && typeof v !== "boolean") {
        return null;
      }
    }
  }

  // Sort levels ascending and keep rawKeys aligned.
  const sorted = [...levels].sort((a, b) => a - b);
  return { levels: sorted, columnKeys };
}

function buildPTFromKeyedByLevel(
  arrayKey: string,
  obj: Record<string, unknown>,
  detection: { levels: number[]; columnKeys: string[] }
): { addon: ProgressionTableSectionAddon; schemaNode: ExportSchemaNode } {
  const { levels, columnKeys } = detection;

  const rowsData: ProgressionTableRow[] = levels.map((level) => {
    const item = obj[String(level)] as Record<string, unknown>;
    const values: Record<string, number | string> = {};
    for (const colKey of columnKeys) {
      const cell = item[colKey];
      values[colKey] = typeof cell === "number" || typeof cell === "string" ? cell : 0;
    }
    return { level, values };
  });

  return buildPTAndSchemaNode(arrayKey, "level", columnKeys, rowsData);
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
  // All columns should be numeric or string primitives in at least the first row
  const hasValidColumns = columns.length > 0 && columns.every((col) => {
    const val = first[col];
    return typeof val === "number" || typeof val === "string";
  });

  if (!hasValidColumns) return null;

  return { levelKey, columns };
}

type ImportResult = {
  newAddons: SectionAddon[];
  exportSchemaNodes: ExportSchemaNode[];
  /**
   * Array output format detected during import. Undefined means no
   * non-rowMajor table was found and the Remote Config can keep its
   * default (rowMajor) format.
   */
  arrayFormat?: ExportSchemaArrayFormat;
};

function detectDecimals(values: Array<number | string>): number {
  let maxDecimals = 0;
  for (const v of values) {
    if (typeof v !== "number") continue;
    const s = String(v);
    const dot = s.indexOf(".");
    if (dot >= 0) maxDecimals = Math.max(maxDecimals, s.length - dot - 1);
  }
  return Math.min(maxDecimals, 6);
}

/**
 * Shared builder: given the extracted level axis, column list, and row data
 * (already in the internal { level, values } shape), produces the
 * Progression Table addon and the matching ExportSchema array node.
 *
 * All four format-specific builders funnel through this helper so the
 * schemas they produce are identical and round-trip stably.
 */
function buildPTAndSchemaNode(
  arrayKey: string,
  levelKey: string,
  columnKeys: string[],
  rowsData: ProgressionTableRow[]
): { addon: ProgressionTableSectionAddon; schemaNode: ExportSchemaNode } {
  const ptAddonId = uid("progression");
  const startLevel = rowsData[0]?.level ?? 1;
  const endLevel = rowsData[rowsData.length - 1]?.level ?? startLevel;

  const columns: ProgressionTableColumn[] = columnKeys.map((colKey) => {
    const values = rowsData.map((r) => r.values[colKey] ?? 0);
    return {
      id: colKey,
      name: colKey,
      generator: { mode: "manual" as const },
      decimals: detectDecimals(values),
    };
  });

  const rows: ProgressionTableRow[] = rowsData.map((r) => {
    const values: Record<string, number | string> = {};
    for (const col of columns) {
      values[col.id] = r.values[col.id] ?? 0;
    }
    return { level: r.level, values };
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

  const itemTemplate: ExportSchemaNode[] = [
    {
      id: uid("n"),
      key: levelKey,
      nodeType: "value",
      binding: { source: "rowLevel" },
    },
    ...columnKeys.map((colKey) => ({
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
    arraySource: { type: "progressionTable" as const, addonId: ptAddonId, addonName: arrayKey },
    itemTemplate,
  };

  return { addon, schemaNode };
}

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
  // First non-rowMajor format detected wins and is applied globally to the
  // Remote Config after import. Mixed-format JSONs still round-trip each
  // table into a Progression Table, but they all render in this format.
  let detectedArrayFormat: ExportSchemaArrayFormat | undefined;

  for (const [topKey, topValue] of Object.entries(json)) {
    // Case 1: Array → try Progression Table (row-major)
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

    // Case 2: Plain object → try the 3 non-rowMajor table formats first,
    // then fall back to Data Schema / generic object handling.
    if (isPlainObject(topValue)) {
      const obj = topValue;

      // 2a: matrix (most specific shape: headers + rows)
      const matrixDet = detectMatrix(obj);
      if (matrixDet) {
        const r = buildPTFromMatrix(topKey, matrixDet);
        newAddons.push(r.addon);
        exportSchemaNodes.push(r.schemaNode);
        if (!detectedArrayFormat) detectedArrayFormat = "matrix";
        continue;
      }

      // 2b: column-major (object of equal-length arrays with a level axis)
      const colDet = detectColumnMajor(obj);
      if (colDet) {
        const r = buildPTFromColumnMajor(topKey, obj, colDet);
        newAddons.push(r.addon);
        exportSchemaNodes.push(r.schemaNode);
        if (!detectedArrayFormat) detectedArrayFormat = "columnMajor";
        continue;
      }

      // 2c: keyed-by-level (integer-string keys mapping to item objects)
      const keyedDet = detectKeyedByLevel(obj);
      if (keyedDet) {
        const r = buildPTFromKeyedByLevel(topKey, obj, keyedDet);
        newAddons.push(r.addon);
        exportSchemaNodes.push(r.schemaNode);
        if (!detectedArrayFormat) detectedArrayFormat = "keyedByLevel";
        continue;
      }

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
      const normalizedKey = normalizeKey(key);
      const matchingEntry = entries.find((e) => e.key === normalizedKey);
      exportSchemaNodes.push({
        id: uid("n"),
        key,
        nodeType: "value",
        binding: { source: "dataSchema", addonId: dsAddonId, addonName: "Base Properties", entryKey: normalizedKey, entryId: matchingEntry?.id },
      });
    }
  }

  return { newAddons, exportSchemaNodes, arrayFormat: detectedArrayFormat };
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
    const entryId = uid("stat");
    entries.push({
      id: entryId,
      key: normalizedKey,
      label: key,
      valueType: inferDataSchemaValueType(value),
      value: (value ?? "") as string | number | boolean,
    });
    children.push({
      id: uid("n"),
      key,
      nodeType: "value",
      binding: { source: "dataSchema", addonId: dsAddonId, addonName: groupName, entryKey: normalizedKey, entryId },
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
  const { levelKey, columns: colKeys } = detection;
  const items = arr as Array<Record<string, number | string>>;

  const rowsData: ProgressionTableRow[] = items.map((item) => {
    const values: Record<string, number | string> = {};
    for (const colKey of colKeys) {
      values[colKey] = item[colKey] ?? 0;
    }
    return { level: Number(item[levelKey]), values };
  });

  return buildPTAndSchemaNode(arrayKey, levelKey, colKeys, rowsData);
}

