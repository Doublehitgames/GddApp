import {
  resolveExportSchema,
  stringifyExportJson,
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
