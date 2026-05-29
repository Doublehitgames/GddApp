"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  parseSpreadsheetId,
  getGoogleSheetsToken,
  fetchSheetCellValue,
  fetchColumnValues,
  fetchSpreadsheetHeaders,
  columnIndexToLetter,
  parseCellNumber,
} from "@/lib/googleSheets";
import { getGoogleClientId } from "@/lib/googleDrivePicker";
import {
  MANUAL_BINDING,
  getBindingChipLabel,
  isBindingBroken,
  economyLinkFieldLabel,
  productionFieldLabel,
  type FieldBinding,
  type FieldBindingConfig,
  type FieldBindingPickerContext,
} from "@/lib/addons/fieldBinding";

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

// ── Props ──────────────────────────────────────────────────────────────────────

interface FieldBindingPickerProps {
  config: FieldBindingConfig;
  value: FieldBinding;
  onChange: (binding: FieldBinding) => Promise<void> | void;
  context: FieldBindingPickerContext;
  /** The field input shown next to the chip. When omitted, the chip spans the full width. */
  children?: ReactNode;
  /** Optional badges/preview shown below the row. */
  badges?: ReactNode;
  /** Optional element rendered inline after the label. */
  labelAdornment?: ReactNode;
}

export function FieldBindingPicker({
  config,
  value,
  onChange,
  context,
  children,
  badges,
  labelAdornment,
}: FieldBindingPickerProps) {
  const [open, setOpen] = useState(false);

  // Sheets form state
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsSheetName, setSheetsSheetName] = useState("");
  // Coluna: "letter" = digita letra (ex: B) | "header" = escolhe pelo nome do header
  const [columnMode, setColumnMode] = useState<"letter" | "header">("letter");
  const [sheetsColInput, setSheetsColInput] = useState("");   // letra quando columnMode="letter"
  const [columnHeaderValue, setColumnHeaderValue] = useState(""); // header quando columnMode="header"
  // Linha: "number" = digita número (ex: 3) | "auto" = usa DataID da página
  const [rowMode, setRowMode] = useState<"number" | "auto">("number");
  const [sheetsRowInput, setSheetsRowInput] = useState("");   // número quando rowMode="number"
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [selectedRegistryId, setSelectedRegistryId] = useState("");
  // Aliases para compatibilidade com lógica de sync (mantidos para não quebrar handleSheetsBind legado)
  const columnLockEnabled = columnMode === "header";
  const columnLockValue = columnHeaderValue;
  const rowLockEnabled = rowMode === "auto";

  // Auto-fetch headers
  const [localColumnsBySheet, setLocalColumnsBySheet] = useState<Record<string, string[]>>({});
  const [headersFetching, setHeadersFetching] = useState(false);

  // Test-bind
  const [testResult, setTestResult] = useState<{ cell: string; value: string | number | boolean | null } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  // Tracks whether we've already initialised the form for the current open session,
  // so adding `value` to the init-effect deps doesn't re-init mid-edit.
  const wasOpenRef = useRef(false);
  const popoverId = useId();
  const labelId = useId();
  const buttonId = useId();

  const isActive = value.source !== "manual";
  const isSheets = value.source === "sheets";
  const isBroken = isActive && isBindingBroken(value, context);
  const chipLabel = isBroken
    ? "Vínculo quebrado"
    : getBindingChipLabel(value, context, config.libraryOutput);

  const curSheetsRef = value.source === "sheets" ? value.ref : undefined;
  const hasLocks = isSheets && curSheetsRef && (curSheetsRef.columnLock || curSheetsRef.rowLock);

  const chipClass = isSheets
    ? "border-emerald-500/60 bg-emerald-600/20 text-emerald-100 hover:bg-emerald-600/30"
    : isBroken
    ? "border-amber-500/60 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
    : isActive
    ? "border-indigo-400/60 bg-indigo-600/20 text-indigo-100 hover:bg-indigo-600/30"
    : "border-gray-600 bg-gray-800/80 text-gray-300 hover:border-indigo-400/50 hover:text-white";

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Sync Sheets form with current binding when popover opens.
  // `value` is in the deps so React always uses the latest binding ref.
  // `wasOpenRef` prevents re-initialising while the popup is already open
  // (which would discard edits in progress).
  useEffect(() => {
    if (!open) { wasOpenRef.current = false; return; }
    if (wasOpenRef.current) return; // already initialised this open session
    wasOpenRef.current = true;
    if (value.source === "sheets") {
      const cur = value.ref;
      setSheetsSheetName(cur.sheetName);
      // Extrair coluna e linha do cellRef existente (ex: "B3" → col="B", row="3")
      const colMatch = cur.cellRef.match(/^([A-Z]+)/);
      const rowMatch = cur.cellRef.match(/(\d+)$/);
      if (cur.columnLock) {
        setColumnMode("header");
        setColumnHeaderValue(cur.columnLock);
        setSheetsColInput(colMatch ? colMatch[1] : "");
      } else {
        setColumnMode("letter");
        setSheetsColInput(colMatch ? colMatch[1] : "");
        setColumnHeaderValue("");
      }
      if (cur.rowLock) {
        setRowMode("auto");
        setSheetsRowInput(rowMatch ? rowMatch[1] : "");
      } else {
        setRowMode("number");
        setSheetsRowInput(rowMatch ? rowMatch[1] : "");
      }
    } else {
      setSheetsSheetName("");
      setColumnMode("letter");
      setSheetsColInput("");
      setColumnHeaderValue("");
      setRowMode("number");
      setSheetsRowInput("");
    }
    setSheetsUrl("");
    // Init registry selection from section's linkedSpreadsheetId
    if (context.spreadsheetRegistry && context.spreadsheetRegistry.length > 0) {
      setSelectedRegistryId(context.linkedSpreadsheetId ?? context.spreadsheetRegistry[0].id);
    } else {
      setSelectedRegistryId("__other__");
    }
    setSheetsError(null);
    setTestResult(null);
    setLocalColumnsBySheet({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  // Auto-fetch headers when tab changes
  useEffect(() => {
    if (!open || !sheetsSheetName) return;

    const effectiveId = context.linkedSpreadsheetId
      ?? (selectedRegistryId !== "__other__" ? selectedRegistryId : undefined);
    const reg = context.spreadsheetRegistry?.find((s) => s.id === effectiveId);
    if (!reg?.spreadsheetId) return;

    // Already have headers from registry or local cache — skip fetch
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

  const accepts = (source: FieldBinding["source"]) => config.acceptedSources.includes(source);

  function handleSelect(binding: FieldBinding) {
    onChange(binding);
    setOpen(false);
  }

  function isCurrent(binding: FieldBinding): boolean {
    if (binding.source !== value.source) return false;
    switch (binding.source) {
      case "manual":
        return true;
      case "progressionColumn":
        return (
          value.source === "progressionColumn" &&
          value.progressionAddonId === binding.progressionAddonId &&
          value.columnId === binding.columnId
        );
      case "library":
        return (
          value.source === "library" &&
          value.libraryAddonId === binding.libraryAddonId &&
          value.entryId === binding.entryId
        );
      case "economyLink":
        return (
          value.source === "economyLink" &&
          value.sectionId === binding.sectionId &&
          value.field === binding.field
        );
      case "production":
        return (
          value.source === "production" &&
          value.addonId === binding.addonId &&
          value.field === binding.field
        );
      case "unitXp":
        return value.source === "unitXp" && value.sectionId === binding.sectionId;
      case "pageDataId":
        return value.source === "pageDataId";
      default:
        return false;
    }
  }

  const spreadsheetRegistry = context.spreadsheetRegistry;

  // Compute available column headers for the currently selected sheet
  const effectiveRegistryEntry = spreadsheetRegistry?.find(
    (s) => s.id === (context.linkedSpreadsheetId ?? (selectedRegistryId !== "__other__" ? selectedRegistryId : undefined))
  );
  const availableHeaders = sheetsSheetName
    ? (localColumnsBySheet[sheetsSheetName] ?? effectiveRegistryEntry?.columnsBySheet?.[sheetsSheetName] ?? [])
    : [];

  const columnLockMissing = !!(curSheetsRef?.columnLock && availableHeaders.length > 0 && !availableHeaders.includes(curSheetsRef.columnLock));

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
    if (!sheet) throw new Error("Selecione uma aba.");

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
      if (!context.pageDataId) throw new Error("Esta página não tem DataID configurado.");
    }

    const effectiveRegistryId = selectedRegistryId && selectedRegistryId !== "__other__"
      ? selectedRegistryId : undefined;
    const registryEntry = effectiveRegistryId
      ? context.spreadsheetRegistry?.find((s) => s.id === effectiveRegistryId) : undefined;
    const spreadsheetId = registryEntry?.spreadsheetId ?? (sheetsUrl ? parseSpreadsheetId(sheetsUrl) : null);
    if (!spreadsheetId) throw new Error("Selecione uma planilha ou informe a URL.");

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
      const rowIdx = colAValues.findIndex((v) => v === context.pageDataId);
      if (rowIdx < 0) throw new Error(`"${context.pageDataId}" não encontrado na coluna A de "${sheet}". Verifique se o DataID está correto.`);
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
      const { resolvedCell, spreadsheetId, token, sheet } = await resolveCell();

      const effectiveRegistryId = selectedRegistryId && selectedRegistryId !== "__other__"
        ? selectedRegistryId : undefined;

      const raw = await fetchSheetCellValue(token, spreadsheetId, sheet, resolvedCell);
      if (raw === null) throw new Error(`Não foi possível ler ${sheet}!${resolvedCell}. Verifique o vínculo.`);

      let cachedValue: string | number | boolean | null = null;
      if (config.valueType === "number") {
        const num = parseCellNumber(raw);
        if (num === null) throw new Error(`Valor "${raw}" em ${sheet}!${resolvedCell} não é um número válido.`);
        cachedValue = num;
      } else if (config.valueType === "boolean") {
        const upper = String(raw).toUpperCase();
        cachedValue = upper === "TRUE" || upper === "1" || upper === "YES";
      } else {
        cachedValue = String(raw);
      }

      if (effectiveRegistryId && effectiveRegistryId !== context.linkedSpreadsheetId) {
        context.onLinkedSpreadsheetChange?.(effectiveRegistryId);
      }

      await onChange({
        source: "sheets",
        ref: {
          sheetName: sheet,
          cellRef: resolvedCell,
          cachedValue,
          syncedAt: new Date().toISOString(),
          columnLock: columnMode === "header" ? columnHeaderValue : undefined,
          rowLock: rowMode === "auto" ? "auto" : undefined,
        },
      });
      setOpen(false);
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : "Erro ao vincular.");
    } finally {
      setSheetsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {open ? <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" aria-hidden="true" /> : null}

      {/* Label row */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1">
          <span id={labelId} className="text-xs text-gray-400">
            {config.label}
          </span>
          {labelAdornment}
        </span>
        {config.hint ? <span className="text-[10px] text-gray-500">{config.hint}</span> : null}
      </div>

      {/* Input + binding chip (or full-width chip when no children) */}
      <div className="flex items-stretch gap-2">
        {children != null ? <div className="min-w-[72px] shrink">{children}</div> : null}

        <div ref={containerRef} className="relative flex-1">
          {/* Chip button */}
          <button
            id={buttonId}
            type="button"
            onClick={() => setOpen((p) => !p)}
            aria-expanded={open}
            aria-controls={popoverId}
            aria-labelledby={`${labelId} ${buttonId}`}
            title={isSheets && curSheetsRef?.syncedAt ? `Último sync: ${formatSyncAge(curSheetsRef.syncedAt)}` : undefined}
            className={`inline-flex h-full w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${chipClass}`}
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m6.656-6.656l1.5-1.5a4 4 0 115.656 5.656l-3 3a4 4 0 01-5.656 0"
              />
            </svg>
            {hasLocks ? <span className="shrink-0 text-amber-400 text-[10px]" aria-hidden="true">🔒</span> : null}
            <span className="whitespace-nowrap">{chipLabel}</span>
            {isActive ? (
              <span aria-hidden="true" className={isSheets ? "text-emerald-300" : "text-indigo-300"}>
                •
              </span>
            ) : null}
            <svg
              className="h-3 w-3 shrink-0 opacity-70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Popover */}
          {open ? (
            <div
              id={popoverId}
              role="listbox"
              className="fixed left-1/2 top-1/2 z-50 max-h-[min(600px,90vh)] w-[22rem] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-gray-700 bg-gray-900/98 p-1.5 shadow-2xl shadow-black/40 backdrop-blur"
            >
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500">
                Vincular campo
              </div>

              {/* No binding */}
              <PickerOption
                label="Sem vínculo"
                selected={!isActive}
                onClick={() => handleSelect(MANUAL_BINDING)}
              />

              {/* Broken binding warning */}
              {isBroken ? (
                <div className="mx-1 my-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
                  <p className="font-semibold">Vínculo quebrado</p>
                  <p className="mt-0.5 text-amber-200/80">
                    A fonte vinculada não existe mais. Escolha outro vínculo.
                  </p>
                </div>
              ) : null}

              {/* ── Progression columns ── */}
              {accepts("progressionColumn") && context.progressionColumns !== undefined ? (
                context.progressionColumns.length > 0 ? (
                  <>
                    <SectionDivider label="Progressão" />
                    {context.progressionColumns.map((opt) => {
                      const b: FieldBinding = {
                        source: "progressionColumn",
                        progressionAddonId: opt.progressionAddonId,
                        columnId: opt.columnId,
                        columnName: opt.columnName,
                      };
                      return (
                        <PickerOption
                          key={`${opt.progressionAddonId}::${opt.columnId}`}
                          label={opt.columnName}
                          hint={opt.progressionAddonName}
                          selected={isCurrent(b)}
                          onClick={() => handleSelect(b)}
                        />
                      );
                    })}
                  </>
                ) : (
                  <>
                    <SectionDivider label="Progressão" />
                    <EmptyState label="Nenhuma tabela de progressão nesta seção." />
                  </>
                )
              ) : null}

              {/* ── Library entries ── */}
              {accepts("library") && context.libraryEntries && context.libraryEntries.length > 0 ? (
                <>
                  <SectionDivider label="Biblioteca de campos" />
                  {context.libraryEntries.map((opt) => {
                    const b: FieldBinding = {
                      source: "library",
                      libraryAddonId: opt.libraryAddonId,
                      entryId: opt.entryId,
                    };
                    return (
                      <PickerOption
                        key={`${opt.libraryAddonId}::${opt.entryId}`}
                        label={opt.label}
                        hint={opt.key}
                        hintMono
                        selected={isCurrent(b)}
                        onClick={() => handleSelect(b)}
                      />
                    );
                  })}
                </>
              ) : null}

              {/* ── Economy Link fields ── */}
              {accepts("economyLink") && context.economyLinks && context.economyLinks.length > 0 ? (
                <>
                  <SectionDivider label="Economy Link" />
                  {context.economyLinks.map((opt) => {
                    const b: FieldBinding = {
                      source: "economyLink",
                      sectionId: opt.sectionId,
                      field: opt.field,
                    };
                    return (
                      <PickerOption
                        key={`${opt.sectionId}::${opt.field}`}
                        label={economyLinkFieldLabel(opt.field)}
                        hint={opt.sectionLabel}
                        selected={isCurrent(b)}
                        onClick={() => handleSelect(b)}
                      />
                    );
                  })}
                </>
              ) : null}

              {/* ── Production addon fields ── */}
              {accepts("production") && context.productionAddons && context.productionAddons.length > 0 ? (
                <>
                  <SectionDivider label="Produção" />
                  {context.productionAddons.map((opt) => {
                    const b: FieldBinding = {
                      source: "production",
                      addonId: opt.addonId,
                      field: opt.field,
                    };
                    return (
                      <PickerOption
                        key={`${opt.addonId}::${opt.field}`}
                        label={productionFieldLabel(opt.field)}
                        hint={opt.addonName}
                        selected={isCurrent(b)}
                        onClick={() => handleSelect(b)}
                      />
                    );
                  })}
                </>
              ) : null}

              {/* ── Unit XP sections ── */}
              {accepts("unitXp") && context.unitXpSections && context.unitXpSections.length > 0 ? (
                <>
                  <SectionDivider label="XP Balance" />
                  {context.unitXpSections.map((opt) => {
                    const b: FieldBinding = { source: "unitXp", sectionId: opt.sectionId };
                    return (
                      <PickerOption
                        key={opt.sectionId}
                        label={opt.sectionLabel}
                        selected={isCurrent(b)}
                        onClick={() => handleSelect(b)}
                      />
                    );
                  })}
                </>
              ) : null}

              {/* ── Page Data ID ── */}
              {accepts("pageDataId") ? (
                <>
                  <SectionDivider />
                  <PickerOption
                    label="ID da página"
                    hint="Usa o dataId desta seção"
                    selected={isCurrent({ source: "pageDataId" })}
                    onClick={() => handleSelect({ source: "pageDataId" })}
                  />
                </>
              ) : null}

              {/* ── Google Sheets ── */}
              {accepts("sheets") ? (
                <>
                  <div className="my-1.5 border-t border-gray-700/60" />
                  <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
                    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                    </svg>
                    Google Sheets
                  </div>

                  {/* Current Sheets binding */}
                  {curSheetsRef ? (
                    <div className="mx-1 mb-1 flex items-center justify-between rounded-md border border-emerald-700/40 bg-emerald-900/15 px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-emerald-300">
                        {curSheetsRef.sheetName}!{curSheetsRef.cellRef}
                        {curSheetsRef.cachedValue != null ? (
                          <span className="ml-1.5 text-emerald-500">= {String(curSheetsRef.cachedValue)}</span>
                        ) : null}
                        {curSheetsRef.columnLock ? (
                          <span className="ml-1.5 rounded bg-amber-900/30 px-1 text-[9px] text-amber-400">col:{curSheetsRef.columnLock}</span>
                        ) : null}
                        {curSheetsRef.rowLock ? (
                          <span className="ml-1 rounded bg-amber-900/30 px-1 text-[9px] text-amber-400">linha:auto</span>
                        ) : null}
                        {curSheetsRef.syncedAt ? (
                          <span className="ml-1.5 text-[9px] text-gray-500">{formatSyncAge(curSheetsRef.syncedAt)}</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(MANUAL_BINDING);
                          setOpen(false);
                        }}
                        className="ml-2 shrink-0 text-[10px] text-rose-400 hover:text-rose-300"
                      >
                        Desvincular
                      </button>
                    </div>
                  ) : null}

                  {/* columnLock missing warning */}
                  {columnLockMissing ? (
                    <div className="mx-1 mb-1 rounded border border-amber-600/40 bg-amber-900/10 px-2 py-1.5 text-[10px] text-amber-300">
                      ⚠ Campo &quot;{curSheetsRef!.columnLock}&quot; não encontrado na planilha. O vínculo pode estar quebrado.
                    </div>
                  ) : null}

                  {/* Sheets form */}
                  <div className="mx-1 mb-1 space-y-2">
                    {/* ── Modo 1: planilha já vinculada à seção ── */}
                    {context.linkedSpreadsheetId && spreadsheetRegistry && spreadsheetRegistry.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5 rounded border border-emerald-700/30 bg-emerald-900/10 px-2 py-1 text-[10px] text-emerald-300">
                          <span aria-hidden="true">📊</span>
                          <span className="truncate">
                            {spreadsheetRegistry.find((s) => s.id === context.linkedSpreadsheetId)?.name ?? "Planilha da seção"}
                          </span>
                        </div>
                        <select
                          value={sheetsSheetName}
                          onChange={(e) => setSheetsSheetName(e.target.value)}
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white outline-none focus:border-gray-500"
                        >
                          <option value="">Aba…</option>
                          {(spreadsheetRegistry.find((s) => s.id === context.linkedSpreadsheetId)?.sheets ?? []).map((sh) => (
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
                          <option value="">Escolher planilha…</option>
                          {spreadsheetRegistry.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                          <option value="__other__">Outra planilha…</option>
                        </select>
                        {selectedRegistryId === "__other__" ? (
                          <input
                            type="url"
                            value={sheetsUrl}
                            onChange={(e) => setSheetsUrl(e.target.value)}
                            placeholder="URL do Google Sheets"
                            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                          />
                        ) : null}
                        {selectedRegistryId && selectedRegistryId !== "__other__" ? (
                          <select
                            value={sheetsSheetName}
                            onChange={(e) => setSheetsSheetName(e.target.value)}
                            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white outline-none focus:border-gray-500"
                          >
                            <option value="">Aba…</option>
                            {(spreadsheetRegistry.find((s) => s.id === selectedRegistryId)?.sheets ?? []).map((sh) => (
                              <option key={sh} value={sh}>{sh}</option>
                            ))}
                          </select>
                        ) : selectedRegistryId === "__other__" ? (
                          <input
                            type="text"
                            value={sheetsSheetName}
                            onChange={(e) => setSheetsSheetName(e.target.value)}
                            placeholder="Nome da aba"
                            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                          />
                        ) : null}
                      </>
                    ) : (
                      /* ── Modo 3: sem registro, URL manual ── */
                      <>
                        <input
                          type="url"
                          value={sheetsUrl}
                          onChange={(e) => setSheetsUrl(e.target.value)}
                          placeholder="URL do Google Sheets"
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                        />
                        <input
                          type="text"
                          value={sheetsSheetName}
                          onChange={(e) => setSheetsSheetName(e.target.value)}
                          placeholder="Nome da aba"
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
                          {context.pageDataId ? (
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
                          <span className="min-w-0 flex-1 truncate font-mono font-medium text-indigo-300">{context.pageDataId}</span>
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

                    {sheetsError ? <p className="text-[10px] text-rose-400">{sheetsError}</p> : null}

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
                        {sheetsLoading ? "Vinculando…" : curSheetsRef ? "Atualizar" : "Vincular"}
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

// ── Internal sub-components ────────────────────────────────────────────────────

function PickerOption({
  label,
  hint,
  hintMono,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  hintMono?: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
        selected ? "bg-indigo-600/25 text-indigo-50" : "text-gray-200 hover:bg-gray-800"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">
        <span className="block truncate">{label}</span>
        {hint ? (
          <span className={`block truncate text-[10px] text-gray-500 ${hintMono ? "font-mono" : ""}`}>
            {hint}
          </span>
        ) : null}
      </span>
      {selected ? (
        <span className="text-indigo-300" aria-hidden="true">
          ✓
        </span>
      ) : null}
    </button>
  );
}

function SectionDivider({ label }: { label?: string }) {
  return (
    <>
      <div className="my-1 border-t border-gray-700/60" />
      {label ? (
        <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      ) : null}
    </>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="m-1 rounded-lg border border-dashed border-gray-700 bg-gray-900/60 px-2.5 py-2 text-center text-[11px] text-gray-400">
      {label}
    </div>
  );
}
