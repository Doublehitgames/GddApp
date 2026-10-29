/**
 * Tabela de várias linhas: a primeira coluna dá nome à linha, e a comparação
 * entre páginas acontece numa linha escolhida — "Quantidade de Trigo".
 */

import { parseTableRule } from "@/lib/tableRule/tableRule";
import { tableRuleSchema } from "@/lib/api/v1/schemas";
import {
  compareCells,
  inferTableRule,
  multiRowColumns,
  multiRowKeys,
  multiRowTables,
  readMultiTable,
  readRow,
  ruleColumns,
  type CellValue,
} from "@/lib/tableRule/read";

const receita = (nivel: number, ingredientes: Array<[string, number]>) => ({
  content: [
    "Texto da receita.",
    "",
    "## Produção",
    "",
    "| Nível | Tempo (s) |",
    "| --- | --- |",
    `| ${nivel} | 180 |`,
    "",
    "## Ingredientes",
    "",
    "| Ingrediente | Quantidade |",
    "| --- | --- |",
    ...ingredientes.map(([nome, q]) => `| $[${nome}] | ${q} |`),
  ].join("\n"),
});

const farinha = receita(37, [["Farelo de Trigo", 3]]);
const bolo = receita(12, [["Trigo", 2], ["Ovo de Galinha", 3]]);
const pao = receita(5, [["Trigo", 5]]);

const RULE = parseTableRule({
  tables: [
    { name: "Produção", columns: [{ name: "Nível", type: "number", required: true }, { name: "Tempo", unit: "s", type: "number" }] },
    { name: "Ingredientes", multiRow: true, columns: [{ name: "Ingrediente", type: "page", required: true }, { name: "Quantidade", type: "number", required: true }] },
  ],
})!;

describe("a regra guarda multiRow", () => {
  it("parse mantém só o true, e a API aceita", () => {
    expect(RULE.tables[1].multiRow).toBe(true);
    expect(RULE.tables[0]).not.toHaveProperty("multiRow");
    const loose = parseTableRule({ tables: [{ name: "A", multiRow: "sim", columns: [{ name: "x" }] }] });
    expect(loose?.tables[0]).not.toHaveProperty("multiRow");
    expect(tableRuleSchema.safeParse(RULE).success).toBe(true);
  });
});

describe("inferTableRule com várias linhas", () => {
  it("marca a tabela que tem mais de uma linha em alguma página", () => {
    const rule = inferTableRule([farinha, bolo])!;
    expect(rule.tables.map((t) => [t.name, !!t.multiRow])).toEqual([["Produção", false], ["Ingredientes", true]]);
    expect(rule.tables[1].columns).toEqual([
      { name: "Ingrediente", type: "page", required: true },
      { name: "Quantidade", type: "number", required: true },
    ]);
  });
});

describe("leitura", () => {
  it("as colunas de uma linha não incluem a tabela de várias linhas", () => {
    expect(ruleColumns(RULE).map((c) => c.column.name)).toEqual(["Nível", "Tempo"]);
    expect(multiRowTables(RULE)).toEqual([1]);
  });

  it("os nomes de linha somam todas as páginas, sem repetir e sem o $[ ]", () => {
    expect(multiRowKeys(RULE, 1, [farinha, bolo, pao])).toEqual(["Farelo de Trigo", "Trigo", "Ovo de Galinha"]);
  });

  it("lê o valor numa linha escolhida; página sem a linha não se aplica", () => {
    const [quantidade] = multiRowColumns(RULE, 1, "Trigo");
    expect(quantidade.column.name).toBe("Quantidade");
    expect(readRow(RULE, bolo, [quantidade])).toEqual([{ kind: "value", raw: "2", number: 2 }]);
    expect(readRow(RULE, farinha, [quantidade])).toEqual([{ kind: "absent" }]);
    expect(readRow(RULE, { content: "Sem tabela." }, [quantidade])).toEqual([{ kind: "absent" }]);
  });

  it("acha a linha com ou sem a referência, e sem caixa", () => {
    const [quantidade] = multiRowColumns(RULE, 1, "$[trigo]");
    expect(readRow(RULE, pao, [quantidade])[0]).toMatchObject({ raw: "5" });
  });

  it("ordena as receitas pela quantidade de Trigo, com quem não leva Trigo no fim", () => {
    const [quantidade] = multiRowColumns(RULE, 1, "Trigo");
    const paginas = [{ n: "farinha", p: farinha }, { n: "bolo", p: bolo }, { n: "pão", p: pao }];
    const cell = (p: typeof farinha): CellValue => readRow(RULE, p, [quantidade])[0];
    const desc = [...paginas].sort((a, b) => compareCells(cell(a.p), cell(b.p), "number", -1)).map((x) => x.n);
    expect(desc).toEqual(["pão", "bolo", "farinha"]);
  });

  it("devolve a tabela inteira para o painel", () => {
    const rows = readMultiTable(RULE, 1, bolo)!;
    expect(rows.map((r) => r.map((c) => (c.kind === "value" ? c.raw : c.kind)))).toEqual([
      ["$[Trigo]", "2"],
      ["$[Ovo de Galinha]", "3"],
    ]);
    expect(readMultiTable(RULE, 1, { content: "Nada." })).toBeNull();
  });
});
