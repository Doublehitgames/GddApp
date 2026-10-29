/**
 * Ler as tabelas das filhas contra a regra da mãe.
 *
 * Tudo aqui é leitura: o dado continua na descrição de cada página, em tabela
 * comum. Nada é escrito de volta e nada é guardado à parte — apagar a tela da
 * Biblioteca deixa as páginas exatamente como estão.
 */

import {
  matchesColumnHeader,
  sameTableName,
  type TableColumnType,
  type TableRule,
  type TableRuleColumn,
  type TableRuleTable,
} from "./tableRule";

/** Uma tabela como está escrita numa página: o `##` acima dela e as linhas. */
export type PageTable = {
  name: string;
  headers: string[];
  rows: string[][];
};

type PageLike = { content?: string; contentBlocks?: unknown };

// ── Leitura das tabelas de uma página ─────────────────────────────────

type Inline = { type?: string; text?: string; content?: unknown };

function inlineText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) {
    // Célula no formato novo do BlockNote: { type: "tableCell", content: [...] }.
    if (value && typeof value === "object" && "content" in value) return inlineText((value as Inline).content);
    return "";
  }
  return value
    .map((item: Inline) => (typeof item?.text === "string" ? item.text : inlineText(item?.content)))
    .join("");
}

function tablesFromBlocks(blocks: unknown[]): PageTable[] {
  const out: PageTable[] = [];
  let heading = "";
  for (const raw of blocks) {
    const block = raw as { type?: string; content?: unknown };
    if (block?.type === "heading") {
      heading = inlineText(block.content).trim();
      continue;
    }
    if (block?.type !== "table") continue;
    const rows = ((block.content as { rows?: Array<{ cells?: unknown[] }> })?.rows ?? []).map((row) =>
      (row.cells ?? []).map((cell) => inlineText(cell).trim()),
    );
    if (rows.length === 0) continue;
    out.push({ name: heading, headers: rows[0], rows: rows.slice(1) });
  }
  return out;
}

const splitRow = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());

function tablesFromMarkdown(markdown: string): PageTable[] {
  const out: PageTable[] = [];
  const lines = markdown.split(/\r?\n/);
  let heading = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      heading = h[1].trim();
      continue;
    }
    const isRow = (l: string | undefined) => !!l && /^\s*\|.*\|\s*$/.test(l);
    const isSeparator = (l: string | undefined) => !!l && /^\s*\|[\s:|-]+\|\s*$/.test(l);
    if (!isRow(line) || !isSeparator(lines[i + 1])) continue;
    const headers = splitRow(line);
    const rows: string[][] = [];
    let j = i + 2;
    while (isRow(lines[j])) rows.push(splitRow(lines[j++]));
    out.push({ name: heading, headers, rows });
    i = j - 1;
  }
  return out;
}

/**
 * As tabelas de uma página, cada uma com o cabeçalho de seção acima dela. Os
 * blocos ganham do markdown quando existem: é o que o editor grava, e o
 * markdown é o espelho.
 */
export function readPageTables(page: PageLike): PageTable[] {
  const blocks = Array.isArray(page.contentBlocks) ? page.contentBlocks : [];
  const fromBlocks = blocks.length > 0 ? tablesFromBlocks(blocks) : [];
  if (fromBlocks.length > 0) return fromBlocks;
  return tablesFromMarkdown(page.content ?? "");
}

// ── Número escrito à mão ──────────────────────────────────────────────

/**
 * "8,1" → 8.1, "13518" → 13518, "1.234,5" → 1234.5, "13.518" → 13518.
 *
 * O GDD é escrito em português: vírgula é decimal, ponto só aparece como
 * milhar. Um ponto sozinho seguido de exatamente três dígitos é milhar; outro
 * ponto qualquer é decimal (quem escreveu em inglês). O que não é número vira
 * `null` — e é isso que o painel de conferência vai acusar.
 */
export function parseCellNumber(raw: string): number | null {
  let s = raw.trim().replace(/\s+/g, "").replace(/[%]$/, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

const BOOLEAN_WORDS = ["sim", "não", "nao", "yes", "no", "true", "false", "sí", "si"];
const isPageRef = (value: string) => /^\$\[[^\]]+\]$/.test(value.trim());

function guessType(values: string[]): TableColumnType {
  const filled = values.filter((v) => v.trim());
  if (filled.length === 0) return "text";
  if (filled.every((v) => parseCellNumber(v) !== null)) return "number";
  if (filled.every(isPageRef)) return "page";
  if (filled.every((v) => BOOLEAN_WORDS.includes(v.trim().toLocaleLowerCase()))) return "boolean";
  return "text";
}

/** "Crescimento (s)" → nome "Crescimento", unidade "s". Sem parênteses no fim, tudo é nome. */
function splitHeader(header: string): { name: string; unit?: string } {
  const m = header.trim().match(/^(.*\S)\s*\(([^()]{1,20})\)$/);
  return m ? { name: m[1], unit: m[2] } : { name: header.trim() };
}

// ── Regra montada a partir das filhas ─────────────────────────────────

/**
 * Uma regra proposta a partir do que as filhas já escrevem: cada `##` com
 * tabela vira uma tabela da regra, na ordem em que aparece primeiro.
 *
 * É ponto de partida, não verdade: o designer revisa antes de salvar. Mas é o
 * que tira o typo da jogada — as colunas vêm do texto, não da memória.
 * Uma coluna sai exigida quando está preenchida em toda linha de toda página
 * que tem a tabela; tabela que só algumas filhas têm continua opcional,
 * porque ausência de tabela quer dizer "não se aplica". Tabela que tem mais
 * de uma linha em alguma filha sai marcada como de várias linhas.
 */
export function inferTableRule(children: PageLike[]): TableRule | undefined {
  type Draft = { name: string; headers: string[]; columnValues: string[][]; multiRow: boolean };
  const drafts: Draft[] = [];

  for (const child of children) {
    const seen = new Set<string>();
    for (const table of readPageTables(child)) {
      if (!table.name || table.headers.length === 0) continue;
      const key = table.name.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      let draft = drafts.find((d) => sameTableName(d.name, table.name));
      if (!draft) {
        draft = { name: table.name, headers: table.headers, columnValues: table.headers.map(() => []), multiRow: false };
        drafts.push(draft);
      }
      if (table.rows.length > 1) draft.multiRow = true;
      const rows = table.rows.length > 0 ? table.rows : [[]];
      draft.headers.forEach((header, index) => {
        const at = table.headers.findIndex((h) => sameTableName(h, header));
        for (const row of rows) draft!.columnValues[index].push(at >= 0 ? row[at] ?? "" : "");
      });
    }
  }

  const tables = drafts.map((draft) => ({
    name: draft.name,
    columns: draft.headers.map((header, index): TableRuleColumn => {
      const { name, unit } = splitHeader(header);
      const values = draft.columnValues[index];
      const required = values.length > 0 && values.every((v) => v.trim() !== "");
      return { name, type: guessType(values), ...(unit ? { unit } : {}), ...(required ? { required: true } : {}) };
    }),
    ...(draft.multiRow ? { multiRow: true } : {}),
  }));
  return tables.length > 0 ? { tables } : undefined;
}

// ── A coleção lida contra a regra ─────────────────────────────────────

/**
 * O valor de uma célula para a tela.
 * - `absent`: a página não tem essa tabela (ou, numa tabela de várias linhas,
 *   não tem aquela linha) — "não se aplica", não acusa nada.
 * - `empty`: a célula existe e está vazia — falta, se a coluna é exigida.
 */
export type CellValue =
  | { kind: "absent" }
  | { kind: "empty" }
  | { kind: "value"; raw: string; number: number | null };

/**
 * Uma coluna comparável. Numa tabela de várias linhas ela vale numa linha
 * escolhida pelo nome (`rowKey`): "Velocidade" no nível "50".
 */
export type RuleColumnRef = {
  tableIndex: number;
  columnIndex: number;
  table: string;
  column: TableRuleColumn;
  rowKey?: string;
};

/** As colunas das tabelas de uma linha, achatadas na ordem em que a tela as mostra. */
export function ruleColumns(rule: TableRule): RuleColumnRef[] {
  return rule.tables.flatMap((table, tableIndex) =>
    table.multiRow ? [] : table.columns.map((column, columnIndex) => ({ tableIndex, columnIndex, table: table.name, column })),
  );
}

/** Os índices das tabelas de várias linhas da regra. */
export function multiRowTables(rule: TableRule): number[] {
  return rule.tables.flatMap((table, index) => (table.multiRow ? [index] : []));
}

/** Como o nome de uma linha aparece na tela: `$[Trigo]` vira "Trigo". */
export function rowKeyLabel(raw: string): string {
  return raw.trim().replace(/^\$\[(.*)\]$/, "$1").trim();
}

/** O nome de uma linha comparado como as refs: sem caixa, e `$[Trigo]` vale "Trigo". */
const rowKeyNorm = (raw: string) => rowKeyLabel(raw).toLocaleLowerCase();

function findTable(tables: PageTable[], name: string) {
  return tables.find((t) => sameTableName(t.name, name));
}

/** A coluna que dá nome às linhas é a primeira da regra; se o cabeçalho não casar, a primeira da página. */
function keyIndex(found: PageTable, table: TableRuleTable): number {
  const at = found.headers.findIndex((h) => matchesColumnHeader(table.columns[0], h));
  return at >= 0 ? at : 0;
}

/**
 * Os nomes de linha de uma tabela de várias linhas, somando todas as páginas,
 * na ordem em que aparecem primeiro. São as opções de "comparar em".
 */
export function multiRowKeys(rule: TableRule, tableIndex: number, pages: PageLike[]): string[] {
  const table = rule.tables[tableIndex];
  const seen = new Map<string, string>();
  for (const page of pages) {
    const found = findTable(readPageTables(page), table.name);
    if (!found) continue;
    const at = keyIndex(found, table);
    for (const row of found.rows) {
      const raw = (row[at] ?? "").trim();
      if (raw && !seen.has(rowKeyNorm(raw))) seen.set(rowKeyNorm(raw), rowKeyLabel(raw));
    }
  }
  return [...seen.values()];
}

/** As colunas de valor de uma tabela de várias linhas (todas menos a do nome), numa linha. */
export function multiRowColumns(rule: TableRule, tableIndex: number, rowKey: string): RuleColumnRef[] {
  const table = rule.tables[tableIndex];
  return table.columns.slice(1).map((column, i) => ({ tableIndex, columnIndex: i + 1, table: table.name, column, rowKey }));
}

function cellOf(raw: string, column: TableRuleColumn): CellValue {
  const value = raw.trim();
  if (!value) return { kind: "empty" };
  return { kind: "value", raw: value, number: column.type === "number" ? parseCellNumber(value) : null };
}

/** Uma célula de uma página, com as tabelas dela já lidas. */
export function readCell(rule: TableRule, tables: PageTable[], ref: RuleColumnRef): CellValue {
  const table = rule.tables[ref.tableIndex];
  const found = findTable(tables, table.name);
  if (!found) return { kind: "absent" };
  const at = found.headers.findIndex((h) => matchesColumnHeader(ref.column, h));
  if (ref.rowKey === undefined) return at >= 0 ? cellOf(found.rows[0]?.[at] ?? "", ref.column) : { kind: "empty" };
  // Página sem aquela linha: a receita que não leva Trigo não está "faltando" Trigo.
  const k = keyIndex(found, table);
  const row = found.rows.find((r) => rowKeyNorm(r[k] ?? "") === rowKeyNorm(ref.rowKey!));
  if (!row) return { kind: "absent" };
  return at >= 0 ? cellOf(row[at] ?? "", ref.column) : { kind: "empty" };
}

/** Os valores de uma página nas colunas pedidas (por padrão, as das tabelas de uma linha). */
export function readRow(rule: TableRule, page: PageLike, refs: RuleColumnRef[] = ruleColumns(rule)): CellValue[] {
  const tables = readPageTables(page);
  return refs.map((ref) => readCell(rule, tables, ref));
}

/**
 * Uma tabela de várias linhas inteira, coluna por coluna da regra — para o
 * painel da página. `null` quando a página não tem a tabela.
 */
export function readMultiTable(rule: TableRule, tableIndex: number, page: PageLike): CellValue[][] | null {
  const table = rule.tables[tableIndex];
  const found = findTable(readPageTables(page), table.name);
  if (!found) return null;
  const at = table.columns.map((c) => found.headers.findIndex((h) => matchesColumnHeader(c, h)));
  return found.rows.map((row) =>
    table.columns.map((c, i): CellValue => (at[i] >= 0 ? cellOf(row[at[i]] ?? "", c) : { kind: "empty" })),
  );
}

/**
 * Comparação para ordenar uma coluna. Valor vem antes de vazio, vazio antes
 * de "não se aplica", nos dois sentidos — quem ordena por preço quer ver os
 * preços, não as páginas que não têm preço.
 */
export function compareCells(a: CellValue, b: CellValue, type: TableColumnType, direction: 1 | -1): number {
  const rank = (c: CellValue) => (c.kind === "value" ? 0 : c.kind === "empty" ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.kind !== "value" || b.kind !== "value") return 0;
  if (type === "number" && a.number !== null && b.number !== null) return (a.number - b.number) * direction;
  // Número que não parseou vai pro fim do bloco de valores: é o que precisa de conserto.
  if (type === "number" && (a.number === null) !== (b.number === null)) return a.number === null ? 1 : -1;
  return a.raw.localeCompare(b.raw, undefined, { numeric: true, sensitivity: "base" }) * direction;
}
