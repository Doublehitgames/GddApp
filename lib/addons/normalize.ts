import type { BalanceAddonDraft } from "@/lib/balance/types";
import type {
  LegacySectionAddonType,
  ProgressionTableAddonDraft,
  ProgressionTableColumn,
  ProgressionTableRow,
  SectionAddon,
} from "@/lib/addons/types";
import { balanceDraftToSectionAddon, buildProgressionRowsFromRange } from "@/lib/addons/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asBalanceDraft(value: unknown): BalanceAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  return value as unknown as BalanceAddonDraft;
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeColumnId(raw: unknown, fallbackIndex: number): string {
  const base = typeof raw === "string" && raw.trim() ? raw.trim() : `col_${fallbackIndex + 1}`;
  return base.replace(/\s+/g, "_");
}

function normalizeProgressionColumns(rawColumns: unknown[]): ProgressionTableColumn[] {
  const columns: ProgressionTableColumn[] = [];
  const usedIds = new Set<string>();
  for (let index = 0; index < rawColumns.length; index += 1) {
    const rawColumn = rawColumns[index];
    if (!isObject(rawColumn)) continue;
    const initialId = normalizeColumnId(rawColumn.id, index);
    let id = initialId;
    let dedupe = 2;
    while (usedIds.has(id)) {
      id = `${initialId}_${dedupe}`;
      dedupe += 1;
    }
    usedIds.add(id);
    const name = typeof rawColumn.name === "string" ? rawColumn.name : "Value";
    const decimalsValue = asFiniteNumber(rawColumn.decimals);
    const minValue = asFiniteNumber(rawColumn.min);
    const maxValue = asFiniteNumber(rawColumn.max);
    const column: ProgressionTableColumn = {
      id,
      name,
      generator: isObject(rawColumn.generator) ? (rawColumn.generator as ProgressionTableColumn["generator"]) : { mode: "manual" },
      decimals: decimalsValue == null ? 0 : Math.max(0, Math.min(6, Math.floor(decimalsValue))),
      min: minValue == null ? undefined : minValue,
      max: maxValue == null ? undefined : maxValue,
    };
    columns.push(column);
  }
  if (columns.length > 0) return columns;
  return [{ id: "value", name: "Value", generator: { mode: "manual" }, decimals: 0 }];
}

function normalizeProgressionRows(rawRows: unknown[], columns: ProgressionTableColumn[]): ProgressionTableRow[] {
  const normalizedRows: ProgressionTableRow[] = [];
  for (const rawRow of rawRows) {
    if (!isObject(rawRow)) continue;
    const level = asFiniteNumber(rawRow.level);
    if (level == null) continue;
    const valuesObj = isObject(rawRow.values) ? rawRow.values : {};
    const values: Record<string, number | string> = {};
    for (const column of columns) {
      const rawValue = valuesObj[column.id];
      const parsed = asFiniteNumber(rawValue);
      values[column.id] = parsed == null ? 0 : parsed;
    }
    normalizedRows.push({ level: Math.max(1, Math.floor(level)), values });
  }
  return normalizedRows.sort((a, b) => a.level - b.level);
}

function asSectionAddon(value: unknown): SectionAddon | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  if (value.type !== "xpBalance" && value.type !== "progressionTable") return null;
  if (!isObject(value.data)) return null;
  return value as unknown as SectionAddon;
}

function asLegacySectionAddon(value: unknown): SectionAddon | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  const legacyType = value.type as LegacySectionAddonType;
  if (legacyType !== "balance") return null;
  if (!isObject(value.data)) return null;
  const legacyData = asBalanceDraft(value.data);
  if (!legacyData) return null;
  return balanceDraftToSectionAddon({
    ...legacyData,
    id: value.id,
    name: value.name,
  });
}

function normalizeProgressionTableDraft(value: unknown): ProgressionTableAddonDraft | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  if (!Array.isArray(value.columns) || !Array.isArray(value.rows)) return null;
  const columns = normalizeProgressionColumns(value.columns);
  const normalizedRows = normalizeProgressionRows(value.rows, columns);
  const startLevelCandidate = asFiniteNumber(value.startLevel);
  const endLevelCandidate = asFiniteNumber(value.endLevel);
  const minRowLevel = normalizedRows.length > 0 ? normalizedRows[0].level : 1;
  const maxRowLevel = normalizedRows.length > 0 ? normalizedRows[normalizedRows.length - 1].level : minRowLevel;
  const startLevel = Math.max(1, Math.floor(startLevelCandidate ?? minRowLevel));
  const endLevel = Math.max(startLevel, Math.floor(endLevelCandidate ?? maxRowLevel));
  const rangeRows = buildProgressionRowsFromRange(startLevel, endLevel, columns);
  const byLevel = new Map(normalizedRows.map((row) => [row.level, row]));
  const rows = rangeRows.map((baseRow) => {
    const fromInput = byLevel.get(baseRow.level);
    if (!fromInput) return baseRow;
    return {
      level: baseRow.level,
      values: columns.reduce<Record<string, number | string>>((acc, column) => {
        const parsed = asFiniteNumber(fromInput.values[column.id]);
        acc[column.id] = parsed == null ? 0 : parsed;
        return acc;
      }, {}),
    };
  });
  return {
    id: value.id,
    name: value.name,
    startLevel,
    endLevel,
    columns,
    rows,
  };
}

export function normalizeSectionAddons(raw: unknown): SectionAddon[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: SectionAddon[] = [];
  for (const item of raw) {
    const addon = asSectionAddon(item);
    if (addon) {
      if (addon.type === "progressionTable") {
        const draft = normalizeProgressionTableDraft(addon.data);
        if (!draft) continue;
        out.push({
          ...addon,
          name: addon.name || draft.name,
          data: draft,
        });
        continue;
      }
      out.push({
        ...addon,
        name: addon.name.trim() || addon.name,
      });
      continue;
    }
    const legacyAddon = asLegacySectionAddon(item);
    if (legacyAddon) {
      out.push(legacyAddon);
      continue;
    }
    const maybeLegacyDraft = asBalanceDraft(item);
    if (maybeLegacyDraft) {
      out.push(balanceDraftToSectionAddon(maybeLegacyDraft));
    }
  }
  return out.length > 0 ? out : undefined;
}

export function stableAddonsForCompare(raw: unknown): string {
  const normalized = normalizeSectionAddons(raw) || [];
  const sorted = [...normalized].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sorted);
}

