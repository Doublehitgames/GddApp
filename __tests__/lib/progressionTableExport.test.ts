import { buildProgressionTableComputedExport } from "@/lib/addons/progressionTableExport";

describe("progressionTableExport", () => {
  it("exports computed rows preserving column order", () => {
    const exportData = buildProgressionTableComputedExport({
      id: "prog-1",
      name: "Tabela de teste",
      startLevel: 1,
      endLevel: 2,
      columns: [
        { id: "atk", name: "Ataque", decimals: 0 },
        { id: "hp", name: "Vida", decimals: 0 },
      ],
      rows: [
        { level: 1, values: { hp: 100, atk: 10 } },
        { level: 2, values: { hp: 120, atk: 12 } },
      ],
    });

    expect(exportData.columns.map((col) => col.id)).toEqual(["atk", "hp"]);
    expect(Object.keys(exportData.rows[0].values)).toEqual(["atk", "hp"]);
    expect(exportData.rows[0].values).toEqual({ atk: 10, hp: 100 });
    expect(exportData.rows[1].values).toEqual({ atk: 12, hp: 120 });
  });

  it("exports text columns as strings, not converted to numbers", () => {
    const exportData = buildProgressionTableComputedExport({
      id: "prog-2",
      name: "Moeda por nível",
      startLevel: 1,
      endLevel: 3,
      columns: [
        { id: "price", name: "Preço", decimals: 0 },
        { id: "currency", name: "Moeda", valueType: "text" },
      ],
      rows: [
        { level: 1, values: { price: 100, currency: "COINS" } },
        { level: 2, values: { price: 200, currency: "COINS" } },
        { level: 3, values: { price: 500, currency: "CASH" } },
      ],
    });

    // column metadata carries valueType
    expect(exportData.columns[0].valueType).toBeUndefined();
    expect(exportData.columns[1].valueType).toBe("text");

    // numeric column stays as number
    expect(exportData.rows[0].values.price).toBe(100);
    expect(exportData.rows[2].values.price).toBe(500);

    // text column stays as string (not coerced to 0)
    expect(exportData.rows[0].values.currency).toBe("COINS");
    expect(exportData.rows[1].values.currency).toBe("COINS");
    expect(exportData.rows[2].values.currency).toBe("CASH");
  });

  it("text column with missing value falls back to empty string", () => {
    const exportData = buildProgressionTableComputedExport({
      id: "prog-3",
      name: "Fallback teste",
      startLevel: 1,
      endLevel: 1,
      columns: [{ id: "currency", name: "Moeda", valueType: "text" }],
      rows: [{ level: 1, values: {} }],
    });
    expect(exportData.rows[0].values.currency).toBe("");
  });
});
