/**
 * A conferência de uma coleção: o que está faltando, o que está escrito torto
 * e o que mudou de posição desde a última vez que alguém olhou.
 *
 * É leitura pura das tabelas das filhas contra a regra da mãe — nada aqui
 * escreve na página. Quem conserta é o designer; a tela só aponta onde.
 */

import { columnHeader, matchesColumnHeader, sameTableName, type TableRule } from "@/lib/tableRule/tableRule";
import { parseCellNumber, readCell, readPageTables, rowKeyLabel, ruleColumns, type CellValue } from "@/lib/tableRule/read";

type PageLike = { id: string; title: string; content?: string; contentBlocks?: unknown };

/**
 * Um problema numa página.
 * - `missing`: coluna exigida com a célula vazia.
 * - `notNumber`: coluna de número com algo que não é número.
 * - `brokenRef`: `$[...]` numa célula que não acha página.
 * - `unknownColumn`: cabeçalho numa tabela da regra que a regra não conhece —
 *   quase sempre um typo, que criaria uma coluna fantasma.
 */
export type AuditIssue =
  | { kind: "missing"; table: string; column: string; rowKey?: string }
  | { kind: "notNumber"; table: string; column: string; rowKey?: string; raw: string }
  | { kind: "brokenRef"; table: string; column: string; rowKey?: string; ref: string }
  | { kind: "unknownColumn"; table: string; column: string };

export type PageAudit<P extends PageLike = PageLike> = { page: P; issues: AuditIssue[] };

/** Os títulos e ids do projeto, para saber se uma ref resolve — mesmo casamento de `findSection`. */
export function refIndex(sections: Array<{ id: string; title: string }>) {
  return { titles: new Set(sections.map((s) => s.title.toLowerCase().trim())), ids: new Set(sections.map((s) => s.id)) };
}
export type RefIndex = ReturnType<typeof refIndex>;

function brokenRefs(raw: string, index: RefIndex): string[] {
  const out: string[] = [];
  for (const m of raw.matchAll(/\$\[([^\]]+)\]/g)) {
    const value = m[1].trim();
    const ok = value.startsWith("#") ? index.ids.has(value.slice(1)) : index.titles.has(value.toLowerCase());
    if (!ok) out.push(value);
  }
  return out;
}

function cellIssues(
  cell: CellValue,
  where: { table: string; column: string; rowKey?: string },
  type: string,
  required: boolean,
  index: RefIndex,
): AuditIssue[] {
  if (cell.kind === "absent") return [];
  if (cell.kind === "empty") return required ? [{ kind: "missing", ...where }] : [];
  const out: AuditIssue[] = [];
  if (type === "number" && cell.number === null) out.push({ kind: "notNumber", ...where, raw: cell.raw });
  for (const ref of brokenRefs(cell.raw, index)) out.push({ kind: "brokenRef", ...where, ref });
  return out;
}

/** Os problemas de uma página contra a regra. Tabela ausente não acusa nada: é "não se aplica". */
export function auditPage<P extends PageLike>(rule: TableRule, page: P, index: RefIndex): PageAudit<P> {
  const tables = readPageTables(page);
  const issues: AuditIssue[] = [];

  for (const ref of ruleColumns(rule)) {
    const where = { table: ref.table, column: ref.column.name };
    issues.push(...cellIssues(readCell(rule, tables, ref), where, ref.column.type, !!ref.column.required, index));
  }

  rule.tables.forEach((table) => {
    const found = tables.find((t) => sameTableName(t.name, table.name));
    if (!found) return;
    for (const header of found.headers) {
      if (header && !table.columns.some((c) => matchesColumnHeader(c, header))) {
        issues.push({ kind: "unknownColumn", table: table.name, column: header });
      }
    }
    if (!table.multiRow) return;
    // Tabela de várias linhas: cada linha conta, com o nome dela no aviso.
    const at = table.columns.map((c) => found.headers.findIndex((h) => matchesColumnHeader(c, h)));
    for (const row of found.rows) {
      const rowKey = rowKeyLabel(row[at[0] >= 0 ? at[0] : 0] ?? "");
      table.columns.forEach((column, ci) => {
        const raw = at[ci] >= 0 ? (row[at[ci]] ?? "").trim() : "";
        const cell: CellValue = raw
          ? { kind: "value", raw, number: column.type === "number" ? parseCellNumber(raw) : null }
          : { kind: "empty" };
        issues.push(...cellIssues(cell, { table: table.name, column: column.name, rowKey: rowKey || undefined }, column.type, !!column.required, index));
      });
    }
  });

  return { page, issues };
}

/** Um problema que se repete em várias páginas, juntado para a lista do painel. */
export type IssueGroup<P extends PageLike = PageLike> = {
  kind: AuditIssue["kind"];
  table: string;
  column: string;
  /** Para `brokenRef`, o título que não achou página. */
  detail?: string;
  pages: P[];
};

/** Junta os problemas por tipo + tabela + coluna (+ ref), na ordem em que a regra lista as colunas. */
export function groupIssues<P extends PageLike>(rule: TableRule, audits: PageAudit<P>[]): IssueGroup<P>[] {
  const groups = new Map<string, IssueGroup<P>>();
  for (const { page, issues } of audits) {
    for (const issue of issues) {
      const detail = issue.kind === "brokenRef" ? issue.ref : undefined;
      const key = [issue.kind, issue.table.toLowerCase(), issue.column.toLowerCase(), detail ?? ""].join("\u0000");
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { kind: issue.kind, table: issue.table, column: issue.column, detail, pages: [] }));
      if (!group.pages.includes(page)) group.pages.push(page);
    }
  }
  const kindOrder: AuditIssue["kind"][] = ["missing", "notNumber", "brokenRef", "unknownColumn"];
  const columnOrder = (g: IssueGroup<P>) => {
    const ti = rule.tables.findIndex((t) => sameTableName(t.name, g.table));
    const ci = ti >= 0 ? rule.tables[ti].columns.findIndex((c) => sameTableName(c.name, g.column)) : -1;
    return ti * 1000 + (ci >= 0 ? ci : 999);
  };
  return [...groups.values()].sort(
    (a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || columnOrder(a) - columnOrder(b),
  );
}

// ── Quem está na ponta ────────────────────────────────────────────────

/** A página com o maior e com o menor valor de cada coluna de número. `null` quando há empate ou dado de menos. */
export type Extremes = Record<string, { max: string | null; min: string | null }>;

/** A chave de uma coluna no registro de pontas: tabela + coluna, sem caixa. */
export const extremeKey = (table: string, column: string) => `${table.trim().toLowerCase()}\u0000${column.trim().toLowerCase()}`;

/**
 * As pontas das colunas de número das tabelas de uma linha.
 *
 * Empate não tem dono: se duas sementes crescem no mesmo tempo, nenhuma é "a
 * mais rápida", e não há o que virar. Com menos de duas páginas com valor,
 * também não.
 */
export function columnExtremes(rule: TableRule, pages: PageLike[]): Extremes {
  const out: Extremes = {};
  const tablesByPage = pages.map((page) => ({ id: page.id, tables: readPageTables(page) }));
  for (const ref of ruleColumns(rule)) {
    if (ref.column.type !== "number") continue;
    const values = tablesByPage.flatMap(({ id, tables }) => {
      const cell = readCell(rule, tables, ref);
      return cell.kind === "value" && cell.number !== null ? [{ id, n: cell.number }] : [];
    });
    if (values.length < 2) continue;
    const pick = (better: (a: number, b: number) => boolean) => {
      const best = values.reduce((acc, v) => (better(v.n, acc.n) ? v : acc));
      return values.filter((v) => v.n === best.n).length === 1 ? best.id : null;
    };
    out[extremeKey(ref.table, ref.column.name)] = { max: pick((a, b) => a > b), min: pick((a, b) => a < b) };
  }
  return out;
}

export type RankShift = { key: string; table: string; column: string; end: "max" | "min"; before: string; now: string };

/**
 * O que virou desde o registro anterior: a página que era a ponta de uma
 * coluna e deixou de ser. Só conta troca de dono — ponta que passou a empatar
 * ou coluna que sumiu não é "o ranking virou".
 */
export function rankShifts(rule: TableRule, before: Extremes, now: Extremes): RankShift[] {
  const out: RankShift[] = [];
  for (const ref of ruleColumns(rule)) {
    const key = extremeKey(ref.table, ref.column.name);
    const a = before[key];
    const b = now[key];
    if (!a || !b) continue;
    for (const end of ["max", "min"] as const) {
      if (a[end] && b[end] && a[end] !== b[end]) {
        out.push({ key, table: ref.table, column: ref.column.name, end, before: a[end]!, now: b[end]! });
      }
    }
  }
  return out;
}

// ── Página nova ───────────────────────────────────────────────────────

/**
 * O texto de uma página nova da coleção: um `##` e uma tabela vazia por tabela
 * da regra, com os cabeçalhos certos. Assim ninguém digita o cabeçalho à mão
 * (e cria uma coluna fantasma), e a tabela que não se aplica é só apagar.
 */
export function ruleScaffoldMarkdown(rule: TableRule): string {
  return rule.tables
    .map((table) => {
      const headers = table.columns.map(columnHeader);
      const row = (cells: string[]) => `| ${cells.join(" | ")} |`;
      return [`## ${table.name}`, "", row(headers), row(headers.map(() => "---")), row(headers.map(() => " "))].join("\n");
    })
    .join("\n\n");
}
