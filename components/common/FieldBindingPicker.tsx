"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { parseSpreadsheetId, getGoogleSheetsToken, fetchSheetCellValue, parseCellNumber } from "@/lib/googleSheets";
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
  const [sheetsCellRef, setSheetsCellRef] = useState("");
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [selectedRegistryId, setSelectedRegistryId] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const labelId = useId();
  const buttonId = useId();

  const isActive = value.source !== "manual";
  const isSheets = value.source === "sheets";
  const isBroken = isActive && isBindingBroken(value, context);
  const chipLabel = isBroken
    ? "Vínculo quebrado"
    : getBindingChipLabel(value, context, config.libraryOutput);

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

  // Sync Sheets form with current binding when popover opens
  useEffect(() => {
    if (!open) return;
    if (value.source === "sheets") {
      const cur = value.ref;
      setSheetsSheetName(cur.sheetName);
      setSheetsCellRef(cur.cellRef);
    } else {
      setSheetsSheetName("");
      setSheetsCellRef("");
    }
    setSheetsUrl("");
    // Init registry selection from section's linkedSpreadsheetId
    if (context.spreadsheetRegistry && context.spreadsheetRegistry.length > 0) {
      setSelectedRegistryId(context.linkedSpreadsheetId ?? context.spreadsheetRegistry[0].id);
    } else {
      setSelectedRegistryId("__other__");
    }
    setSheetsError(null);
  }, [open]);

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

  async function handleSheetsBind() {
    setSheetsError(null);
    const sheet = sheetsSheetName.trim();
    if (!sheet) {
      setSheetsError("Nome da aba é obrigatório.");
      return;
    }
    const cell = sheetsCellRef.trim().toUpperCase();
    if (!cell || !/^[A-Z]+\d+$/.test(cell)) {
      setSheetsError("Referência de célula inválida (ex: A1).");
      return;
    }
    // Resolve which registry entry to use
    const effectiveRegistryId = selectedRegistryId && selectedRegistryId !== "__other__"
      ? selectedRegistryId
      : undefined;
    const registryEntry = effectiveRegistryId
      ? context.spreadsheetRegistry?.find((s) => s.id === effectiveRegistryId)
      : undefined;
    const spreadsheetId = registryEntry?.spreadsheetId ?? (sheetsUrl ? parseSpreadsheetId(sheetsUrl) : null);
    if (!spreadsheetId) {
      setSheetsError("Selecione uma planilha ou informe a URL.");
      return;
    }
    setSheetsLoading(true);
    try {
      const clientId = await getGoogleClientId();
      const token = clientId ? await getGoogleSheetsToken(clientId) : null;
      if (!token) throw new Error("Não foi possível obter autorização do Google.");
      const raw = await fetchSheetCellValue(token, spreadsheetId, sheet, cell);
      if (raw === null) throw new Error(`Não foi possível ler ${sheet}!${cell}. Verifique o vínculo.`);

      let cachedValue: string | number | boolean | null = null;
      if (config.valueType === "number") {
        const num = parseCellNumber(raw);
        if (num === null) throw new Error(`Valor "${raw}" em ${sheet}!${cell} não é um número válido.`);
        cachedValue = num;
      } else if (config.valueType === "boolean") {
        const upper = String(raw).toUpperCase();
        cachedValue = upper === "TRUE" || upper === "1" || upper === "YES";
      } else {
        cachedValue = String(raw);
      }

      // Update section-level linked spreadsheet if changed
      if (effectiveRegistryId && effectiveRegistryId !== context.linkedSpreadsheetId) {
        context.onLinkedSpreadsheetChange?.(effectiveRegistryId);
      }

      await onChange({
        source: "sheets",
        ref: {
          sheetName: sheet,
          cellRef: cell,
          cachedValue,
          syncedAt: new Date().toISOString(),
        },
      });
      setOpen(false);
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : "Erro ao vincular.");
    } finally {
      setSheetsLoading(false);
    }
  }

  const spreadsheetRegistry = context.spreadsheetRegistry;
  const curSheetsRef = value.source === "sheets" ? value.ref : undefined;

  return (
    <div className="flex flex-col gap-1.5">
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
              className="absolute right-0 z-30 mt-1 max-h-[480px] w-72 overflow-auto rounded-xl border border-gray-700 bg-gray-900/98 p-1.5 shadow-2xl shadow-black/40 backdrop-blur"
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
                      <span className="truncate font-mono text-[10px] text-emerald-300">
                        {curSheetsRef.sheetName}!{curSheetsRef.cellRef}
                        {curSheetsRef.cachedValue != null ? (
                          <span className="ml-1.5 text-emerald-500">= {String(curSheetsRef.cachedValue)}</span>
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

                  {/* Sheets form */}
                  <div className="mx-1 mb-1 space-y-1">
                    {spreadsheetRegistry && spreadsheetRegistry.length > 0 ? (
                      <>
                        <select
                          value={selectedRegistryId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedRegistryId(id);
                            if (id !== "__other__") {
                              const reg = spreadsheetRegistry.find((s) => s.id === id);
                              if (reg) {
                                setSheetsUrl(reg.url);
                                setSheetsSheetName("");
                              }
                            } else {
                              setSheetsUrl("");
                              setSheetsSheetName("");
                            }
                            setSheetsError(null);
                          }}
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white outline-none focus:border-gray-500"
                        >
                          <option value="">Escolher planilha…</option>
                          {spreadsheetRegistry.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
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
                          <div className="flex gap-1">
                            <select
                              value={sheetsSheetName}
                              onChange={(e) => setSheetsSheetName(e.target.value)}
                              className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white outline-none focus:border-gray-500"
                            >
                              <option value="">Aba…</option>
                              {(
                                spreadsheetRegistry.find((s) => s.id === selectedRegistryId)?.sheets ?? []
                              ).map((sh) => (
                                <option key={sh} value={sh}>
                                  {sh}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={sheetsCellRef}
                              onChange={(e) => setSheetsCellRef(e.target.value.toUpperCase())}
                              placeholder="A1"
                              className="w-16 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                            />
                          </div>
                        ) : selectedRegistryId === "__other__" ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={sheetsSheetName}
                              onChange={(e) => setSheetsSheetName(e.target.value)}
                              placeholder="Nome da aba"
                              className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                            />
                            <input
                              type="text"
                              value={sheetsCellRef}
                              onChange={(e) => setSheetsCellRef(e.target.value.toUpperCase())}
                              placeholder="A1"
                              className="w-16 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                            />
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <input
                          type="url"
                          value={sheetsUrl}
                          onChange={(e) => setSheetsUrl(e.target.value)}
                          placeholder="URL do Google Sheets"
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                        />
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={sheetsSheetName}
                            onChange={(e) => setSheetsSheetName(e.target.value)}
                            placeholder="Nome da aba"
                            className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                          />
                          <input
                            type="text"
                            value={sheetsCellRef}
                            onChange={(e) => setSheetsCellRef(e.target.value.toUpperCase())}
                            placeholder="A1"
                            className="w-16 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                          />
                        </div>
                      </>
                    )}

                    {sheetsError ? <p className="text-[10px] text-rose-400">{sheetsError}</p> : null}

                    <button
                      type="button"
                      onClick={handleSheetsBind}
                      disabled={sheetsLoading}
                      className="w-full rounded-lg border border-emerald-700/60 bg-emerald-900/20 px-2 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
                    >
                      {sheetsLoading ? "Vinculando…" : curSheetsRef ? "Atualizar vínculo" : "Vincular"}
                    </button>
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
