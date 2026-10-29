/**
 * Ler as tabelas das filhas: dos blocos e do markdown, inferir a regra a partir
 * do que já está escrito, e ordenar número escrito em português.
 */

import {
  compareCells,
  inferTableRule,
  parseCellNumber,
  readPageTables,
  readRow,
  type CellValue,
} from "@/lib/tableRule/read";

/** Uma semente como está no Granjita, em markdown. */
const lavanda = {
  content: [
    "Semente de flor. Vem da $[Moita Nv2].",
    "",
    "## Economia",
    "",
    "| Lv de desbloqueio | Compra | Venda |",
    "| --- | --- | --- |",
    "| 38 | 10512 | 5256 |",
    "",
    "## Cultivo",
    "",
    "| Crescimento (s) | Colheita | XP na colheita |",
    "| --- | --- | --- |",
    "| 88 | 8 | 30 |",
    "",
    "## Drop no Bosque",
    "",
    "| Fonte | Chance (%) | Mín | Máx |",
    "| --- | --- | --- | --- |",
    "| $[Moita Nv2] | 7,0 | 1 | 2 |",
  ].join("\n"),
};

/** Uma semente de loja: sem a tabela de Drop. */
const nabo = {
  content: [
    "## Economia",
    "| Lv de desbloqueio | Compra | Venda |",
    "| --- | --- | --- |",
    "| 1 | 10 | 5 |",
    "## Cultivo",
    "| Crescimento (s) | Colheita | XP na colheita |",
    "| --- | --- | --- |",
    "| 30 | 2 | 1 |",
  ].join("\n"),
};

describe("readPageTables", () => {
  it("lê as tabelas do markdown com o ## acima de cada uma", () => {
    const tables = readPageTables(lavanda);
    expect(tables.map((t) => t.name)).toEqual(["Economia", "Cultivo", "Drop no Bosque"]);
    expect(tables[1].headers).toEqual(["Crescimento (s)", "Colheita", "XP na colheita"]);
    expect(tables[2].rows[0]).toEqual(["$[Moita Nv2]", "7,0", "1", "2"]);
  });

  it("prefere os blocos quando existem, nos dois formatos de célula", () => {
    const text = (t: string) => [{ type: "text", text: t }];
    const tables = readPageTables({
      content: "ignorado",
      contentBlocks: [
        { type: "heading", props: { level: 2 }, content: text("Economia") },
        {
          type: "table",
          content: {
            type: "tableContent",
            rows: [
              { cells: [text("Compra"), { type: "tableCell", content: text("Venda") }] },
              { cells: [text("10"), { type: "tableCell", content: text("5") }] },
            ],
          },
        },
      ],
    });
    expect(tables).toEqual([{ name: "Economia", headers: ["Compra", "Venda"], rows: [["10", "5"]] }]);
  });
});

describe("parseCellNumber", () => {
  it.each([
    ["8,1", 8.1],
    ["13518", 13518],
    ["13.518", 13518],
    ["1.234,5", 1234.5],
    ["7,0", 7],
    ["0.5", 0.5],
    ["-3", -3],
    ["12 %", 12],
  ])("%s → %s", (raw, expected) => {
    expect(parseCellNumber(raw)).toBe(expected);
  });

  it.each(["", "—", "dez", "$[Moita Nv2]", "1-2"])("'%s' não é número", (raw) => {
    expect(parseCellNumber(raw)).toBeNull();
  });
});

describe("inferTableRule", () => {
  it("monta a regra das sementes a partir das páginas", () => {
    const rule = inferTableRule([lavanda, nabo]);
    expect(rule?.tables.map((t) => t.name)).toEqual(["Economia", "Cultivo", "Drop no Bosque"]);
    expect(rule?.tables[1].columns[0]).toEqual({ name: "Crescimento", type: "number", unit: "s", required: true });
    expect(rule?.tables[2].columns[0]).toEqual({ name: "Fonte", type: "page", required: true });
    expect(rule?.tables[2].columns[1]).toEqual({ name: "Chance", type: "number", unit: "%", required: true });
  });

  it("coluna vazia em alguma página não sai exigida", () => {
    const furada = { content: "## Economia\n| Lv de desbloqueio | Compra | Venda |\n| --- | --- | --- |\n| 2 |  | 4 |" };
    const rule = inferTableRule([nabo, furada]);
    expect(rule?.tables[0].columns[1]).toEqual({ name: "Compra", type: "number" });
  });

  it("filhas sem tabela não propõem regra", () => {
    expect(inferTableRule([{ content: "Só texto." }])).toBeUndefined();
  });
});

describe("readRow", () => {
  const rule = inferTableRule([lavanda, nabo])!;

  it("separa 'não se aplica' de valor", () => {
    const row = readRow(rule, nabo);
    // Economia (3) + Cultivo (3) + Drop (4): o Drop do nabo não existe.
    expect(row.slice(6).every((c) => c.kind === "absent")).toBe(true);
    expect(row[3]).toEqual({ kind: "value", raw: "30", number: 30 });
  });

  it("acha a coluna com ou sem a unidade no cabeçalho", () => {
    const semUnidade = { content: "## Cultivo\n| Crescimento | Colheita | XP na colheita |\n| --- | --- | --- |\n| 40 | 3 | 2 |" };
    expect(readRow(rule, semUnidade)[3]).toEqual({ kind: "value", raw: "40", number: 40 });
  });
});

describe("compareCells", () => {
  const v = (raw: string): CellValue => ({ kind: "value", raw, number: parseCellNumber(raw) });
  const sort = (cells: CellValue[], dir: 1 | -1) => [...cells].sort((a, b) => compareCells(a, b, "number", dir));
  const label = (c: CellValue) => (c.kind === "value" ? c.raw : c.kind);

  it("ordena número de verdade, não texto", () => {
    expect(sort([v("10512"), v("8,1"), v("88")], 1).map(label)).toEqual(["8,1", "88", "10512"]);
  });

  it("vazio e 'não se aplica' ficam no fim nos dois sentidos", () => {
    const cells: CellValue[] = [{ kind: "absent" }, v("2"), { kind: "empty" }, v("5")];
    expect(sort(cells, 1).map(label)).toEqual(["2", "5", "empty", "absent"]);
    expect(sort(cells, -1).map(label)).toEqual(["5", "2", "empty", "absent"]);
  });
});
