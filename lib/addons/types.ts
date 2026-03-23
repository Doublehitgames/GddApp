import type { BalanceAddonDraft } from "@/lib/balance/types";

export type ProgressionTableColumn = {
  id: string;
  name: string;
  generator?: ProgressionColumnGenerator;
  decimals?: number;
  min?: number;
  max?: number;
};

export type ProgressionColumnGenerator =
  | { mode: "manual" }
  | { mode: "linear"; base: number; step: number }
  | { mode: "exponential"; base: number; growth: number }
  | { mode: "formula"; baseColumnId: string; expression: string };

export type ProgressionTableRow = {
  level: number;
  values: Record<string, number | string>;
};

export type ProgressionTableAddonDraft = {
  id: string;
  name: string;
  startLevel: number;
  endLevel: number;
  columns: ProgressionTableColumn[];
  rows: ProgressionTableRow[];
};

export type SectionAddonType = "xpBalance" | "progressionTable";
export type LegacySectionAddonType = "balance";

export type XpBalanceSectionAddon = {
  id: string;
  type: "xpBalance";
  name: string;
  data: BalanceAddonDraft;
};

export type ProgressionTableSectionAddon = {
  id: string;
  type: "progressionTable";
  name: string;
  data: ProgressionTableAddonDraft;
};

export type SectionAddon = XpBalanceSectionAddon | ProgressionTableSectionAddon;

function createDefaultRows(
  startLevel: number,
  endLevel: number,
  columns: ProgressionTableColumn[]
): ProgressionTableRow[] {
  const normalizedStart = Math.max(1, Math.floor(startLevel || 1));
  const normalizedEnd = Math.max(normalizedStart, Math.floor(endLevel || normalizedStart));
  const rows: ProgressionTableRow[] = [];
  for (let level = normalizedStart; level <= normalizedEnd; level += 1) {
    const values: Record<string, number | string> = {};
    for (const column of columns) {
      values[column.id] = 0;
    }
    rows.push({ level, values });
  }
  return rows;
}

export function createDefaultProgressionTableAddon(addonId: string): ProgressionTableSectionAddon {
  const columns: ProgressionTableColumn[] = [
    {
      id: "value",
      name: "Valor",
      generator: { mode: "manual" },
      decimals: 0,
    },
  ];
  const startLevel = 1;
  const endLevel = 20;
  return {
    id: addonId,
    type: "progressionTable",
    name: "Tabela de Balanceamento",
    data: {
      id: addonId,
      name: "Tabela de Balanceamento",
      startLevel,
      endLevel,
      columns,
      rows: createDefaultRows(startLevel, endLevel, columns),
    },
  };
}

export function buildProgressionRowsFromRange(
  startLevel: number,
  endLevel: number,
  columns: ProgressionTableColumn[]
): ProgressionTableRow[] {
  return createDefaultRows(startLevel, endLevel, columns);
}

export function balanceDraftToSectionAddon(draft: BalanceAddonDraft): XpBalanceSectionAddon {
  return {
    id: draft.id,
    type: "xpBalance",
    name: draft.name,
    data: draft,
  };
}

export function sectionAddonToBalanceDraft(addon: SectionAddon): BalanceAddonDraft {
  if (addon.type !== "xpBalance") {
    throw new Error("Addon nao e do tipo xpBalance.");
  }
  return {
    ...addon.data,
    id: addon.id,
    name: addon.name,
  };
}

