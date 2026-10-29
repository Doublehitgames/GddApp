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
 * Uma coluna sai exigida quando está preenchida em toda página que tem a
 * tabela; tabela que só algumas filhas têm continua opcional, porque ausência
 * de tabela quer dizer "não se aplica".
 */
export function inferTableRule(children: PageLike[]): TableRule | undefined {
  type Draft = { name: string; headers: string[]; columnValues: string[][]; pages: number };
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
        draft = { name: table.name, headers: table.headers, columnValues: table.headers.map(() => []), pages: 0 };
        drafts.push(draft);
      }
      draft.pages += 1;
      draft.headers.forEach((header, index) => {
        const at = table.headers.findIndex((h) => sameTableName(h, header));
        const cell = at >= 0 ? table.rows[0]?.[at] ?? "" : "";
        draft!.columnValues[index].push(cell);
      });
    }
  }

  const tables = drafts.map((draft) => ({
    name: draft.name,
    columns: draft.headers.map((header, index): TableRuleColumn => {
      const { name, unit } = splitHeader(header);
      const values = draft.columnValues[index];
      const required = values.length === draft.pages && values.every((v) => v.trim() !== "");
      return { name, type: guessType(values), ...(unit ? { unit } : {}), ...(required ? { required: true } : {}) };
    }),
  }));
  return tables.length > 0 ? { tables } : undefined;
}

// ── A coleção lida contra a regra ─────────────────────────────────────

/**
 * O valor de uma célula para a tela.
 * - `absent`: a página não tem essa tabela — "não se aplica", não acusa nada.
 * - `empty`: a tabela está lá e a célula não — falta, se a coluna é exigida.
 */
export type CellValue =
  | { kind: "absent" }
  | { kind: "empty" }
  | { kind: "value"; raw: string; number: number | null };

export type RuleColumnRef = { tableIndex: number; columnIndex: number; table: string; column: TableRuleColumn };

/** As colunas da regra, achatadas na ordem em que a tela as mostra. */
export function ruleColumns(rule: TableRule): RuleColumnRef[] {
  return rule.tables.flatMap((table, tableIndex) =>
    table.columns.map((column, columnIndex) => ({ tableIndex, columnIndex, table: table.name, column })),
  );
}

/** Os valores de uma página, um por coluna da regra, na ordem de `ruleColumns`. */
export function readRow(rule: TableRule, page: PageLike): CellValue[] {
  const tables = readPageTables(page);
  return ruleColumns(rule).map(({ table, column }) => {
    const found = tables.find((t) => sameTableName(t.name, table));
    if (!found) return { kind: "absent" };
    const at = found.headers.findIndex((h) => matchesColumnHeader(column, h));
    const raw = at >= 0 ? (found.rows[0]?.[at] ?? "").trim() : "";
    if (!raw) return { kind: "empty" };
    return { kind: "value", raw, number: column.type === "number" ? parseCellNumber(raw) : null };
  });
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

