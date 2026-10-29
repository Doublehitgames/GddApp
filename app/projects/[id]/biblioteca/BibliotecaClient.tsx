"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AreaHeader } from "@/components/project/AreaHeader";
import { SectionThumb } from "@/components/common/SectionThumb";
import { IconLibrary } from "@/components/project/ProjectSidebar";
import { useShellProject } from "@/components/project/useShellProject";
import { useI18n } from "@/lib/i18n/provider";
import { libraryCollections, type LibraryCollection } from "@/lib/library/collections";
import { backlinkIndex, groupRelations, proseExcerpt, type Backlink } from "@/lib/library/relations";
import { PAGE_STATUS_META } from "@/lib/pageStatus/types";
import { parseTableRule, type TableRule } from "@/lib/tableRule/tableRule";
import {
  compareCells,
  multiRowColumns,
  multiRowKeys,
  multiRowTables,
  readMultiTable,
  readRow,
  ruleColumns,
  type CellValue,
  type RuleColumnRef,
} from "@/lib/tableRule/read";
import { toSlug } from "@/lib/utils/slug";
import type { Section } from "@/store/slices/types";

type SortKey = number | "title";
/** Uma página da coleção: os valores nas colunas comparáveis e se alguma tabela de várias linhas tem falta. */
type Row = { item: Section; cells: CellValue[]; multiIssue: boolean };

/**
 * A Biblioteca: uma lente de balanceamento sobre as páginas que já existem.
 *
 * Cada coleção é uma página-mãe com regra de tabelas; cada card é uma filha,
 * e cada valor é lido da tabela que está no texto dela. Nada aqui é guardado à
 * parte — apagar esta tela deixa as tabelas onde sempre estiveram.
 */
export default function BibliotecaClient({ projectId, collection }: { projectId: string; collection?: string }) {
  const { t } = useI18n();
  const project = useShellProject(projectId);
  const sections = useMemo(() => project?.sections ?? [], [project?.sections]);
  const collections = useMemo(() => libraryCollections(sections), [sections]);
  const current =
    collections.find((c) => c.section.id === collection || toSlug(c.section.title) === collection) ?? collections[0];

  if (!project) return null;

  return (
    <div className="w-full">
      <AreaHeader
        icon={<IconLibrary className="h-5 w-5" />}
        tone="lib"
        title={t("libraryPage.title", "Biblioteca do jogo")}
        lead={t(
          "libraryPage.lead",
          "Os números das coleções, lidos das tabelas de cada página. A prosa guarda a relação; a tabela guarda o valor.",
        )}
      />

      {collections.length === 0 || !current ? (
        <EmptyLibrary />
      ) : (
        <>
          <CollectionTiles projectSlug={projectId} collections={collections} currentId={current.section.id} />
          <CollectionView key={current.section.id} projectSlug={projectId} parent={current.section} sections={sections} />
        </>
      )}
    </div>
  );
}

function EmptyLibrary() {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center">
      <p className="text-base font-semibold text-ink">{t("libraryPage.emptyTitle", "Nenhuma coleção ainda")}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
        {t(
          "libraryPage.emptyText",
          "Abra a página-mãe das coisas que têm números — as sementes, as armas, os inimigos — e use “+ regra de tabelas” no cabeçalho. A regra diz quais tabelas as subpáginas carregam, e a coleção aparece aqui.",
        )}
      </p>
    </div>
  );
}

// ── Blocos das coleções ───────────────────────────────────────────────

/** O topo do mock: um bloco por coleção, com o ícone da página-mãe e quantas coisas ela tem. */
function CollectionTiles({
  projectSlug,
  collections,
  currentId,
}: {
  projectSlug: string;
  collections: LibraryCollection<Section>[];
  currentId: string;
}) {
  const { t } = useI18n();
  return (
    <nav className="mb-5 flex gap-3 overflow-x-auto pb-1 scrollbar-premium" aria-label={t("projectShell.collectionsLabel", "Coleções")}>
      {collections.map(({ section, itemCount }) => {
        const active = section.id === currentId;
        return (
          <Link
            key={section.id}
            href={`/projects/${projectSlug}/biblioteca?c=${section.id}`}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-[150px] items-center gap-3 rounded-2xl border p-3 transition-colors ${
              active ? "border-area-lib bg-area-lib-soft" : "border-line bg-surface hover:bg-surface-2"
            }`}
          >
            <Thumb section={section} className="h-11 w-11 rounded-xl" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{section.title}</span>
              <span className="block text-xs tabular-nums text-muted">{itemCount}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── A coleção aberta ─────────────────────────────────────────────────

function CollectionView({ projectSlug, parent, sections }: { projectSlug: string; parent: Section; sections: Section[] }) {
  const { t } = useI18n();
  // A regra existe: só entra na lista quem tem uma (libraryCollections).
  const rule = useMemo(() => parseTableRule(parent.tableRule)!, [parent.tableRule]);
  const items = useMemo(
    () => sections.filter((s) => s.parentId === parent.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [sections, parent.id],
  );
  // Tabela de várias linhas compara numa linha escolhida — "Velocidade no nível
  // 50", "Quantidade de Trigo". Começa na primeira linha que aparece.
  const multiTables = useMemo(() => multiRowTables(rule), [rule]);
  const rowKeys = useMemo(
    () => new Map(multiTables.map((ti) => [ti, multiRowKeys(rule, ti, items)])),
    [multiTables, rule, items],
  );
  const [keyByTable, setKeyByTable] = useState<Record<number, string>>({});
  const keyOf = (ti: number) => keyByTable[ti] ?? rowKeys.get(ti)?.[0];
  const columns = useMemo(
    () => [
      ...ruleColumns(rule),
      ...multiTables.flatMap((ti) => {
        const key = keyByTable[ti] ?? rowKeys.get(ti)?.[0];
        return key ? multiRowColumns(rule, ti, key) : [];
      }),
    ],
    [rule, multiTables, keyByTable, rowKeys],
  );
  const rows = useMemo<Row[]>(
    () => items.map((item) => ({ item, cells: readRow(rule, item, columns), multiIssue: hasMultiIssue(rule, multiTables, item) })),
    [items, rule, columns, multiTables],
  );
  const setKey = (ti: number, key: string) => setKeyByTable((k) => ({ ...k, [ti]: key }));
  const backlinks = useMemo(() => backlinkIndex(sections), [sections]);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = q
      ? rows.filter(({ item }) => item.title.toLocaleLowerCase().includes(q) || (item.dataId ?? "").toLocaleLowerCase().includes(q))
      : [...rows];
    if (sortKey === "title") {
      list.sort((a, b) => a.item.title.localeCompare(b.item.title, undefined, { numeric: true }) * direction);
    } else {
      const type = columns[sortKey].column.type;
      list.sort((a, b) => compareCells(a.cells[sortKey], b.cells[sortKey], type, direction));
    }
    return list;
  }, [rows, query, sortKey, direction, columns]);

  const selected = visible.find((r) => r.item.id === selectedId) ?? visible[0] ?? null;

  const problems = (row: Row) =>
    row.multiIssue || row.cells.some((c, i) => columns[i].rowKey === undefined && (isMissing(columns[i], c) || isNotNumber(columns[i], c)));
  const incomplete = rows.filter(problems).length;
  const sortedRef = typeof sortKey === "number" ? columns[sortKey] : null;

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setDirection((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setDirection(1);
    }
  };

  const pageHref = (title: string) => `/projects/${projectSlug}/sections/${toSlug(title)}`;

  return (
    <>
      {/* Barra: busca, ordenação e modo de ver */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">{t("libraryPage.search", "Buscar na coleção")}</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("libraryPage.search", "Buscar na coleção")}
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-muted">
          <span className="hidden sm:inline">{t("libraryPage.sortBy", "Ordenar por")}</span>
          <select
            value={String(sortKey)}
            onChange={(e) => {
              setSortKey(e.target.value === "title" ? "title" : Number(e.target.value));
              setDirection(1);
            }}
            className="bg-transparent text-ink focus:outline-none"
          >
            <option value="title">{t("libraryPage.sortName", "Nome")}</option>
            {rule.tables.map((table, ti) => (
              <optgroup key={table.name} label={table.multiRow && keyOf(ti) ? `${table.name} · ${keyOf(ti)}` : table.name}>
                {columns.map((ref, index) =>
                  ref.tableIndex === ti ? (
                    <option key={index} value={index}>
                      {ref.column.name}
                    </option>
                  ) : null,
                )}
              </optgroup>
            ))}
          </select>
        </label>
        {sortedRef?.rowKey !== undefined && (
          <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-muted">
            <span>{t("libraryPage.compareAt", "em")}</span>
            <select
              value={sortedRef.rowKey}
              onChange={(e) => setKey(sortedRef.tableIndex, e.target.value)}
              className="max-w-[12rem] bg-transparent text-ink focus:outline-none"
            >
              {(rowKeys.get(sortedRef.tableIndex) ?? []).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={() => setDirection((d) => (d === 1 ? -1 : 1))}
          className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink hover:bg-surface-2"
          aria-label={direction === 1 ? t("libraryPage.ascending", "Crescente") : t("libraryPage.descending", "Decrescente")}
          title={direction === 1 ? t("libraryPage.ascending", "Crescente") : t("libraryPage.descending", "Decrescente")}
        >
          {direction === 1 ? "↑" : "↓"}
        </button>
        <div className="flex h-10 overflow-hidden rounded-xl border border-line bg-surface" role="group" aria-label={t("libraryPage.view", "Modo de ver")}>
          {(["grid", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              title={mode === "grid" ? t("libraryPage.viewGrid", "Cards") : t("libraryPage.viewList", "Comparar em tabela")}
              className={`grid w-10 place-items-center ${view === mode ? "bg-area-lib-soft text-area-lib" : "text-muted hover:bg-surface-2"}`}
            >
              {mode === "grid" ? <IconGrid /> : <IconList />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold text-ink">{parent.title}</h2>
            <span className="text-sm text-muted">
              {t("libraryPage.summary", "{n} páginas · {tables} tabelas")
                .replace("{n}", String(items.length))
                .replace("{tables}", String(rule.tables.length))}
              {" · "}
              {incomplete === 0 ? (
                t("libraryPage.allComplete", "todas completas")
              ) : (
                <span className="font-medium text-warn-ink">
                  {t("libraryPage.incomplete", "{n} com falta").replace("{n}", String(incomplete))}
                </span>
              )}
            </span>
            <Link href={pageHref(parent.title)} className="ml-auto text-sm text-muted hover:text-ink">
              {t("libraryPage.openParent", "Abrir a página e a regra")} →
            </Link>
          </header>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-muted">
              {t("libraryPage.noMatch", "Nenhuma página com esse nome nesta coleção.")}
            </p>
          ) : view === "grid" ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {visible.map((row) => (
                <li key={row.item.id}>
                  <ItemCard
                    row={row}
                    sortedBy={typeof sortKey === "number" ? columns[sortKey] : null}
                    sortedCell={typeof sortKey === "number" ? row.cells[sortKey] : null}
                    citedBy={backlinks.get(row.item.id)?.length ?? 0}
                    hasProblem={problems(row)}
                    selected={row.item.id === selected?.item.id}
                    onSelect={() => setSelectedId(row.item.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <CompareTable
              rule={rule}
              columns={columns}
              rows={visible}
              sortKey={sortKey}
              direction={direction}
              onSort={sortBy}
              selectedId={selected?.item.id ?? null}
              onSelect={setSelectedId}
              pageHref={pageHref}
              rowKeys={rowKeys}
              onKey={setKey}
            />
          )}
        </section>

        {selected && (
          <DetailPanel
            parent={parent}
            rule={rule}
            columns={columns}
            row={selected}
            sections={sections}
            backlinks={backlinks.get(selected.item.id) ?? []}
            pageHref={pageHref}
            position={visible.findIndex((r) => r.item.id === selected.item.id)}
            total={visible.length}
            onStep={(delta) => {
              const at = visible.findIndex((r) => r.item.id === selected.item.id);
              const next = visible[(at + delta + visible.length) % visible.length];
              if (next) setSelectedId(next.item.id);
            }}
          />
        )}
      </div>
    </>
  );
}

const isMissing = (ref: RuleColumnRef, cell: CellValue) => cell.kind === "empty" && !!ref.column.required;
const isNotNumber = (ref: RuleColumnRef, cell: CellValue) =>
  cell.kind === "value" && ref.column.type === "number" && cell.number === null;

/** Alguma linha de alguma tabela de várias linhas com célula exigida vazia ou número que não é número. */
function hasMultiIssue(rule: TableRule, multiTables: number[], page: Section): boolean {
  return multiTables.some((ti) =>
    (readMultiTable(rule, ti, page) ?? []).some((cells) =>
      cells.some((cell, ci) => {
        const ref = { tableIndex: ti, columnIndex: ci, table: rule.tables[ti].name, column: rule.tables[ti].columns[ci] };
        return isMissing(ref, cell) || isNotNumber(ref, cell);
      }),
    ),
  );
}

/** Uma tabela de várias linhas inteira, no painel da página. */
function MultiRowBox({
  rule,
  tableIndex,
  page,
  pageHref,
}: {
  rule: TableRule;
  tableIndex: number;
  page: Section;
  pageHref: (title: string) => string;
}) {
  const { t } = useI18n();
  const table = rule.tables[tableIndex];
  const rows = readMultiTable(rule, tableIndex, page);
  const refs = table.columns.map((column, columnIndex) => ({ tableIndex, columnIndex, table: table.name, column }));
  return (
    <section className="rounded-xl border border-line">
      <h4 className="flex items-center justify-between px-3 pt-2.5 text-xs font-semibold uppercase tracking-wide text-subtle">
        {table.name}
        {!rows && <span className="font-normal normal-case tracking-normal">{t("libraryPage.notApplicable", "não se aplica")}</span>}
      </h4>
      {rows && (
        <div className="overflow-x-auto px-3 pb-2 pt-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted">
                {refs.map((ref) => (
                  <th key={ref.columnIndex} className={`py-1 pr-2 font-medium ${ref.column.type === "number" ? "text-right" : ""}`}>
                    {ref.column.name}
                    {ref.column.unit && <span className="text-subtle"> ({ref.column.unit})</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, r) => (
                <tr key={r} className="border-t border-line/60">
                  {cells.map((cell, ci) => (
                    <td key={ci} className={`py-1 pr-2 ${refs[ci].column.type === "number" ? "text-right tabular-nums" : ""}`}>
                      <Cell cell={cell} ref_={refs[ci]} pageHref={pageHref} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Card ─────────────────────────────────────────────────────────────

function ItemCard({
  row,
  sortedBy,
  sortedCell,
  citedBy,
  hasProblem,
  selected,
  onSelect,
}: {
  row: Row;
  sortedBy: RuleColumnRef | null;
  sortedCell: CellValue | null;
  citedBy: number;
  hasProblem: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const { item } = row;
  const excerpt = useMemo(() => proseExcerpt(item.content ?? "", 110), [item.content]);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-full w-full flex-col rounded-2xl border bg-surface p-3 text-left transition-shadow hover:shadow-md ${
        selected ? "border-area-lib ring-2 ring-area-lib/30" : "border-line"
      }`}
    >
      <div className="relative mb-2 grid h-24 place-items-center rounded-xl bg-surface-2">
        <Thumb section={item} className="h-20 w-20 rounded-lg" iconClassName="h-8 w-8" />
        {hasProblem && (
          <span className="absolute right-2 top-2 rounded-md bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold text-warn-ink">
            {t("libraryPage.missing", "falta")}
          </span>
        )}
      </div>
      <StatusBadge section={item} />
      <span className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ink">{item.title}</span>
      {excerpt && <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{excerpt}</span>}

      {/* Ordenado por uma coluna: o valor dela vem para o card, senão ordenar não se vê */}
      {sortedBy && sortedCell && (
        <span className="mt-2 inline-flex items-baseline gap-1.5 self-start rounded-lg bg-area-lib-soft px-2 py-1 text-xs">
          <span className="text-muted">
            {sortedBy.column.name}
            {sortedBy.rowKey !== undefined && ` · ${sortedBy.rowKey}`}
          </span>
          <span className="font-semibold tabular-nums text-ink">
            <CellText cell={sortedCell} unit={sortedBy.column.unit} />
          </span>
        </span>
      )}

      <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
        {(item.domainTags ?? []).slice(0, 2).map((tag) => (
          <span key={tag} className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">
            {tag}
          </span>
        ))}
        {citedBy > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted">
            <IconLink />
            {(citedBy === 1
              ? t("libraryPage.citedOne", "citada em 1 página")
              : t("libraryPage.citedMany", "citada em {n} páginas")
            ).replace("{n}", String(citedBy))}
          </span>
        )}
      </span>
    </button>
  );
}

// ── Modo comparar ────────────────────────────────────────────────────

function CompareTable({
  rule,
  columns,
  rows,
  sortKey,
  direction,
  onSort,
  selectedId,
  onSelect,
  pageHref,
  rowKeys,
  onKey,
}: {
  rule: TableRule;
  columns: RuleColumnRef[];
  rows: Row[];
  sortKey: SortKey;
  direction: 1 | -1;
  onSort: (key: SortKey) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  pageHref: (title: string) => string;
  rowKeys: Map<number, string[]>;
  onKey: (tableIndex: number, key: string) => void;
}) {
  const { t } = useI18n();
  // Grupos de colunas seguidas da mesma tabela, para o cabeçalho de cima.
  const groups = columns.reduce<Array<{ tableIndex: number; span: number; rowKey?: string }>>((acc, ref) => {
    const last = acc[acc.length - 1];
    if (last && last.tableIndex === ref.tableIndex) last.span++;
    else acc.push({ tableIndex: ref.tableIndex, span: 1, rowKey: ref.rowKey });
    return acc;
  }, []);
  const startsGroup = (index: number) => index === 0 || columns[index - 1].tableIndex !== columns[index].tableIndex;
  const arrow = (key: SortKey) => (sortKey === key ? (direction === 1 ? " ↑" : " ↓") : "");
  const ariaSort = (key: SortKey) => (sortKey === key ? (direction === 1 ? "ascending" : "descending") : "none");
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-subtle">
            <th className="sticky left-0 z-10 bg-surface" />
            {groups.map((group) => (
              <th key={group.tableIndex} colSpan={group.span} className="border-l border-line px-3 pt-2 text-left font-semibold">
                {rule.tables[group.tableIndex].name}
                {group.rowKey !== undefined && (
                  <select
                    value={group.rowKey}
                    onChange={(e) => onKey(group.tableIndex, e.target.value)}
                    aria-label={t("libraryPage.compareAt", "em")}
                    className="ml-1.5 max-w-[10rem] rounded border border-line bg-surface px-1 text-[11px] font-normal normal-case tracking-normal text-ink"
                  >
                    {(rowKeys.get(group.tableIndex) ?? []).map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                )}
              </th>
            ))}
          </tr>
          <tr className="border-b border-line text-xs text-muted">
            <th aria-sort={ariaSort("title")} className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">
              <button type="button" onClick={() => onSort("title")} className="hover:text-ink">
                {t("libraryPage.page", "Página")}
                {arrow("title")}
              </button>
            </th>
            {columns.map((ref, index) => (
              <th
                key={index}
                aria-sort={ariaSort(index)}
                className={`whitespace-nowrap px-3 py-2 font-medium ${startsGroup(index) ? "border-l border-line" : ""} ${
                  ref.column.type === "number" ? "text-right" : "text-left"
                }`}
              >
                <button type="button" onClick={() => onSort(index)} className="hover:text-ink">
                  {ref.column.name}
                  {ref.column.unit && <span className="text-subtle"> ({ref.column.unit})</span>}
                  {arrow(index)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item, cells }) => {
            const selected = item.id === selectedId;
            return (
              <tr
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`cursor-pointer border-b border-line/60 last:border-0 ${selected ? "bg-area-lib-soft" : "hover:bg-surface-2/60"}`}
              >
                <td className={`sticky left-0 z-10 px-3 py-1.5 ${selected ? "bg-area-lib-soft" : "bg-surface"}`}>
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <Thumb section={item} className="h-6 w-6 rounded" />
                    <span className="whitespace-nowrap">{item.title}</span>
                  </span>
                </td>
                {cells.map((cell, index) => {
                  const ref = columns[index];
                  return (
                    <td
                      key={index}
                      className={`whitespace-nowrap px-3 py-1.5 ${startsGroup(index) ? "border-l border-line" : ""} ${
                        ref.column.type === "number" ? "text-right tabular-nums" : ""
                      }`}
                    >
                      <Cell cell={cell} ref_={ref} pageHref={pageHref} />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Painel da direita ────────────────────────────────────────────────

function DetailPanel({
  parent,
  rule,
  columns,
  row,
  sections,
  backlinks,
  pageHref,
  position,
  total,
  onStep,
}: {
  parent: Section;
  rule: TableRule;
  columns: RuleColumnRef[];
  row: Row;
  sections: Section[];
  backlinks: Backlink[];
  pageHref: (title: string) => string;
  position: number;
  total: number;
  onStep: (delta: number) => void;
}) {
  const { t } = useI18n();
  const { item, cells } = row;
  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const groups = useMemo(() => groupRelations(backlinks, byId), [backlinks, byId]);
  const short = useMemo(() => proseExcerpt(item.content ?? "", 220, sections), [item.content, sections]);
  const long = useMemo(() => proseExcerpt(item.content ?? "", 1200, sections), [item.content, sections]);
  // O grupo aberto é da página: trocar de página fecha, sem efeito nenhum.
  const [openGroup, setOpenGroup] = useState<{ page: string; group: string } | null>(null);
  const openKey = openGroup?.page === item.id ? openGroup.group : null;

  return (
    <aside className="h-fit rounded-2xl border border-line bg-surface p-4 xl:sticky xl:top-4">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <Link href={pageHref(parent.title)} className="truncate font-medium text-muted hover:text-ink">
          {parent.title}
        </Link>
        <span className="ml-auto text-xs tabular-nums text-subtle">
          {position + 1}/{total}
        </span>
        <button type="button" onClick={() => onStep(-1)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("libraryPage.previous", "Anterior")}>
          ‹
        </button>
        <button type="button" onClick={() => onStep(1)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("libraryPage.next", "Próxima")}>
          ›
        </button>
      </div>

      <div className="grid h-40 place-items-center rounded-xl bg-surface-2">
        <Thumb section={item} className="h-32 w-32 rounded-xl" iconClassName="h-12 w-12" />
      </div>

      <div className="mt-3 flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-lg font-semibold leading-snug text-ink">{item.title}</h3>
        <StatusBadge section={item} />
      </div>
      {short && <p className="mt-1 text-sm leading-relaxed text-muted">{short}</p>}

      {/* Os valores: uma caixa por tabela da regra */}
      <div className="mt-4 flex flex-col gap-3">
        {rule.tables.map((table, ti) => {
          if (table.multiRow) return <MultiRowBox key={table.name} rule={rule} tableIndex={ti} page={item} pageHref={pageHref} />;
          const refs = columns.map((ref, index) => ({ ref, index })).filter(({ ref }) => ref.tableIndex === ti);
          const absent = refs.every(({ index }) => cells[index].kind === "absent");
          return (
            <section key={table.name} className="rounded-xl border border-line">
              <h4 className="flex items-center justify-between px-3 pt-2.5 text-xs font-semibold uppercase tracking-wide text-subtle">
                {table.name}
                {absent && <span className="font-normal normal-case tracking-normal">{t("libraryPage.notApplicable", "não se aplica")}</span>}
              </h4>
              {!absent && (
                <dl className="px-3 pb-2 pt-1">
                  {refs.map(({ ref, index }) => (
                    <div key={index} className="flex items-baseline justify-between gap-3 py-1 text-sm">
                      <dt className="text-muted">{ref.column.name}</dt>
                      <dd className={ref.column.type === "number" ? "tabular-nums text-ink" : "text-right text-ink"}>
                        <Cell cell={cells[index]} ref_={ref} pageHref={pageHref} withUnit />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          );
        })}
      </div>

      {/* Relações: quem cita esta página, agrupado pela coleção de quem cita */}
      <section className="mt-4">
        <h4 className="mb-1.5 text-sm font-semibold text-ink">{t("libraryPage.relations", "Relações")}</h4>
        {groups.length === 0 ? (
          <p className="text-sm text-subtle">{t("libraryPage.noRelations", "Nenhuma página cita esta ainda.")}</p>
        ) : (
          <ul className="flex flex-col">
            {groups.map((group) => {
              const key = group.parent?.id ?? "root";
              const open = openKey === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setOpenGroup(open ? null : { page: item.id, group: key })}
                    aria-expanded={open}
                    className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm hover:bg-surface-2"
                  >
                    <IconLink />
                    <span className="min-w-0 flex-1 truncate text-ink-2">
                      {group.parent
                        ? t("libraryPage.citedIn", "Citada em {group}").replace("{group}", group.parent.title)
                        : t("libraryPage.citedAtRoot", "Citada em páginas soltas")}
                    </span>
                    <span className="tabular-nums text-muted">{group.pages.length}</span>
                    <span className={`text-subtle transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                  </button>
                  {open && (
                    <ul className="mb-1 ml-7 flex flex-col gap-0.5">
                      {group.pages.map((page) => (
                        <li key={page.id}>
                          <Link href={pageHref(page.title)} className="text-sm text-accent hover:underline">
                            {page.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {long && long !== short && (
        <details key={item.id} className="mt-4 rounded-xl border border-line px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-ink">{t("libraryPage.longDescription", "Descrição completa")}</summary>
          <p className="mt-2 text-sm leading-relaxed text-muted">{long}</p>
        </details>
      )}

      {(item.domainTags ?? []).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(item.domainTags ?? []).map((tag) => (
            <span key={tag} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">
              {tag}
            </span>
          ))}
        </div>
      )}

      <Link
        href={pageHref(item.title)}
        className="mt-4 flex h-9 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-on-accent hover:bg-accent-strong"
      >
        {t("libraryPage.openPage", "Abrir a página completa")}
      </Link>
    </aside>
  );
}

// ── Pedaços ──────────────────────────────────────────────────────────

/**
 * A cara da página, pela mesma peça do resto do app: o Drive serve a imagem
 * por várias URLs e nem todas passam em todo navegador, e o SectionThumb desce
 * a lista antes de cair no ícone.
 */
function Thumb({ section, className, iconClassName = "h-5 w-5" }: { section: Section; className: string; iconClassName?: string }) {
  return <SectionThumb section={section} className={className} iconClassName={iconClassName} />;
}

function StatusBadge({ section }: { section: Section }) {
  const { t } = useI18n();
  if (!section.status) return null;
  const meta = PAGE_STATUS_META[section.status];
  return (
    <span className={`inline-flex shrink-0 self-start rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}>
      {t(meta.labelKey, meta.labelFallback)}
    </span>
  );
}

function CellText({ cell, unit }: { cell: CellValue; unit?: string }) {
  if (cell.kind !== "value") return <>—</>;
  return (
    <>
      {cell.raw.replace(/\$\[([^\]]+)\]/g, "$1")}
      {unit && <span className="font-normal text-muted"> {unit}</span>}
    </>
  );
}

function Cell({
  cell,
  ref_,
  pageHref,
  withUnit = false,
}: {
  cell: CellValue;
  ref_: RuleColumnRef;
  pageHref: (title: string) => string;
  withUnit?: boolean;
}) {
  const { t } = useI18n();
  if (cell.kind === "absent") {
    return (
      <span className="text-subtle" title={t("libraryPage.absent", "Esta página não tem a tabela — não se aplica.")}>
        ·
      </span>
    );
  }
  if (cell.kind === "empty") {
    return isMissing(ref_, cell) ? (
      <span className="rounded bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn-ink">{t("libraryPage.missing", "falta")}</span>
    ) : (
      <span className="text-subtle">—</span>
    );
  }
  if (isNotNumber(ref_, cell)) {
    return (
      <span className="rounded bg-danger-soft px-1.5 py-0.5 text-danger" title={t("libraryPage.notNumber", "A coluna é de número e isto não é.")}>
        {cell.raw}
      </span>
    );
  }
  const unit = withUnit && ref_.column.unit ? <span className="text-muted"> {ref_.column.unit}</span> : null;
  // Célula de página: cada $[Título] vira link, o resto fica como texto.
  if (ref_.column.type === "page" || cell.raw.includes("$[")) {
    const parts = cell.raw.split(/(\$\[[^\]]+\])/g).filter(Boolean);
    return (
      <span onClick={(e) => e.stopPropagation()}>
        {parts.map((part, i) => {
          const m = part.match(/^\$\[([^\]]+)\]$/);
          return m ? (
            <Link key={i} href={pageHref(m[1])} className="text-accent hover:underline">
              {m[1]}
            </Link>
          ) : (
            <span key={i}>{part}</span>
          );
        })}
      </span>
    );
  }
  return (
    <span className="text-ink">
      {cell.raw}
      {unit}
    </span>
  );
}

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const IconGrid = () => (
  <svg {...iconProps} className="h-4 w-4">
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);
const IconList = () => (
  <svg {...iconProps} className="h-4 w-4">
    <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);
const IconLink = () => (
  <svg {...iconProps} className="h-3.5 w-3.5 shrink-0">
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </svg>
);
