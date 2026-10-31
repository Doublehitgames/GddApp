/**
 * A conferência da coleção: falta, número torto, ref quebrada, coluna fora da
 * regra, quem está na ponta — e a página nova que nasce com as tabelas certas.
 */

import {
  auditPage,
  columnExtremes,
  extremeKey,
  groupIssues,
  rankShifts,
  refIndex,
  ruleScaffoldMarkdown,
} from "@/lib/library/audit";
import { inferTableRule, readPageTables } from "@/lib/tableRule/read";
import type { TableRule } from "@/lib/tableRule/tableRule";

const rule: TableRule = {
  tables: [
    {
      name: "Cultivo",
      columns: [
        { name: "Crescimento", type: "number", unit: "s", required: true },
        { name: "Colheita", type: "number" },
      ],
    },
    { name: "Drop", columns: [{ name: "Fonte", type: "page", required: true }] },
    {
      name: "Ingredientes",
      multiRow: true,
      columns: [
        { name: "Item", type: "page", required: true },
        { name: "Quantidade", type: "number", required: true },
      ],
    },
  ],
};

const page = (id: string, title: string, ...tables: string[]) => ({ id, title, content: tables.join("\n\n") });
const cultivo = (grow: string, harvest = "8") =>
  ["## Cultivo", "", "| Crescimento (s) | Colheita |", "| --- | --- |", `| ${grow} | ${harvest} |`].join("\n");

const trigo = page("a", "Trigo", cultivo("60"));
const nabo = page("b", "Nabo", cultivo("90"));
const index = refIndex([trigo, nabo, { id: "m", title: "Moita" }]);

describe("auditPage", () => {
  it("página certa não acusa nada, e tabela ausente é 'não se aplica'", () => {
    expect(auditPage(rule, trigo, index).issues).toEqual([]);
  });

  it("acusa falta, número torto, ref quebrada e coluna fora da regra", () => {
    const torta = page(
      "c",
      "Torta",
      ["## Cultivo", "", "| Crescimento (s) | Colheta |", "| --- | --- |", "| rápido | 8 |"].join("\n"),
      ["## Drop", "", "| Fonte |", "| --- |", "| $[Moita Velha] |"].join("\n"),
    );
    const kinds = auditPage(rule, torta, index).issues.map((i) => [i.kind, i.column]);
    expect(kinds).toEqual(
      expect.arrayContaining([
        ["notNumber", "Crescimento"],
        ["brokenRef", "Fonte"],
        ["unknownColumn", "Colheta"],
      ]),
    );
  });

  it("ref resolve sem caixa e por uuid legado", () => {
    const ok = page("d", "Ok", ["## Drop", "", "| Fonte |", "| --- |", "| $[moita] e $[#a] |"].join("\n"));
    expect(auditPage(rule, ok, index).issues).toEqual([]);
  });

  it("em tabela de várias linhas, cada linha conta e leva o nome dela", () => {
    const receita = page(
      "e",
      "Pão",
      ["## Ingredientes", "", "| Item | Quantidade |", "| --- | --- |", "| $[Trigo] | 2 |", "| $[Nabo] |  |"].join("\n"),
    );
    expect(auditPage(rule, receita, index).issues).toEqual([
      { kind: "missing", table: "Ingredientes", column: "Quantidade", rowKey: "Nabo" },
    ]);
  });
});

describe("groupIssues", () => {
  it("junta a mesma falta de várias páginas, falta antes de erro", () => {
    const vazia = (id: string) => page(id, id, ["## Cultivo", "", "| Crescimento (s) | Colheita |", "| --- | --- |", "|  | x |"].join("\n"));
    const audits = [auditPage(rule, vazia("x"), index), auditPage(rule, vazia("y"), index)];
    const groups = groupIssues(rule, audits);
    expect(groups.map((g) => [g.kind, g.column, g.pages.length])).toEqual([
      ["missing", "Crescimento", 2],
      ["notNumber", "Colheita", 2],
    ]);
  });
});

describe("pontas", () => {
  it("acha o maior e o menor; empate não tem dono", () => {
    const now = columnExtremes(rule, [trigo, nabo, page("f", "Milho", cultivo("90"))]);
    expect(now[extremeKey("Cultivo", "Crescimento")]).toEqual({ max: null, min: "a" });
  });

  it("avisa só quando a ponta troca de dono", () => {
    const before = columnExtremes(rule, [trigo, nabo]);
    const after = columnExtremes(rule, [page("a", "Trigo", cultivo("120")), nabo]);
    expect(rankShifts(rule, before, after).map((s) => [s.column, s.end, s.before, s.now])).toEqual([
      ["Crescimento", "max", "b", "a"],
      ["Crescimento", "min", "a", "b"],
    ]);
    expect(rankShifts(rule, before, before)).toEqual([]);
  });
});

describe("ruleScaffoldMarkdown", () => {
  it("dá uma tabela vazia por tabela da regra, com o cabeçalho que a regra lê", () => {
    const md = ruleScaffoldMarkdown(rule);
    expect(readPageTables({ content: md }).map((t) => [t.name, t.headers])).toEqual([
      ["Cultivo", ["Crescimento (s)", "Colheita"]],
      ["Drop", ["Fonte"]],
      ["Ingredientes", ["Item", "Quantidade"]],
    ]);
    // A página nova nasce com falta onde a regra exige, não com coluna fantasma.
    const kinds = auditPage(rule, { id: "n", title: "Nova", content: md }, index).issues.map((i) => i.kind);
    expect(kinds).not.toContain("unknownColumn");
    expect(kinds).toContain("missing");
    expect(inferTableRule([{ content: md }])?.tables.map((t) => t.name)).toEqual(["Cultivo", "Drop", "Ingredientes"]);
  });
});
