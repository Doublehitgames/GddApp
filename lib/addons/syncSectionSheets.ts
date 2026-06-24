// lib/addons/syncSectionSheets.ts
// Sincronização em lote de todos os campos Google Sheets de uma seção.

import { fetchSheetCellValue, fetchSheetRangeValues, fetchColumnValues, fetchSpreadsheetHeaders, columnIndexToLetter, parseCellNumber } from "@/lib/googleSheets";
import type { SectionAddon, SheetsCellRef, ProgressionTableColumnSheetsBinding, ProgressionTableRow, InventoryFieldKey } from "@/lib/addons/types";
import { INVENTORY_FIELD_VALUE_TYPE } from "@/lib/addons/inventoryFields";

/** Converte o valor cru de uma célula para boolean (mesma regra do FieldBindingPicker). */
function parseCellBoolean(raw: string | number | boolean): boolean {
  if (typeof raw === "boolean") return raw;
  const upper = String(raw).trim().toUpperCase();
  return upper === "TRUE" || upper === "1" || upper === "YES" || upper === "SIM";
}

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
        columnLock: typeof ref.columnLock === "string" ? ref.columnLock : undefined,
        rowLock: typeof ref.rowLock === "string" ? (ref.rowLock as "auto" | string) : undefined,
      },
    });
  }
  return results;
}

/**
 * Resolve o cellRef real de um binding com locks ativos.
 * Usa columnsBySheet (cache) para o columnLock e busca coluna A para o rowLock.
 * Retorna null se não conseguir resolver.
 */
async function resolveLockedCellRef(
  ref: SheetsCellRef,
  spreadsheetId: string,
  token: string,
  pageDataId: string | undefined,
  columnsBySheet: Record<string, string[]>,
  columnACache: Map<string, string[]>,
): Promise<string | null> {
  let colLetter: string | null = null;
  let rowNumber: number | null = null;

  if (ref.columnLock) {
    const headers = columnsBySheet[ref.sheetName];
    if (!headers) return null;
    const idx = headers.findIndex((h) => h === ref.columnLock);
    if (idx < 0) return null;
    colLetter = columnIndexToLetter(idx);
  } else {
    // Extract column letter from existing cellRef (e.g. "B3" → "B")
    const match = ref.cellRef.match(/^([A-Z]+)/);
    colLetter = match ? match[1] : null;
  }

  if (ref.rowLock) {
    const key = ref.rowLock === "auto" ? pageDataId : ref.rowLock;
    if (!key) return null;

    // Cache column A per sheet to avoid redundant fetches
    let colAValues = columnACache.get(ref.sheetName);
    if (!colAValues) {
      const fetched = await fetchColumnValues(token, spreadsheetId, ref.sheetName);
      if (!fetched) return null;
      colAValues = fetched;
      columnACache.set(ref.sheetName, colAValues);
    }

    // Row index in the array is 0-based (index 0 = row 1 in the sheet)
    const rowIdx = colAValues.findIndex((v) => v === key);
    if (rowIdx < 0) return null;
    rowNumber = rowIdx + 1; // 1-based row number
  } else {
    // Extract row number from existing cellRef (e.g. "B3" → 3)
    const match = ref.cellRef.match(/(\d+)$/);
    rowNumber = match ? parseInt(match[1], 10) : null;
  }

  if (!colLetter || !rowNumber) return null;
  return `${colLetter}${rowNumber}`;
}

/**
 * Cache compartilhado entre várias seções num sync em lote, para reduzir chamadas
 * à API do Google Sheets (e evitar rate limit). Mantém:
 * - columnA: valores da coluna A por aba (resolução de rowLock)
 * - columnValues: valores de uma coluna inteira por `${aba}!${letra}` (leitura de célula)
 */
export type SheetFetchCache = {
  columnA: Map<string, string[]>;
  columnValues: Map<string, (string | number | null)[]>;
};

/**
 * Lê o valor de uma célula resolvida (ex: "E17") buscando a COLUNA INTEIRA uma vez
 * e cacheando-a. Em lote, isso transforma N leituras de célula em 1 leitura por coluna.
 * Retorna null se não conseguir ler.
 */
async function readCellCached(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  cellRef: string,
  cache: SheetFetchCache,
): Promise<string | number | null> {
  const m = cellRef.match(/^([A-Z]+)(\d+)$/);
  if (!m) {
    // Formato inesperado — cai no fetch de célula única
    return fetchSheetCellValue(token, spreadsheetId, sheetName, cellRef);
  }
  const colLetter = m[1];
  const rowNumber = parseInt(m[2], 10);
  const key = `${sheetName}!${colLetter}`;
  let colValues = cache.columnValues.get(key);
  if (!colValues) {
    const fetched = await fetchSheetRangeValues(token, spreadsheetId, sheetName, `${colLetter}:${colLetter}`);
    if (!fetched) return null;
    colValues = fetched;
    cache.columnValues.set(key, colValues);
  }
  return colValues[rowNumber - 1] ?? null;
}

/**
 * Busca um intervalo e mapeia os valores para cada linha da tabela de progressão.
 * Suporta columnLock: resolve a coluna pelo header e reconstrói o range.
 * Replicado aqui (sem dependência do panel) para uso no sync em lote.
 */
async function mapRangeToRows(
  binding: ProgressionTableColumnSheetsBinding,
  spreadsheetId: string,
  rows: ProgressionTableRow[],
  columnId: string,
  token: string,
  isText: boolean,
  columnsBySheet: Record<string, string[]>,
): Promise<{ cachedValues: (number | string)[]; rowValues: Record<number, number | string>; resolvedRange: string } | null> {
  let effectiveRange = binding.range;

  if (binding.columnLock) {
    const headers = columnsBySheet[binding.sheetName];
    if (headers) {
      const idx = headers.findIndex((h) => h === binding.columnLock);
      if (idx >= 0) {
        const colLetter = columnIndexToLetter(idx);
        // Extract row numbers from existing range (e.g. "B2:B51" → rowStart=2, rowEnd=51)
        const rangeMatch = binding.range.match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);
        if (rangeMatch) {
          effectiveRange = `${colLetter}${rangeMatch[1]}:${colLetter}${rangeMatch[2]}`;
        }
      }
    }
  }

  const rawValues = await fetchSheetRangeValues(token, spreadsheetId, binding.sheetName, effectiveRange);
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
  return { cachedValues, rowValues, resolvedRange: effectiveRange };
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
 * `pageDataId` é o DataID da seção (usado para resolver rowLock: "auto").
 * `columnsBySheet` é o cache de headers por aba da planilha vinculada (LinkedSpreadsheet.columnsBySheet).
 *
 * Não lança exceções — erros por campo ficam registrados em `fields[].error`.
 */
export async function syncSectionAddons(
  addons: SectionAddon[],
  spreadsheetId: string,
  token: string,
  pageDataId?: string,
  columnsBySheet?: Record<string, string[]>,
  sharedCache?: SheetFetchCache,
): Promise<SyncSectionResult> {
  const syncedAt = new Date().toISOString();
  let totalSynced = 0;
  const fields: SyncFieldResult[] = [];
  const updatedAddons: SectionAddon[] = [];
  const effectiveColumnsBySheet = columnsBySheet ?? {};

  // Cache de fetches do Sheets. Quando fornecido (sync em lote), é compartilhado
  // entre todas as seções → coluna A e colunas de valor são buscadas uma única vez.
  const cache: SheetFetchCache = sharedCache ?? { columnA: new Map(), columnValues: new Map() };
  const columnACache = cache.columnA;

  // Se columnsBySheet não foi fornecido mas há locks no sheet, busca headers on-demand
  // (fallback para quando a planilha foi cadastrada antes do recurso existir)
  async function ensureColumnsBySheet(sheetNames: string[]): Promise<Record<string, string[]>> {
    if (Object.keys(effectiveColumnsBySheet).length > 0) return effectiveColumnsBySheet;
    const missing = sheetNames.filter((s) => !effectiveColumnsBySheet[s]);
    if (missing.length === 0) return effectiveColumnsBySheet;
    const fetched = await fetchSpreadsheetHeaders(token, spreadsheetId, missing);
    return { ...effectiveColumnsBySheet, ...fetched };
  }

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

      // Resolve headers se houver locks de coluna
      const hasLocks = bindings.some((b) => b.ref.columnLock || b.ref.rowLock);
      const resolvedColumnsBySheet = hasLocks
        ? await ensureColumnsBySheet([...new Set(bindings.map((b) => b.ref.sheetName))])
        : effectiveColumnsBySheet;

      let changed = false;
      for (const { bindingKey, scalarKey, ref } of bindings) {
        try {
          // Resolve locks se ativos
          let resolvedCellRef = ref.cellRef;
          if (ref.columnLock || ref.rowLock) {
            const resolved = await resolveLockedCellRef(ref, spreadsheetId, token, pageDataId, resolvedColumnsBySheet, columnACache);
            if (resolved === null) {
              fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: false, error: `Não foi possível resolver lock: coluna "${ref.columnLock ?? ""}" / linha "${ref.rowLock ?? ""}"` });
              continue;
            }
            resolvedCellRef = resolved;
          }

          const rawVal = await readCellCached(token, spreadsheetId, ref.sheetName, resolvedCellRef, cache);
          if (rawVal === null) {
            fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: false, error: `Não foi possível ler ${ref.sheetName}!${resolvedCellRef}` });
            continue;
          }
          const num = typeof rawVal === "number" ? rawVal : parseCellNumber(String(rawVal));
          if (num === null) {
            fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: false, error: `"${rawVal}" não é número válido` });
            continue;
          }
          // Atualiza cellRef com a posição resolvida (para display)
          data[bindingKey] = { source: "sheets", ref: { ...ref, cellRef: resolvedCellRef, cachedValue: num, syncedAt } };
          if (scalarKey) data[scalarKey] = Math.floor(Math.max(0, num));
          totalSynced++;
          changed = true;
          fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: true });
        } catch {
          fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: false, error: "Erro inesperado" });
        }
      }

      updatedAddons.push(changed ? ({ ...addon, data } as SectionAddon) : addon);

    // ── inventory: células individuais (boolean/numérico, type-aware) ────────
    } else if (addon.type === "inventory") {
      const data = { ...(addon.data as Record<string, unknown>) };
      const bindings = extractCellBindings(data);

      if (bindings.length === 0) {
        updatedAddons.push(addon);
        continue;
      }

      const hasLocks = bindings.some((b) => b.ref.columnLock || b.ref.rowLock);
      const resolvedColumnsBySheet = hasLocks
        ? await ensureColumnsBySheet([...new Set(bindings.map((b) => b.ref.sheetName))])
        : effectiveColumnsBySheet;

      let changed = false;
      for (const { bindingKey, scalarKey, ref } of bindings) {
        try {
          let resolvedCellRef = ref.cellRef;
          if (ref.columnLock || ref.rowLock) {
            const resolved = await resolveLockedCellRef(ref, spreadsheetId, token, pageDataId, resolvedColumnsBySheet, columnACache);
            if (resolved === null) {
              fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: false, error: `Não foi possível resolver lock: coluna "${ref.columnLock ?? ""}" / linha "${ref.rowLock ?? ""}"` });
              continue;
            }
            resolvedCellRef = resolved;
          }

          const rawVal = await readCellCached(token, spreadsheetId, ref.sheetName, resolvedCellRef, cache);
          if (rawVal === null) {
            fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: false, error: `Não foi possível ler ${ref.sheetName}!${resolvedCellRef}` });
            continue;
          }

          // Tipo do campo escalar determina a conversão (boolean vs numérico).
          const valueType = scalarKey ? INVENTORY_FIELD_VALUE_TYPE[scalarKey as InventoryFieldKey] : undefined;
          let cachedValue: string | number | boolean;
          let scalarValue: number | boolean;
          if (valueType === "boolean") {
            const bool = parseCellBoolean(rawVal);
            cachedValue = bool;
            scalarValue = bool;
          } else {
            const num = typeof rawVal === "number" ? rawVal : parseCellNumber(String(rawVal));
            if (num === null) {
              fields.push({ addonId: addon.id, addonName, field: bindingKey, ok: false, error: `"${rawVal}" não é número válido` });
              continue;
            }
            cachedValue = num;
            scalarValue = Math.floor(Math.max(0, num));
          }

          data[bindingKey] = { source: "sheets", ref: { ...ref, cellRef: resolvedCellRef, cachedValue, syncedAt } };
          if (scalarKey) data[scalarKey] = scalarValue;
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

      // Resolve headers se houver locks de coluna
      const hasLocks = boundColumns.some((c) => (c.sheetsBinding as ProgressionTableColumnSheetsBinding)?.columnLock);
      const resolvedColumnsBySheet = hasLocks
        ? await ensureColumnsBySheet([...new Set(boundColumns.map((c) => (c.sheetsBinding as ProgressionTableColumnSheetsBinding).sheetName))])
        : effectiveColumnsBySheet;

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
            col.valueType === "text",
            resolvedColumnsBySheet,
          );
          if (!result) {
            fields.push({ addonId: addon.id, addonName, field: colName, ok: false, error: "Erro ao buscar intervalo" });
            continue;
          }
          const { cachedValues, rowValues, resolvedRange } = result;

          // Atualiza binding da coluna (inclui range resolvido para display)
          const colIdx = columns.findIndex((c) => c.id === col.id);
          if (colIdx >= 0) {
            columns[colIdx] = { ...columns[colIdx], sheetsBinding: { ...col.sheetsBinding as object, range: resolvedRange, cachedValues, syncedAt } };
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
