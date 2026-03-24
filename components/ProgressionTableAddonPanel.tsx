"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  ProgressionColumnGenerator,
  ProgressionTableAddonDraft,
  ProgressionTableColumn,
  ProgressionTableRow,
} from "@/lib/addons/types";
import { buildProgressionRowsFromRange } from "@/lib/addons/types";
import {
  applyColumnClamp,
  applyColumnDecimals,
  generateAllProgressionColumnValues,
  generateProgressionColumnValues,
  clampValueWithBounds,
} from "@/lib/addons/progressionTableGenerator";
import { buildProgressionTableComputedExport } from "@/lib/addons/progressionTableExport";
import { useI18n } from "@/lib/i18n/provider";
import { blurOnEnterKey } from "@/hooks/useBlurCommitText";
import { ToggleSwitch } from "@/components/ToggleSwitch";

const FORMULA_ALLOWED_CHARS = /^[0-9,+\-*/().\s_a-zA-Z]+$/;
const FORMULA_ALLOWED_VARIABLES = new Set(["base", "level", "delta"]);
const FORMULA_ALLOWED_FUNCTIONS = new Set(["min", "max", "round", "floor", "ceil", "abs", "pow"]);
const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-2.5 py-1.5 text-xs text-white outline-none focus:border-gray-500";
const INPUT_CLASS_LG =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_PRIMARY_CLASS = "rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-100 hover:bg-gray-700";
const BUTTON_SECONDARY_CLASS = "rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-gray-100 hover:bg-gray-700";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/20 px-2 py-1.5 text-[11px] text-rose-200 hover:bg-rose-900/40";
const FORMULA_CHEATSHEET_EXAMPLES = [
  { label: "Custo progressivo", expression: "base * 1.2 + delta" },
  { label: "Cap de teto", expression: "min(pow(base, 2), 500)" },
  { label: "Arredondamento", expression: "round(base / 3, 1)" },
  { label: "Suavização de pico", expression: "max(10, base - abs(delta - 5))" },
  { label: "Ajuste por nível", expression: "base + level * 0.5" },
];

interface ProgressionTableAddonPanelProps {
  addon: ProgressionTableAddonDraft;
  onChange: (next: ProgressionTableAddonDraft) => void;
  onRemove: () => void;
}

function normalizeColumns(columns: ProgressionTableColumn[]): ProgressionTableColumn[] {
  if (columns.length > 0) {
    return columns.map((column) => ({
      ...column,
      generator: column.generator ?? { mode: "manual" },
      decimals: Number.isFinite(column.decimals) ? Math.max(0, Math.min(6, Math.floor(Number(column.decimals)))) : 0,
      isPercentage: Boolean(column.isPercentage),
      min: Number.isFinite(column.min) ? Number(column.min) : undefined,
      max: Number.isFinite(column.max) ? Number(column.max) : undefined,
    }));
  }
  return [{ id: "value", name: "Valor", generator: { mode: "manual" }, decimals: 0, isPercentage: false, min: undefined, max: undefined }];
}

function remapRows(
  rows: ProgressionTableRow[],
  columns: ProgressionTableColumn[],
  startLevel: number,
  endLevel: number
): ProgressionTableRow[] {
  const safeColumns = normalizeColumns(columns);
  const baseRows = buildProgressionRowsFromRange(startLevel, endLevel, safeColumns);
  const byLevel = new Map(rows.map((row) => [row.level, row]));
  return baseRows.map((baseRow) => {
    const existing = byLevel.get(baseRow.level);
    if (!existing) return baseRow;
    const values: Record<string, number | string> = {};
    for (const column of safeColumns) {
      values[column.id] = existing.values[column.id] ?? 0;
    }
    return { level: baseRow.level, values };
  });
}

function parseNumber(value: string): number {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = parseNumber(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clampDecimals(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(6, Math.floor(value)));
}

function normalizeBounds(min?: number, max?: number): { min?: number; max?: number } {
  const safeMin = Number.isFinite(min) ? Number(min) : undefined;
  const safeMax = Number.isFinite(max) ? Number(max) : undefined;
  if (safeMin == null || safeMax == null) return { min: safeMin, max: safeMax };
  if (safeMin <= safeMax) return { min: safeMin, max: safeMax };
  return { min: safeMax, max: safeMin };
}

function countColumnValueChanges(
  previousRows: ProgressionTableRow[],
  nextRows: ProgressionTableRow[],
  columnId: string
): number {
  const previousByLevel = new Map(previousRows.map((row) => [row.level, Number(row.values[columnId])]));
  let changes = 0;
  for (const row of nextRows) {
    const before = previousByLevel.get(row.level);
    const after = Number(row.values[columnId]);
    const beforeValue = typeof before === "number" ? before : Number.NaN;
    if (!Number.isFinite(beforeValue) || !Number.isFinite(after)) continue;
    if (Math.abs(beforeValue - after) > Number.EPSILON) {
      changes += 1;
    }
  }
  return changes;
}

function defaultGeneratorForMode(
  mode: ProgressionColumnGenerator["mode"],
  columnId: string,
  columns: ProgressionTableColumn[]
): ProgressionColumnGenerator {
  if (mode === "linear") return { mode: "linear", base: 0, step: 1 };
  if (mode === "exponential") return { mode: "exponential", base: 1, growth: 1.1 };
  if (mode === "formula") {
    const fallbackBaseColumnId = columns.find((column) => column.id !== columnId)?.id ?? "";
    return {
      mode: "formula",
      baseColumnId: fallbackBaseColumnId,
      expression: "base",
    };
  }
  return { mode: "manual" };
}

function formatSummaryValue(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "n/a";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(parsed);
}

function hasValidFormulaTokens(expression: string): boolean {
  const trimmedExpression = expression.trim();
  if (!trimmedExpression) return false;
  if (!FORMULA_ALLOWED_CHARS.test(trimmedExpression)) return false;

  const identifiers = trimmedExpression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return identifiers.every(
    (token) => FORMULA_ALLOWED_VARIABLES.has(token) || FORMULA_ALLOWED_FUNCTIONS.has(token)
  );
}

function getColumnWarnings(
  column: ProgressionTableColumn,
  rows: ProgressionTableRow[],
  columns: ProgressionTableColumn[],
  t: (key: string, fallback?: string) => string
): string[] {
  const warnings: string[] = [];
  const generator = column.generator ?? { mode: "manual" as const };
  if (generator.mode === "linear") {
    if (!Number.isFinite(generator.base) || !Number.isFinite(generator.step)) {
      warnings.push(t("progressionTableAddon.warnings.invalidLinearParams", "Parametros da formula linear invalidos."));
    }
  }
  if (generator.mode === "exponential") {
    if (!Number.isFinite(generator.base) || !Number.isFinite(generator.growth)) {
      warnings.push(t("progressionTableAddon.warnings.invalidExponentialParams", "Parametros da formula exponencial invalidos."));
    } else if (generator.growth <= 0) {
      warnings.push(t("progressionTableAddon.warnings.growthMustBePositive", "Growth deve ser maior que zero."));
    }
  }
  if (generator.mode === "formula") {
    if (!generator.expression.trim()) {
      warnings.push(t("progressionTableAddon.warnings.emptyExpression", "A expressao da formula nao pode ficar vazia."));
    } else if (!hasValidFormulaTokens(generator.expression)) {
      warnings.push(
        t(
          "progressionTableAddon.warnings.invalidFormula",
          "Formula invalida. Use base/level/delta, funcoes min/max/round/floor/ceil/abs/pow e operadores + - * / ( ) ,."
        )
      );
    }

    if (!generator.baseColumnId) {
      warnings.push(t("progressionTableAddon.warnings.selectBaseColumn", "Selecione a coluna base para a formula."));
    } else if (generator.baseColumnId === column.id) {
      warnings.push(t("progressionTableAddon.warnings.baseCannotBeSelf", "A coluna base nao pode ser a propria coluna."));
    } else {
      const currentIndex = columns.findIndex((item) => item.id === column.id);
      const baseIndex = columns.findIndex((item) => item.id === generator.baseColumnId);
      if (baseIndex < 0) {
        warnings.push(t("progressionTableAddon.warnings.baseNoLongerExists", "A coluna base selecionada nao existe mais."));
      } else if (baseIndex > currentIndex) {
        warnings.push(
          t(
            "progressionTableAddon.warnings.baseAfterColumn",
            "A coluna base esta depois desta coluna. Reordene para gerar corretamente."
          )
        );
      }
    }
  }

  const hasMin = Number.isFinite(column.min);
  const hasMax = Number.isFinite(column.max);
  if (hasMin && hasMax && Number(column.min) > Number(column.max)) {
    warnings.push(
      t("progressionTableAddon.warnings.minGreaterThanMax", "Minimo maior que maximo. Os limites serao ajustados automaticamente.")
    );
  }

  const bounds = normalizeBounds(column.min, column.max);
  if (bounds.min != null || bounds.max != null) {
    let outOfBoundsCount = 0;
    for (const row of rows) {
      const value = Number(row.values[column.id]);
      if (!Number.isFinite(value)) continue;
      if (bounds.min != null && value < bounds.min) outOfBoundsCount += 1;
      else if (bounds.max != null && value > bounds.max) outOfBoundsCount += 1;
    }
    if (outOfBoundsCount > 0) {
      warnings.push(
        t("progressionTableAddon.warnings.outOfBounds", "{count} valor(es) fora dos limites definidos para esta coluna.").replace(
          "{count}",
          String(outOfBoundsCount)
        )
      );
    }
  }

  let hasNegative = false;
  let hasNonNumeric = false;
  for (const row of rows) {
    const value = Number(row.values[column.id]);
    if (!Number.isFinite(value)) {
      hasNonNumeric = true;
      continue;
    }
    if (value < 0) hasNegative = true;
  }
  if (hasNonNumeric) warnings.push(t("progressionTableAddon.warnings.hasNonNumeric", "Ha valores nao numericos (NaN) nesta coluna."));
  if (hasNegative) warnings.push(t("progressionTableAddon.warnings.hasNegative", "Ha valores negativos nesta coluna."));
  return warnings;
}

export function ProgressionTableAddonPanel({ addon, onChange, onRemove }: ProgressionTableAddonPanelProps) {
  const { t } = useI18n();
  const [lastGeneratedColumnId, setLastGeneratedColumnId] = useState<string | null>(null);
  const [clampSummaryByColumnId, setClampSummaryByColumnId] = useState<Record<string, number>>({});
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [exportFeedback, setExportFeedback] = useState<"idle" | "success" | "error">("idle");
  const [columnNameDrafts, setColumnNameDrafts] = useState<Record<string, string>>({});
  const [formulaDrafts, setFormulaDrafts] = useState<Record<string, string>>({});
  const columns = useMemo(() => normalizeColumns(addon.columns || []), [addon.columns]);
  const startLevel = Math.max(1, Math.floor(addon.startLevel || 1));
  const endLevel = Math.max(startLevel, Math.floor(addon.endLevel || startLevel));
  const rows = remapRows(addon.rows || [], columns, startLevel, endLevel);
  const columnIdSignature = useMemo(() => columns.map((column) => column.id).join("|"), [columns]);

  useEffect(() => {
    setCollapsedColumns((prev) => {
      const next: Record<string, boolean> = {};
      for (const column of columns) {
        next[column.id] = prev[column.id] ?? false;
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key])) {
        return prev;
      }
      return next;
    });
  }, [columnIdSignature, columns]);

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    const nextFormulas: Record<string, string> = {};
    for (const column of columns) {
      nextDrafts[column.id] = column.name ?? "";
      nextFormulas[column.id] =
        column.generator?.mode === "formula" ? column.generator.expression : "base";
    }
    setColumnNameDrafts(nextDrafts);
    setFormulaDrafts(nextFormulas);
  }, [columnIdSignature, columns]);

  const commit = (next: Partial<ProgressionTableAddonDraft>) => {
    onChange({
      ...addon,
      ...next,
    });
  };

  const updateRange = (nextStart: number, nextEnd: number) => {
    const safeStart = Math.max(1, Math.floor(nextStart || 1));
    const safeEnd = Math.max(safeStart, Math.floor(nextEnd || safeStart));
    commit({
      startLevel: safeStart,
      endLevel: safeEnd,
      rows: remapRows(rows, columns, safeStart, safeEnd),
      columns,
    });
  };

  const updateColumnName = (columnId: string, columnName: string) => {
    const nextColumns = columns.map((column) =>
      column.id === columnId ? { ...column, name: columnName } : column
    );
    commit({
      columns: nextColumns,
      rows: remapRows(rows, nextColumns, startLevel, endLevel),
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId({});
  };

  const commitColumnName = (columnId: string) => {
    const current = columns.find((column) => column.id === columnId)?.name ?? "";
    const draft = columnNameDrafts[columnId] ?? "";
    if (draft !== current) {
      updateColumnName(columnId, draft);
    }
  };

  const commitFormulaExpression = (columnId: string) => {
    const column = columns.find((item) => item.id === columnId);
    if (!column || column.generator?.mode !== "formula") return;
    const currentExpression = column.generator.expression;
    const draftExpression = formulaDrafts[columnId] ?? "base";
    if (draftExpression !== currentExpression) {
      updateColumnGeneratorParams(columnId, {
        expression: draftExpression,
      });
    }
  };

  const updateColumnGeneratorMode = (columnId: string, mode: ProgressionColumnGenerator["mode"]) => {
    const nextColumns = columns.map((column) =>
      column.id === columnId ? { ...column, generator: defaultGeneratorForMode(mode, columnId, columns) } : column
    );
    commit({
      columns: nextColumns,
      rows: remapRows(rows, nextColumns, startLevel, endLevel),
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId({});
  };

  const updateColumnGeneratorParams = (columnId: string, patch: Partial<ProgressionColumnGenerator>) => {
    const nextColumns: ProgressionTableColumn[] = columns.map((column) => {
      if (column.id !== columnId) return column;
      const currentGenerator = column.generator ?? { mode: "manual" as const };
      if (currentGenerator.mode === "manual") return column;
      switch (currentGenerator.mode) {
        case "linear": {
          const linearPatch = patch.mode === "linear" || patch.mode == null ? patch : {};
          return {
            ...column,
            generator: {
              mode: "linear",
              base: Number.isFinite((linearPatch as { base?: number }).base)
                ? Number((linearPatch as { base?: number }).base)
                : currentGenerator.base,
              step: Number.isFinite((linearPatch as { step?: number }).step)
                ? Number((linearPatch as { step?: number }).step)
                : currentGenerator.step,
            },
          };
        }
        case "exponential": {
          const exponentialPatch = patch.mode === "exponential" || patch.mode == null ? patch : {};
          return {
            ...column,
            generator: {
              mode: "exponential",
              base: Number.isFinite((exponentialPatch as { base?: number }).base)
                ? Number((exponentialPatch as { base?: number }).base)
                : currentGenerator.base,
              growth: Number.isFinite((exponentialPatch as { growth?: number }).growth)
                ? Number((exponentialPatch as { growth?: number }).growth)
                : currentGenerator.growth,
            },
          };
        }
        case "formula": {
          const formulaPatch = patch.mode === "formula" || patch.mode == null ? patch : {};
          return {
            ...column,
            generator: {
              mode: "formula",
              baseColumnId: (formulaPatch as { baseColumnId?: string }).baseColumnId ?? currentGenerator.baseColumnId,
              expression: (formulaPatch as { expression?: string }).expression ?? currentGenerator.expression,
            },
          };
        }
      }
    });
    commit({
      columns: nextColumns,
      rows: remapRows(rows, nextColumns, startLevel, endLevel),
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId({});
  };

  const updateColumnDecimals = (columnId: string, rawValue: string) => {
    const decimals = clampDecimals(parseNumber(rawValue));
    const nextColumns = columns.map((column) => (column.id === columnId ? { ...column, decimals } : column));
    const updatedColumn = nextColumns.find((column) => column.id === columnId);
    const bounds = normalizeBounds(updatedColumn?.min, updatedColumn?.max);
    const nextRows = applyColumnDecimals({
      rows,
      columnId,
      decimals,
      min: bounds.min,
      max: bounds.max,
    });
    const clampedValues = countColumnValueChanges(rows, nextRows, columnId);
    commit({
      columns: nextColumns,
      rows: nextRows,
      startLevel,
      endLevel,
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId((prev) => ({
      ...prev,
      [columnId]: clampedValues,
    }));
  };

  const updateColumnBounds = (columnId: string, field: "min" | "max", rawValue: string) => {
    const parsedValue = parseOptionalNumber(rawValue);
    const nextColumns = columns.map((column) =>
      column.id === columnId ? { ...column, [field]: parsedValue } : column
    );
    const updatedColumn = nextColumns.find((column) => column.id === columnId);
    const bounds = normalizeBounds(updatedColumn?.min, updatedColumn?.max);
    const nextRows = applyColumnClamp({
      rows,
      columnId,
      min: bounds.min,
      max: bounds.max,
    });
    const clampedValues = countColumnValueChanges(rows, nextRows, columnId);
    commit({
      columns: nextColumns,
      rows: nextRows,
      startLevel,
      endLevel,
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId((prev) => ({
      ...prev,
      [columnId]: clampedValues,
    }));
  };

  const updateColumnPercentage = (columnId: string, isPercentage: boolean) => {
    const nextColumns = columns.map((column) => (column.id === columnId ? { ...column, isPercentage } : column));
    commit({
      columns: nextColumns,
      rows: remapRows(rows, nextColumns, startLevel, endLevel),
    });
  };

  const generateColumn = (columnId: string) => {
    const column = columns.find((item) => item.id === columnId);
    if (!column) return;
    const generator = column.generator ?? { mode: "manual" as const };
    if (generator.mode === "manual") return;
    const bounds = normalizeBounds(column.min, column.max);
    const rawRows = generateProgressionColumnValues({
      rows,
      columnId,
      startLevel,
      generator,
      decimals: column.decimals,
    });
    const nextRows = applyColumnClamp({
      rows: rawRows,
      columnId,
      min: bounds.min,
      max: bounds.max,
    });
    const clampedValues = countColumnValueChanges(rawRows, nextRows, columnId);
    commit({
      rows: nextRows,
      columns,
      startLevel,
      endLevel,
    });
    setLastGeneratedColumnId(columnId);
    setClampSummaryByColumnId((prev) => ({
      ...prev,
      [columnId]: clampedValues,
    }));
  };

  const generateAllColumns = () => {
    const rawRows = generateAllProgressionColumnValues({
      rows,
      columns: columns.map((column) => ({ ...column, min: undefined, max: undefined })),
      startLevel,
    });
    const nextRows = generateAllProgressionColumnValues({
      rows,
      columns,
      startLevel,
    });
    const summary: Record<string, number> = {};
    for (const column of columns) {
      summary[column.id] = countColumnValueChanges(rawRows, nextRows, column.id);
    }
    commit({
      rows: nextRows,
      columns,
      startLevel,
      endLevel,
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId(summary);
  };

  const addColumn = () => {
    const id = `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nextColumns = [
      ...columns,
      { id, name: "Nova Coluna", generator: { mode: "manual" as const }, min: undefined, max: undefined },
    ];
    nextColumns[nextColumns.length - 1].decimals = 0;
    nextColumns[nextColumns.length - 1].isPercentage = false;
    commit({
      columns: nextColumns,
      rows: remapRows(rows, nextColumns, startLevel, endLevel),
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId({});
  };

  const removeColumn = (columnId: string) => {
    if (columns.length <= 1) return;
    const nextColumns = columns.filter((column) => column.id !== columnId);
    commit({
      columns: nextColumns,
      rows: remapRows(rows, nextColumns, startLevel, endLevel),
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId({});
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columns.findIndex((column) => column.id === String(active.id));
    const newIndex = columns.findIndex((column) => column.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    const nextColumns = arrayMove(columns, oldIndex, newIndex);
    commit({
      columns: nextColumns,
      rows: remapRows(rows, nextColumns, startLevel, endLevel),
    });
  };

  const updateCell = (level: number, columnId: string, rawValue: string) => {
    const column = columns.find((item) => item.id === columnId);
    const bounds = normalizeBounds(column?.min, column?.max);
    const parsedValue = parseNumber(rawValue);
    const clampedValue = clampValueWithBounds(parsedValue, bounds.min, bounds.max);
    const nextRows = rows.map((row) => {
      if (row.level !== level) return row;
      return {
        ...row,
        values: {
          ...row.values,
          [columnId]: clampedValue,
        },
      };
    });
    commit({
      rows: nextRows,
      columns,
      startLevel,
      endLevel,
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId((prev) => ({
      ...prev,
      [columnId]: 0,
    }));
  };

  const toggleColumnCollapsed = (columnId: string) => {
    setCollapsedColumns((prev) => ({
      ...prev,
      [columnId]: !(prev[columnId] ?? false),
    }));
  };

  const handleExportJson = () => {
    try {
      const payload = buildProgressionTableComputedExport({
        ...addon,
        columns,
        rows,
        startLevel,
        endLevel,
      });
      const safeBaseName = (addon.name || "progression-table")
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
        .replace(/\s+/g, "-")
        .toLowerCase();
      const filename = `${safeBaseName || "progression-table"}.progression-table.v1.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportFeedback("success");
    } catch {
      setExportFeedback("error");
    }
  };

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="mb-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("progressionTableAddon.startLevelLabel", "Level inicial")}
            </span>
            <input
              type="number"
              value={startLevel}
              onChange={(e) => updateRange(parseNumber(e.target.value), endLevel)}
              className={INPUT_CLASS_LG}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("progressionTableAddon.endLevelLabel", "Level final")}
            </span>
            <input
              type="number"
              value={endLevel}
              onChange={(e) => updateRange(startLevel, parseNumber(e.target.value))}
              className={INPUT_CLASS_LG}
            />
          </label>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-300">{t("progressionTableAddon.columnsByLevel", "Colunas de atributos por level")}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={generateAllColumns}
            className={BUTTON_PRIMARY_CLASS}
          >
            {t("progressionTableAddon.generateAllColumns", "Gerar todas as colunas")}
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className={BUTTON_SECONDARY_CLASS}
          >
            {t("progressionTableAddon.exportButton", "Exportar JSON")}
          </button>
          <button
            type="button"
            onClick={addColumn}
            className={BUTTON_PRIMARY_CLASS}
          >
            {t("progressionTableAddon.addColumnButton", "+ Coluna")}
          </button>
        </div>
      </div>
      {exportFeedback !== "idle" && (
        <p className={`mb-3 text-xs ${exportFeedback === "success" ? "text-gray-300" : "text-rose-300"}`}>
          {exportFeedback === "success"
            ? t("progressionTableAddon.exportSuccess", "JSON exportado com sucesso.")
            : t("progressionTableAddon.exportError", "Nao foi possivel exportar o JSON.")}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={columns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {columns.map((column) => (
              <SortableColumnBlock key={column.id} id={column.id}>
                {(() => {
                  const warnings = getColumnWarnings(column, rows, columns, t);
                  const startRow = rows.find((row) => row.level === startLevel);
                  const endRow = rows.find((row) => row.level === endLevel);
                  const startValue = startRow?.values[column.id];
                  const endValue = endRow?.values[column.id];
                  return (
                <div className={PANEL_BLOCK_CLASS}>
                  <button
                    type="button"
                    onClick={() => toggleColumnCollapsed(column.id)}
                    aria-expanded={!collapsedColumns[column.id]}
                    className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left hover:bg-gray-800/40"
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                      <span
                        className="inline-flex cursor-grab items-center text-gray-400 active:cursor-grabbing"
                        data-drag-handle
                        onClick={(event) => event.stopPropagation()}
                        aria-label={t("progressionTableAddon.dragBlockAria", "Arrastar bloco")}
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <circle cx="6" cy="5" r="1.5" />
                          <circle cx="6" cy="10" r="1.5" />
                          <circle cx="6" cy="15" r="1.5" />
                          <circle cx="12" cy="5" r="1.5" />
                          <circle cx="12" cy="10" r="1.5" />
                          <circle cx="12" cy="15" r="1.5" />
                        </svg>
                      </span>
                      {column.name || t("progressionTableAddon.columnFallback", "Coluna")}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {t("progressionTableAddon.levelPrefix", "Lv")} {startLevel} {"->"} {t("progressionTableAddon.levelPrefix", "Lv")}{" "}
                      {endLevel}: {formatSummaryValue(startValue)} {"->"} {formatSummaryValue(endValue)}
                    </span>
                    <span
                      className="text-[11px] text-gray-300 transition-transform duration-200"
                      style={{ transform: collapsedColumns[column.id] ? "rotate(0deg)" : "rotate(180deg)" }}
                    >
                      ▼
                    </span>
                  </button>

                  {!collapsedColumns[column.id] && (
                    <div className="space-y-3">
                      <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={columnNameDrafts[column.id] ?? column.name}
                            onChange={(e) =>
                              setColumnNameDrafts((prev) => ({
                                ...prev,
                                [column.id]: e.target.value,
                              }))
                            }
                            onBlur={() => commitColumnName(column.id)}
                            onKeyDown={blurOnEnterKey}
                            className={INPUT_CLASS}
                          />
                          <button
                            type="button"
                            onClick={() => removeColumn(column.id)}
                            disabled={columns.length <= 1}
                            className={`${BUTTON_DANGER_CLASS} disabled:opacity-40`}
                          >
                            {t("progressionTableAddon.removeColumnButton", "Remover")}
                          </button>
                        </div>

                        <label className="block">
                          <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                            {t("progressionTableAddon.modeLabel", "Modo")}
                          </span>
                          <select
                            value={column.generator?.mode ?? "manual"}
                            onChange={(e) =>
                              updateColumnGeneratorMode(
                                column.id,
                                e.target.value as ProgressionColumnGenerator["mode"]
                              )
                            }
                            className={INPUT_CLASS}
                          >
                            <option value="manual">{t("progressionTableAddon.mode.manual", "Manual")}</option>
                            <option value="linear">{t("progressionTableAddon.mode.linear", "Linear")}</option>
                            <option value="exponential">{t("progressionTableAddon.mode.exponential", "Exponencial")}</option>
                            <option value="formula">{t("progressionTableAddon.mode.formula", "Formula")}</option>
                          </select>
                        </label>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                              {t("progressionTableAddon.decimalsLabel", "Casas decimais")}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={6}
                              step={1}
                              value={column.decimals ?? 0}
                              onChange={(e) => updateColumnDecimals(column.id, e.target.value)}
                              className={INPUT_CLASS}
                            />
                          </label>
                          <div className="block">
                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                              {t("progressionTableAddon.percentageLabel", "Percentual (%)")}
                            </span>
                            <ToggleSwitch
                              checked={Boolean(column.isPercentage)}
                              onChange={(next) => updateColumnPercentage(column.id, next)}
                              ariaLabel={t("progressionTableAddon.percentageLabel", "Percentual (%)")}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                              {t("progressionTableAddon.minLabel", "Minimo")}
                            </span>
                            <input
                              type="number"
                              value={column.min ?? ""}
                              onChange={(e) => updateColumnBounds(column.id, "min", e.target.value)}
                              placeholder={t("progressionTableAddon.noLimitPlaceholder", "Sem limite")}
                              className={INPUT_CLASS}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                              {t("progressionTableAddon.maxLabel", "Maximo")}
                            </span>
                            <input
                              type="number"
                              value={column.max ?? ""}
                              onChange={(e) => updateColumnBounds(column.id, "max", e.target.value)}
                              placeholder={t("progressionTableAddon.noLimitPlaceholder", "Sem limite")}
                              className={INPUT_CLASS}
                            />
                          </label>
                        </div>

                        {(column.generator?.mode ?? "manual") === "linear" && (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                {t("progressionTableAddon.baseLabel", "Base")}
                              </span>
                              <input
                                type="number"
                                value={column.generator?.mode === "linear" ? column.generator.base : 0}
                                onChange={(e) =>
                                  updateColumnGeneratorParams(column.id, {
                                    base: parseNumber(e.target.value),
                                  })
                                }
                                className={INPUT_CLASS}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                {t("progressionTableAddon.stepLabel", "Step")}
                              </span>
                              <input
                                type="number"
                                value={column.generator?.mode === "linear" ? column.generator.step : 1}
                                onChange={(e) =>
                                  updateColumnGeneratorParams(column.id, {
                                    step: parseNumber(e.target.value),
                                  })
                                }
                                className={INPUT_CLASS}
                              />
                            </label>
                          </div>
                        )}

                        {(column.generator?.mode ?? "manual") === "exponential" && (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                {t("progressionTableAddon.baseLabel", "Base")}
                              </span>
                              <input
                                type="number"
                                value={column.generator?.mode === "exponential" ? column.generator.base : 1}
                                onChange={(e) =>
                                  updateColumnGeneratorParams(column.id, {
                                    base: parseNumber(e.target.value),
                                  })
                                }
                                className={INPUT_CLASS}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                {t("progressionTableAddon.growthLabel", "Growth")}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={column.generator?.mode === "exponential" ? column.generator.growth : 1.1}
                                onChange={(e) =>
                                  updateColumnGeneratorParams(column.id, {
                                    growth: parseNumber(e.target.value),
                                  })
                                }
                                className={INPUT_CLASS}
                              />
                            </label>
                          </div>
                        )}

                        {(column.generator?.mode ?? "manual") === "formula" && (
                          <div className="space-y-2">
                            <label className="block">
                              <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                {t("progressionTableAddon.baseColumnLabel", "Coluna base")}
                              </span>
                              <select
                                value={column.generator?.mode === "formula" ? column.generator.baseColumnId : ""}
                                onChange={(e) =>
                                  updateColumnGeneratorParams(column.id, {
                                    baseColumnId: e.target.value,
                                  })
                                }
                                className={INPUT_CLASS}
                              >
                                <option value="">{t("progressionTableAddon.selectPlaceholder", "Selecione...")}</option>
                                {columns
                                  .filter((item) => item.id !== column.id)
                                  .map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name || t("progressionTableAddon.columnFallback", "Coluna")}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
                                {t("progressionTableAddon.expressionLabel", "Expressao")}
                                <span className="group relative inline-flex">
                                  <button
                                    type="button"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 bg-gray-800 text-[10px] font-semibold text-gray-300 outline-none transition-colors hover:border-gray-500 hover:text-gray-100 focus-visible:border-gray-500 focus-visible:text-gray-100"
                                    aria-label={t(
                                      "progressionTableAddon.formulaHelpAria",
                                      "Ajuda sobre variaveis e funcoes da formula"
                                    )}
                                  >
                                    ?
                                  </button>
                                  <div className="pointer-events-none invisible absolute left-1/2 top-[calc(100%+6px)] z-20 w-72 -translate-x-1/2 rounded-md border border-gray-700 bg-gray-950/95 p-2.5 text-[10px] normal-case tracking-normal text-gray-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                                    <p className="font-semibold text-gray-200">
                                      {t("progressionTableAddon.cheatsheetTitle", "Cheatsheet rapido")}
                                    </p>
                                    <p className="mt-0.5 text-gray-300">
                                      {t("progressionTableAddon.formulaVariables", "Variaveis: base, level, delta")}
                                    </p>
                                    <p className="mt-1 text-gray-300">
                                      {t("progressionTableAddon.formulaFunctions", "Funcoes: min, max, round, floor, ceil, abs, pow")}
                                    </p>
                                    <p className="mt-1.5 font-semibold text-gray-200">
                                      {t("progressionTableAddon.formulaRecipes", "Receitas prontas")}
                                    </p>
                                    <ul className="mt-0.5 space-y-1 text-gray-300">
                                      {FORMULA_CHEATSHEET_EXAMPLES.map((example) => (
                                        <li key={example.label}>
                                          <span className="text-gray-100">{example.label}:</span> {example.expression}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </span>
                              </span>
                              <input
                                type="text"
                                value={formulaDrafts[column.id] ?? "base"}
                                onChange={(e) =>
                                  setFormulaDrafts((prev) => ({
                                    ...prev,
                                    [column.id]: e.target.value,
                                  }))
                                }
                                onBlur={() => commitFormulaExpression(column.id)}
                                onKeyDown={blurOnEnterKey}
                                placeholder={t("progressionTableAddon.expressionPlaceholder", "base * 1.25 + delta * 2")}
                                className={INPUT_CLASS}
                              />
                              <p className="mt-1 text-[10px] text-gray-500">
                                {t("progressionTableAddon.formulaVariables", "Variaveis: base, level, delta")}
                              </p>
                            </label>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] text-gray-400">
                            {lastGeneratedColumnId === column.id
                              ? t("progressionTableAddon.generatedNow", "Gerado agora")
                              : t("progressionTableAddon.overwritesColumn", "Sobrescreve toda a coluna")}
                          </p>
                          <button
                            type="button"
                            onClick={() => generateColumn(column.id)}
                            disabled={(column.generator?.mode ?? "manual") === "manual"}
                            className="rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-[11px] text-gray-100 hover:bg-gray-700 disabled:opacity-40"
                          >
                            {t("progressionTableAddon.generateButton", "Gerar")}
                          </button>
                        </div>
                        {Number(clampSummaryByColumnId[column.id]) > 0 && (
                          <p className="text-[10px] text-amber-300">
                            {t(
                              "progressionTableAddon.clampApplied",
                              "Limite aplicado em {count} valor(es) desta coluna."
                            ).replace("{count}", String(clampSummaryByColumnId[column.id]))}
                          </p>
                        )}
                        {warnings.length > 0 && (
                          <div className="rounded-md border border-amber-700/60 bg-amber-900/20 px-2 py-1.5 text-[11px] text-amber-200">
                            {warnings.map((warning) => (
                              <p key={warning}>{warning}</p>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="max-h-[380px] overflow-auto rounded-lg border border-gray-700">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-gray-900 text-gray-300">
                            <tr>
                              <th className="px-3 py-2">{t("progressionTableAddon.levelHeader", "Level")}</th>
                              <th className="px-3 py-2">{column.name || t("progressionTableAddon.columnFallback", "Coluna")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr key={`${column.id}-${row.level}`} className="border-t border-gray-800 text-gray-200">
                                <td className="px-3 py-1.5 font-medium">
                                  {t("progressionTableAddon.levelPrefix", "Lv")} {row.level}
                                </td>
                                <td className="px-3 py-1.5">
                                  <div className="relative">
                                    <input
                                      type="number"
                                      value={Number(row.values[column.id] ?? 0)}
                                      onChange={(e) => updateCell(row.level, column.id, e.target.value)}
                                      className={`${INPUT_CLASS} ${column.isPercentage ? "pr-6" : ""}`}
                                    />
                                    {column.isPercentage && (
                                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-300">
                                        %
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                  );
                })()}
              </SortableColumnBlock>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50"
        >
          {t("progressionTableAddon.removeAddonButton", "Remover addon")}
        </button>
      </div>
    </section>
  );
}

function SortableColumnBlock({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const stableTransform = transform
    ? {
        ...transform,
        scaleX: 1,
        scaleY: 1,
      }
    : null;
  const style = {
    transform: CSS.Transform.toString(stableTransform),
    transition,
    width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onPointerDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-drag-handle]")) {
            listeners?.onPointerDown?.(event);
          }
        }}
        onKeyDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-drag-handle]")) {
            listeners?.onKeyDown?.(event);
          }
        }}
        {...attributes}
      >
        {children}
      </div>
    </div>
  );
}
