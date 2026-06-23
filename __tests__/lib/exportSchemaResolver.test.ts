import {
  resolveExportSchema,
  stringifyExportJson,
  buildSectionLookup,
  findSectionsCoverageIssues,
} from "@/lib/addons/exportSchemaResolver";
import { normalizeSectionAddons } from "@/lib/addons/normalize";
import type {
  ExportSchemaNode,
  ProgressionTableSectionAddon,
  SectionAddon,
} from "@/lib/addons/types";

// ── Fixtures ─────────────────────────────────────────────────────────
// Tiny progression table: 3 levels × 2 columns, plus a schema node that
// maps rowLevel → "level" and each column into the item body.

const tableAddon: ProgressionTableSectionAddon = {
  id: "pt-1",
  type: "progressionTable",
  name: "Levels",
  data: {
    id: "pt-1",
    name: "Levels",
    startLevel: 1,
    endLevel: 3,
    columns: [
      { id: "price", name: "price" },
      { id: "cap", name: "cap" },
    ],
    rows: [
      { level: 1, values: { price: 100, cap: 10 } },
      { level: 2, values: { price: 200, cap: 20 } },
      { level: 3, values: { price: 300, cap: 30 } },
    ],
  },
};

const schemaNodes: ExportSchemaNode[] = [
  {
    id: "n1",
    key: "levelSettings",
    nodeType: "array",
    arraySource: { type: "progressionTable", addonId: "pt-1" },
    itemTemplate: [
      { id: "t1", key: "level", nodeType: "value", binding: { source: "rowLevel" } },
      { id: "t2", key: "price", nodeType: "value", binding: { source: "rowColumn", columnId: "price" } },
      { id: "t3", key: "cap", nodeType: "value", binding: { source: "rowColumn", columnId: "cap" } },
    ],
  },
];

// ── resolveExportSchema: array formats ───────────────────────────────

describe("resolveExportSchema — array formats", () => {
  it("defaults to rowMajor (array of objects, one per level)", () => {
    const out = resolveExportSchema(schemaNodes, [tableAddon]);
    expect(out).toEqual({
      levelSettings: [
        { level: 1, price: 100, cap: 10 },
        { level: 2, price: 200, cap: 20 },
        { level: 3, price: 300, cap: 30 },
      ],
    });
  });

  it("explicit rowMajor matches the default", () => {
    expect(resolveExportSchema(schemaNodes, [tableAddon], undefined, "rowMajor")).toEqual(
      resolveExportSchema(schemaNodes, [tableAddon])
    );
  });

  it("columnMajor: object of arrays, level node becomes an axis", () => {
    const out = resolveExportSchema(schemaNodes, [tableAddon], undefined, "columnMajor");
    expect(out).toEqual({
      levelSettings: {
        level: [1, 2, 3],
        price: [100, 200, 300],
        cap: [10, 20, 30],
      },
    });
  });

  it("keyedByLevel: object indexed by level; rowLevel node is dropped from item body", () => {
    const out = resolveExportSchema(schemaNodes, [tableAddon], undefined, "keyedByLevel");
    expect(out).toEqual({
      levelSettings: {
        "1": { price: 100, cap: 10 },
        "2": { price: 200, cap: 20 },
        "3": { price: 300, cap: 30 },
      },
    });
  });

  it("matrix: headers + row cells, both following itemTemplate order", () => {
    const out = resolveExportSchema(schemaNodes, [tableAddon], undefined, "matrix");
    expect(out).toEqual({
      levelSettings: {
        headers: ["level", "price", "cap"],
        rows: [
          [1, 100, 10],
          [2, 200, 20],
          [3, 300, 30],
        ],
      },
    });
  });

  it("handles an empty table in all formats without crashing", () => {
    const emptyTable: ProgressionTableSectionAddon = {
      ...tableAddon,
      data: { ...tableAddon.data, rows: [] },
    };

    expect(resolveExportSchema(schemaNodes, [emptyTable], undefined, "rowMajor")).toEqual({
      levelSettings: [],
    });
    expect(resolveExportSchema(schemaNodes, [emptyTable], undefined, "columnMajor")).toEqual({
      levelSettings: { level: [], price: [], cap: [] },
    });
    expect(resolveExportSchema(schemaNodes, [emptyTable], undefined, "keyedByLevel")).toEqual({
      levelSettings: {},
    });
    expect(resolveExportSchema(schemaNodes, [emptyTable], undefined, "matrix")).toEqual({
      levelSettings: { headers: ["level", "price", "cap"], rows: [] },
    });
  });
});

// ── sections source: per-child progression curve, rename- and id-proof ──
// A parent page aggregates its children. Each child renamed its progression
// table to a unique COSMETIC name ("Balanceamento Cão", "Balanceamento Cabra")
// and one child has a different COLUMN ID. The binding was sampled from one
// child, so it carries that child's addon id + name + column id. Resolution
// must still reach every sibling: the addon by TYPE (singleton), the column by
// NAME. The user-given name is cosmetic and must NOT be required to match.

describe("resolveExportSchema — sections source: per-child curve, rename/id proof", () => {
  const makeChildTable = (
    tableId: string,
    addonName: string,
    priceColId: string,
    v1: number,
    v2: number
  ): SectionAddon => ({
    id: tableId,
    type: "progressionTable",
    name: addonName,
    data: {
      id: tableId,
      name: addonName,
      startLevel: 1,
      endLevel: 2,
      columns: [{ id: priceColId, name: "price" }],
      rows: [
        { level: 1, values: { [priceColId]: v1 } },
        { level: 2, values: { [priceColId]: v2 } },
      ],
    },
  });

  // Child A: addon name "Balanceamento Cão", column id "price" (both match the
  //   sampled binding directly).
  // Child B: addon name "Balanceamento Cabra" (diverges → resolved by type) and
  //   column id "col_regen" (diverges → resolved by columnName).
  const lookup = buildSectionLookup([
    {
      sections: [
        { id: "P", title: "Animais", parentId: null, order: 0, addons: [] },
        { id: "A", title: "Cão", parentId: "P", order: 0, dataId: "PET_DOG", addons: [makeChildTable("pt-a", "Balanceamento Cão", "price", 100, 200)] },
        { id: "B", title: "Cabra", parentId: "P", order: 1, dataId: "PET_GOAT", addons: [makeChildTable("pt-b", "Balanceamento Cabra", "col_regen", 111, 222)] },
      ],
    },
  ]);

  const nestedLevelSettings = (columnName?: string): ExportSchemaNode[] => [
    {
      id: "root",
      key: "animals",
      nodeType: "array",
      arraySource: { type: "sections", parentSectionId: "P" },
      itemTemplate: [
        {
          id: "ls",
          key: "levelSettings",
          nodeType: "array",
          // Sampled from child A: id "pt-a", cosmetic name "Balanceamento Cão".
          arraySource: { type: "progressionTable", addonId: "pt-a", addonName: "Balanceamento Cão" },
          itemTemplate: [
            { id: "lvl", key: "level", nodeType: "value", binding: { source: "rowLevel" } },
            { id: "pr", key: "price", nodeType: "value", binding: { source: "rowColumn", columnId: "price", columnName } },
          ],
        },
      ],
    },
  ];

  it("resolves every child's curve: addon by type (rename-proof), column by name (id-proof)", () => {
    const out = resolveExportSchema(nestedLevelSettings("price"), [], undefined, "rowMajor", lookup);
    expect(out).toEqual({
      animals: [
        { levelSettings: [{ level: 1, price: 100 }, { level: 2, price: 200 }] },
        // Child B resolved despite a different addon name AND a different column id.
        { levelSettings: [{ level: 1, price: 111 }, { level: 2, price: 222 }] },
      ],
    });
  });

  it("without columnName, the divergent-column child loses only that value (column layer guard)", () => {
    const out = resolveExportSchema(nestedLevelSettings(undefined), [], undefined, "rowMajor", lookup) as {
      animals: Array<{ levelSettings: Array<{ level: number; price: number | null }> }>;
    };
    // Child B's table is still found (by type), but its column can't be matched
    // without the name fallback, so the value falls through to null.
    expect(out.animals[0].levelSettings).toEqual([{ level: 1, price: 100 }, { level: 2, price: 200 }]);
    expect(out.animals[1].levelSettings).toEqual([{ level: 1, price: null }, { level: 2, price: null }]);
  });
});

// ── Data Schema → Inventory binding: Remote Config reads inventory fields ──

describe("resolveExportSchema — Data Schema bound to Inventory fields", () => {
  const inventoryAddon: SectionAddon = {
    id: "inv-1",
    type: "inventory",
    name: "Inventory",
    data: {
      id: "inv-1",
      name: "Inventory",
      weight: 2.5,
      stackable: true,
      maxStack: 99,
      inventoryCategory: "consumable",
      slotSize: 1,
      durability: 0,
      bindType: "onPickup",
      showInShop: false,
      consumable: true,
      discardable: true,
    } as SectionAddon["data"],
  };

  const dataSchemaAddon: SectionAddon = {
    id: "ds-1",
    type: "dataSchema",
    name: "Schema",
    data: {
      id: "ds-1",
      name: "Schema",
      entries: [
        { id: "e1", key: "weight", label: "weight", valueType: "float", value: 0, binding: { source: "inventory", addonId: "inv-1", field: "weight" } },
        { id: "e2", key: "max_stack", label: "max_stack", valueType: "int", value: 0, binding: { source: "inventory", addonId: "inv-1", field: "maxStack" } },
        { id: "e3", key: "consumable", label: "consumable", valueType: "boolean", value: false, binding: { source: "inventory", addonId: "inv-1", field: "consumable" } },
        { id: "e4", key: "category", label: "category", valueType: "string", value: "", binding: { source: "inventory", addonId: "inv-1", field: "inventoryCategory" } },
        { id: "e5", key: "bind_type", label: "bind_type", valueType: "string", value: "", binding: { source: "inventory", addonId: "inv-1", field: "bindType" } },
      ],
    } as SectionAddon["data"],
  };

  const nodes: ExportSchemaNode[] = [
    { id: "n1", key: "weight", nodeType: "value", binding: { source: "dataSchema", addonId: "ds-1", entryKey: "weight" } },
    { id: "n2", key: "maxStack", nodeType: "value", binding: { source: "dataSchema", addonId: "ds-1", entryKey: "max_stack" } },
    { id: "n3", key: "consumable", nodeType: "value", binding: { source: "dataSchema", addonId: "ds-1", entryKey: "consumable" } },
    { id: "n4", key: "category", nodeType: "value", binding: { source: "dataSchema", addonId: "ds-1", entryKey: "category" } },
    { id: "n5", key: "bindType", nodeType: "value", binding: { source: "dataSchema", addonId: "ds-1", entryKey: "bind_type" } },
  ];

  it("reads numeric, boolean and text inventory fields through the schema binding", () => {
    const out = resolveExportSchema(nodes, [dataSchemaAddon, inventoryAddon]);
    // Keys come from the Data Schema entry keys (existing behavior for dataSchema-bound nodes).
    expect(out).toEqual({
      weight: 2.5,
      max_stack: 99,
      consumable: true,
      category: "consumable",
      bind_type: "onPickup",
    });
  });
});

// ── findSectionsCoverageIssues: warn on children missing required addons ──

describe("findSectionsCoverageIssues", () => {
  const progTable = (id: string): SectionAddon => ({
    id,
    type: "progressionTable",
    name: "Balanceamento",
    data: { id, name: "Balanceamento", startLevel: 1, endLevel: 1, columns: [{ id: "price", name: "price" }], rows: [{ level: 1, values: { price: 1 } }] },
  });
  const schema = (id: string): SectionAddon => ({
    id,
    type: "dataSchema",
    name: "Schema",
    data: { id, name: "Schema", entries: [{ id: "e1", key: "id", label: "id", valueType: "string", value: "" }] },
  });

  const nodes: ExportSchemaNode[] = [
    {
      id: "root",
      key: "animals",
      nodeType: "array",
      arraySource: { type: "sections", parentSectionId: "P" },
      itemTemplate: [
        { id: "v", key: "id", nodeType: "value", binding: { source: "dataSchema", addonId: "ds-a", entryKey: "id" } },
        {
          id: "ls",
          key: "levelSettings",
          nodeType: "array",
          arraySource: { type: "progressionTable", addonId: "pt-a" },
          itemTemplate: [{ id: "lvl", key: "level", nodeType: "value", binding: { source: "rowLevel" } }],
        },
      ],
    },
  ];

  it("flags children missing a required addon type (e.g. no progression table)", () => {
    const lookup = buildSectionLookup([
      {
        sections: [
          { id: "P", title: "Animais", parentId: null, order: 0, addons: [] },
          { id: "A", title: "Cão", parentId: "P", order: 0, addons: [schema("ds-a"), progTable("pt-a")] },
          { id: "B", title: "Cabra", parentId: "P", order: 1, addons: [schema("ds-b")] }, // no progressionTable
        ],
      },
    ]);
    const issues = findSectionsCoverageIssues(nodes, lookup);
    expect(issues).toEqual([
      { parentSectionId: "P", childId: "B", childTitle: "Cabra", missingTypes: ["progressionTable"] },
    ]);
  });

  it("returns no issues when every child has all required addons (names may differ)", () => {
    const lookup = buildSectionLookup([
      {
        sections: [
          { id: "P", title: "Animais", parentId: null, order: 0, addons: [] },
          { id: "A", title: "Cão", parentId: "P", order: 0, addons: [schema("ds-a"), progTable("pt-a")] },
          { id: "B", title: "Cabra", parentId: "P", order: 1, addons: [schema("ds-b"), progTable("pt-b")] },
        ],
      },
    ]);
    expect(findSectionsCoverageIssues(nodes, lookup)).toEqual([]);
  });
});

// ── stringifyExportJson: smart pretty-printer ────────────────────────

describe("stringifyExportJson", () => {
  it("inlines arrays of numbers", () => {
    expect(stringifyExportJson({ a: [1, 2, 3] })).toBe('{\n    "a": [1, 2, 3]\n}');
  });

  it("inlines arrays of strings, booleans, and nulls", () => {
    expect(
      stringifyExportJson({ a: ["x", "y"], b: [true, false, null] })
    ).toBe('{\n    "a": ["x", "y"],\n    "b": [true, false, null]\n}');
  });

  it("keeps arrays of objects indented across multiple lines", () => {
    const out = stringifyExportJson({ list: [{ a: 1 }, { a: 2 }] });
    expect(out).toBe(
      '{\n    "list": [\n        {\n            "a": 1\n        },\n        {\n            "a": 2\n        }\n    ]\n}'
    );
  });

  it("matrix shape: inner primitive rows inline, outer array indented", () => {
    const out = stringifyExportJson({
      headers: ["level", "price"],
      rows: [
        [1, 100],
        [2, 200],
      ],
    });
    expect(out).toBe(
      '{\n    "headers": ["level", "price"],\n    "rows": [\n        [1, 100],\n        [2, 200]\n    ]\n}'
    );
  });

  it("renders empty arrays and empty objects inline", () => {
    expect(stringifyExportJson({ a: [], b: {} })).toBe('{\n    "a": [],\n    "b": {}\n}');
  });

  it("escapes strings via JSON.stringify", () => {
    expect(stringifyExportJson(['a"b', "c\nd"])).toBe('["a\\"b", "c\\nd"]');
  });

  it("respects a custom indent size", () => {
    expect(stringifyExportJson({ a: [1, 2] }, 2)).toBe('{\n  "a": [1, 2]\n}');
  });

  it("round-trips to the same value via JSON.parse", () => {
    const input = {
      headers: ["level", "price"],
      rows: [
        [1, 100],
        [2, 200],
      ],
      meta: { count: 2, active: true, tag: null },
    };
    expect(JSON.parse(stringifyExportJson(input))).toEqual(input);
  });
});

// ── Regression: normalizeExportSchemaDraft must preserve arrayFormat ─
// Before this fix, the field was silently stripped on every save, which
// made the format selector in edit mode appear to do nothing.

describe("normalizeSectionAddons — exportSchema arrayFormat", () => {
  const makeRaw = (arrayFormat: unknown): unknown[] => [
    {
      id: "rc-1",
      type: "exportSchema",
      name: "Remote Config",
      data: {
        id: "rc-1",
        name: "Remote Config",
        nodes: [],
        arrayFormat,
      },
    },
  ];

  const getExportSchema = (addons: SectionAddon[] | undefined) =>
    addons?.find((a) => a.type === "exportSchema");

  it("preserves all four valid arrayFormat values", () => {
    for (const fmt of ["rowMajor", "columnMajor", "keyedByLevel", "matrix"] as const) {
      const normalized = normalizeSectionAddons(makeRaw(fmt));
      const rc = getExportSchema(normalized);
      expect(rc?.type).toBe("exportSchema");
      if (rc?.type === "exportSchema") {
        expect(rc.data.arrayFormat).toBe(fmt);
      }
    }
  });

  it("leaves arrayFormat undefined when not provided (implicit rowMajor)", () => {
    const normalized = normalizeSectionAddons([
      {
        id: "rc-1",
        type: "exportSchema",
        name: "Remote Config",
        data: { id: "rc-1", name: "Remote Config", nodes: [] },
      },
    ]);
    const rc = getExportSchema(normalized);
    if (rc?.type === "exportSchema") {
      expect(rc.data.arrayFormat).toBeUndefined();
    }
  });

  it("drops unknown arrayFormat strings instead of preserving them", () => {
    const normalized = normalizeSectionAddons(makeRaw("notARealFormat"));
    const rc = getExportSchema(normalized);
    if (rc?.type === "exportSchema") {
      expect(rc.data.arrayFormat).toBeUndefined();
    }
  });
});
