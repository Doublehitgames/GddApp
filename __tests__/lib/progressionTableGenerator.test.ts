import {
  applyColumnClamp,
  applyColumnDecimals,
  generateAllProgressionColumnValues,
  generateProgressionColumnValues,
} from "@/lib/addons/progressionTableGenerator";

describe("progressionTableGenerator", () => {
  const baseRows = [
    { level: 1, values: { upgradeCost: 0, production: 5 } },
    { level: 2, values: { upgradeCost: 0, production: 7 } },
    { level: 3, values: { upgradeCost: 0, production: 9 } },
  ];

  it("generates linear values and overwrites target column", () => {
    const result = generateProgressionColumnValues({
      rows: baseRows,
      columnId: "upgradeCost",
      startLevel: 1,
      generator: { mode: "linear", base: 100, step: 50 },
    });
    expect(result.map((row) => row.values.upgradeCost)).toEqual([100, 150, 200]);
    expect(result.map((row) => row.values.production)).toEqual([5, 7, 9]);
  });

  it("generates exponential values and overwrites existing values", () => {
    const result = generateProgressionColumnValues({
      rows: baseRows.map((row) => ({
        ...row,
        values: { ...row.values, upgradeCost: 9999 },
      })),
      columnId: "upgradeCost",
      startLevel: 1,
      generator: { mode: "exponential", base: 100, growth: 1.5 },
    });
    expect(result.map((row) => row.values.upgradeCost)).toEqual([100, 150, 225]);
  });

  it("generates all columns following current order and keeps manual unchanged", () => {
    const result = generateAllProgressionColumnValues({
      rows: baseRows.map((row) => ({
        ...row,
        values: { ...row.values, upgradeCost: 999, cap: -1 },
      })),
      startLevel: 1,
      columns: [
        { id: "upgradeCost", name: "Custo", generator: { mode: "linear", base: 10, step: 3 } },
        { id: "cap", name: "Cap", generator: { mode: "manual" } },
      ],
    });
    expect(result.map((row) => row.values.upgradeCost)).toEqual([10, 13, 16]);
    expect(result.map((row) => row.values.cap)).toEqual([-1, -1, -1]);
  });

  it("applies column decimals to existing values", () => {
    const result = applyColumnDecimals({
      rows: [
        { level: 1, values: { production: 0.12345 } },
        { level: 2, values: { production: 1.98765 } },
      ],
      columnId: "production",
      decimals: 2,
    });
    expect(result.map((row) => row.values.production)).toEqual([0.12, 1.99]);
  });

  it("uses column decimals during generation", () => {
    const result = generateProgressionColumnValues({
      rows: baseRows,
      columnId: "production",
      startLevel: 1,
      generator: { mode: "linear", base: 0.1, step: 0.1 },
      decimals: 1,
    });
    expect(result.map((row) => row.values.production)).toEqual([0.1, 0.2, 0.3]);
  });

  it("generates formula values using base, level and delta variables", () => {
    const result = generateProgressionColumnValues({
      rows: baseRows,
      columnId: "upgradeCost",
      startLevel: 1,
      generator: { mode: "formula", baseColumnId: "production", expression: "base * 2 + delta + level" },
    });
    expect(result.map((row) => row.values.upgradeCost)).toEqual([11, 17, 23]);
  });

  it("applies decimals when generating formula values", () => {
    const result = generateProgressionColumnValues({
      rows: baseRows,
      columnId: "upgradeCost",
      startLevel: 1,
      generator: { mode: "formula", baseColumnId: "production", expression: "base / 3" },
      decimals: 2,
    });
    expect(result.map((row) => row.values.upgradeCost)).toEqual([1.67, 2.33, 3]);
  });

  it("returns zero values when formula expression is invalid", () => {
    const result = generateProgressionColumnValues({
      rows: baseRows,
      columnId: "upgradeCost",
      startLevel: 1,
      generator: { mode: "formula", baseColumnId: "production", expression: "base + foo" },
    });
    expect(result.map((row) => row.values.upgradeCost)).toEqual([0, 0, 0]);
  });

  it("follows column order for formula dependencies in generateAll", () => {
    const rows = baseRows.map((row) => ({
      ...row,
      values: { ...row.values, upgradeCost: 0, totalCost: 0 },
    }));

    const formulaAfterBase = generateAllProgressionColumnValues({
      rows,
      startLevel: 1,
      columns: [
        { id: "upgradeCost", name: "Custo", generator: { mode: "linear", base: 10, step: 5 } },
        {
          id: "totalCost",
          name: "Custo total",
          generator: { mode: "formula", baseColumnId: "upgradeCost", expression: "base * 1.1" },
        },
      ],
    });

    expect(formulaAfterBase.map((row) => row.values.upgradeCost)).toEqual([10, 15, 20]);
    expect(formulaAfterBase.map((row) => row.values.totalCost)).toEqual([11, 17, 22]);

    const formulaBeforeBase = generateAllProgressionColumnValues({
      rows,
      startLevel: 1,
      columns: [
        {
          id: "totalCost",
          name: "Custo total",
          generator: { mode: "formula", baseColumnId: "upgradeCost", expression: "base * 1.1" },
        },
        { id: "upgradeCost", name: "Custo", generator: { mode: "linear", base: 10, step: 5 } },
      ],
    });

    expect(formulaBeforeBase.map((row) => row.values.totalCost)).toEqual([0, 0, 0]);
    expect(formulaBeforeBase.map((row) => row.values.upgradeCost)).toEqual([10, 15, 20]);
  });

  it("supports advanced formula functions", () => {
    const result = generateProgressionColumnValues({
      rows: baseRows,
      columnId: "upgradeCost",
      startLevel: 1,
      generator: {
        mode: "formula",
        baseColumnId: "production",
        expression: "max(10, min(pow(base, 2), 80)) + abs(delta - 2)",
      },
    });
    expect(result.map((row) => row.values.upgradeCost)).toEqual([27, 50, 80]);
  });

  it("supports round/floor/ceil in formulas", () => {
    const result = generateProgressionColumnValues({
      rows: baseRows,
      columnId: "upgradeCost",
      startLevel: 1,
      generator: {
        mode: "formula",
        baseColumnId: "production",
        expression: "round(base / 3, 1) + floor(level / 2) + ceil(delta / 2)",
      },
      decimals: 1,
    });
    expect(result.map((row) => row.values.upgradeCost)).toEqual([1.7, 4.3, 5]);
  });

  it("clamps generated values with min/max", () => {
    const result = generateProgressionColumnValues({
      rows: baseRows,
      columnId: "upgradeCost",
      startLevel: 1,
      generator: { mode: "linear", base: 2, step: 5 },
      min: 5,
      max: 10,
    });
    expect(result.map((row) => row.values.upgradeCost)).toEqual([5, 7, 10]);
  });

  it("treats swapped min/max bounds as normalized range", () => {
    const result = applyColumnClamp({
      rows: [
        { level: 1, values: { production: 2 } },
        { level: 2, values: { production: 7 } },
        { level: 3, values: { production: 15 } },
      ],
      columnId: "production",
      min: 10,
      max: 5,
    });
    expect(result.map((row) => row.values.production)).toEqual([5, 7, 10]);
  });

  it("applies clamp when changing column decimals", () => {
    const result = applyColumnDecimals({
      rows: [
        { level: 1, values: { production: 1.234 } },
        { level: 2, values: { production: 9.991 } },
      ],
      columnId: "production",
      decimals: 2,
      min: 2,
      max: 8,
    });
    expect(result.map((row) => row.values.production)).toEqual([2, 8]);
  });

  it("returns zero for non-finite formula results", () => {
    const result = generateProgressionColumnValues({
      rows: baseRows,
      columnId: "upgradeCost",
      startLevel: 1,
      generator: {
        mode: "formula",
        baseColumnId: "production",
        expression: "pow(10, 1000)",
      },
    });
    expect(result.map((row) => row.values.upgradeCost)).toEqual([0, 0, 0]);
  });

});
