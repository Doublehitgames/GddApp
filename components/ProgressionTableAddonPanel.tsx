"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  ProgressionTableColumnSheetsBinding,
  ProgressionTableRow,
} from "@/lib/addons/types";
import { getGoogleSheetsToken, fetchSheetRangeValues, parseSpreadsheetId, parseCellNumber } from "@/lib/googleSheets";
import { getGoogleClientId } from "@/lib/googleDrivePicker";
import type { LinkedSpreadsheet } from "@/store/slices/types";
import { buildProgressionRowsFromRange } from "@/lib/addons/types";
import {
  applyColumnClamp,
  applyColumnDecimals,
  generateAllProgressionColumnValues,
  generateProgressionColumnValues,
  clampValueWithBounds,
} from "@/lib/addons/progressionTableGenerator";
import { buildProgressionTableComputedExport } from "@/lib/addons/progressionTableExport";
import { suggestGeneratorMode, analyzeSegments, type SuggestionResult, type CurveSegment } from "@/lib/addons/curveFitting";
import { MiniLineChart } from "@/components/MiniLineChart";
import { useI18n } from "@/lib/i18n/provider";
import { blurOnEnterKey } from "@/hooks/useBlurCommitText";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useProjectStore } from "@/store/projectStore";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import {
  CommitNumberInput,
  CommitOptionalNumberInput,
} from "@/components/common/CommitInput";
import { LibraryLabelPath } from "@/components/common/LibraryLabelPath";

const FORMULA_ALLOWED_CHARS = /^[0-9,+\-*/().\s_a-zA-Z]+$/;

/** Module-level helper: fetches a sheets range and maps raw values to per-row numbers. */
async function fetchAndMapSheetsValues(
  binding: ProgressionTableColumnSheetsBinding,
  rows: ProgressionTableRow[],
  columnId: string,
  token: string
): Promise<{ cachedValues: number[]; rowValues: Record<number, number> } | null> {
  const rawValues = await fetchSheetRangeValues(token, binding.spreadsheetId, binding.sheetName, binding.range);
  if (!rawValues) return null;
  const cachedValues: number[] = [];
  const rowValues: Record<number, number> = {};
  rows.forEach((row, i) => {
    const raw = i < rawValues.length ? rawValues[i] : null;
    let num: number | null = null;
    if (typeof raw === "number") num = raw;
    else if (typeof raw === "string") num = parseCellNumber(raw);
    const val = num ?? Number(row.values[columnId] ?? 0);
    cachedValues.push(val);
    if (num !== null) rowValues[row.level] = num;
  });
  return { cachedValues, rowValues };
}
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

type LibraryColumnOption = {
  libraryAddonId: string;
  libraryName: string;
  sectionTitle: string;
  entryId: string;
  key: string;
  label: string;
  description?: string;
};

function resolveColumnDisplayName(
  column: ProgressionTableColumn,
  availableLibraryColumns: LibraryColumnOption[]
): string {
  if (!column.libraryRef) return column.name;
  const match = availableLibraryColumns.find(
    (entry) =>
      entry.libraryAddonId === column.libraryRef!.libraryAddonId &&
      entry.entryId === column.libraryRef!.entryId
  );
  return match?.label ?? column.name;
}

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

type AutoIntervalResult =
  | { ok: true; patch: { base: number; step: number } | { base: number; growth: number } }
  | { ok: false; errorKey: string };

function computeAutoInterval(
  mode: "linear" | "exponential",
  fromValue: number,
  toValue: number,
  startLevel: number,
  endLevel: number
): AutoIntervalResult {
  const steps = endLevel - startLevel;
  if (steps <= 0) {
    return { ok: false, errorKey: "progressionTableAddon.warnings.autoIntervalRangeTooSmall" };
  }
  if (!Number.isFinite(fromValue) || !Number.isFinite(toValue)) {
    return { ok: false, errorKey: "progressionTableAddon.warnings.autoIntervalInvalidValues" };
  }
  if (mode === "linear") {
    return {
      ok: true,
      patch: {
        base: fromValue,
        step: (toValue - fromValue) / steps,
      },
    };
  }
  // exponential
  if (fromValue === 0 || toValue === 0) {
    return { ok: false, errorKey: "progressionTableAddon.warnings.autoIntervalExpNeedsPositive" };
  }
  if (Math.sign(fromValue) !== Math.sign(toValue)) {
    return { ok: false, errorKey: "progressionTableAddon.warnings.autoIntervalExpNeedsPositive" };
  }
  const growth = Math.pow(toValue / fromValue, 1 / steps);
  if (!Number.isFinite(growth) || growth <= 0) {
    return { ok: false, errorKey: "progressionTableAddon.warnings.autoIntervalExpNeedsPositive" };
  }
  const roundedGrowth = Math.round(growth * 1_000_000) / 1_000_000;
  return {
    ok: true,
    patch: {
      base: fromValue,
      growth: roundedGrowth,
    },
  };
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
  if (mode === "linear") return { mode: "linear", base: 0, step: 1, bias: 1 };
  if (mode === "exponential") return { mode: "exponential", base: 1, growth: 1.1, bias: 1 };
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
  t: (key: string, fallback?: string) => string,
  availableLibraryColumns?: LibraryColumnOption[]
): string[] {
  const warnings: string[] = [];

  // Broken library reference
  if (column.libraryRef && availableLibraryColumns) {
    const found = availableLibraryColumns.some(
      (entry) =>
        entry.libraryAddonId === column.libraryRef!.libraryAddonId &&
        entry.entryId === column.libraryRef!.entryId
    );
    if (!found) {
      warnings.push(
        t(
          "progressionTableAddon.warnings.brokenLibraryRef",
          "A coluna vinculada à Biblioteca não foi encontrada. Usando o último nome salvo como fallback."
        )
      );
    }
  }

  const generator = column.generator ?? { mode: "manual" as const };
  if (generator.mode === "linear") {
    if (!Number.isFinite(generator.base) || !Number.isFinite(generator.step)) {
      warnings.push(t("progressionTableAddon.warnings.invalidLinearParams", "Parametros da formula linear invalidos."));
    }
    if (generator.bias != null && (!Number.isFinite(generator.bias) || generator.bias <= 0)) {
      warnings.push(
        t(
          "progressionTableAddon.warnings.invalidBias",
          "Curvatura deve ser maior que zero. Usando 1.0 como fallback."
        )
      );
    }
  }
  if (generator.mode === "exponential") {
    if (!Number.isFinite(generator.base) || !Number.isFinite(generator.growth)) {
      warnings.push(t("progressionTableAddon.warnings.invalidExponentialParams", "Parametros da formula exponencial invalidos."));
    } else if (generator.growth <= 0) {
      warnings.push(t("progressionTableAddon.warnings.growthMustBePositive", "Growth deve ser maior que zero."));
    }
    if (generator.bias != null && (!Number.isFinite(generator.bias) || generator.bias <= 0)) {
      warnings.push(
        t(
          "progressionTableAddon.warnings.invalidBias",
          "Curvatura deve ser maior que zero. Usando 1.0 como fallback."
        )
      );
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
    } else if (generator.baseColumnId === "__manual__") {
      // Manual base is always valid
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
  const [pasteByColumnId, setPasteByColumnId] = useState<Record<string, string>>({});
  const [copiedColumnId, setCopiedColumnId] = useState<string | null>(null);
  const [curveSuggestion, setCurveSuggestion] = useState<Record<string, SuggestionResult>>({});
  const [columnNameDrafts, setColumnNameDrafts] = useState<Record<string, string>>({});
  const [formulaDrafts, setFormulaDrafts] = useState<Record<string, string>>({});
  const [autoIntervalOpenColumnId, setAutoIntervalOpenColumnId] = useState<string | null>(null);
  const [autoIntervalDrafts, setAutoIntervalDrafts] = useState<Record<string, { from: string; to: string }>>({});
  const autoIntervalPopoverRef = useRef<HTMLDivElement | null>(null);
  const autoIntervalButtonRef = useRef<HTMLButtonElement | null>(null);
  const [libraryPickerOpenColumnId, setLibraryPickerOpenColumnId] = useState<string | null>(null);
  const libraryPickerRef = useRef<HTMLDivElement | null>(null);

  // ── Sheets binding state ─────────────────────────────────────────────
  const [syncingColumnIds, setSyncingColumnIds] = useState<Record<string, boolean>>({});
  const [sheetsSyncErrors, setSheetsSyncErrors] = useState<Record<string, string>>({});
  const [bindingFormColumnId, setBindingFormColumnId] = useState<string | null>(null);
  const [sheetsFormRegistryId, setSheetsFormRegistryId] = useState<string>("");
  const [sheetsFormSheetName, setSheetsFormSheetName] = useState<string>("");
  const [sheetsFormRange, setSheetsFormRange] = useState<string>("");
  const [sheetsFormUrl, setSheetsFormUrl] = useState<string>("");

  // ── Library linking: collect entries from every fieldLibrary addon in the project ──
  const projects = useProjectStore((state) => state.projects);
  const currentProjectId = useCurrentProjectId();
  const availableLibraryColumns = useMemo<LibraryColumnOption[]>(() => {
    const out: LibraryColumnOption[] = [];
    const seenLibraryIds = new Set<string>();
    const scope = currentProjectId
      ? projects.filter((p) => p.id === currentProjectId)
      : projects;
    for (const project of scope) {
      for (const section of project.sections || []) {
        const sectionTitle = (section as { title?: string; id: string }).title?.trim() || (section as { id: string }).id;
        for (const sectionAddon of (section as { addons?: Array<{ id: string; type: string; name: string; data: Record<string, unknown> }> }).addons || []) {
          if (sectionAddon.type !== "fieldLibrary") continue;
          if (seenLibraryIds.has(sectionAddon.id)) continue;
          seenLibraryIds.add(sectionAddon.id);
          const libraryName = sectionAddon.name || (sectionAddon.data as { name?: string }).name || "Biblioteca";
          const entries =
            (sectionAddon.data as {
              entries?: Array<{ id: string; key: string; label: string; description?: string }>;
            }).entries || [];
          for (const entry of entries) {
            out.push({
              libraryAddonId: sectionAddon.id,
              libraryName,
              sectionTitle,
              entryId: entry.id,
              key: entry.key,
              label: entry.label || entry.key,
              description: entry.description,
            });
          }
        }
      }
    }
    return out;
  }, [projects, currentProjectId]);

  // ── Linked spreadsheets registry (project-level) ──────────────────────
  const linkedSpreadsheets = useMemo<LinkedSpreadsheet[]>(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    return (project as unknown as { linkedSpreadsheets?: LinkedSpreadsheet[] })?.linkedSpreadsheets ?? [];
  }, [projects, currentProjectId]);

  const columns = useMemo(() => normalizeColumns(addon.columns || []), [addon.columns]);
  // No more attribute overrides — `resolvedColumns` is just the raw columns.
  // Kept as alias to minimize churn at call sites.
  const resolvedColumns = columns;
  const startLevel = Math.max(1, Math.floor(addon.startLevel || 1));
  const endLevel = Math.max(startLevel, Math.floor(addon.endLevel || startLevel));
  const rows = remapRows(addon.rows || [], columns, startLevel, endLevel);
  const columnIdSignature = useMemo(() => columns.map((column) => column.id).join("|"), [columns]);

  useEffect(() => {
    setCollapsedColumns((prev) => {
      const next: Record<string, boolean> = {};
      for (const column of columns) {
        next[column.id] = prev[column.id] ?? true;
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

  // Auto-close the auto-interval popover when its column's mode leaves linear/exponential
  useEffect(() => {
    if (!autoIntervalOpenColumnId) return;
    const column = columns.find((item) => item.id === autoIntervalOpenColumnId);
    const mode = column?.generator?.mode;
    if (mode !== "linear" && mode !== "exponential") {
      setAutoIntervalOpenColumnId(null);
    }
  }, [autoIntervalOpenColumnId, columns]);

  // Close auto-interval popover on Escape key
  useEffect(() => {
    if (!autoIntervalOpenColumnId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAutoIntervalOpenColumnId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [autoIntervalOpenColumnId]);

  // Close auto-interval popover on click outside
  useEffect(() => {
    if (!autoIntervalOpenColumnId) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (autoIntervalPopoverRef.current?.contains(target)) return;
      if (autoIntervalButtonRef.current?.contains(target)) return;
      setAutoIntervalOpenColumnId(null);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [autoIntervalOpenColumnId]);

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

  const linkColumnToLibrary = (columnId: string, entry: LibraryColumnOption) => {
    const nextColumns = columns.map((column) =>
      column.id === columnId
        ? {
            ...column,
            name: entry.label,
            libraryRef: { libraryAddonId: entry.libraryAddonId, entryId: entry.entryId },
          }
        : column
    );
    commit({ columns: nextColumns, rows: remapRows(rows, nextColumns, startLevel, endLevel) });
    setColumnNameDrafts((prev) => ({ ...prev, [columnId]: entry.label }));
    setLibraryPickerOpenColumnId(null);
  };

  const unlinkColumnFromLibrary = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    if (!column) return;
    const displayName = resolveColumnDisplayName(column, availableLibraryColumns);
    const nextColumns = columns.map((col) =>
      col.id === columnId ? { ...col, name: displayName, libraryRef: undefined } : col
    );
    commit({ columns: nextColumns, rows: remapRows(rows, nextColumns, startLevel, endLevel) });
    setColumnNameDrafts((prev) => ({ ...prev, [columnId]: displayName }));
  };

  // Close library picker on click outside or Escape
  useEffect(() => {
    if (!libraryPickerOpenColumnId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLibraryPickerOpenColumnId(null);
    };
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (libraryPickerRef.current?.contains(target)) return;
      setLibraryPickerOpenColumnId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [libraryPickerOpenColumnId]);

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
    // Clear overrides for this column when switching to manual
    const nextOverrides = mode === "manual" ? removeColumnOverrides(columnId) : currentOverrides;
    commit({
      columns: nextColumns,
      rows: remapRows(rows, nextColumns, startLevel, endLevel),
      overrides: nextOverrides,
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId({});
    if (autoIntervalOpenColumnId === columnId) {
      setAutoIntervalOpenColumnId(null);
    }
  };

  const applyAutoInterval = (columnId: string) => {
    const column = columns.find((item) => item.id === columnId);
    if (!column) return;
    const mode = column.generator?.mode;
    if (mode !== "linear" && mode !== "exponential") return;
    const draft = autoIntervalDrafts[columnId] ?? { from: "", to: "" };
    const fromValue = parseNumber(draft.from);
    const toValue = parseNumber(draft.to);
    const result = computeAutoInterval(mode, fromValue, toValue, startLevel, endLevel);
    if (!result.ok) return;
    updateColumnGeneratorParams(columnId, result.patch);
    setAutoIntervalOpenColumnId(null);
    setAutoIntervalDrafts((prev) => ({ ...prev, [columnId]: { from: "", to: "" } }));
  };

  const toggleAutoIntervalPopover = (columnId: string) => {
    setAutoIntervalOpenColumnId((prev) => (prev === columnId ? null : columnId));
  };

  const updateAutoIntervalDraft = (columnId: string, patch: Partial<{ from: string; to: string }>) => {
    setAutoIntervalDrafts((prev) => {
      const current = prev[columnId] ?? { from: "", to: "" };
      return { ...prev, [columnId]: { ...current, ...patch } };
    });
  };

  const updateColumnGeneratorParams = (columnId: string, patch: Partial<ProgressionColumnGenerator>) => {
    const nextColumns: ProgressionTableColumn[] = columns.map((column) => {
      if (column.id !== columnId) return column;
      const currentGenerator = column.generator ?? { mode: "manual" as const };
      if (currentGenerator.mode === "manual") return column;
      switch (currentGenerator.mode) {
        case "linear": {
          const linearPatch = patch.mode === "linear" || patch.mode == null ? patch : {};
          const patchBias = (linearPatch as { bias?: number }).bias;
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
              bias: Number.isFinite(patchBias)
                ? Number(patchBias)
                : currentGenerator.bias ?? 1,
            },
          };
        }
        case "exponential": {
          const exponentialPatch = patch.mode === "exponential" || patch.mode == null ? patch : {};
          const patchBias = (exponentialPatch as { bias?: number }).bias;
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
              bias: Number.isFinite(patchBias)
                ? Number(patchBias)
                : currentGenerator.bias ?? 1,
            },
          };
        }
        case "formula": {
          const formulaPatch = patch.mode === "formula" || patch.mode == null ? patch : {};
          const fp = formulaPatch as { baseColumnId?: string; baseManualValue?: number; expression?: string };
          return {
            ...column,
            generator: {
              mode: "formula",
              baseColumnId: fp.baseColumnId ?? currentGenerator.baseColumnId,
              baseManualValue: fp.baseManualValue !== undefined ? fp.baseManualValue : currentGenerator.baseManualValue,
              expression: fp.expression ?? currentGenerator.expression,
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
    const rc = resolvedColumns.find((item) => item.id === columnId);
    if (!rc) return;
    const generator = rc.generator ?? { mode: "manual" as const };
    if (generator.mode === "manual") return;
    const bounds = normalizeBounds(rc.min, rc.max);
    const rawRows = generateProgressionColumnValues({
      rows,
      columnId,
      startLevel,
      endLevel,
      generator,
      decimals: rc.decimals,
    });
    const nextRows = applyColumnClamp({
      rows: rawRows,
      columnId,
      min: bounds.min,
      max: bounds.max,
    });
    const clampedValues = countColumnValueChanges(rawRows, nextRows, columnId);
    // Apply manual overrides on top of generated values
    const finalRows = applyOverridesToRows(nextRows, columnId, currentOverrides);
    commit({
      rows: finalRows,
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
      columns: resolvedColumns.map((column) => ({ ...column, min: undefined, max: undefined })),
      startLevel,
      endLevel,
    });
    let nextRows = generateAllProgressionColumnValues({
      rows,
      columns: resolvedColumns,
      startLevel,
      endLevel,
    });
    // Apply manual overrides for all non-manual columns
    for (const column of resolvedColumns) {
      if ((column.generator?.mode ?? "manual") !== "manual") {
        nextRows = applyOverridesToRows(nextRows, column.id, currentOverrides);
      }
    }
    const summary: Record<string, number> = {};
    for (const column of resolvedColumns) {
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

  const duplicateColumn = (columnId: string) => {
    const source = columns.find((column) => column.id === columnId);
    if (!source) return;
    const newId = `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const copy = { ...source, id: newId, name: `${source.name} (cópia)`, libraryRef: undefined };
    const sourceIndex = columns.findIndex((column) => column.id === columnId);
    const nextColumns = [
      ...columns.slice(0, sourceIndex + 1),
      copy,
      ...columns.slice(sourceIndex + 1),
    ];
    // Copy row values from source column to the new column
    const nextRows = rows.map((row) => ({
      ...row,
      values: { ...row.values, [newId]: row.values[columnId] ?? 0 },
    }));
    // Copy overrides from source column to the new column
    const nextOverrides: Record<string, Record<string, number>> = {};
    for (const [levelKey, colMap] of Object.entries(currentOverrides)) {
      nextOverrides[levelKey] = columnId in colMap
        ? { ...colMap, [newId]: colMap[columnId] }
        : { ...colMap };
    }
    commit({ columns: nextColumns, rows: nextRows, overrides: nextOverrides });
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

  // ── Override helpers ─────────────────────────────────────────────
  const currentOverrides = addon.overrides ?? {};

  const setOverride = (level: number, columnId: string, value: number): Record<string, Record<string, number>> => {
    const key = String(level);
    const prev = currentOverrides[key] ?? {};
    return { ...currentOverrides, [key]: { ...prev, [columnId]: value } };
  };

  const removeOverride = (level: number, columnId: string): Record<string, Record<string, number>> => {
    const key = String(level);
    const prev = currentOverrides[key];
    if (!prev || !(columnId in prev)) return currentOverrides;
    const { [columnId]: _, ...rest } = prev;
    const next = { ...currentOverrides, [key]: rest };
    if (Object.keys(rest).length === 0) {
      const { [key]: __, ...withoutLevel } = next;
      return withoutLevel;
    }
    return next;
  };

  const removeColumnOverrides = (columnId: string): Record<string, Record<string, number>> => {
    const next: Record<string, Record<string, number>> = {};
    for (const [key, colMap] of Object.entries(currentOverrides)) {
      const { [columnId]: _, ...rest } = colMap;
      if (Object.keys(rest).length > 0) next[key] = rest;
    }
    return next;
  };

  const hasOverride = (level: number, columnId: string): boolean => {
    return currentOverrides[String(level)]?.[columnId] != null;
  };

  const getOverrideCount = (columnId: string): number => {
    let count = 0;
    for (const colMap of Object.values(currentOverrides)) {
      if (colMap[columnId] != null) count += 1;
    }
    return count;
  };

  const applyOverridesToRows = (
    generatedRows: ProgressionTableRow[],
    columnId: string,
    ovr: Record<string, Record<string, number>>
  ): ProgressionTableRow[] => {
    return generatedRows.map((row) => {
      const overrideValue = ovr[String(row.level)]?.[columnId];
      if (overrideValue == null) return row;
      return { ...row, values: { ...row.values, [columnId]: overrideValue } };
    });
  };

  const updateCell = (level: number, columnId: string, rawValue: string) => {
    const rc = resolvedColumns.find((item) => item.id === columnId);
    const column = columns.find((item) => item.id === columnId);
    const bounds = normalizeBounds(rc?.min, rc?.max);
    const parsedValue = parseNumber(rawValue);
    const clampedValue = clampValueWithBounds(parsedValue, bounds.min, bounds.max);
    const nextRows = rows.map((row) => {
      if (row.level !== level) return row;
      return {
        ...row,
        values: { ...row.values, [columnId]: clampedValue },
      };
    });
    const mode = column?.generator?.mode ?? "manual";
    const nextOverrides = mode !== "manual"
      ? setOverride(level, columnId, clampedValue)
      : currentOverrides;
    commit({
      rows: nextRows,
      columns,
      startLevel,
      endLevel,
      overrides: nextOverrides,
    });
    setLastGeneratedColumnId(null);
    setClampSummaryByColumnId((prev) => ({ ...prev, [columnId]: 0 }));
  };

  const resetCellOverride = (level: number, columnId: string) => {
    const rc = resolvedColumns.find((c) => c.id === columnId);
    if (!rc) return;
    const generator = rc.generator ?? { mode: "manual" as const };
    const nextOverrides = removeOverride(level, columnId);
    // Recompute the generated value for this specific cell
    if (generator.mode !== "manual") {
      const singleRow: ProgressionTableRow[] = [{ level, values: {} }];
      const generated = generateProgressionColumnValues({
        rows: singleRow,
        columnId,
        startLevel,
        endLevel,
        generator,
        decimals: rc.decimals,
        min: rc.min,
        max: rc.max,
      });
      const newValue = generated[0]?.values[columnId] ?? 0;
      const nextRows = rows.map((row) =>
        row.level === level ? { ...row, values: { ...row.values, [columnId]: newValue } } : row
      );
      commit({ rows: nextRows, columns, startLevel, endLevel, overrides: nextOverrides });
    } else {
      commit({ overrides: nextOverrides });
    }
  };

  const resetColumnOverrides = (columnId: string) => {
    const nextOverrides = removeColumnOverrides(columnId);
    // Regenerate the entire column without overrides
    const rc = resolvedColumns.find((item) => item.id === columnId);
    if (!rc) return;
    const generator = rc.generator ?? { mode: "manual" as const };
    if (generator.mode === "manual") {
      commit({ overrides: nextOverrides });
      return;
    }
    const bounds = normalizeBounds(rc.min, rc.max);
    const rawRows = generateProgressionColumnValues({
      rows,
      columnId,
      startLevel,
      endLevel,
      generator,
      decimals: rc.decimals,
    });
    const nextRows = applyColumnClamp({
      rows: rawRows,
      columnId,
      min: bounds.min,
      max: bounds.max,
    });
    commit({ rows: nextRows, columns, startLevel, endLevel, overrides: nextOverrides });
    setLastGeneratedColumnId(columnId);
    setClampSummaryByColumnId((prev) => ({ ...prev, [columnId]: 0 }));
  };

  const pasteColumnValues = (columnId: string, rawText: string) => {
    const column = columns.find((c) => c.id === columnId);
    const bounds = normalizeBounds(column?.min, column?.max);
    const parts = rawText.includes("\n")
      ? rawText.split("\n")
      : rawText.split(",");
    const values = parts.map((s) => s.trim()).filter(Boolean).map(parseNumber);
    if (values.length === 0) return;

    const nextRows = rows.map((row, i) => {
      if (i >= values.length) return row;
      return {
        ...row,
        values: {
          ...row.values,
          [columnId]: clampValueWithBounds(values[i], bounds.min, bounds.max),
        },
      };
    });
    commit({ rows: nextRows, columns, startLevel, endLevel });
    setLastGeneratedColumnId(null);
    setPasteByColumnId((prev) => ({ ...prev, [columnId]: undefined as any }));

    // Run curve fitting on the pasted values
    const suggestion = suggestGeneratorMode(values);
    setCurveSuggestion((prev) => ({ ...prev, [columnId]: suggestion }));
  };

  const copyColumnValues = async (columnId: string) => {
    const text = rows.map((r) => String(r.values[columnId] ?? 0)).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedColumnId(columnId);
      setTimeout(() => setCopiedColumnId((curr) => (curr === columnId ? null : curr)), 1500);
    } catch {
      // Clipboard API not available (e.g. insecure context) — fallback to textarea trick
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopiedColumnId(columnId);
        setTimeout(() => setCopiedColumnId((curr) => (curr === columnId ? null : curr)), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const acceptCurveSuggestion = (columnId: string) => {
    const result = curveSuggestion[columnId];
    if (!result || !result.suggested) return;
    const { fit } = result;

    // Switch column to the suggested mode with fitted params
    const nextColumns = columns.map((col) => {
      if (col.id !== columnId) return col;
      if (fit.mode === "linear") {
        return {
          ...col,
          generator: {
            mode: "linear" as const,
            base: fit.base,
            step: fit.step,
            bias: fit.bias ?? 1,
          },
        };
      }
      if (fit.mode === "exponential") {
        return {
          ...col,
          generator: {
            mode: "exponential" as const,
            base: fit.base,
            growth: fit.growth,
            bias: fit.bias ?? 1,
          },
        };
      }
      // formula (polynomial)
      return { ...col, generator: { mode: "formula" as const, baseColumnId: "__manual__", baseManualValue: 0, expression: fit.expression } };
    });

    // Generate values with the new params
    const remapped = remapRows(rows, nextColumns, startLevel, endLevel);
    const targetCol = nextColumns.find((c) => c.id === columnId)!;
    const generated = generateProgressionColumnValues({
      rows: remapped,
      columnId,
      startLevel,
      endLevel,
      generator: targetCol.generator!,
      decimals: targetCol.decimals,
    });
    const bounds = normalizeBounds(targetCol.min, targetCol.max);
    const clamped = applyColumnClamp({ rows: generated, columnId, min: bounds.min, max: bounds.max });

    commit({ rows: clamped, columns: nextColumns, startLevel, endLevel });
    setLastGeneratedColumnId(columnId);
    setCurveSuggestion((prev) => ({ ...prev, [columnId]: { suggested: false } }));
  };

  const dismissCurveSuggestion = (columnId: string) => {
    setCurveSuggestion((prev) => ({ ...prev, [columnId]: { suggested: false } }));
  };

  // ── Sheets binding handlers ──────────────────────────────────────────

  const openBindingForm = (columnId: string, existingBinding?: ProgressionTableColumnSheetsBinding) => {
    setBindingFormColumnId(columnId);
    if (existingBinding) {
      setSheetsFormSheetName(existingBinding.sheetName);
      setSheetsFormRange(existingBinding.range);
      const matchEntry = linkedSpreadsheets.find(
        (s) => s.spreadsheetId === existingBinding.spreadsheetId
      );
      if (matchEntry) {
        setSheetsFormRegistryId(matchEntry.id);
        setSheetsFormUrl("");
      } else {
        setSheetsFormRegistryId("");
        setSheetsFormUrl(existingBinding.spreadsheetId);
      }
    } else {
      setSheetsFormRegistryId(linkedSpreadsheets[0]?.id ?? "");
      setSheetsFormSheetName("");
      setSheetsFormRange("");
      setSheetsFormUrl("");
    }
    setSheetsSyncErrors((prev) => ({ ...prev, [columnId]: "" }));
  };

  const handleUnbindColumn = (columnId: string) => {
    const nextColumns = columns.map((c) =>
      c.id === columnId ? { ...c, sheetsBinding: undefined } : c
    );
    const nextOverrides = removeColumnOverrides(columnId);
    commit({ columns: nextColumns, overrides: nextOverrides });
    setSheetsSyncErrors((prev) => ({ ...prev, [columnId]: "" }));
  };

  const handleSyncColumn = async (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    if (!column?.sheetsBinding) return;
    setSyncingColumnIds((prev) => ({ ...prev, [columnId]: true }));
    setSheetsSyncErrors((prev) => ({ ...prev, [columnId]: "" }));
    try {
      const clientId = await getGoogleClientId();
      if (!clientId) throw new Error(t("progressionTableAddon.sheets.errorNoClientId", "Google Client ID não configurado."));
      const token = await getGoogleSheetsToken(clientId);
      if (!token) throw new Error(t("progressionTableAddon.sheets.errorAuthFailed", "Falha na autenticação Google."));
      const result = await fetchAndMapSheetsValues(column.sheetsBinding, rows, columnId, token);
      if (!result) throw new Error(t("progressionTableAddon.sheets.errorFetchFailed", "Erro ao buscar dados da planilha."));
      const { cachedValues, rowValues } = result;
      let nextOverrides = { ...currentOverrides };
      Object.entries(rowValues).forEach(([level, val]) => {
        nextOverrides = {
          ...nextOverrides,
          [level]: { ...(nextOverrides[level] ?? {}), [columnId]: val },
        };
      });
      const nextColumns = columns.map((c) =>
        c.id === columnId
          ? { ...c, sheetsBinding: { ...c.sheetsBinding!, cachedValues, syncedAt: new Date().toISOString() } }
          : c
      );
      const nextRows = rows.map((row, i) => ({
        ...row,
        values: { ...row.values, [columnId]: cachedValues[i] ?? row.values[columnId] ?? 0 },
      }));
      commit({ columns: nextColumns, rows: nextRows, overrides: nextOverrides });
    } catch (err) {
      setSheetsSyncErrors((prev) => ({
        ...prev,
        [columnId]: err instanceof Error ? err.message : t("progressionTableAddon.sheets.errorSyncGeneric", "Erro inesperado ao sincronizar."),
      }));
    } finally {
      setSyncingColumnIds((prev) => ({ ...prev, [columnId]: false }));
    }
  };

  const handleSyncAllColumns = async () => {
    const boundColumns = columns.filter((c) => c.sheetsBinding);
    if (boundColumns.length === 0) return;
    const syncMap: Record<string, boolean> = {};
    boundColumns.forEach((c) => { syncMap[c.id] = true; });
    setSyncingColumnIds(syncMap);
    setSheetsSyncErrors({});
    let finalColumns = [...columns];
    let finalRows = [...rows];
    let finalOverrides = { ...currentOverrides };
    const errors: Record<string, string> = {};
    try {
      const clientId = await getGoogleClientId();
      if (!clientId) {
        boundColumns.forEach((c) => { errors[c.id] = t("progressionTableAddon.sheets.errorNoClientId", "Google Client ID não configurado."); });
        setSheetsSyncErrors(errors);
        return;
      }
      const token = await getGoogleSheetsToken(clientId);
      if (!token) {
        boundColumns.forEach((c) => { errors[c.id] = t("progressionTableAddon.sheets.errorAuthFailed", "Falha na autenticação Google."); });
        setSheetsSyncErrors(errors);
        return;
      }
      for (const col of boundColumns) {
        if (!col.sheetsBinding) continue;
        const result = await fetchAndMapSheetsValues(col.sheetsBinding, finalRows, col.id, token);
        if (!result) { errors[col.id] = t("progressionTableAddon.sheets.errorFetchFailed", "Erro ao buscar dados da planilha."); continue; }
        const { cachedValues, rowValues } = result;
        Object.entries(rowValues).forEach(([level, val]) => {
          finalOverrides = {
            ...finalOverrides,
            [level]: { ...(finalOverrides[level] ?? {}), [col.id]: val },
          };
        });
        finalColumns = finalColumns.map((c) =>
          c.id === col.id
            ? { ...c, sheetsBinding: { ...col.sheetsBinding!, cachedValues, syncedAt: new Date().toISOString() } }
            : c
        );
        finalRows = finalRows.map((row, i) => ({
          ...row,
          values: { ...row.values, [col.id]: cachedValues[i] ?? row.values[col.id] ?? 0 },
        }));
      }
      commit({ columns: finalColumns, rows: finalRows, overrides: finalOverrides });
      if (Object.keys(errors).length > 0) setSheetsSyncErrors(errors);
    } catch {
      boundColumns.forEach((c) => { errors[c.id] = t("progressionTableAddon.sheets.errorSyncGeneric", "Erro inesperado ao sincronizar."); });
      setSheetsSyncErrors(errors);
    } finally {
      setSyncingColumnIds({});
    }
  };

  const handleBindAndSyncColumn = async (columnId: string) => {
    let spreadsheetId: string | null = null;
    if (sheetsFormRegistryId) {
      const entry = linkedSpreadsheets.find((s) => s.id === sheetsFormRegistryId);
      if (entry) spreadsheetId = entry.spreadsheetId;
    }
    if (!spreadsheetId && sheetsFormUrl.trim()) {
      spreadsheetId = parseSpreadsheetId(sheetsFormUrl.trim());
    }
    if (!spreadsheetId) {
      setSheetsSyncErrors((prev) => ({ ...prev, [columnId]: t("progressionTableAddon.sheets.errorInvalidUrl", "URL de planilha inválida.") }));
      return;
    }
    if (!sheetsFormSheetName.trim()) {
      setSheetsSyncErrors((prev) => ({ ...prev, [columnId]: t("progressionTableAddon.sheets.errorNoSheet", "Informe o nome da aba.") }));
      return;
    }
    if (!sheetsFormRange.trim()) {
      setSheetsSyncErrors((prev) => ({ ...prev, [columnId]: t("progressionTableAddon.sheets.errorNoRange", "Informe o intervalo (ex: B2:B51).") }));
      return;
    }
    const binding: ProgressionTableColumnSheetsBinding = {
      spreadsheetId,
      sheetName: sheetsFormSheetName.trim(),
      range: sheetsFormRange.trim(),
    };
    setSyncingColumnIds((prev) => ({ ...prev, [columnId]: true }));
    setSheetsSyncErrors((prev) => ({ ...prev, [columnId]: "" }));
    try {
      const clientId = await getGoogleClientId();
      if (!clientId) throw new Error(t("progressionTableAddon.sheets.errorNoClientId", "Google Client ID não configurado."));
      const token = await getGoogleSheetsToken(clientId);
      if (!token) throw new Error(t("progressionTableAddon.sheets.errorAuthFailed", "Falha na autenticação Google."));
      const result = await fetchAndMapSheetsValues(binding, rows, columnId, token);
      if (!result) throw new Error(t("progressionTableAddon.sheets.errorFetchFailed", "Erro ao buscar dados da planilha."));
      const { cachedValues, rowValues } = result;
      let nextOverrides = { ...currentOverrides };
      Object.entries(rowValues).forEach(([level, val]) => {
        nextOverrides = {
          ...nextOverrides,
          [level]: { ...(nextOverrides[level] ?? {}), [columnId]: val },
        };
      });
      const finalBinding = { ...binding, cachedValues, syncedAt: new Date().toISOString() };
      const nextColumns = columns.map((c) =>
        c.id === columnId ? { ...c, sheetsBinding: finalBinding } : c
      );
      const nextRows = rows.map((row, i) => ({
        ...row,
        values: { ...row.values, [columnId]: cachedValues[i] ?? row.values[columnId] ?? 0 },
      }));
      commit({ columns: nextColumns, rows: nextRows, overrides: nextOverrides });
      setBindingFormColumnId(null);
    } catch (err) {
      setSheetsSyncErrors((prev) => ({
        ...prev,
        [columnId]: err instanceof Error ? err.message : t("progressionTableAddon.sheets.errorBindGeneric", "Erro inesperado ao vincular."),
      }));
    } finally {
      setSyncingColumnIds((prev) => ({ ...prev, [columnId]: false }));
    }
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
            <CommitNumberInput
              value={startLevel}
              onCommit={(next) => updateRange(next, endLevel)}
              integer
              className={INPUT_CLASS_LG}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("progressionTableAddon.endLevelLabel", "Level final")}
            </span>
            <CommitNumberInput
              value={endLevel}
              onCommit={(next) => updateRange(startLevel, next)}
              integer
              className={INPUT_CLASS_LG}
            />
          </label>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-300">{t("progressionTableAddon.columnsByLevel", "Colunas de atributos por level")}</p>
        <div className="flex items-center gap-2">
          {columns.some((c) => c.sheetsBinding) && (
            <button
              type="button"
              onClick={handleSyncAllColumns}
              disabled={Object.values(syncingColumnIds).some(Boolean)}
              className={`${BUTTON_SECONDARY_CLASS} disabled:opacity-60`}
            >
              {Object.values(syncingColumnIds).some(Boolean) ? t("progressionTableAddon.sheets.syncingButton", "⟳ Sincronizando...") : t("progressionTableAddon.sheets.syncAllButton", "⟳ Sincronizar Sheets")}
            </button>
          )}
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
                  const warnings = getColumnWarnings(column, rows, columns, t, availableLibraryColumns);
                  const rc = resolvedColumns.find((c) => c.id === column.id) ?? column;
                  // (libraryRef state used inline via column.libraryRef)
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
                      {column.libraryRef ? (
                        <LibraryLabelPath
                          value={resolveColumnDisplayName(column, availableLibraryColumns) || t("progressionTableAddon.columnFallback", "Coluna")}
                        />
                      ) : (
                        resolveColumnDisplayName(column, availableLibraryColumns) || t("progressionTableAddon.columnFallback", "Coluna")
                      )}
                      {column.libraryRef && <span className="ml-1 text-[10px] text-sky-400/80" aria-hidden>📎</span>}
                      {column.sheetsBinding?.syncedAt && (
                        <span className="ml-1 text-[10px] text-emerald-400/80" aria-hidden title={t("progressionTableAddon.sheets.chipSynced", "Vinculada ao Google Sheets")}>📊</span>
                      )}
                      {column.sheetsBinding && !column.sheetsBinding.syncedAt && (
                        <span className="ml-1 text-[10px] text-yellow-400/80" aria-hidden title={t("progressionTableAddon.sheets.chipNotSynced", "Vinculada ao Sheets — ainda não sincronizada")}>📊</span>
                      )}
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
                          {column.libraryRef ? (
                            <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-sky-600/40 bg-sky-900/20 px-2.5 py-1.5 text-xs text-sky-200">
                              <span aria-hidden className="text-[10px]">📎</span>
                              <span className="flex-1 flex flex-wrap items-center gap-1">
                                <LibraryLabelPath value={resolveColumnDisplayName(column, availableLibraryColumns)} />
                              </span>
                              <button
                                type="button"
                                onClick={() => unlinkColumnFromLibrary(column.id)}
                                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-sky-300 hover:bg-sky-800/50 hover:text-sky-100"
                                aria-label={t("progressionTableAddon.unlinkLibraryAriaLabel", "Desvincular da Biblioteca")}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="relative flex flex-1 items-center gap-1">
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
                                className={`${INPUT_CLASS} flex-1`}
                              />
                              {availableLibraryColumns.length > 0 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLibraryPickerOpenColumnId((prev) =>
                                        prev === column.id ? null : column.id
                                      )
                                    }
                                    aria-label={t(
                                      "progressionTableAddon.linkLibraryAriaLabel",
                                      "Vincular a Biblioteca de Colunas"
                                    )}
                                    aria-expanded={libraryPickerOpenColumnId === column.id}
                                    className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-gray-600 bg-gray-800 text-sm text-gray-300 hover:bg-gray-700 hover:text-gray-100"
                                    title={t("progressionTableAddon.linkLibraryButton", "Vincular à Biblioteca de Colunas")}
                                  >
                                    📚
                                  </button>
                                  {libraryPickerOpenColumnId === column.id && (
                                    <div
                                      ref={libraryPickerRef}
                                      role="listbox"
                                      aria-label={t(
                                        "progressionTableAddon.libraryPickerTitle",
                                        "Selecionar coluna da Biblioteca"
                                      )}
                                      className="absolute right-0 top-full z-20 mt-1 w-72 max-h-64 overflow-y-auto rounded-md border border-gray-700 bg-gray-950/95 p-1 text-xs text-gray-200 shadow-xl"
                                    >
                                      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                        {t("progressionTableAddon.libraryPickerTitle", "Selecionar coluna da Biblioteca")}
                                      </p>
                                      {(() => {
                                        // Group by library
                                        const byLibrary = new Map<string, { libraryName: string; sectionTitle: string; entries: LibraryColumnOption[] }>();
                                        for (const entry of availableLibraryColumns) {
                                          const bucket = byLibrary.get(entry.libraryAddonId);
                                          if (bucket) {
                                            bucket.entries.push(entry);
                                          } else {
                                            byLibrary.set(entry.libraryAddonId, {
                                              libraryName: entry.libraryName,
                                              sectionTitle: entry.sectionTitle,
                                              entries: [entry],
                                            });
                                          }
                                        }
                                        return Array.from(byLibrary.entries()).map(([libId, group]) => (
                                          <div key={libId} className="mb-1">
                                            <p className="px-2 py-1 text-[10px] font-semibold text-sky-300/80">
                                              <span className="text-gray-400">{group.sectionTitle}</span>
                                              <span className="mx-1 text-gray-500">→</span>
                                              <span>{group.libraryName}</span>
                                            </p>
                                            {group.entries.map((entry) => (
                                              <button
                                                key={`${entry.libraryAddonId}:${entry.entryId}`}
                                                type="button"
                                                role="option"
                                                onClick={() => linkColumnToLibrary(column.id, entry)}
                                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-800"
                                                title={entry.description || undefined}
                                              >
                                                <LibraryLabelPath value={entry.label} className="flex-1" />
                                                <span className="shrink-0 text-[10px] text-gray-500">{entry.key}</span>
                                              </button>
                                            ))}
                                          </div>
                                        ));
                                      })()}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => duplicateColumn(column.id)}
                            className="rounded-lg border border-gray-600 bg-gray-800/60 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700/60"
                          >
                            {t("progressionTableAddon.duplicateColumnButton", "Duplicar")}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeColumn(column.id)}
                            disabled={columns.length <= 1}
                            className={`${BUTTON_DANGER_CLASS} disabled:opacity-40`}
                          >
                            {t("progressionTableAddon.removeColumnButton", "Remover")}
                          </button>
                        </div>

                        {/* ── Sheets binding section ── */}
                        {column.sheetsBinding ? (
                          <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                                <span aria-hidden>📊</span>
                                <span>{t("progressionTableAddon.sheets.boundTitle", "Google Sheets vinculada")}</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSyncColumn(column.id)}
                                  disabled={syncingColumnIds[column.id]}
                                  className="rounded-lg border border-emerald-700/60 bg-emerald-900/20 px-2.5 py-1 text-[11px] text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-60"
                                >
                                  {syncingColumnIds[column.id] ? t("progressionTableAddon.sheets.syncingButton", "⟳ Sincronizando...") : t("progressionTableAddon.sheets.syncButton", "⟳ Sincronizar")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUnbindColumn(column.id)}
                                  className="rounded-lg border border-rose-700/60 bg-rose-900/20 px-2.5 py-1 text-[11px] text-rose-200 hover:bg-rose-900/40"
                                >
                                  {t("progressionTableAddon.sheets.unbindButton", "Desvincular")}
                                </button>
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-400">
                              <span className="text-gray-300">{column.sheetsBinding.sheetName}</span>
                              <span className="mx-1 text-gray-600">·</span>
                              <span className="font-mono text-gray-300">{column.sheetsBinding.range}</span>
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {column.sheetsBinding.syncedAt
                                ? t("progressionTableAddon.sheets.lastSyncLabel", "Última sincronização: {date}").replace("{date}", new Date(column.sheetsBinding.syncedAt).toLocaleString())
                                : t("progressionTableAddon.sheets.neverSynced", "Nunca sincronizado — clique em Sincronizar")}
                            </p>
                            {sheetsSyncErrors[column.id] && (
                              <p className="text-[10px] text-rose-300">{sheetsSyncErrors[column.id]}</p>
                            )}
                          </div>
                        ) : bindingFormColumnId === column.id ? (
                          <div className="rounded-lg border border-gray-600 bg-gray-800/50 p-2.5 space-y-2">
                            <p className="text-[11px] font-semibold text-gray-200">📊 {t("progressionTableAddon.sheets.formTitle", "Vincular ao Google Sheets")}</p>
                            {linkedSpreadsheets.length > 0 && (
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">{t("progressionTableAddon.sheets.spreadsheetLabel", "Planilha")}</span>
                                <select
                                  value={sheetsFormRegistryId}
                                  onChange={(e) => { setSheetsFormRegistryId(e.target.value); setSheetsFormSheetName(""); }}
                                  className={INPUT_CLASS}
                                >
                                  {linkedSpreadsheets.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                  <option value="">{t("progressionTableAddon.sheets.customUrlOption", "URL personalizada...")}</option>
                                </select>
                              </label>
                            )}
                            {(!sheetsFormRegistryId || linkedSpreadsheets.length === 0) && (
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">{t("progressionTableAddon.sheets.urlLabel", "URL da Planilha")}</span>
                                <input
                                  type="text"
                                  value={sheetsFormUrl}
                                  onChange={(e) => setSheetsFormUrl(e.target.value)}
                                  placeholder="https://docs.google.com/spreadsheets/d/..."
                                  className={INPUT_CLASS}
                                />
                              </label>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">{t("progressionTableAddon.sheets.sheetLabel", "Aba")}</span>
                                {(() => {
                                  const registrySheets = linkedSpreadsheets.find((s) => s.id === sheetsFormRegistryId)?.sheets ?? [];
                                  return registrySheets.length > 0 ? (
                                    <select
                                      value={sheetsFormSheetName}
                                      onChange={(e) => setSheetsFormSheetName(e.target.value)}
                                      className={INPUT_CLASS}
                                    >
                                      <option value="">{t("progressionTableAddon.sheets.sheetSelectPlaceholder", "Selecione...")}</option>
                                      {registrySheets.map((sh) => (
                                        <option key={sh} value={sh}>{sh}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={sheetsFormSheetName}
                                      onChange={(e) => setSheetsFormSheetName(e.target.value)}
                                      placeholder="Sheet1"
                                      className={INPUT_CLASS}
                                    />
                                  );
                                })()}
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">{t("progressionTableAddon.sheets.rangeLabel", "Intervalo")}</span>
                                <input
                                  type="text"
                                  value={sheetsFormRange}
                                  onChange={(e) => setSheetsFormRange(e.target.value)}
                                  placeholder={t("progressionTableAddon.sheets.rangePlaceholder", "B2:B51")}
                                  className={INPUT_CLASS}
                                />
                              </label>
                            </div>
                            {sheetsSyncErrors[column.id] && (
                              <p className="text-[10px] text-rose-300">{sheetsSyncErrors[column.id]}</p>
                            )}
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setBindingFormColumnId(null);
                                  setSheetsSyncErrors((prev) => ({ ...prev, [column.id]: "" }));
                                }}
                                className={BUTTON_SECONDARY_CLASS}
                              >
                                {t("progressionTableAddon.sheets.cancelButton", "Cancelar")}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleBindAndSyncColumn(column.id)}
                                disabled={syncingColumnIds[column.id]}
                                className="rounded-lg border border-emerald-600 bg-emerald-700/50 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {syncingColumnIds[column.id] ? t("progressionTableAddon.sheets.bindingButton", "⟳ Vinculando...") : t("progressionTableAddon.sheets.bindButton", "Vincular e Sincronizar")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openBindingForm(column.id)}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800/40 px-2.5 py-1.5 text-[11px] text-gray-400 hover:border-emerald-700/40 hover:bg-emerald-900/10 hover:text-emerald-300 transition-colors"
                          >
                            <span aria-hidden>📊</span>
                            <span>{t("progressionTableAddon.sheets.openFormButton", "Vincular ao Google Sheets")}</span>
                          </button>
                        )}

                        {!column.sheetsBinding && (<>
                        <div>
                          <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                            {t("progressionTableAddon.modeLabel", "Modo")}
                          </span>
                          <div className="relative flex items-stretch gap-1.5">
                            <select
                              value={column.generator?.mode ?? "manual"}
                              onChange={(e) =>
                                updateColumnGeneratorMode(
                                  column.id,
                                  e.target.value as ProgressionColumnGenerator["mode"]
                                )
                              }
                              className={`${INPUT_CLASS} flex-1`}
                            >
                              <option value="manual">{t("progressionTableAddon.mode.manual", "Manual")}</option>
                              <option value="linear">{t("progressionTableAddon.mode.linear", "Linear")}</option>
                              <option value="exponential">{t("progressionTableAddon.mode.exponential", "Exponencial")}</option>
                              <option value="formula">{t("progressionTableAddon.mode.formula", "Formula")}</option>
                            </select>
                            {(column.generator?.mode === "linear" || column.generator?.mode === "exponential") && (() => {
                              const mode = column.generator.mode;
                              const isOpen = autoIntervalOpenColumnId === column.id;
                              const draft = autoIntervalDrafts[column.id] ?? { from: "", to: "" };
                              const fromStr = draft.from;
                              const hasBothValues = fromStr.trim().length > 0 && draft.to.trim().length > 0;
                              const result = hasBothValues
                                ? computeAutoInterval(
                                    mode,
                                    parseNumber(fromStr),
                                    parseNumber(draft.to),
                                    startLevel,
                                    endLevel
                                  )
                                : null;
                              const errorMessage =
                                result && !result.ok
                                  ? t(
                                      result.errorKey,
                                      result.errorKey === "progressionTableAddon.warnings.autoIntervalExpNeedsPositive"
                                        ? "Exponencial requer ambos os valores com o mesmo sinal e diferentes de zero."
                                        : result.errorKey === "progressionTableAddon.warnings.autoIntervalRangeTooSmall"
                                        ? "O level final deve ser maior que o inicial."
                                        : "Valores invalidos."
                                    )
                                  : null;
                              const canApply = Boolean(result && result.ok);
                              return (
                                <>
                                  <button
                                    ref={isOpen ? autoIntervalButtonRef : undefined}
                                    type="button"
                                    onClick={() => toggleAutoIntervalPopover(column.id)}
                                    aria-label={t(
                                      "progressionTableAddon.autoIntervalAriaLabel",
                                      "Auto-gerar base e step/growth a partir do intervalo"
                                    )}
                                    aria-expanded={isOpen}
                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-100 hover:bg-gray-700 focus-visible:border-gray-500"
                                  >
                                    <span aria-hidden>✨</span>
                                    <span>{t("progressionTableAddon.autoIntervalButton", "Auto")}</span>
                                  </button>
                                  {isOpen && (
                                    <div
                                      ref={autoIntervalPopoverRef}
                                      role="dialog"
                                      aria-label={t("progressionTableAddon.autoIntervalTitle", "Preencher intervalo")}
                                      className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-md border border-gray-700 bg-gray-950/95 p-3 text-xs text-gray-200 shadow-xl"
                                    >
                                      <p className="mb-2 text-[11px] font-semibold text-gray-100">
                                        {t("progressionTableAddon.autoIntervalTitle", "Preencher intervalo")}
                                      </p>
                                      <div className="space-y-2">
                                        <label className="block">
                                          <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                            {t("progressionTableAddon.autoIntervalFromLabel", "Valor no Lv {level}").replace(
                                              "{level}",
                                              String(startLevel)
                                            )}
                                          </span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            autoFocus
                                            value={draft.from}
                                            onChange={(e) =>
                                              updateAutoIntervalDraft(column.id, { from: e.target.value })
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" && canApply) {
                                                e.preventDefault();
                                                applyAutoInterval(column.id);
                                              }
                                            }}
                                            className={INPUT_CLASS}
                                          />
                                        </label>
                                        <label className="block">
                                          <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                            {t("progressionTableAddon.autoIntervalToLabel", "Valor no Lv {level}").replace(
                                              "{level}",
                                              String(endLevel)
                                            )}
                                          </span>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={draft.to}
                                            onChange={(e) =>
                                              updateAutoIntervalDraft(column.id, { to: e.target.value })
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" && canApply) {
                                                e.preventDefault();
                                                applyAutoInterval(column.id);
                                              }
                                            }}
                                            className={INPUT_CLASS}
                                          />
                                        </label>
                                      </div>
                                      {errorMessage && (
                                        <p className="mt-2 text-[10px] text-rose-300">{errorMessage}</p>
                                      )}
                                      <div className="mt-3 flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setAutoIntervalOpenColumnId(null)}
                                          className={BUTTON_SECONDARY_CLASS}
                                        >
                                          {t("progressionTableAddon.autoIntervalCancel", "Cancelar")}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => applyAutoInterval(column.id)}
                                          disabled={!canApply}
                                          className={`${BUTTON_PRIMARY_CLASS} disabled:opacity-40`}
                                        >
                                          {t("progressionTableAddon.autoIntervalApply", "Aplicar")}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                              {t("progressionTableAddon.decimalsLabel", "Casas decimais")}
                            </span>
                            <CommitNumberInput
                              value={rc.decimals ?? 0}
                              onCommit={(next) => updateColumnDecimals(column.id, String(next))}
                              min={0}
                              max={6}
                              step={1}
                              integer
                              className={INPUT_CLASS}
                            />
                          </label>
                          <div className="block">
                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                              {t("progressionTableAddon.percentageLabel", "Percentual (%)")}
                            </span>
                            <ToggleSwitch
                              checked={Boolean(rc.isPercentage)}
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
                            <CommitOptionalNumberInput
                              value={rc.min}
                              onCommit={(next) => updateColumnBounds(column.id, "min", next == null ? "" : String(next))}
                              placeholder={t("progressionTableAddon.noLimitPlaceholder", "Sem limite")}
                              className={INPUT_CLASS}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                              {t("progressionTableAddon.maxLabel", "Maximo")}
                            </span>
                            <CommitOptionalNumberInput
                              value={rc.max}
                              onCommit={(next) => updateColumnBounds(column.id, "max", next == null ? "" : String(next))}
                              placeholder={t("progressionTableAddon.noLimitPlaceholder", "Sem limite")}
                              className={INPUT_CLASS}
                            />
                          </label>
                        </div>

                        {(column.generator?.mode ?? "manual") === "linear" && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                  {t("progressionTableAddon.baseLabel", "Base")}
                                </span>
                                <CommitNumberInput
                                  value={rc.generator?.mode === "linear" ? rc.generator.base : 0}
                                  onCommit={(next) =>
                                    updateColumnGeneratorParams(column.id, { base: next })
                                  }
                                  className={INPUT_CLASS}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                  {t("progressionTableAddon.stepLabel", "Step")}
                                </span>
                                <CommitNumberInput
                                  value={column.generator?.mode === "linear" ? column.generator.step : 1}
                                  onCommit={(next) =>
                                    updateColumnGeneratorParams(column.id, { step: next })
                                  }
                                  className={INPUT_CLASS}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
                                  {t("progressionTableAddon.biasLabel", "Curvatura")}
                                  <span className="group relative inline-flex">
                                    <button
                                      type="button"
                                      onPointerDown={(event) => event.stopPropagation()}
                                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 bg-gray-800 text-[10px] font-semibold text-gray-300 outline-none transition-colors hover:border-gray-500 hover:text-gray-100 focus-visible:border-gray-500 focus-visible:text-gray-100"
                                      aria-label={t(
                                        "progressionTableAddon.biasHelpAria",
                                        "Ajuda sobre o parametro de curvatura"
                                      )}
                                    >
                                      ?
                                    </button>
                                    <div className="pointer-events-none invisible absolute left-1/2 top-[calc(100%+6px)] z-20 w-64 -translate-x-1/2 rounded-md border border-gray-700 bg-gray-950/95 p-2.5 text-[10px] normal-case tracking-normal text-gray-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                                      <p className="font-semibold text-gray-100">
                                        {t("progressionTableAddon.biasHelpTitle", "Forma da curva")}
                                      </p>
                                      <p className="mt-1 text-gray-300">
                                        {t(
                                          "progressionTableAddon.biasHelpBodyLinear",
                                          "Mantem Base e o valor final fixos, mas muda a forma entre eles. 1.0 = linear pura. Maior que 1 = cresce devagar no inicio e rapido no fim. Menor que 1 = cresce rapido no inicio e alisa no fim."
                                        )}
                                      </p>
                                    </div>
                                  </span>
                                </span>
                                <CommitNumberInput
                                  value={
                                    column.generator?.mode === "linear"
                                      ? column.generator.bias ?? 1
                                      : 1
                                  }
                                  onCommit={(next) =>
                                    updateColumnGeneratorParams(column.id, { bias: next })
                                  }
                                  step="0.1"
                                  min={0.1}
                                  className={INPUT_CLASS}
                                />
                                {(() => {
                                  const currentBias =
                                    column.generator?.mode === "linear"
                                      ? column.generator.bias ?? 1
                                      : 1;
                                  const presets = [0.5, 1, 2];
                                  return (
                                    <div className="mt-1 flex items-center gap-1">
                                      {presets.map((preset) => {
                                        const isActive = Math.abs(currentBias - preset) < 0.001;
                                        return (
                                          <button
                                            key={preset}
                                            type="button"
                                            onClick={() =>
                                              updateColumnGeneratorParams(column.id, { bias: preset })
                                            }
                                            className={`rounded-md border px-1.5 py-0.5 text-[10px] transition-colors ${
                                              isActive
                                                ? "border-sky-600/60 bg-sky-900/30 text-sky-200"
                                                : "border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
                                            }`}
                                            aria-pressed={isActive}
                                          >
                                            {preset === 1 ? "1.0" : String(preset)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </label>
                            </div>
                            {column.generator?.mode === "linear" &&
                              column.generator.bias != null &&
                              Number.isFinite(column.generator.bias) &&
                              column.generator.bias > 0 &&
                              column.generator.bias !== 1 && (
                                <p className="text-[10px] text-amber-200/70">
                                  {t(
                                    "progressionTableAddon.stepHintWithBias",
                                    "Com curvatura != 1, Step e o incremento medio entre os extremos. A diferenca por level varia ao longo da curva."
                                  )}
                                </p>
                              )}
                          </div>
                        )}

                        {(column.generator?.mode ?? "manual") === "exponential" && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                  {t("progressionTableAddon.baseLabel", "Base")}
                                </span>
                                <CommitNumberInput
                                  value={rc.generator?.mode === "exponential" ? rc.generator.base : 1}
                                  onCommit={(next) =>
                                    updateColumnGeneratorParams(column.id, { base: next })
                                  }
                                  className={INPUT_CLASS}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                  {t("progressionTableAddon.growthLabel", "Growth")}
                                </span>
                                <CommitNumberInput
                                  value={column.generator?.mode === "exponential" ? column.generator.growth : 1.1}
                                  onCommit={(next) =>
                                    updateColumnGeneratorParams(column.id, { growth: next })
                                  }
                                  step="0.01"
                                  className={INPUT_CLASS}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
                                  {t("progressionTableAddon.biasLabel", "Curvatura")}
                                  <span className="group relative inline-flex">
                                    <button
                                      type="button"
                                      onPointerDown={(event) => event.stopPropagation()}
                                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-600 bg-gray-800 text-[10px] font-semibold text-gray-300 outline-none transition-colors hover:border-gray-500 hover:text-gray-100 focus-visible:border-gray-500 focus-visible:text-gray-100"
                                      aria-label={t(
                                        "progressionTableAddon.biasHelpAria",
                                        "Ajuda sobre o parametro de curvatura"
                                      )}
                                    >
                                      ?
                                    </button>
                                    <div className="pointer-events-none invisible absolute left-1/2 top-[calc(100%+6px)] z-20 w-64 -translate-x-1/2 rounded-md border border-gray-700 bg-gray-950/95 p-2.5 text-[10px] normal-case tracking-normal text-gray-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                                      <p className="font-semibold text-gray-100">
                                        {t("progressionTableAddon.biasHelpTitle", "Forma da curva")}
                                      </p>
                                      <p className="mt-1 text-gray-300">
                                        {t(
                                          "progressionTableAddon.biasHelpBody",
                                          "Mantem Base e o valor final fixos, mas muda a forma entre eles. 1.0 = exponencial pura. Maior que 1 = cresce devagar no inicio e rapido no fim (grind tardio). Menor que 1 = cresce rapido no inicio e alisa no fim."
                                        )}
                                      </p>
                                    </div>
                                  </span>
                                </span>
                                <CommitNumberInput
                                  value={
                                    column.generator?.mode === "exponential"
                                      ? column.generator.bias ?? 1
                                      : 1
                                  }
                                  onCommit={(next) =>
                                    updateColumnGeneratorParams(column.id, { bias: next })
                                  }
                                  step="0.1"
                                  min={0.1}
                                  className={INPUT_CLASS}
                                />
                                {(() => {
                                  const currentBias =
                                    column.generator?.mode === "exponential"
                                      ? column.generator.bias ?? 1
                                      : 1;
                                  const presets = [0.5, 1, 2];
                                  return (
                                    <div className="mt-1 flex items-center gap-1">
                                      {presets.map((preset) => {
                                        const isActive = Math.abs(currentBias - preset) < 0.001;
                                        return (
                                          <button
                                            key={preset}
                                            type="button"
                                            onClick={() =>
                                              updateColumnGeneratorParams(column.id, { bias: preset })
                                            }
                                            className={`rounded-md border px-1.5 py-0.5 text-[10px] transition-colors ${
                                              isActive
                                                ? "border-sky-600/60 bg-sky-900/30 text-sky-200"
                                                : "border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
                                            }`}
                                            aria-pressed={isActive}
                                          >
                                            {preset === 1 ? "1.0" : String(preset)}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </label>
                            </div>
                            {column.generator?.mode === "exponential" &&
                              column.generator.bias != null &&
                              Number.isFinite(column.generator.bias) &&
                              column.generator.bias > 0 &&
                              column.generator.bias !== 1 && (
                                <p className="text-[10px] text-amber-200/70">
                                  {t(
                                    "progressionTableAddon.growthHintWithBias",
                                    "Com curvatura != 1, Growth e a taxa efetiva entre os extremos. A taxa por level varia ao longo da curva."
                                  )}
                                </p>
                              )}
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
                                <option value="__manual__">Valor manual</option>
                                {columns
                                  .filter((item) => item.id !== column.id)
                                  .map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name || t("progressionTableAddon.columnFallback", "Coluna")}
                                    </option>
                                  ))}
                              </select>
                              {column.generator?.mode === "formula" && column.generator.baseColumnId === "__manual__" && (
                                <label className="block mt-2">
                                  <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                                    Valor base (manual)
                                  </span>
                                  <CommitNumberInput
                                    value={column.generator.baseManualValue ?? 0}
                                    onCommit={(next) =>
                                      updateColumnGeneratorParams(column.id, { baseManualValue: next })
                                    }
                                    className={INPUT_CLASS}
                                  />
                                </label>
                              )}
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
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => copyColumnValues(column.id)}
                              className="rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-[11px] text-gray-100 hover:bg-gray-700"
                            >
                              {copiedColumnId === column.id
                                ? t("progressionTableAddon.copiedFeedback", "Copiado!")
                                : t("progressionTableAddon.copyButton", "Copiar valores")}
                            </button>
                            {(column.generator?.mode ?? "manual") === "manual" && (
                              <button
                                type="button"
                                onClick={() => setPasteByColumnId((prev) => ({ ...prev, [column.id]: prev[column.id] != null ? undefined as any : "" }))}
                                className="rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-[11px] text-gray-100 hover:bg-gray-700"
                              >
                                {pasteByColumnId[column.id] != null
                                  ? t("progressionTableAddon.cancelPaste", "Cancelar")
                                  : t("progressionTableAddon.pasteButton", "Colar valores")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => generateColumn(column.id)}
                              disabled={(column.generator?.mode ?? "manual") === "manual"}
                              className="rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-[11px] text-gray-100 hover:bg-gray-700 disabled:opacity-40"
                            >
                              {t("progressionTableAddon.generateButton", "Gerar")}
                            </button>
                          </div>
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
                        </>)}
                      </div>

                      {pasteByColumnId[column.id] != null && (
                        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-2 space-y-1.5">
                          <textarea
                            rows={4}
                            value={pasteByColumnId[column.id] ?? ""}
                            onChange={(e) => setPasteByColumnId((prev) => ({ ...prev, [column.id]: e.target.value }))}
                            placeholder={t("progressionTableAddon.pastePlaceholder", "Cole valores separados por quebra de linha ou virgula\nEx: 100\n200\n300\nou: 100,200,300")}
                            className={`${INPUT_CLASS} resize-y min-h-[60px] font-mono text-[11px]`}
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-gray-500">
                              {(() => {
                                const raw = pasteByColumnId[column.id] ?? "";
                                const parts = raw.includes("\n") ? raw.split("\n") : raw.split(",");
                                const count = parts.map((s) => s.trim()).filter(Boolean).length;
                                return count > 0
                                  ? t("progressionTableAddon.pasteCount", "{count} valor(es) — {rows} linha(s)")
                                      .replace("{count}", String(count))
                                      .replace("{rows}", String(rows.length))
                                  : "";
                              })()}
                            </p>
                            <button
                              type="button"
                              onClick={() => pasteColumnValues(column.id, pasteByColumnId[column.id] ?? "")}
                              disabled={!(pasteByColumnId[column.id] ?? "").trim()}
                              className="rounded-lg border border-blue-600 bg-blue-700 px-2.5 py-1 text-[11px] text-white hover:bg-blue-600 disabled:opacity-40"
                            >
                              {t("progressionTableAddon.applyPaste", "Aplicar")}
                            </button>
                          </div>
                        </div>
                      )}

                      {curveSuggestion[column.id]?.suggested && (() => {
                        const result = curveSuggestion[column.id] as { suggested: true; fit: { mode: string; r2: number; [k: string]: unknown } };
                        const { fit } = result;
                        const pct = Math.round(fit.r2 * 100);
                        const biasSuffix =
                          (fit.mode === "linear" || fit.mode === "exponential") &&
                          typeof fit.bias === "number" &&
                          Number.isFinite(fit.bias) &&
                          Math.abs(fit.bias - 1) >= 0.05
                            ? `, curvatura=${fit.bias}`
                            : "";
                        const desc = fit.mode === "linear"
                          ? `Linear (base=${fit.base}, step=${fit.step}${biasSuffix})`
                          : fit.mode === "exponential"
                            ? `Exponencial (base=${fit.base}, growth=${fit.growth}${biasSuffix})`
                            : `Formula: ${fit.expression}`;
                        const modeLabel = fit.mode === "linear"
                          ? t("progressionTableAddon.useLinear", "Usar Linear")
                          : fit.mode === "exponential"
                            ? t("progressionTableAddon.useExponential", "Usar Exponencial")
                            : t("progressionTableAddon.useFormula", "Usar Formula");
                        return (
                          <div className="rounded-lg border border-emerald-700/60 bg-emerald-900/20 px-3 py-2 text-[11px] text-emerald-200">
                            <p>
                              {t(
                                "progressionTableAddon.curveSuggestion",
                                "Estes valores seguem um padrao {desc} com {pct}% de precisao."
                              ).replace("{desc}", desc).replace("{pct}", String(pct))}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                type="button"
                                onClick={() => acceptCurveSuggestion(column.id)}
                                className="rounded-lg border border-emerald-600 bg-emerald-700 px-2.5 py-1 text-[11px] text-white hover:bg-emerald-600"
                              >
                                {modeLabel}
                              </button>
                              <button
                                type="button"
                                onClick={() => dismissCurveSuggestion(column.id)}
                                className="rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-[11px] text-gray-300 hover:bg-gray-700"
                              >
                                {t("progressionTableAddon.keepManual", "Manter Manual")}
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex gap-3 items-start">
                        <div className="max-h-[380px] overflow-auto rounded-lg border border-gray-700 shrink-0">
                          <table className="text-left text-xs">
                            <thead className="sticky top-0 bg-gray-900 text-gray-300">
                              <tr>
                                <th className="px-3 py-2">{t("progressionTableAddon.levelHeader", "Level")}</th>
                                <th className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span>{resolveColumnDisplayName(column, availableLibraryColumns) || t("progressionTableAddon.columnFallback", "Coluna")}</span>
                                    {(() => {
                                      const count = getOverrideCount(column.id);
                                      if (count === 0 || (column.generator?.mode ?? "manual") === "manual" || column.sheetsBinding) return null;
                                      return (
                                        <span className="flex items-center gap-1.5">
                                          <span className="rounded-full bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-200">
                                            {t("progressionTableAddon.overrideCount", "{count} manual(is)").replace("{count}", String(count))}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => resetColumnOverrides(column.id)}
                                            className="rounded-md px-1.5 py-0.5 text-[10px] text-amber-300 hover:bg-amber-900/30 hover:text-amber-100"
                                            aria-label={t(
                                              "progressionTableAddon.resetAllOverridesAriaLabel",
                                              "Resetar todos os valores manuais desta coluna"
                                            )}
                                          >
                                            {t("progressionTableAddon.resetAllOverridesButton", "↺ Resetar")}
                                          </button>
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => {
                                const cellHasOverride =
                                  (column.generator?.mode ?? "manual") !== "manual" &&
                                  hasOverride(row.level, column.id);
                                return (
                                <tr key={`${column.id}-${row.level}`} className="border-t border-gray-800 text-gray-200">
                                  <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                                    {t("progressionTableAddon.levelPrefix", "Lv")} {row.level}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <div className="flex items-center gap-1">
                                      <div className="relative flex-1">
                                        <CommitNumberInput
                                          value={Number(row.values[column.id] ?? 0)}
                                          onCommit={(next) => updateCell(row.level, column.id, String(next))}
                                          readOnly={!!column.sheetsBinding}
                                          className={`${INPUT_CLASS} w-64 ${
                                            column.isPercentage ? "pr-6" : ""
                                          } ${
                                            column.sheetsBinding
                                              ? "cursor-default border-emerald-600/40 bg-emerald-900/10 text-emerald-100/80 select-none"
                                              : cellHasOverride
                                              ? "border-amber-600/40 bg-amber-900/10"
                                              : ""
                                          }`}
                                        />
                                        {column.isPercentage && (
                                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-300">
                                            %
                                          </span>
                                        )}
                                      </div>
                                      {cellHasOverride && !column.sheetsBinding && (
                                        <button
                                          type="button"
                                          onClick={() => resetCellOverride(row.level, column.id)}
                                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] text-amber-300 hover:bg-amber-900/30 hover:text-amber-100"
                                          aria-label={t(
                                            "progressionTableAddon.resetOverrideAriaLabel",
                                            "Resetar ao valor gerado"
                                          )}
                                          title={t(
                                            "progressionTableAddon.resetOverrideAriaLabel",
                                            "Resetar ao valor gerado"
                                          )}
                                        >
                                          ↺
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {rows.length >= 2 && (() => {
                          const colValues = rows.map((r) => Number(r.values[column.id] ?? 0));
                          return (
                            <div className="flex-1 min-w-0 sticky top-0 h-[380px]">
                              <MiniLineChart values={colValues} startLevel={startLevel} />
                            </div>
                          );
                        })()}
                      </div>

                      {rows.length >= 3 && (() => {
                        const colValues = rows.map((r) => Number(r.values[column.id] ?? 0));
                        const segments = analyzeSegments(colValues, startLevel);
                        if (segments.length < 2) return null;
                        return (
                          <details className="group">
                            <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-300 select-none">
                              {t("progressionTableAddon.curveAnalysis", "Analise da curva")} ({segments.length} {t("progressionTableAddon.segments", "segmentos")})
                            </summary>
                            <div className="mt-1 space-y-0.5 text-[10px] text-gray-400">
                              {segments.map((seg, idx) => {
                                // When both values are negative, describe by magnitude
                                const bothNegative = seg.fromValue < 0 && seg.toValue < 0;
                                const magnitudeGrowing = bothNegative && Math.abs(seg.toValue) > Math.abs(seg.fromValue);
                                const magnitudeShrinking = bothNegative && Math.abs(seg.toValue) < Math.abs(seg.fromValue);

                                let text: string;
                                if (seg.trend === "flat") {
                                  text = t("progressionTableAddon.segFlat", "constante em ~{val}")
                                    .replace("{val}", formatSummaryValue(seg.fromValue));
                                } else if (magnitudeGrowing) {
                                  text = t("progressionTableAddon.segMagUp", "magnitude cresce ~{delta}/nv ({from} {arrow} {to})")
                                    .replace("{delta}", formatSummaryValue(Math.abs(seg.avgDelta)))
                                    .replace("{from}", formatSummaryValue(seg.fromValue))
                                    .replace("{arrow}", "\u2192")
                                    .replace("{to}", formatSummaryValue(seg.toValue));
                                } else if (magnitudeShrinking) {
                                  text = t("progressionTableAddon.segMagDown", "magnitude reduz ~{delta}/nv ({from} {arrow} {to})")
                                    .replace("{delta}", formatSummaryValue(Math.abs(seg.avgDelta)))
                                    .replace("{from}", formatSummaryValue(seg.fromValue))
                                    .replace("{arrow}", "\u2192")
                                    .replace("{to}", formatSummaryValue(seg.toValue));
                                } else if (seg.trend === "down") {
                                  text = t("progressionTableAddon.segDown", "cai ~{delta}/nv ({from} {arrow} {to})")
                                    .replace("{delta}", formatSummaryValue(Math.abs(seg.avgDelta)))
                                    .replace("{from}", formatSummaryValue(seg.fromValue))
                                    .replace("{arrow}", "\u2192")
                                    .replace("{to}", formatSummaryValue(seg.toValue));
                                } else {
                                  text = t("progressionTableAddon.segUp", "cresce ~{delta}/nv ({from} {arrow} {to})")
                                    .replace("{delta}", formatSummaryValue(seg.avgDelta))
                                    .replace("{from}", formatSummaryValue(seg.fromValue))
                                    .replace("{arrow}", "\u2192")
                                    .replace("{to}", formatSummaryValue(seg.toValue));
                                }
                                return (
                                  <p key={idx}>
                                    <span className="text-gray-300">Lv {seg.fromLevel}{"\u2192"}{seg.toLevel}:</span>{" "}
                                    {text}
                                  </p>
                                );
                              })}
                            </div>
                          </details>
                        );
                      })()}
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
