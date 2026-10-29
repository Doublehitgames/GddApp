/**
 * Regra de tabelas — o que uma página-mãe diz sobre as tabelas das filhas.
 *
 * O número de balanceamento mora numa tabela dentro da descrição de cada
 * filha, com um `## Nome` em cima. Sem regra, a identidade da tabela é o texto
 * desse cabeçalho, digitado à mão em cada página: um typo em uma das 36 cria
 * uma tabela fantasma. A regra é a lista canônica contra a qual a tela casa.
 *
 * O que ela NÃO é:
 * - Não é onde o dado mora. Apagar a regra deixa todas as tabelas de pé no
 *   markdown, no export, no Doc, no Deck e no MCP — ela só ensina a ler.
 * - Não é contrato com o jogo. Ninguém exporta por ela.
 * - Não sabe do que a coleção é. Nome de tabela e de coluna é texto que o
 *   usuário digita; o código não conhece "semente" nem "preço".
 *
 * "Tipo" é dica de leitura: a célula continua texto no markdown. `page` é uma
 * célula com `$[Título]` dentro, o sistema de referência que já existe.
 */

export type TableColumnType = "number" | "text" | "boolean" | "page";

export const TABLE_COLUMN_TYPES: readonly TableColumnType[] = ["number", "text", "boolean", "page"] as const;

export type TableRuleColumn = {
  /** O texto do cabeçalho da coluna, como aparece na tabela. */
  name: string;
  type: TableColumnType;
  /**
   * Unidade separada do nome ("s", "%", "moedas"). É o que permite formatar o
   * número sem reescrever o cabeçalho que o designer escolheu.
   */
  unit?: string;
  /**
   * Célula vazia nesta coluna é falta. Só vale quando a tabela está na página:
   * tabela ausente quer dizer "não se aplica", e não acusa nada.
   */
  required?: boolean;
};

export type TableRuleTable = {
  /** O que vai no `##` acima da tabela, em cada filha. */
  name: string;
  columns: TableRuleColumn[];
};

/**
 * Objeto e não lista solta: o campo nasce numa coluna JSONB que não se desfaz
 * fácil, e um envelope deixa espaço para crescer sem migração.
 */
export type TableRule = {
  tables: TableRuleTable[];
};

const isType = (value: unknown): value is TableColumnType =>
  TABLE_COLUMN_TYPES.includes(value as TableColumnType);

const cleanName = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Lê o que veio do banco ou do localStorage sem confiar na forma.
 *
 * Coluna sem nome some; tipo desconhecido vira texto, que é a leitura que
 * nunca mente; tabela sem coluna some. Regra que sobra vazia é "sem regra" —
 * `undefined`, como o resto dos campos opcionais da página.
 */
export function parseTableRule(value: unknown): TableRule | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rawTables = (value as { tables?: unknown }).tables;
  if (!Array.isArray(rawTables)) return undefined;

  const tables: TableRuleTable[] = [];
  for (const rawTable of rawTables) {
    if (!rawTable || typeof rawTable !== "object") continue;
    const name = cleanName((rawTable as { name?: unknown }).name);
    const rawColumns = (rawTable as { columns?: unknown }).columns;
    if (!name || !Array.isArray(rawColumns)) continue;

    const columns: TableRuleColumn[] = [];
    for (const rawColumn of rawColumns) {
      if (!rawColumn || typeof rawColumn !== "object") continue;
      const c = rawColumn as Record<string, unknown>;
      const columnName = cleanName(c.name);
      if (!columnName) continue;
      const unit = cleanName(c.unit);
      columns.push({
        name: columnName,
        type: isType(c.type) ? c.type : "text",
        ...(unit ? { unit } : {}),
        ...(c.required === true ? { required: true } : {}),
      });
    }
    if (columns.length > 0) tables.push({ name, columns });
  }

  return tables.length > 0 ? { tables } : undefined;
}

/**
 * A regra que um sync deve deixar no banco, dada a página que o app mandou e
 * a regra que já está lá.
 *
 * Campo AUSENTE quer dizer "este app não sabe" — um localStorage baixado antes
 * da regra existir, ou um bundle antigo — e vale a do banco. Senão a primeira
 * edição qualquer no projeto apagaria em silêncio a regra que um agente gravou
 * pelo MCP. `null` explícito é "tirei a regra", e esse apaga.
 */
export function tableRuleAfterSync(incoming: object, stored: unknown): TableRule | null {
  if (!("tableRule" in incoming)) return parseTableRule(stored) ?? null;
  return parseTableRule((incoming as { tableRule?: unknown }).tableRule) ?? null;
}

/** Casamento de nome como o das refs `$[...]`: sem caixa e sem espaço nas pontas. */
export function sameTableName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/**
 * O texto que a coluna leva no cabeçalho da tabela: `Crescimento (s)`.
 *
 * A unidade fica no cabeçalho porque a tabela tem que se ler sozinha — no
 * export, no Doc, para quem chega por MCP — e separada na regra porque é dela
 * que a tela tira o sufixo para formatar o número.
 */
export function columnHeader(column: Pick<TableRuleColumn, "name" | "unit">): string {
  return column.unit ? `${column.name} (${column.unit})` : column.name;
}

/** O cabeçalho escrito numa página é desta coluna? Aceita com e sem a unidade. */
export function matchesColumnHeader(column: Pick<TableRuleColumn, "name" | "unit">, header: string): boolean {
  return sameTableName(header, columnHeader(column)) || sameTableName(header, column.name);
}
