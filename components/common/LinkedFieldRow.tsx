"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { SheetsCellRef } from "@/lib/addons/types";
import type { LinkedSpreadsheet } from "@/store/slices/types";
import { parseSpreadsheetId } from "@/lib/googleSheets";

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
}: LinkedFieldRowProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [sheetsSheetName, setSheetsSheetName] = useState("");
  const [sheetsCellRef, setSheetsCellRef] = useState("");
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  // registry mode
  const [selectedRegistryId, setSelectedRegistryId] = useState("");
  const popoverId = useId();
  // Stable ids so the label <span> can be referenced via aria-labelledby on
  // the trigger button. Without this, screen-readers (and accessibility-aware
  // queries like `getByRole("button", { name: /Tempo (segundos)/ })`) only
  // see the chip text and miss the field label entirely.
  const labelId = useId();
  const buttonId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = selectedKey ? options.find((o) => o.key === selectedKey) : undefined;
  const hasInvalidLink = Boolean(selectedKey && !selected);

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
    setSheetsUrl(cur ? `https://docs.google.com/spreadsheets/d/${cur.spreadsheetId}/edit` : "");
    setSheetsSheetName(cur?.sheetName ?? "");
    setSheetsCellRef(cur?.cellRef ?? "");
    setSheetsError(null);
    // Init registry selection from current binding
    if (cur && spreadsheetRegistry) {
      const match = spreadsheetRegistry.find((s) => s.spreadsheetId === cur.spreadsheetId);
      setSelectedRegistryId(match?.id ?? "__other__");
    } else {
      setSelectedRegistryId(spreadsheetRegistry && spreadsheetRegistry.length > 0 ? "" : "__other__");
    }
  }, [open]);

  async function handleSheetsBind() {
    setSheetsError(null);
    const spreadsheetId = parseSpreadsheetId(sheetsUrl);
    if (!spreadsheetId) {
      setSheetsError(t("linkedField.sheets.errorInvalidUrl"));
      return;
    }
    const sheet = sheetsSheetName.trim();
    if (!sheet) { setSheetsError(t("linkedField.sheets.errorNoSheet")); return; }
    const cell = sheetsCellRef.trim().toUpperCase();
    if (!cell || !/^[A-Z]+\d+$/.test(cell)) {
      setSheetsError(t("linkedField.sheets.errorInvalidCell"));
      return;
    }
    const cur = sheetsBinding?.current;
    setSheetsLoading(true);
    try {
      await sheetsBinding?.onBind({
        spreadsheetId,
        sheetName: sheet,
        cellRef: cell,
        cachedValue: cur?.spreadsheetId === spreadsheetId ? (cur?.cachedValue ?? null) : null,
        syncedAt: cur?.spreadsheetId === spreadsheetId ? (cur?.syncedAt ?? null) : null,
      });
      setOpen(false);
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : t("linkedField.sheets.errorGeneric"));
    } finally {
      setSheetsLoading(false);
    }
  }

  const hasSheetsBinding = Boolean(sheetsBinding?.current);

  const chipText = hasSheetsBinding
    ? `${sheetsBinding!.current!.sheetName}!${sheetsBinding!.current!.cellRef}`
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
            // Combine the field label + the button's own chip text so the
            // accessible name reads e.g. "Tempo (segundos) — Tabela Base".
            aria-labelledby={`${labelId} ${buttonId}`}
            title={
              selected
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
            <span className="truncate">{chipText}</span>
            {/* Active-link bullet indicator. Hidden visually when there's no
                link, kept in markup as " " so test queries that assert on the
                presence of "•" in the chip can run a single comparison. */}
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
              className="absolute right-0 z-30 mt-1 w-72 max-h-72 overflow-auto rounded-xl border border-gray-700 bg-gray-900/98 p-1.5 shadow-2xl shadow-black/40 backdrop-blur"
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
                      <span className="text-[10px] font-mono text-emerald-300 truncate">
                        {sheetsBinding.current.sheetName}!{sheetsBinding.current.cellRef}
                        {sheetsBinding.current.cachedValue != null ? (
                          <span className="ml-1.5 text-emerald-500">= {sheetsBinding.current.cachedValue}</span>
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
                  <div className="mx-1 mb-1 space-y-1">
                    {/* Seletor de planilha — modo registry ou input livre */}
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

                        {/* Aba: select quando registry tem sheets, input quando "Outra" */}
                        {selectedRegistryId && selectedRegistryId !== "__other__" ? (
                          <div className="flex gap-1">
                            <select
                              value={sheetsSheetName}
                              onChange={(e) => setSheetsSheetName(e.target.value)}
                              className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white outline-none focus:border-gray-500"
                            >
                              <option value="">{t("linkedField.sheets.chooseSheetPlaceholder")}</option>
                              {(spreadsheetRegistry.find((s) => s.id === selectedRegistryId)?.sheets ?? []).map((sh) => (
                                <option key={sh} value={sh}>{sh}</option>
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
                              placeholder={t("linkedField.sheets.sheetNamePlaceholder")}
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
                      /* Modo input livre (sem registry) */
                      <>
                        <input
                          type="url"
                          value={sheetsUrl}
                          onChange={(e) => setSheetsUrl(e.target.value)}
                          placeholder={t("linkedField.sheets.urlPlaceholder")}
                          className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-500"
                        />
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={sheetsSheetName}
                            onChange={(e) => setSheetsSheetName(e.target.value)}
                            placeholder={t("linkedField.sheets.sheetNamePlaceholder")}
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

                    {sheetsError ? (
                      <p className="text-[10px] text-rose-400">{sheetsError}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleSheetsBind}
                      disabled={sheetsLoading}
                      className="w-full rounded-lg border border-emerald-700/60 bg-emerald-900/20 px-2 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
                    >
                      {sheetsLoading ? t("linkedField.sheets.bindingButton") : sheetsBinding.current ? t("linkedField.sheets.updateButton") : t("linkedField.sheets.bindButton")}
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
