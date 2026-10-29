"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import {
  TABLE_COLUMN_TYPES,
  columnHeader,
  parseTableRule,
  sameTableName,
  type TableColumnType,
  type TableRule,
} from "@/lib/tableRule/tableRule";
import { inferTableRule } from "@/lib/tableRule/read";

/** Referência estável para o projeto sem páginas, para não re-renderizar à toa. */
const NO_SECTIONS: Array<{ id: string; parentId?: string; content?: string; contentBlocks?: unknown }> = [];

type DraftColumn = { name: string; type: TableColumnType; unit: string; required: boolean };
type DraftTable = { name: string; columns: DraftColumn[] };

const toDraft = (rule: TableRule | null | undefined): DraftTable[] =>
  (rule?.tables ?? []).map((t) => ({
    name: t.name,
    columns: t.columns.map((c) => ({ name: c.name, type: c.type, unit: c.unit ?? "", required: !!c.required })),
  }));

const fromDraft = (tables: DraftTable[]): TableRule | undefined =>
  parseTableRule({
    tables: tables.map((t) => ({
      name: t.name,
      columns: t.columns.map((c) => ({ name: c.name, type: c.type, unit: c.unit, required: c.required })),
    })),
  });

const emptyColumn = (): DraftColumn => ({ name: "", type: "number", unit: "", required: true });

const move = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** O que está errado no rascunho, por posição. Nome é a identidade: vazio ou repetido não salva. */
function problemsOf(tables: DraftTable[]) {
  const table = new Map<number, string>();
  const column = new Map<string, string>();
  tables.forEach((t, ti) => {
    if (!t.name.trim()) table.set(ti, "empty");
    else if (tables.findIndex((o) => sameTableName(o.name, t.name)) !== ti) table.set(ti, "repeated");
    t.columns.forEach((c, ci) => {
      if (!c.name.trim()) column.set(`${ti}:${ci}`, "empty");
      else if (t.columns.findIndex((o) => sameTableName(o.name, c.name)) !== ci) column.set(`${ti}:${ci}`, "repeated");
    });
    if (t.columns.length === 0) table.set(ti, "noColumns");
  });
  return { table, column, ok: table.size === 0 && column.size === 0 };
}

/**
 * A regra de tabelas da página-mãe: quais tabelas as filhas carregam e as
 * colunas de cada uma. Mora no cabeçalho da página, ao lado da exibição no
 * Deck, e só aparece em página com filhas.
 *
 * A regra é dica de leitura. Salvar não mexe em página nenhuma: as tabelas
 * continuam no texto das filhas, e é contra elas que a Biblioteca confere.
 */
export default function TableRuleEditor({
  projectId,
  projectSlug,
  sectionId,
  tableRule,
  readOnly = false,
}: {
  /** UUID do projeto, não o slug. */
  projectId: string;
  /** Segmento da URL do projeto, para o link da Biblioteca. */
  projectSlug: string;
  sectionId: string;
  tableRule: TableRule | null | undefined;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
  const setSectionTableRule = useProjectStore((s) => s.setSectionTableRule);
  const sections = useProjectStore((s) => s.projects.find((p) => p.id === projectId)?.sections ?? NO_SECTIONS);
  const children = useMemo(() => sections.filter((s) => s.parentId === sectionId), [sections, sectionId]);
  const rule = parseTableRule(tableRule);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftTable[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (children.length === 0) return null;

  const inferred = () => inferTableRule(children);
  const problems = problemsOf(draft);

  const openEditor = () => {
    // Sem regra, já começa com o que as filhas escrevem: o caminho mais curto
    // até uma regra certa é revisar a proposta, não digitar do zero.
    setDraft(toDraft(rule ?? inferred()));
    setConfirmRemove(false);
    setOpen(true);
  };

  const save = () => {
    if (!problems.ok) return;
    setSectionTableRule(projectId, sectionId, fromDraft(draft));
    setOpen(false);
  };

  const remove = () => {
    setSectionTableRule(projectId, sectionId, undefined);
    setOpen(false);
  };

  const updateTable = (ti: number, patch: Partial<DraftTable>) =>
    setDraft((d) => d.map((tb, i) => (i === ti ? { ...tb, ...patch } : tb)));
  const updateColumn = (ti: number, ci: number, patch: Partial<DraftColumn>) =>
    setDraft((d) =>
      d.map((tb, i) => (i === ti ? { ...tb, columns: tb.columns.map((c, j) => (j === ci ? { ...c, ...patch } : c)) } : tb)),
    );

  const typeLabel: Record<TableColumnType, string> = {
    number: t("tableRule.type.number", "Número"),
    text: t("tableRule.type.text", "Texto"),
    boolean: t("tableRule.type.boolean", "Sim/não"),
    page: t("tableRule.type.page", "Página"),
  };

  const pill = rule ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-area-lib/40 bg-area-lib-soft px-2.5 py-0.5 text-[11px] font-semibold leading-none text-area-lib">
      <span aria-hidden>▤</span>
      {t("tableRule.pill", "{n} tabelas").replace("{n}", String(rule.tables.length))}
    </span>
  ) : (
    <span className="text-[11px] text-subtle transition-colors group-hover:text-muted">
      {t("tableRule.set", "+ regra de tabelas")}
    </span>
  );

  if (readOnly) return rule ? pill : null;

  const inputBase =
    "h-8 rounded-md border bg-surface px-2 text-sm text-ink placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent/40";
  const lineFor = (bad: boolean) => (bad ? "border-danger" : "border-line");
  const iconButton =
    "grid h-8 w-7 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="group rounded-full transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        title={t("tableRule.pickerTitle", "Quais tabelas as subpáginas carregam")}
      >
        {pill}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("tableRule.title", "Regra de tabelas")}
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-16 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-line bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold text-ink">{t("tableRule.title", "Regra de tabelas")}</h2>
              <p className="mt-1 text-sm text-muted">
                {t(
                  "tableRule.lead",
                  "As tabelas que cada subpágina carrega na descrição, com o título que vai em cima delas. A Biblioteca confere as {n} subpáginas contra esta lista — a regra não muda o texto de nenhuma.",
                ).replace("{n}", String(children.length))}
              </p>
            </header>

            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-4">
              {draft.length === 0 && (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
                  {t("tableRule.empty", "As subpáginas ainda não têm tabela. Comece com uma.")}
                </p>
              )}

              {draft.map((table, ti) => {
                const tableProblem = problems.table.get(ti);
                return (
                  <section key={ti} className="rounded-xl border border-line bg-surface-2/50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-subtle" aria-hidden>
                        ##
                      </span>
                      <input
                        value={table.name}
                        onChange={(e) => updateTable(ti, { name: e.target.value })}
                        placeholder={t("tableRule.tableName", "Título da tabela")}
                        aria-label={t("tableRule.tableName", "Título da tabela")}
                        className={`${inputBase} ${lineFor(tableProblem === "empty" || tableProblem === "repeated")} flex-1 font-semibold`}
                      />
                      <button type="button" className={iconButton} disabled={ti === 0} onClick={() => setDraft((d) => move(d, ti, ti - 1))} aria-label={t("tableRule.up", "Subir")}>↑</button>
                      <button type="button" className={iconButton} disabled={ti === draft.length - 1} onClick={() => setDraft((d) => move(d, ti, ti + 1))} aria-label={t("tableRule.down", "Descer")}>↓</button>
                      <button type="button" className={iconButton} onClick={() => setDraft((d) => d.filter((_, i) => i !== ti))} aria-label={t("tableRule.removeTable", "Tirar a tabela")}>✕</button>
                    </div>
                    {tableProblem === "repeated" && (
                      <p className="mt-1 pl-7 text-xs text-danger">{t("tableRule.repeatedTable", "Já existe uma tabela com esse título.")}</p>
                    )}

                    <div className="mt-3 flex flex-col gap-1.5 pl-7">
                      <div className="hidden grid-cols-[1fr_8rem_5rem_4.5rem_5.5rem] gap-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-subtle sm:grid">
                        <span>{t("tableRule.colName", "Coluna")}</span>
                        <span>{t("tableRule.colType", "Tipo")}</span>
                        <span>{t("tableRule.colUnit", "Unidade")}</span>
                        <span>{t("tableRule.colRequired", "Exigida")}</span>
                        <span />
                      </div>
                      {table.columns.map((column, ci) => {
                        const columnProblem = problems.column.get(`${ti}:${ci}`);
                        return (
                          <div key={ci} className="grid grid-cols-[1fr_8rem] gap-2 sm:grid-cols-[1fr_8rem_5rem_4.5rem_5.5rem]">
                            <input
                              value={column.name}
                              onChange={(e) => updateColumn(ti, ci, { name: e.target.value })}
                              placeholder={t("tableRule.colName", "Coluna")}
                              aria-label={t("tableRule.colName", "Coluna")}
                              title={columnProblem === "repeated" ? t("tableRule.repeatedColumn", "Já existe uma coluna com esse nome nesta tabela.") : columnHeader(column)}
                              className={`${inputBase} ${lineFor(!!columnProblem)} min-w-0`}
                            />
                            <select
                              value={column.type}
                              onChange={(e) => updateColumn(ti, ci, { type: e.target.value as TableColumnType })}
                              aria-label={t("tableRule.colType", "Tipo")}
                              className={`${inputBase} border-line`}
                            >
                              {TABLE_COLUMN_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {typeLabel[type]}
                                </option>
                              ))}
                            </select>
                            <input
                              value={column.unit}
                              onChange={(e) => updateColumn(ti, ci, { unit: e.target.value })}
                              placeholder={t("tableRule.unitPlaceholder", "s, %…")}
                              aria-label={t("tableRule.colUnit", "Unidade")}
                              className={`${inputBase} border-line min-w-0`}
                            />
                            <label className="flex h-8 items-center gap-1.5 text-xs text-muted">
                              <input
                                type="checkbox"
                                checked={column.required}
                                onChange={(e) => updateColumn(ti, ci, { required: e.target.checked })}
                                className="h-4 w-4 accent-[var(--accent)]"
                              />
                              <span className="sm:sr-only">{t("tableRule.colRequired", "Exigida")}</span>
                            </label>
                            <div className="flex items-center">
                              <button type="button" className={iconButton} disabled={ci === 0} onClick={() => updateTable(ti, { columns: move(table.columns, ci, ci - 1) })} aria-label={t("tableRule.up", "Subir")}>↑</button>
                              <button type="button" className={iconButton} disabled={ci === table.columns.length - 1} onClick={() => updateTable(ti, { columns: move(table.columns, ci, ci + 1) })} aria-label={t("tableRule.down", "Descer")}>↓</button>
                              <button type="button" className={iconButton} onClick={() => updateTable(ti, { columns: table.columns.filter((_, j) => j !== ci) })} aria-label={t("tableRule.removeColumn", "Tirar a coluna")}>✕</button>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => updateTable(ti, { columns: [...table.columns, emptyColumn()] })}
                        className="self-start rounded-md px-1 py-1 text-xs font-medium text-accent hover:underline"
                      >
                        {t("tableRule.addColumn", "+ coluna")}
                      </button>
                      {tableProblem === "noColumns" && (
                        <p className="text-xs text-danger">{t("tableRule.noColumns", "Uma tabela precisa de pelo menos uma coluna.")}</p>
                      )}
                    </div>
                  </section>
                );
              })}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDraft((d) => [...d, { name: "", columns: [emptyColumn()] }])}
                  className="rounded-lg border border-dashed border-line-strong px-3 py-1.5 text-sm text-ink hover:bg-surface-2"
                >
                  {t("tableRule.addTable", "+ tabela")}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(toDraft(inferred()))}
                  className="text-sm text-muted hover:text-ink"
                  title={t("tableRule.inferHint", "Lê os títulos e cabeçalhos que as subpáginas já escrevem")}
                >
                  {t("tableRule.infer", "Montar a partir das subpáginas")}
                </button>
              </div>
            </div>

            <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
              {rule && !confirmRemove && (
                <button type="button" onClick={() => setConfirmRemove(true)} className="text-sm text-danger hover:underline">
                  {t("tableRule.remove", "Tirar a regra")}
                </button>
              )}
              {confirmRemove && (
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-muted">{t("tableRule.removeConfirm", "As tabelas das subpáginas ficam. Tirar a regra?")}</span>
                  <button type="button" onClick={remove} className="font-medium text-danger hover:underline">
                    {t("tableRule.removeYes", "Tirar")}
                  </button>
                </span>
              )}
              {rule && (
                <Link
                  href={`/projects/${projectSlug}/biblioteca?c=${sectionId}`}
                  className="text-sm text-muted hover:text-ink"
                >
                  {t("tableRule.openLibrary", "Ver na Biblioteca")}
                </Link>
              )}
              <span className="ml-auto" />
              <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg px-3 text-sm text-ink hover:bg-surface-2">
                {t("common.cancel", "Cancelar")}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!problems.ok || draft.length === 0}
                className="h-9 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-strong disabled:opacity-40"
              >
                {t("tableRule.save", "Salvar regra")}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
