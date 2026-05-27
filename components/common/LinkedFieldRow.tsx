"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { SheetsCellRef } from "@/lib/addons/types";
import type { LinkedSpreadsheet } from "@/store/slices/types";
import {
  getGoogleSheetsToken,
  fetchSheetCellValue,
  fetchColumnValues,
  fetchSpreadsheetHeaders,
  columnIndexToLetter,
  parseSpreadsheetId,
} from "@/lib/googleSheets";
import { getGoogleClientId } from "@/lib/googleDrivePicker";

// ── Module-level helpers ───────────────────────────────────────────────────────

function formatSyncAge(syncedAt: string | null | undefined): string | null {
  if (!syncedAt) return null;
  const diff = Date.now() - new Date(syncedAt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type LinkedFieldOption = {
  /** Stable unique key for this option (e.g. `${addonId}::${columnId}`). */
  key: string;
  /** What appears in the picker row. */
  label: string;
  /** Optional sub-label shown muted under the label. */
  hint?: string;
};

interface LinkedFieldRowProps {
  /** Field label shown above the input. */
  label: string;
  /** Optional helper line shown above the row (smaller, muted). */
  hint?: string;
  /** Field control (input/select/etc.) — usually a CommitNumberInput. */
  children: ReactNode;
  /** Optional badges/preview shown below the row when linked. */
  badges?: ReactNode;
  /** Currently-selected option key (empty string = no link). */
  selectedKey: string;
  /** Available link options. Empty array shows the "no options" empty state. */
  options: LinkedFieldOption[];
  /** Called when user selects an option. Pass undefined for the chosen option = clear. */
  onChange: (option: LinkedFieldOption | undefined) => void;
  /** Optional fallback name to show when the saved link no longer matches any option. */
  invalidLabelFallback?: string;
  /** Optional custom CTA shown inside the popover when options is empty. */
  emptyStateCta?: ReactNode;
  /** Optional element rendered inline after the label (e.g. a bind icon button). */
  labelAdornment?: ReactNode;
  /** When provided, adds a Google Sheets section inside the popover. */
  sheetsBinding?: {
    current: SheetsCellRef | undefined;
    onBind: (ref: SheetsCellRef) => Promise<void>;
    onUnbind: () => void;
  };
  /** Planilhas cadastradas no projeto — quando fornecido, o formulário usa selects em vez de input livre. */
  spreadsheetRegistry?: LinkedSpreadsheet[];
  /** ID da planilha (registry) vinculada à seção atual. */
  linkedSpreadsheetId?: string;
  /** Chamado quando o usuário muda a planilha vinculada à seção. */
  onLinkedSpreadsheetChange?: (id: string) => void;
  /** DataID da página atual — usado para resolver rowLock: "auto". */
  pageDataId?: string;
}

export function LinkedFieldRow({
  label,
  hint,
  children,
  badges,
  selectedKey,
  options,
  onChange,
  invalidLabelFallback,
  emptyStateCta,
  labelAdornment,
  sheetsBinding,
  spreadsheetRegistry,
  linkedSpreadsheetId,
  onLinkedSpreadsheetChange,
  pageDataId,
}: LinkedFieldRowProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsSheetName, setSheetsSheetName] = useState("");
  // Coluna: "letter" = digita letra (ex: B) | "header" = escolhe pelo nome do header
  const [columnMode, setColumnMode] = useState<"letter" | "header">("letter");
  const [sheetsColInput, setSheetsColInput] = useState("");
  const [columnHeaderValue, setColumnHeaderValue] = useState("");
  // Linha: "number" = digita número (ex: 3) | "auto" = usa DataID da página
  const [rowMode, setRowMode] = useState<"number" | "auto">("number");
  const [sheetsRowInput, setSheetsRowInput] = useState("");
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  // registry mode
  const [selectedRegistryId, setSelectedRegistryId] = useState("");

  // Auto-fetch headers
  const [localColumnsBySheet, setLocalColumnsBySheet] = useState<Record<string, string[]>>({});
  const [headersFetching, setHeadersFetching] = useState(false);

  // Test-bind
  const [testResult, setTestResult] = useState<{ cell: string; value: string | number | boolean | null } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const popoverId = useId();
  const labelId = useId();
  const buttonId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = selectedKey ? options.find((o) => o.key === selectedKey) : undefined;
  const hasInvalidLink = Boolean(selectedKey && !selected);
  const hasSheetsBinding = Boolean(sheetsBinding?.current);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !sheetsBinding) return;
    const cur = sheetsBinding.current;
    setSheetsSheetName(cur?.sheetName ?? "");
    // Extrair coluna e linha do cellRef existente (ex: "B3" → col="B", row="3")
    const colMatch = cur?.cellRef?.match(/^([A-Z]+)/);
    const rowMatch = cur?.cellRef?.match(/(\d+)$/);
    if (cur?.columnLock) {
      setColumnMode("header");
      setColumnHeaderValue(cur.columnLock);
      setSheetsColInput(colMatch ? colMatch[1] : "");
    } else {
      setColumnMode("letter");
      setSheetsColInput(colMatch ? colMatch[1] : "");
      setColumnHeaderValue("");
    }
    if (cur?.rowLock) {
      setRowMode("auto");
      setSheetsRowInput(rowMatch ? rowMatch[1] : "");
    } else {
      setRowMode("number");
      setSheetsRowInput(rowMatch ? rowMatch[1] : "");
    }
    setSheetsError(null);
    setTestResult(null);
    setLocalColumnsBySheet({});
    // Init registry selection from section's linkedSpreadsheetId, falling back to first registry entry
    if (spreadsheetRegistry && spreadsheetRegistry.length > 0) {
      setSelectedRegistryId(linkedSpreadsheetId ?? spreadsheetRegistry[0].id);
      setSheetsUrl("");
    } else {
      setSelectedRegistryId("__other__");
      setSheetsUrl("");
    }
  }, [open]);

  // Auto-fetch headers when tab changes
  useEffect(() => {
    if (!open || !sheetsBinding || !sheetsSheetName) return;

    const effectiveId = linkedSpreadsheetId
      ?? (selectedRegistryId !== "__other__" ? selectedRegistryId : undefined);
    const reg = spreadsheetRegistry?.find((s) => s.id === effectiveId);
    if (!reg?.spreadsheetId) return;

    // Already have headers — skip fetch
    if (
      (reg.columnsBySheet?.[sheetsSheetName] && reg.columnsBySheet[sheetsSheetName].length > 0) ||
      (localColumnsBySheet[sheetsSheetName] && localColumnsBySheet[sheetsSheetName].length > 0)
    ) return;

    let cancelled = false;
    setHeadersFetching(true);
    (async () => {
      try {
        const clientId = await getGoogleClientId();
        const token = clientId ? await getGoogleSheetsToken(clientId) : null;
        if (!token || cancelled) return;
        const result = await fetchSpreadsheetHeaders(token, reg.spreadsheetId, [sheetsSheetName]);
        if (!cancelled) {
          setLocalColumnsBySheet((prev) => ({ ...prev, ...result }));
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setHeadersFetching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, sheetsSheetName, selectedRegistryId]);

  // Derived: available headers
  const effectiveRegistryEntry = spreadsheetRegistry?.find(
    (s) => s.id === (linkedSpreadsheetId ?? (selectedRegistryId !== "__other__" ? selectedRegistryId : undefined))
  );
  const availableHeaders = sheetsSheetName
    ? (localColumnsBySheet[sheetsSheetName] ?? effectiveRegistryEntry?.columnsBySheet?.[sheetsSheetName] ?? [])
    : [];

  const columnLockMissing = !!(sheetsBinding?.current?.columnLock && availableHeaders.length > 0 && !availableHeaders.includes(sheetsBinding.current.columnLock));
  const hasLocks = hasSheetsBinding && sheetsBinding?.current && (sheetsBinding.current.columnLock || sheetsBinding.current.rowLock);

  // Preview cell (derived from form state, no network)
  const previewColLetter = columnMode === "letter"
    ? (sheetsColInput.trim().toUpperCase() || null)
    : (() => { const idx = availableHeaders.indexOf(columnHeaderValue); return idx >= 0 ? columnIndexToLetter(idx) : null; })();
  const previewCell = sheetsSheetName && previewColLetter
    ? `${sheetsSheetName}!${previewColLetter}${rowMode === "number" ? (sheetsRowInput.trim() || "?") : "?"}`
    : null;

  // ── Resolution helper (shared by test and bind) ────────────────────────────
  async function resolveCell(): Promise<{ resolvedCell: string; spreadsheetId: string; token: string; sheet: string }> {
    const sheet = sheetsSheetName.trim();
    if (!sheet) throw new Error(t("linkedField.sheets.errorNoSheet"));

    if (columnMode === "letter") {
      const col = sheetsColInput.trim().toUpperCase();
      if (!col || !/^[A-Z]+$/.test(col)) throw new Error("Informe a letra da coluna (ex: B).");
    } else {
      if (!columnHeaderValue) throw new Error("Selecione um campo da coluna.");
    }
    if (rowMode === "number") {
      if (!sheetsRowInput.trim() || !/^\d+$/.test(sheetsRowInput.trim())) {
        throw new Error("Informe o número da linha (ex: 3).");
      }
    } else {
      if (!pageDataId) throw new Error("DataID da página não disponível.");
    }

    const effectiveRegistryId = selectedRegistryId && selectedRegistryId !== "__other__"
      ? selectedRegistryId : undefined;
    if (!effectiveRegistryId && !sheetsUrl.trim()) {
      throw new Error(t("linkedField.sheets.errorInvalidUrl"));
    }

    const registryEntry = effectiveRegistryId
      ? spreadsheetRegistry?.find((s) => s.id === effectiveRegistryId) : undefined;
    const spreadsheetId = registryEntry?.spreadsheetId ?? (sheetsUrl ? parseSpreadsheetId(sheetsUrl) : null);
    if (!spreadsheetId) throw new Error("Planilha não encontrada no registro.");

    const clientId = await getGoogleClientId();
    const token = clientId ? await getGoogleSheetsToken(clientId) : null;
    if (!token) throw new Error("Não foi possível obter autorização do Google.");

    // Resolver coluna
    let colLetter: string;
    if (columnMode === "letter") {
      colLetter = sheetsColInput.trim().toUpperCase();
    } else {
      const headers = registryEntry?.columnsBySheet?.[sheet] ?? availableHeaders;
      const colIdx = headers.findIndex((h) => h === columnHeaderValue);
      if (colIdx < 0) throw new Error(`Campo "${columnHeaderValue}" não encontrado na aba "${sheet}". Atualize a planilha nas configurações do projeto.`);
      colLetter = columnIndexToLetter(colIdx);
    }

    // Resolver linha
    let rowNum: number;
    if (rowMode === "number") {
      rowNum = parseInt(sheetsRowInput.trim(), 10);
    } else {
      const colAValues = await fetchColumnValues(token, spreadsheetId, sheet);
      if (!colAValues) throw new Error(`Não foi possível ler a coluna de IDs da aba "${sheet}".`);
      const rowIdx = colAValues.findIndex((v) => v === pageDataId);
      if (rowIdx < 0) throw new Error(`"${pageDataId}" não encontrado na coluna A de "${sheet}". Verifique se o DataID está correto.`);
      rowNum = rowIdx + 1;
    }

    return { resolvedCell: `${colLetter}${rowNum}`, spreadsheetId, token, sheet };
  }

  async function handleSheetsTest() {
    setSheetsError(null);
    setTestResult(null);
    setTestLoading(true);
    try {
      const { resolvedCell, spreadsheetId, token, sheet } = await resolveCell();
      const raw = await fetchSheetCellValue(token, spreadsheetId, sheet, resolvedCell);
      if (raw === null) throw new Error(`Célula ${sheet}!${resolvedCell} está vazia ou não foi possível ler.`);
      setTestResult({ cell: `${sheet}!${resolvedCell}`, value: raw });
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : "Erro ao testar.");
    } finally {
      setTestLoading(false);
    }
  }

  async function handleSheetsBind() {
    setSheetsError(null);
    setSheetsLoading(true);
    try {
      const { resolvedCell, sheet } = await resolveCell();

      const effectiveRegistryId = selectedRegistryId && selectedRegistryId !== "__other__"
        ? selectedRegistryId : undefined;

      if (effectiveRegistryId && onLinkedSpreadsheetChange && effectiveRegistryId !== linkedSpreadsheetId) {
        onLinkedSpreadsheetChange(effectiveRegistryId);
      }

      const cur = sheetsBinding?.current;
      await sheetsBinding?.onBind({
        sheetName: sheet,
        cellRef: resolvedCell,
        cachedValue: cur?.sheetName === sheet && cur?.cellRef === resolvedCell ? (cur?.cachedValue ?? null) : null,
        syncedAt: cur?.sheetName === sheet && cur?.cellRef === resolvedCell ? (cur?.syncedAt ?? null) : null,
        columnLock: columnMode === "header" ? columnHeaderValue : undefined,
        rowLock: rowMode === "auto" ? "auto" : undefined,
      });
      setOpen(false);
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : t("linkedField.sheets.errorGeneric"));
    } finally {
      setSheetsLoading(false);
    }
  }

  const sheetsRegistryName = hasSheetsBinding && linkedSpreadsheetId
    ? spreadsheetRegistry?.find((s) => s.id === linkedSpreadsheetId)?.name
    : undefined;

  const chipText = hasSheetsBinding
    ? `${sheetsRegistryName ? `Google Sheets: ${sheetsRegistryName} - ` : ""}${sheetsBinding!.current!.sheetName}!${sheetsBinding!.current!.cellRef}`
    : selected
    ? selected.label
    : hasInvalidLink
    ? invalidLabelFallback || t("linkedField.invalid", "Vínculo quebrado")
    : t("linkedField.noLink", "Sem vínculo");

  const chipClass = hasSheetsBinding
    ? "border-emerald-500/60 bg-emerald-600/20 text-emerald-100 hover:bg-emerald-600/30"
    : selected
    ? "border-indigo-400/60 bg-indigo-600/20 text-indigo-100 hover:bg-indigo-600/30"
    : hasInvalidLink
    ? "border-amber-500/60 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
    : "border-gray-600 bg-gray-800/80 text-gray-300 hover:border-indigo-400/50 hover:text-white";

  return (
    <div className="flex flex-col gap-1.5">
      {open ? <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" aria-hidden="true" /> : null}

      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1">
          <span id={labelId} className="text-xs text-gray-400">{label}</span>
          {labelAdornment}
        </span>
        {hint ? <span className="text-[10px] text-gray-500">{hint}</span> : null}
      </div>
      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">{children}</div>
        <div ref={containerRef} className="relative shrink-0">
          <button
            id={buttonId}
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls={popoverId}
            aria-labelledby={`${labelId} ${buttonId}`}
            title={
              hasSheetsBinding && sheetsBinding?.current?.syncedAt
                ? `Último sync: ${formatSyncAge(sheetsBinding.current.syncedAt)}`
                : selected
                ? t("linkedField.editLink", "Editar vínculo")
                : t("linkedField.addLink", "Vincular a uma tabela de progressão")
            }
            className={`inline-flex h-full max-w-[220px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${chipClass}`}
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m6.656-6.656l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0"
              />
            </svg>
            {hasLocks ? <span className="shrink-0 text-amber-400 text-[10px]" aria-hidden="true">🔒</span> : null}
            <span className="truncate">{chipText}</span>
            {selected || hasSheetsBinding ? (
              <span aria-hidden="true" className={hasSheetsBinding ? "text-emerald-300" : "text-indigo-300"}>
                •
              </span>
            ) : null}
            <svg className="h-3 w-3 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open ? (
            <div
              id={popoverId}
              role="listbox"
              className="fixed left-1/2 top-1/2 z-50 max-h-[min(600px,90vh)] w-[22rem] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-gray-700 bg-gray-900/98 p-1.5 shadow-2xl shadow-black/40 backdrop-blur"
            >
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500">
                {t("linkedField.popoverTitle", "Vincular a tabela de progressão")}
              </div>

              <button
                type="button"
                role="option"
                aria-selected={!selected && !hasInvalidLink}
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                  !selected && !hasInvalidLink
                    ? "bg-gray-800/70 text-white"
                    : "text-gray-200 hover:bg-gray-800"
                }`}
              >
                <span>{t("linkedField.noLink", "Sem vínculo")}</span>
                {!selected && !hasInvalidLink ? (
                  <span className="text-indigo-300" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>

              {hasInvalidLink ? (
                <div className="mx-1 my-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
                  <p className="font-semibold">
                    {t(
                      "linkedField.invalidOption",
                      "Vinculo invalido (coluna removida)"
                    )}
                  </p>
                  <p className="mt-1 text-amber-200/80">
                    {t(
                      "linkedField.invalidExplain",
                      "A coluna vinculada não existe mais. Escolha outra ou limpe o vínculo."
                    )}
                  </p>
                </div>
              ) : null}

              {options.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/60 px-2.5 py-3 text-center text-[11px] text-gray-400 m-1">
                  <p className="mb-2">
                    {t(
                      "linkedField.emptyOptions",
                      "Nenhuma tabela de progressão nesta seção. Crie uma para vincular."
                    )}
                  </p>
                  {emptyStateCta}
                </div>
              ) : hasSheetsBinding ? (
                <div className="mx-1 mb-1 rounded-md border border-gray-700/60 bg-gray-800/40 px-2 py-2 text-[11px] text-gray-500">
                  {t("linkedField.sheets.removeSheetsToBind")}
                </div>
              ) : (
                <ul className="mt-0.5">
                  {options.map((option) => {
                    const isSelected = option.key === selectedKey;
                    return (
                      <li key={option.key}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onChange(option);
                            setOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                            isSelected ? "bg-indigo-600/25 text-indigo-50" : "text-gray-200 hover:bg-gray-800"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            <span className="block truncate">{option.label}</span>
                            {option.hint ? (
                              <span className="block truncate text-[10px] text-gray-500">{option.hint}</span>
                            ) : null}
                          </span>
                          {isSelected ? (
                            <span className="text-indigo-300" aria-hidden="true">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {sheetsBinding ? (
                <>
                  <div className="my-1.5 border-t border-gray-700/60" />
                  <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 flex items-center gap-1">
                    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                    </svg>
                    Google Sheets
                  </div>

                  {sheetsBinding.current ? (
                    <div className="mx-1 mb-1 flex items-center justify-between rounded-md border border-emerald-700/40 bg-emerald-900/15 px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-emerald-300">
                        {sheetsBinding.current.sheetName}!{sheetsBinding.current.cellRef}
                        {sheetsBinding.current.cachedValue != null ? (
                          <span className="ml-1.5 text-emerald-500">= {sheetsBinding.current.cachedValue}</span>
                        ) : null}
                        {sheetsBinding.current.columnLock ? (
                          <span className="ml-1.5 rounded bg-amber-900/30 px-1 text-[9px] text-amber-400">col:{sheetsBinding.current.columnLock}</span>
                        ) : null}
                        {sheetsBinding.current.rowLock ? (
                          <span className="ml-1 rounded bg-amber-900/30 px-1 text-[9px] text-amber-400">linha:auto</span>
                        ) : null}
                        {sheetsBinding.current.syncedAt ? (
                          <span className="ml-1.5 text-[9px] text-gray-500">{formatSyncAge(sheetsBinding.current.syncedAt)}</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => { sheetsBinding.onUnbind(); setOpen(false); }}
                        className="ml-2 shrink-0 text-[10px] text-rose-400 hover:text-rose-300"
                      >
                        {t("linkedField.sheets.unbind")}
                      </button>
                    </div>
                  ) : null}

                  {/* columnLock missing warning */}
                  {columnLockMissing ? (
                    <div className="mx-1 mb-1 rounded border border-amber-600/40 bg-amber-900/10 px-2 py-1.5 text-[10px] text-amber-300">
                      ⚠ Campo &quot;{sheetsBinding.current!.columnLock}&quot; não encontrado na planilha. O vínculo pode estar quebrado.
                    </div>
                  ) : null}

                  <div className="mx-1 mb-1 space-y-2">
                    {/* ── Modo 1: planilha já vinculada à seção ── */}
                    {linkedSpreadsheetId && spreadsheetRegistry && spreadsheetRegistry.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5 rounded border border-emerald-700/30 bg-emerald-900/10 px-2 py-1 text-[10px] text-emerald-300">
                          <span aria-hidden="true">📊</span>
                          <span className="truncate">
                            {spreadsheetRegistry.find((s) => s.id === linkedSpreadsheetId)?.name ?? "Planilha da seção"}
                          </span>
                        </div>
                        <select
                          value={sheetsSheetName}
                          onChange={(e) => setSheetsSheetName(e.target.value)}
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white outline-none focus:border-gray-500"
                        >
                          <option value="">{t("linkedField.sheets.chooseSheetPlaceholder")}</option>
                          {(spreadsheetRegistry.find((s) => s.id === linkedSpreadsheetId)?.sheets ?? []).map((sh) => (
                            <option key={sh} value={sh}>{sh}</option>
                          ))}
                        </select>
                      </>
                    ) : spreadsheetRegistry && spreadsheetRegistry.length > 0 ? (
                      /* ── Modo 2: tem registro mas sem planilha na seção ── */
                      <>
                        <div className="rounded border border-amber-700/30 bg-amber-900/10 px-2 py-1 text-[10px] text-amber-300/80">
                          💡 Defina a planilha desta seção na página para não precisar escolher aqui toda vez.
                        </div>
                        <select
                          value={selectedRegistryId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedRegistryId(id);
                            if (id !== "__other__") {
                              const reg = spreadsheetRegistry.find((s) => s.id === id);
                              if (reg) { setSheetsUrl(reg.url); setSheetsSheetName(""); }
                            } else {
                              setSheetsUrl(""); setSheetsSheetName("");
                            }
                            setSheetsError(null);
                          }}
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white outline-none focus:border-gray-500"
                        >
                          <option value="">{t("linkedField.sheets.choosePlaceholder")}</option>
                          {spreadsheetRegistry.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                          <option value="__other__">{t("linkedField.sheets.otherOption")}</option>
                        </select>
                        {selectedRegistryId === "__other__" && (
                          <input
                            type="url"
                            value={sheetsUrl}
                            onChange={(e) => setSheetsUrl(e.target.value)}
                            placeholder={t("linkedField.sheets.urlPlaceholder")}
                            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                          />
                        )}
                        {selectedRegistryId && selectedRegistryId !== "__other__" ? (
                          <select
                            value={sheetsSheetName}
                            onChange={(e) => setSheetsSheetName(e.target.value)}
                            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white outline-none focus:border-gray-500"
                          >
                            <option value="">{t("linkedField.sheets.chooseSheetPlaceholder")}</option>
                            {(spreadsheetRegistry.find((s) => s.id === selectedRegistryId)?.sheets ?? []).map((sh) => (
                              <option key={sh} value={sh}>{sh}</option>
                            ))}
                          </select>
                        ) : selectedRegistryId === "__other__" ? (
                          <input
                            type="text"
                            value={sheetsSheetName}
                            onChange={(e) => setSheetsSheetName(e.target.value)}
                            placeholder={t("linkedField.sheets.sheetNamePlaceholder")}
                            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                          />
                        ) : null}
                      </>
                    ) : (
                      /* ── Modo 3: sem registry, URL manual ── */
                      <>
                        <input
                          type="url"
                          value={sheetsUrl}
                          onChange={(e) => setSheetsUrl(e.target.value)}
                          placeholder={t("linkedField.sheets.urlPlaceholder")}
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                        />
                        <input
                          type="text"
                          value={sheetsSheetName}
                          onChange={(e) => setSheetsSheetName(e.target.value)}
                          placeholder={t("linkedField.sheets.sheetNamePlaceholder")}
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                        />
                      </>
                    )}

                    {/* ── Eixo: Coluna ── */}
                    <div className="space-y-1.5 rounded-lg border border-gray-700/60 bg-gray-800/40 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Coluna</span>
                        <div className="flex overflow-hidden rounded border border-gray-700">
                          <button
                            type="button"
                            onClick={() => setColumnMode("letter")}
                            className={`px-2 py-0.5 text-[10px] transition-colors ${
                              columnMode === "letter" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            Por letra
                          </button>
                          <button
                            type="button"
                            onClick={() => setColumnMode("header")}
                            className={`border-l border-gray-700 px-2 py-0.5 text-[10px] transition-colors ${
                              columnMode === "header" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            Por nome
                          </button>
                        </div>
                      </div>
                      {columnMode === "letter" ? (
                        <input
                          type="text"
                          value={sheetsColInput}
                          onChange={(e) => setSheetsColInput(e.target.value.toUpperCase())}
                          placeholder="Ex: B"
                          maxLength={3}
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                        />
                      ) : headersFetching && availableHeaders.length === 0 ? (
                        <div className="flex items-center gap-2 rounded border border-gray-700 bg-gray-800/60 px-2 py-1.5 text-[10px] text-gray-500">
                          <svg className="h-3 w-3 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4" />
                            <path className="opacity-75" strokeLinecap="round" strokeWidth="4" d="M4 12a8 8 0 018-8" />
                          </svg>
                          Carregando campos…
                        </div>
                      ) : availableHeaders.length > 0 ? (
                        <select
                          value={columnHeaderValue}
                          onChange={(e) => setColumnHeaderValue(e.target.value)}
                          className="w-full rounded border border-indigo-600/40 bg-gray-800 px-2 py-1 text-xs text-indigo-100 outline-none focus:border-indigo-500"
                        >
                          <option value="">Escolher campo…</option>
                          {availableHeaders.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="rounded border border-gray-700 bg-gray-800/60 px-2 py-1.5 text-[10px] text-gray-500">
                          Selecione uma aba acima para ver os campos disponíveis.
                        </div>
                      )}
                    </div>

                    {/* ── Eixo: Linha ── */}
                    <div className="space-y-1.5 rounded-lg border border-gray-700/60 bg-gray-800/40 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Linha</span>
                        <div className="flex overflow-hidden rounded border border-gray-700">
                          <button
                            type="button"
                            onClick={() => setRowMode("number")}
                            className={`px-2 py-0.5 text-[10px] transition-colors ${
                              rowMode === "number" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            Por número
                          </button>
                          {pageDataId ? (
                            <button
                              type="button"
                              onClick={() => setRowMode("auto")}
                              className={`border-l border-gray-700 px-2 py-0.5 text-[10px] transition-colors ${
                                rowMode === "auto" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
                              }`}
                            >
                              DataID (auto)
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {rowMode === "number" ? (
                        <input
                          type="text"
                          value={sheetsRowInput}
                          onChange={(e) => setSheetsRowInput(e.target.value.replace(/\D/g, ""))}
                          placeholder="Ex: 3"
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                        />
                      ) : (
                        <div className="flex items-center gap-2 rounded border border-indigo-600/30 bg-indigo-900/15 px-2 py-1.5 text-[11px]">
                          <span className="shrink-0 text-gray-400">ID da linha:</span>
                          <span className="min-w-0 flex-1 truncate font-mono font-medium text-indigo-300">{pageDataId}</span>
                          <span className="shrink-0 text-indigo-400" aria-hidden="true">🔒</span>
                        </div>
                      )}
                    </div>

                    {/* Preview cell */}
                    {previewCell ? (
                      <div className="flex items-center gap-1.5 rounded border border-indigo-700/30 bg-indigo-900/10 px-2 py-1 text-[10px]">
                        <span className="text-gray-500">→</span>
                        <span className="font-mono text-indigo-300">{previewCell}</span>
                        {rowMode === "auto" ? (
                          <span className="ml-auto text-[9px] text-gray-500">linha resolvida no vínculo</span>
                        ) : null}
                      </div>
                    ) : null}

                    {sheetsError ? (
                      <p className="text-[10px] text-rose-400">{sheetsError}</p>
                    ) : null}

                    {/* Test result */}
                    {testResult ? (
                      <div className="flex items-center gap-2 rounded border border-emerald-700/40 bg-emerald-900/10 px-2 py-1.5 text-[11px]">
                        <span className="text-emerald-400" aria-hidden="true">✓</span>
                        <span className="font-mono text-[10px] text-gray-400">{testResult.cell}</span>
                        <span className="ml-auto font-mono font-medium text-emerald-300">{String(testResult.value)}</span>
                      </div>
                    ) : null}

                    {/* Buttons */}
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleSheetsTest}
                        disabled={testLoading || sheetsLoading}
                        className="flex-1 rounded-lg border border-gray-600 bg-gray-800/60 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                      >
                        {testLoading ? "Testando…" : "Testar"}
                      </button>
                      <button
                        type="button"
                        onClick={handleSheetsBind}
                        disabled={sheetsLoading || testLoading}
                        className="flex-1 rounded-lg border border-emerald-700/60 bg-emerald-900/20 px-2 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
                      >
                        {sheetsLoading ? t("linkedField.sheets.bindingButton") : sheetsBinding.current ? t("linkedField.sheets.updateButton") : t("linkedField.sheets.bindButton")}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {badges}
    </div>
  );
}
