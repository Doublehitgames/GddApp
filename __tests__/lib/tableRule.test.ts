/**
 * A regra de tabelas da página-mãe: o que se lê de volta, o que a API aceita
 * e a forma em que ela é gravada — a mesma que o sync compara, para que a
 * escrita de um agente não pareça mudança (e custe crédito) no sync seguinte.
 */

import {
  columnHeader,
  matchesColumnHeader,
  parseTableRule,
  tableRuleAfterSync,
} from "@/lib/tableRule/tableRule";
import { tableRuleSchema, updateSectionSchema } from "@/lib/api/v1/schemas";
import { buildSectionUpdates } from "@/lib/api/v1/sectionWrite";
import { sectionFull, sectionRow } from "@/lib/mcp/project";

/** A regra das sementes do Granjita, como ela vai ser gravada. */
const SEMENTES = {
  tables: [
    {
      name: "Economia",
      columns: [
        { name: "Lv de desbloqueio", type: "number", required: true },
        { name: "Compra", type: "number", required: true },
        { name: "Venda", type: "number", required: true },
      ],
    },
    {
      name: "Cultivo",
      columns: [
        { name: "Crescimento", type: "number", unit: "s", required: true },
        { name: "Colheita", type: "number", required: true },
        { name: "XP na colheita", type: "number", required: true },
      ],
    },
    {
      name: "Drop no Bosque",
      columns: [
        { name: "Fonte", type: "page", required: true },
        { name: "Chance", type: "number", unit: "%", required: true },
        { name: "Mín", type: "number" },
        { name: "Máx", type: "number" },
      ],
    },
  ],
};

describe("parseTableRule", () => {
  it("devolve a regra boa como veio", () => {
    expect(parseTableRule(SEMENTES)).toEqual(SEMENTES);
  });

  it("não é regra: null, lixo, lista vazia", () => {
    expect(parseTableRule(null)).toBeUndefined();
    expect(parseTableRule("Economia")).toBeUndefined();
    expect(parseTableRule({ tables: [] })).toBeUndefined();
    expect(parseTableRule([{ name: "Economia" }])).toBeUndefined();
  });

  it("descarta o que não tem nome e lê tipo desconhecido como texto", () => {
    const rule = parseTableRule({
      tables: [
        { name: "  ", columns: [{ name: "A", type: "number" }] },
        {
          name: " Economia ",
          columns: [{ name: "" }, { name: "Compra", type: "moeda", unit: "", required: false }],
        },
        { name: "Sem colunas", columns: [] },
      ],
    });
    expect(rule).toEqual({ tables: [{ name: "Economia", columns: [{ name: "Compra", type: "text" }] }] });
  });
});

describe("cabeçalho da coluna", () => {
  const crescimento = { name: "Crescimento", unit: "s" };

  it("leva a unidade entre parênteses, como as páginas já escrevem", () => {
    expect(columnHeader(crescimento)).toBe("Crescimento (s)");
    expect(columnHeader({ name: "Compra" })).toBe("Compra");
  });

  it("casa com e sem a unidade, sem caixa", () => {
    expect(matchesColumnHeader(crescimento, "Crescimento (s)")).toBe(true);
    expect(matchesColumnHeader(crescimento, "crescimento")).toBe(true);
    expect(matchesColumnHeader(crescimento, "Crescimento (min)")).toBe(false);
  });
});

describe("tableRuleAfterSync", () => {
  it("campo ausente é 'este app não sabe': preserva a regra do banco", () => {
    // O localStorage de quem baixou o projeto antes do agente gravar a regra.
    expect(tableRuleAfterSync({ id: "x", title: "Sementes" }, SEMENTES)).toEqual(SEMENTES);
  });

  it("null explícito é 'tirei a regra': apaga", () => {
    expect(tableRuleAfterSync({ id: "x", tableRule: null }, SEMENTES)).toBeNull();
  });

  it("regra mandada pelo app ganha da do banco", () => {
    const nova = { tables: [SEMENTES.tables[0]] };
    expect(tableRuleAfterSync({ id: "x", tableRule: nova }, SEMENTES)).toEqual(nova);
  });
});

describe("tableRuleSchema", () => {
  it("aceita a regra das sementes", () => {
    expect(tableRuleSchema.safeParse(SEMENTES).success).toBe(true);
  });

  it("recusa tabela repetida — o nome é a identidade dela", () => {
    const repetida = { tables: [SEMENTES.tables[0], { ...SEMENTES.tables[1], name: "economia" }] };
    expect(tableRuleSchema.safeParse(repetida).success).toBe(false);
  });

  it("recusa coluna repetida dentro da mesma tabela", () => {
    const rule = { tables: [{ name: "Economia", columns: [{ name: "Compra", type: "number" }, { name: "Compra ", type: "text" }] }] };
    expect(tableRuleSchema.safeParse(rule).success).toBe(false);
  });

  it("recusa tipo fora da lista", () => {
    const rule = { tables: [{ name: "Economia", columns: [{ name: "Compra", type: "currency" }] }] };
    expect(tableRuleSchema.safeParse(rule).success).toBe(false);
  });

  it("null tira a regra pelo PATCH", () => {
    expect(updateSectionSchema.parse({ tableRule: null }).tableRule).toBeNull();
  });
});

describe("buildSectionUpdates com tableRule", () => {
  const CTX = { userId: "user-1", now: "2026-10-29T12:00:00Z" };

  it("grava na forma que o app lê de volta", () => {
    const fields = updateSectionSchema.parse({
      tableRule: { tables: [{ name: "Economia", columns: [{ name: "Compra", type: "number", unit: "", required: false }] }] },
    });
    const { updates, touched } = buildSectionUpdates(fields, CTX);
    expect(updates.table_rule).toEqual({ tables: [{ name: "Economia", columns: [{ name: "Compra", type: "number" }] }] });
    expect(touched).toEqual(["tableRule"]);
  });

  it("null apaga a regra e nada mais", () => {
    const { updates } = buildSectionUpdates({ tableRule: null }, CTX);
    expect(updates.table_rule).toBeNull();
    expect(updates).not.toHaveProperty("content");
    expect(updates).not.toHaveProperty("content_blocks");
  });

  it("sem o campo, a coluna não é tocada", () => {
    const { updates } = buildSectionUpdates({ title: "Sementes" }, CTX);
    expect(updates).not.toHaveProperty("table_rule");
  });
});

describe("a regra no MCP", () => {
  it("a listagem marca a página-mãe com um bit", () => {
    expect(sectionRow({ id: "a", title: "Sementes", tableRule: SEMENTES })).toMatchObject({ hasTableRule: true });
    expect(sectionRow({ id: "b", title: "Galinha", tableRule: null })).not.toHaveProperty("hasTableRule");
  });

  it("a leitura traz a regra inteira, e cala quando não há", () => {
    expect(sectionFull({ id: "a", tableRule: SEMENTES }).tableRule).toEqual(SEMENTES);
    expect(sectionFull({ id: "b", tableRule: null })).not.toHaveProperty("tableRule");
  });
});
