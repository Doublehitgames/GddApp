"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";

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
}: LinkedFieldRowProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
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

  const chipText = selected
    ? selected.label
    : hasInvalidLink
    ? invalidLabelFallback || t("linkedField.invalid", "Vínculo quebrado")
    : t("linkedField.noLink", "Sem vínculo");

  const chipClass = selected
    ? "border-indigo-400/60 bg-indigo-600/20 text-indigo-100 hover:bg-indigo-600/30"
    : hasInvalidLink
    ? "border-amber-500/60 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
    : "border-gray-600 bg-gray-800/80 text-gray-300 hover:border-indigo-400/50 hover:text-white";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span id={labelId} className="text-xs text-gray-400">{label}</span>
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
            {selected ? (
              <span aria-hidden="true" className="text-indigo-300">
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
            </div>
          ) : null}
        </div>
      </div>
      {badges}
    </div>
  );
}
