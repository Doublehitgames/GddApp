// lib/addons/syncSectionSheets.ts
// Sincronização em lote de todos os campos Google Sheets de uma seção.

import { fetchSheetCellValue, fetchSheetRangeValues, parseCellNumber } from "@/lib/googleSheets";
import type { SectionAddon, SheetsCellRef, ProgressionTableColumnSheetsBinding, ProgressionTableRow } from "@/lib/addons/types";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type SyncFieldResult = {
  addonId: string;
  addonName: string;
  field: string;
  ok: boolean;
  error?: string;
};

export type SyncSectionResult = {
  updatedAddons: SectionAddon[];
  totalSynced: number;
  fields: SyncFieldResult[];
};

// ---------------------------------------------------------------------------
// Helpers privados
// ---------------------------------------------------------------------------

/**
 * Varre os campos de um objeto procurando por bindings sheets de célula:
 * { source: "sheets", ref: { sheetName, cellRef } }
 */
function extractCellBindings(data: Record<string, unknown>): Array<{
  bindingKey: string;
  /** Chave escalar derivada: "buyValueBinding" → "buyValue". Null se não conseguir derivar. */
  scalarKey: string | null;
  ref: SheetsCellRef;
}> {
  const results: Array<{ bindingKey: string; scalarKey: string | null; ref: SheetsCellRef }> = [];
  for (const [key, value] of Object.entries(data)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    if (v.source !== "sheets") continue;
    const ref = v.ref as Record<string, unknown> | undefined;
    if (!ref || typeof ref.sheetName !== "string" || typeof ref.cellRef !== "string") continue;
    results.push({
      bindingKey: key,
      scalarKey: key.endsWith("Binding") ? key.slice(0, -7) : null,
      ref: {
        sheetName: ref.sheetName,
        cellRef: ref.cellRef,
        cachedValue: (ref.cachedValue as string | number | boolean | null) ?? null,
        syncedAt: (ref.syncedAt as string | null) ?? null,
      },
    });
  }
  return results;
}

/**
 * Busca um intervalo e mapeia os valores para cada linha da tabela de progressão.
 * Replicado aqui (sem dependência do panel) para uso no sync em lote.
 */
async function mapRangeToRows(
  binding: ProgressionTableColumnSheetsBinding,
  spreadsheetId: string,
  rows: ProgressionTableRow[],
  columnId: string,
  token: string,
  isText: boolean
): Promise<{ cachedValues: (number | string)[]; rowValues: Record<number, number | string> } | null> {
  const rawValues = await fetchSheetRangeValues(token, spreadsheetId, binding.sheetName, binding.range);
  if (!rawValues) return null;
  const cachedValues: (number | string)[] = [];
  const rowValues: Record<number, number | string> = {};
  rows.forEach((row, i) => {
    const raw = i < rawValues.length ? rawValues[i] : null;
    if (isText) {
      const val = raw != null ? String(raw) : String((row.values as Record<string, unknown>)?.[columnId] ?? "");
      cachedValues.push(val);
      if (raw != null) rowValues[row.level] = val;
    } else {
      let num: number | null = null;
      if (typeof raw === "number") num = raw;
      else if (typeof raw === "string") num = parseCellNumber(raw);
      const val = num ?? Number((row.values as Record<string, unknown>)?.[columnId] ?? 0);
      cachedValues.push(val);
      if (num !== null) rowValues[row.level] = num;
    }
  });
  return { cachedValues, rowValues };
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Sincroniza todos os campos Google Sheets dos addons de uma seção de uma vez.
 *
 * - `economyLink` e `production`: escaneia todos os campos com `source: "sheets"`
 *   e atualiza cachedValue + escalar correspondente.
 * - `progressionTable`: sincroniza todas as colunas com `sheetsBinding`,
 *   atualizando rows e overrides como o "Sincronizar tudo" do painel.
 * - Outros tipos de addon: passados sem alteração.
 *
 * Não lança exceções — erros por campo ficam registrados em `fields[].error`.
 */
export async function syncSectionAddons(
  addons: SectionAddon[],
  spreadsheetId: string,
  token: string
): Promise<SyncSectionResult> {
  const syncedAt = new Date().toISOString();
  let totalSynced = 0;
  const fields: SyncFieldResult[] = [];
  const updatedAddons: SectionAddon[] = [];

  for (const addon of addons) {
    const addonName = addon.name?.trim() || addon.type;

    // ── economyLink e production: células individuais ───────────────────────
    if (addon.type === "economyLink" || addon.type === "production") {
      const data = { ...(addon.data as Record<string, unknown>) };
      const bindings = extractCellBindings(data);

      if (bindings.length === 0) {
        updatedAddons.push(addon);
        continue;
      }

      let changed = false;
      for (const { bindingKey, scalarKey, ref } of bindings) {
        try {
          const raw = await fetchSheetCellValue(token, spreadsheetId, ref.sheetName, ref.cellRef);
          if (raw === null) {
            fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: false, error: `Não foi possível ler ${ref.sheetName}!${ref.cellRef}` });
            continue;
          }
          const num = parseCellNumber(raw);
          if (num === null) {
            fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: false, error: `"${raw}" não é número válido` });
            continue;
          }
          data[bindingKey] = { source: "sheets", ref: { ...ref, cachedValue: num, syncedAt } };
          if (scalarKey) data[scalarKey] = Math.floor(Math.max(0, num));
          totalSynced++;
          changed = true;
          fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: true });
        } catch {
          fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: false, error: "Erro inesperado" });
        }
      }

      updatedAddons.push(changed ? ({ ...addon, data } as SectionAddon) : addon);

    // ── progressionTable: intervalos de coluna ───────────────────────────────
    } else if (addon.type === "progressionTable") {
      const data = { ...(addon.data as Record<string, unknown>) };
      const columns = [...((data.columns as unknown[]) || [])] as Array<Record<string, unknown>>;
      let rows = [...((data.rows as ProgressionTableRow[]) || [])];
      let overrides = { ...((data.overrides as Record<string, Record<string, unknown>>) || {}) };
      const boundColumns = columns.filter((c) => c.sheetsBinding);

      if (boundColumns.length === 0) {
        updatedAddons.push(addon);
        continue;
      }

      let changed = false;
      for (const col of boundColumns) {
        const colId = String(col.id);
        const colName = String(col.name || col.id);
        try {
          const result = await mapRangeToRows(
            col.sheetsBinding as ProgressionTableColumnSheetsBinding,
            spreadsheetId,
            rows,
            colId,
            token,
            col.valueType === "text"
          );
          if (!result) {
            fields.push({ addonId: addon.id, addonName, field: colName, ok: false, error: "Erro ao buscar intervalo" });
            continue;
          }
          const { cachedValues, rowValues } = result;

          // Atualiza binding da coluna
          const colIdx = columns.findIndex((c) => c.id === col.id);
          if (colIdx >= 0) {
            columns[colIdx] = { ...columns[colIdx], sheetsBinding: { ...col.sheetsBinding as object, cachedValues, syncedAt } };
          }

          // Atualiza overrides
          for (const [level, val] of Object.entries(rowValues)) {
            overrides = { ...overrides, [level]: { ...(overrides[level] ?? {}), [colId]: val } };
          }

          // Atualiza rows
          rows = rows.map((row, i) => ({
            ...row,
            values: {
              ...(row.values as Record<string, string | number>),
              [colId]: cachedValues[i] ?? (row.values as Record<string, string | number>)?.[colId] ?? (col.valueType === "text" ? "" : 0),
            } as Record<string, string | number>,
          }));

          totalSynced++;
          changed = true;
          fields.push({ addonId: addon.id, addonName, field: colName, ok: true });
        } catch {
          fields.push({ addonId: addon.id, addonName, field: colName, ok: false, error: "Erro inesperado" });
        }
      }

      updatedAddons.push(changed ? ({ ...addon, data: { ...data, columns, rows, overrides } } as SectionAddon) : addon);

    // ── outros tipos: sem alteração ──────────────────────────────────────────
    } else {
      updatedAddons.push(addon);
    }
  }

  return { updatedAddons, totalSynced, fields };
}
