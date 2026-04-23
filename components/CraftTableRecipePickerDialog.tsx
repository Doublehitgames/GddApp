"use client";

import { useEffect, useMemo, useState } from "react";
import type { RequiresCandidate } from "@/lib/pageTypes/registry";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  open: boolean;
  candidates: RequiresCandidate[];
  onConfirm: (selectedSectionIds: string[]) => void;
  onCancel: () => void;
}

export function CraftTableRecipePickerDialog({
  open,
  candidates,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Default: pre-select all candidates when the dialog opens.
  const defaultIds = useMemo(() => new Set(candidates.map((c) => c.sectionId)), [candidates]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(defaultIds));
  }, [open, defaultIds]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const toggle = (sectionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(candidates.map((c) => c.sectionId)));
  const clearAll = () => setSelected(new Set());

  const buildPreview = (c: RequiresCandidate): string => {
    const recipe = c.recipe;
    if (!recipe) return "";
    const ing = recipe.ingredientsCount;
    const out = recipe.outputsCount;
    const ingKey =
      ing === 1
        ? "pageTypes.craftTablePicker.ingredientsOne"
        : "pageTypes.craftTablePicker.ingredientsMany";
    const outKey =
      out === 1
        ? "pageTypes.craftTablePicker.outputsOne"
        : "pageTypes.craftTablePicker.outputsMany";
    const ingFb = ing === 1 ? "{n} ingrediente" : "{n} ingredientes";
    const outFb = out === 1 ? "{n} saída" : "{n} saídas";
    const ingText = t(ingKey, ingFb).replace("{n}", String(ing));
    const outText = t(outKey, outFb).replace("{n}", String(out));
    const parts = [ingText, outText];
    if (typeof recipe.craftTimeSeconds === "number") {
      const timeText = t("pageTypes.craftTablePicker.craftTime", "{s}s").replace(
        "{s}",
        String(recipe.craftTimeSeconds)
      );
      parts.push(timeText);
    }
    return parts.join(" · ");
  };

  const handleConfirm = () => {
    // Preserve the order of candidates for stable entry.order values.
    const selectedIds = candidates.filter((c) => selected.has(c.sectionId)).map((c) => c.sectionId);
    onConfirm(selectedIds);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("pageTypes.craftTablePicker.title", "Selecionar receitas para a Mesa de Craft")}
          className="w-full max-w-xl mt-16 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-100">
                {t("pageTypes.craftTablePicker.title", "Selecionar receitas para a Mesa de Craft")}
              </h3>
              <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                {t(
                  "pageTypes.craftTablePicker.intro",
                  "Escolha quais receitas já existentes entram nesta mesa. Você pode ajustar depois."
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label={t("pageTypes.requiresDialog.close", "Fechar")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-100"
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">
              {t("pageTypes.craftTablePicker.selectedCount", "{n} selecionada(s)").replace(
                "{n}",
                String(selected.size)
              )}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
              >
                {t("pageTypes.craftTablePicker.selectAll", "Selecionar todas")}
              </button>
              <span className="text-gray-600">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                {t("pageTypes.craftTablePicker.clearAll", "Limpar")}
              </button>
            </div>
          </div>

          <div className="px-5 py-4 max-h-[min(60vh,520px)] overflow-y-auto space-y-2">
            {candidates.map((c) => {
              const isChecked = selected.has(c.sectionId);
              const preview = buildPreview(c);
              return (
                <label
                  key={c.sectionId}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                    isChecked
                      ? "border-indigo-400/70 bg-gradient-to-r from-indigo-600/25 to-fuchsia-600/20"
                      : "border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/70"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isChecked}
                    onChange={() => toggle(c.sectionId)}
                  />
                  <span
                    aria-hidden
                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isChecked
                        ? "border-indigo-300 bg-gradient-to-br from-indigo-500 to-fuchsia-500"
                        : "border-gray-500 bg-gray-900"
                    }`}
                  >
                    {isChecked && (
                      <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-gray-100">
                    <span className="block font-medium truncate">{c.sectionTitle}</span>
                    <span className="block text-xs text-gray-400 mt-0.5 truncate">
                      {c.addonName}
                      {preview && (
                        <>
                          {" · "}
                          {preview}
                        </>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="px-5 py-4 border-t border-gray-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center h-9 rounded-lg border border-gray-600 bg-gray-800 px-4 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
            >
              {t("pageTypes.requiresDialog.cancel", "Cancelar")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="ui-btn-primary-gradient inline-flex items-center h-9 rounded-lg px-4 text-sm font-medium shadow-md shadow-indigo-900/30"
            >
              {t("pageTypes.requiresDialog.confirm", "Confirmar e criar")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
