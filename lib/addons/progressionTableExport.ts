import type { ProgressionTableAddonDraft } from "@/lib/addons/types";

export type ProgressionTableComputedExport = {
  version: "1.0";
  addonType: "progressionTable";
  addonId: string;
  name: string;
  startLevel: number;
  endLevel: number;
  exportedAt: string;
  columns: Array<{
    id: string;
    name: string;
    decimals: number;
    min?: number;
    max?: number;
  }>;
  rows: Array<{
    level: number;
    values: Record<string, number>;
  }>;
};

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildProgressionTableComputedExport(
  addon: ProgressionTableAddonDraft
): ProgressionTableComputedExport {
  const columns = (addon.columns || []).map((column) => ({
    id: column.id,
    name: column.name || column.id,
    decimals: Number.isFinite(column.decimals) ? Math.max(0, Math.min(6, Math.floor(Number(column.decimals)))) : 0,
    min: Number.isFinite(column.min) ? Number(column.min) : undefined,
    max: Number.isFinite(column.max) ? Number(column.max) : undefined,
  }));

  const rows = (addon.rows || []).map((row) => {
    const orderedValues: Record<string, number> = {};
    for (const column of columns) {
      orderedValues[column.id] = asNumber(row.values?.[column.id]);
    }
    return {
      level: Math.max(1, Math.floor(asNumber(row.level))),
      values: orderedValues,
    };
  });

  return {
    version: "1.0",
    addonType: "progressionTable",
    addonId: addon.id,
    name: addon.name,
    startLevel: Math.max(1, Math.floor(asNumber(addon.startLevel))),
    endLevel: Math.max(1, Math.floor(asNumber(addon.endLevel))),
    exportedAt: new Date().toISOString(),
    columns,
    rows,
  };
}

