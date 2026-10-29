"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AreaHeader } from "@/components/project/AreaHeader";
import { IconLibrary } from "@/components/project/ProjectSidebar";
import { useShellProject } from "@/components/project/useShellProject";
import { useI18n } from "@/lib/i18n/provider";
import { libraryCollections } from "@/lib/library/collections";
import { parseTableRule } from "@/lib/tableRule/tableRule";
import { compareCells, readRow, ruleColumns, type CellValue, type RuleColumnRef } from "@/lib/tableRule/read";
import { toSlug } from "@/lib/utils/slug";
import type { Section } from "@/store/slices/types";

type Sort = { column: number | "title"; direction: 1 | -1 };

/**
 * A Biblioteca: uma lente de balanceamento sobre as páginas que já existem.
 *
 * Cada coleção é uma página-mãe com regra de tabelas; cada linha é uma filha,
 * e cada célula é lida da tabela que está no texto dela. Nada aqui é guardado
 * à parte — apagar esta tela deixa as tabelas onde sempre estiveram.
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

      {collections.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <>
          {collections.length > 1 && (
            <nav className="mb-4 flex flex-wrap gap-2" aria-label={t("projectShell.collectionsLabel", "Coleções")}>
              {collections.map(({ section, itemCount }) => {
                const active = section.id === current?.section.id;
                return (
                  <Link
                    key={section.id}
                    href={`/projects/${projectId}/biblioteca?c=${section.id}`}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                      active ? "border-area-lib bg-area-lib-soft font-semibold text-ink" : "border-line text-muted hover:bg-surface-2"
                    }`}
                  >
                    {section.title}
                    <span className="text-xs tabular-nums text-subtle">{itemCount}</span>
                  </Link>
                );
              })}
            </nav>
          )}
          {current && (
            <CollectionTable
              key={current.section.id}
              projectSlug={projectId}
              parent={current.section}
              items={sections.filter((s) => s.parentId === current.section.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))}
            />
          )}
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

function CollectionTable({ projectSlug, parent, items }: { projectSlug: string; parent: Section; items: Section[] }) {
  const { t } = useI18n();
  // A regra existe: só entra na lista quem tem uma (libraryCollections).
  const rule = useMemo(() => parseTableRule(parent.tableRule)!, [parent.tableRule]);
  const columns = useMemo(() => ruleColumns(rule), [rule]);
  const rows = useMemo(() => items.map((item) => ({ item, cells: readRow(rule, item) })), [items, rule]);
  const [sort, setSort] = useState<Sort>({ column: "title", direction: 1 });

  const sorted = useMemo(() => {
    const list = [...rows];
    if (sort.column === "title") {
      list.sort((a, b) => a.item.title.localeCompare(b.item.title, undefined, { numeric: true }) * sort.direction);
    } else {
      const index = sort.column;
      const type = columns[index].column.type;
      list.sort((a, b) => compareCells(a.cells[index], b.cells[index], type, sort.direction));
    }
    return list;
  }, [rows, sort, columns]);

  const isMissing = (ref: RuleColumnRef, cell: CellValue) => cell.kind === "empty" && !!ref.column.required;
  const isNotNumber = (ref: RuleColumnRef, cell: CellValue) =>
    cell.kind === "value" && ref.column.type === "number" && cell.number === null;
  const incomplete = rows.filter(({ cells }) => cells.some((c, i) => isMissing(columns[i], c) || isNotNumber(columns[i], c))).length;

  const toggle = (column: Sort["column"]) =>
    setSort((s) => (s.column === column ? { column, direction: s.direction === 1 ? -1 : 1 } : { column, direction: 1 }));
  const arrow = (column: Sort["column"]) => (sort.column === column ? (sort.direction === 1 ? " ↑" : " ↓") : "");
  const ariaSort = (column: Sort["column"]) =>
    sort.column === column ? (sort.direction === 1 ? "ascending" : "descending") : "none";

  const pageHref = (title: string) => `/projects/${projectSlug}/sections/${toSlug(title)}`;

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-ink">{parent.title}</h2>
          <p className="text-xs text-muted">
            {t("libraryPage.summary", "{n} páginas · {tables} tabelas")
              .replace("{n}", String(items.length))
              .replace("{tables}", String(rule.tables.length))}
            {" · "}
            {incomplete === 0 ? (
              <span>{t("libraryPage.allComplete", "todas completas")}</span>
            ) : (
              <span className="font-medium text-warn-ink">
                {t("libraryPage.incomplete", "{n} com falta").replace("{n}", String(incomplete))}
              </span>
            )}
          </p>
        </div>
        <Link
          href={pageHref(parent.title)}
          className="ml-auto inline-flex h-8 items-center rounded-lg border border-line px-3 text-sm text-ink hover:bg-surface-2"
        >
          {t("libraryPage.openParent", "Abrir a página e a regra")}
        </Link>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-subtle">
              <th className="sticky left-0 z-10 bg-surface" />
              {rule.tables.map((table) => (
                <th key={table.name} colSpan={table.columns.length} className="border-l border-line px-3 pt-2 text-left font-semibold">
                  {table.name}
                </th>
              ))}
            </tr>
            <tr className="border-b border-line text-xs text-muted">
              <th aria-sort={ariaSort("title")} className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">
                <button type="button" onClick={() => toggle("title")} className="hover:text-ink">
                  {t("libraryPage.page", "Página")}
                  {arrow("title")}
                </button>
              </th>
              {columns.map((ref, index) => (
                <th
                  key={`${ref.tableIndex}:${ref.columnIndex}`}
                  aria-sort={ariaSort(index)}
                  className={`whitespace-nowrap px-3 py-2 font-medium ${ref.columnIndex === 0 ? "border-l border-line" : ""} ${
                    ref.column.type === "number" ? "text-right" : "text-left"
                  }`}
                >
                  <button type="button" onClick={() => toggle(index)} className="hover:text-ink">
                    {ref.column.name}
                    {ref.column.unit && <span className="text-subtle"> ({ref.column.unit})</span>}
                    {arrow(index)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ item, cells }) => (
              <tr key={item.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/60">
                <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
                  <Link href={pageHref(item.title)} className="flex items-center gap-2 font-medium text-ink hover:text-accent">
                    {item.thumbImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbImageUrl} alt="" className="h-6 w-6 shrink-0 rounded object-cover" loading="lazy" />
                    ) : (
                      <span className="h-6 w-6 shrink-0 rounded bg-surface-2" aria-hidden />
                    )}
                    <span className="whitespace-nowrap">{item.title}</span>
                  </Link>
                </td>
                {cells.map((cell, index) => {
                  const ref = columns[index];
                  return (
                    <td
                      key={index}
                      className={`whitespace-nowrap px-3 py-1.5 ${ref.columnIndex === 0 ? "border-l border-line" : ""} ${
                        ref.column.type === "number" ? "text-right tabular-nums" : ""
                      }`}
                    >
                      <Cell cell={cell} ref_={ref} missing={isMissing(ref, cell)} notNumber={isNotNumber(ref, cell)} pageHref={pageHref} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({
  cell,
  ref_,
  missing,
  notNumber,
  pageHref,
}: {
  cell: CellValue;
  ref_: RuleColumnRef;
  missing: boolean;
  notNumber: boolean;
  pageHref: (title: string) => string;
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
    return missing ? (
      <span className="rounded bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn-ink">{t("libraryPage.missing", "falta")}</span>
    ) : (
      <span className="text-subtle">—</span>
    );
  }
  if (notNumber) {
    return (
      <span
        className="rounded bg-danger-soft px-1.5 py-0.5 text-danger"
        title={t("libraryPage.notNumber", "A coluna é de número e isto não é.")}
      >
        {cell.raw}
      </span>
    );
  }
  // Célula de página: cada $[Título] vira link, o resto fica como texto.
  if (ref_.column.type === "page" || cell.raw.includes("$[")) {
    const parts = cell.raw.split(/(\$\[[^\]]+\])/g).filter(Boolean);
    return (
      <>
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
      </>
    );
  }
  return <span className="text-ink">{cell.raw}</span>;
}
