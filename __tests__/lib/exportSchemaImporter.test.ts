import { importJsonToAddons } from "@/lib/addons/exportSchemaImporter";
import {
  resolveExportSchema,
  stringifyExportJson,
} from "@/lib/addons/exportSchemaResolver";
import type {
  ExportSchemaArrayFormat,
  ExportSchemaNode,
  ProgressionTableSectionAddon,
  SectionAddon,
} from "@/lib/addons/types";

// ── Fixtures ─────────────────────────────────────────────────────────
// Same 3-level × 2-column table as the resolver test, re-resolved in
// every format to drive the round-trip checks.

const sourceTable: ProgressionTableSectionAddon = {
  id: "pt-source",
  type: "progressionTable",
  name: "Levels",
  data: {
    id: "pt-source",
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

const sourceSchemaNodes: ExportSchemaNode[] = [
  {
    id: "n1",
    key: "levelSettings",
    nodeType: "array",
    arraySource: { type: "progressionTable", addonId: "pt-source" },
    itemTemplate: [
      { id: "t1", key: "level", nodeType: "value", binding: { source: "rowLevel" } },
      { id: "t2", key: "price", nodeType: "value", binding: { source: "rowColumn", columnId: "price" } },
      { id: "t3", key: "cap", nodeType: "value", binding: { source: "rowColumn", columnId: "cap" } },
    ],
  },
];

/**
 * Round-trip invariant: resolve original → stringify → parse → import →
 * resolve imported (with detected format) → must equal the original
 * resolved object. Non-deterministic uid()s don't leak because we compare
 * the RESOLVED outputs, not the internal ids.
 */
function roundTrip(format: ExportSchemaArrayFormat): {
  original: Record<string, unknown>;
  reimported: Record<string, unknown>;
  detectedFormat: ExportSchemaArrayFormat | undefined;
  importedAddons: SectionAddon[];
} {
  const original = resolveExportSchema(sourceSchemaNodes, [sourceTable], undefined, format);
  const jsonString = stringifyExportJson(original);
  const parsed = JSON.parse(jsonString) as Record<string, unknown>;
  const result = importJsonToAddons(parsed);
  const reimported = resolveExportSchema(
    result.exportSchemaNodes,
    result.newAddons,
    undefined,
    result.arrayFormat
  );
  return {
    original,
    reimported,
    detectedFormat: result.arrayFormat,
    importedAddons: result.newAddons,
  };
}

// ── Round-trip tests for every format ────────────────────────────────

describe("importJsonToAddons — round-trip per format", () => {
  it("row-major: resolve → stringify → import → resolve reproduces the original", () => {
    const trip = roundTrip("rowMajor");
    expect(trip.reimported).toEqual(trip.original);
    expect(trip.detectedFormat).toBeUndefined(); // row-major stays implicit
    expect(trip.importedAddons).toHaveLength(1);
    expect(trip.importedAddons[0]?.type).toBe("progressionTable");
  });

  it("column-major: round-trip preserves values and detects columnMajor", () => {
    const trip = roundTrip("columnMajor");
    expect(trip.reimported).toEqual(trip.original);
    expect(trip.detectedFormat).toBe("columnMajor");
  });

  it("keyed-by-level: round-trip preserves values and detects keyedByLevel", () => {
    const trip = roundTrip("keyedByLevel");
    expect(trip.reimported).toEqual(trip.original);
    expect(trip.detectedFormat).toBe("keyedByLevel");
  });

  it("matrix: round-trip preserves values and detects matrix", () => {
    const trip = roundTrip("matrix");
    expect(trip.reimported).toEqual(trip.original);
    expect(trip.detectedFormat).toBe("matrix");
  });

  it("preserves the actual cell values inside the reconstructed PT addon", () => {
    const trip = roundTrip("columnMajor");
    const pt = trip.importedAddons.find(
      (a): a is ProgressionTableSectionAddon => a.type === "progressionTable"
    );
    expect(pt).toBeDefined();
    expect(pt?.data.rows).toEqual([
      { level: 1, values: { price: 100, cap: 10 } },
      { level: 2, values: { price: 200, cap: 20 } },
      { level: 3, values: { price: 300, cap: 30 } },
    ]);
    expect(pt?.data.columns.map((c) => c.id)).toEqual(["price", "cap"]);
  });
});

// ── Mixed-format conflict resolution ─────────────────────────────────

describe("importJsonToAddons — mixed and edge cases", () => {
  it("first non-rowMajor format wins when multiple tables are present", () => {
    const json = {
      firstTable: {
        // column-major
        level: [1, 2, 3],
        value: [10, 20, 30],
      },
      secondTable: {
        // keyed-by-level
        "1": { bonus: 1 },
        "2": { bonus: 2 },
      },
    };
    const result = importJsonToAddons(json);
    expect(result.arrayFormat).toBe("columnMajor");
    // Both tables should still be reconstructed as PT addons.
    const pts = result.newAddons.filter((a) => a.type === "progressionTable");
    expect(pts).toHaveLength(2);
  });

  it("row-major array alongside a column-major object → format stays column-major", () => {
    const json = {
      rmTable: [
        { level: 1, value: 10 },
        { level: 2, value: 20 },
      ],
      cmTable: {
        level: [1, 2, 3],
        value: [100, 200, 300],
      },
    };
    const result = importJsonToAddons(json);
    // The row-major table alone wouldn't set detectedArrayFormat, so the
    // column-major one wins.
    expect(result.arrayFormat).toBe("columnMajor");
    expect(result.newAddons.filter((a) => a.type === "progressionTable")).toHaveLength(2);
  });

  it("ordinary flat object still becomes a Data Schema, arrayFormat stays undefined", () => {
    const json = {
      baseSettings: { id: "ITEM_01", maxHp: 100, flying: true },
    };
    const result = importJsonToAddons(json);
    expect(result.arrayFormat).toBeUndefined();
    expect(result.newAddons.some((a) => a.type === "dataSchema")).toBe(true);
    expect(result.newAddons.some((a) => a.type === "progressionTable")).toBe(false);
  });

  it("keeps both: a flat Data Schema object plus a column-major table", () => {
    const json = {
      baseSettings: { id: "ITEM_01", tier: 3 },
      levelSettings: {
        level: [1, 2],
        price: [100, 200],
      },
    };
    const result = importJsonToAddons(json);
    expect(result.arrayFormat).toBe("columnMajor");
    expect(result.newAddons.some((a) => a.type === "dataSchema")).toBe(true);
    expect(result.newAddons.some((a) => a.type === "progressionTable")).toBe(true);
  });
});

// ── False-positive guards ────────────────────────────────────────────

describe("importJsonToAddons — detection guards", () => {
  it("column-major without a level axis falls through (not detected as table)", () => {
    // Two arrays of strings — no numeric increasing axis, so this isn't
    // a progression table. Should not become a PT addon.
    const json = {
      tags: {
        names: ["common", "rare", "epic"],
        labels: ["Common", "Rare", "Epic"],
      },
    };
    const result = importJsonToAddons(json);
    expect(result.arrayFormat).toBeUndefined();
    expect(result.newAddons.some((a) => a.type === "progressionTable")).toBe(false);
  });

  it("keyed-by-level rejects non-integer keys", () => {
    const json = {
      rarity: {
        common: { weight: 1 },
        rare: { weight: 2 },
      },
    };
    const result = importJsonToAddons(json);
    expect(result.arrayFormat).toBeUndefined();
    expect(result.newAddons.some((a) => a.type === "progressionTable")).toBe(false);
  });

  it("keyed-by-level rejects leading-zero keys like \"01\"", () => {
    const json = {
      levels: {
        "01": { price: 100 },
        "02": { price: 200 },
      },
    };
    const result = importJsonToAddons(json);
    expect(result.newAddons.some((a) => a.type === "progressionTable")).toBe(false);
  });

  it("matrix rejects objects where rows length doesn't match headers length", () => {
    const json = {
      table: {
        headers: ["level", "price", "cap"],
        rows: [
          [1, 100], // missing cap column
          [2, 200, 20],
        ],
      },
    };
    const result = importJsonToAddons(json);
    expect(result.arrayFormat).toBeUndefined();
    expect(result.newAddons.some((a) => a.type === "progressionTable")).toBe(false);
  });

  it("matrix-like object without headers+rows is treated as generic nested object", () => {
    const json = {
      table: {
        headers: "not an array",
        rows: [[1, 2]],
      },
    };
    const result = importJsonToAddons(json);
    expect(result.newAddons.some((a) => a.type === "progressionTable")).toBe(false);
  });
});
