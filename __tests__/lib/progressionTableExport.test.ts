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
});

