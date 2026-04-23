"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getPageTypeLabel,
  type PageType,
  type RequiresCandidate,
} from "@/lib/pageTypes/registry";
import { useI18n } from "@/lib/i18n/provider";

export type RecipeSettings = {
  ingredientQty: number;
  outputQty: number;
  craftTimeSeconds: number;
};

export type PageTypeRequiresChoice =
  | { mode: "link-existing"; candidate: RequiresCandidate; recipeSettings?: RecipeSettings }
  | { mode: "create-new"; name?: string; recipeSettings?: RecipeSettings }
  | { mode: "skip"; recipeSettings?: RecipeSettings };

interface Props {
  open: boolean;
  pageType: PageType | null;
  requiredPageType: PageType | null;
  candidates: RequiresCandidate[];
  onConfirm: (choice: PageTypeRequiresChoice) => void;
  onCancel: () => void;
  /** Optional override for the intro sentence under the title. */
  introCopy?: string;
  /** When true, show a text input under "Create new" for the new page name. */
  askNameOnCreateNew?: boolean;
  /** Label above the name input. */
  createNewNameLabel?: string;
  /** Placeholder inside the name input. */
  createNewNamePlaceholder?: string;
  /** Pre-fills the name input when the dialog opens. */
  defaultCreateNewName?: string;
  /** When true, an empty name is allowed (the caller provides a fallback). */
  allowEmptyCreateNewName?: boolean;
  /** Replaces the default "Vincular X a Y" title with a friendlier contextual headline. */
  title?: string;
  /** Header above the existing-candidates list. Defaults to "Vincular a página existente". */
  linkExistingHeader?: string;
  /** Header above the create-new + skip section. Defaults to "Outras opções". Passing empty string hides it. */
  otherOptionsHeader?: string;
  /** Main label on the "create new" option. Defaults to "Criar nova página X". */
  createNewLabel?: string;
  /** Description under the create-new label. */
  createNewDescription?: string;
  /** Main label on the "skip" option. Defaults to "Continuar sem vincular". */
  skipLabel?: string;
  /** Description under the skip label. */
  skipDescription?: string;
  /** When true, render a recipe-settings section (ingredient qty / output qty / craft time). */
  showRecipeSettings?: boolean;
  /** Default values for the recipe settings section. */
  defaultRecipeSettings?: RecipeSettings;
}

type Selection =
  | { kind: "candidate"; candidateId: string }
  | { kind: "create-new" }
  | { kind: "skip" };

function buildCandidatePreview(
  c: RequiresCandidate,
  t: (key: string, fallback?: string) => string
): string {
  if (c.kind === "attributeDefinitions") {
    const attrs = c.attributes || [];
    if (attrs.length === 0) return t("pageTypes.requiresDialog.noAttrs", "sem atributos");
    const listed = attrs.slice(0, 4).map((a) => a.label || a.key).join(", ");
    const more = attrs.length > 4 ? `, +${attrs.length - 4}` : "";
    const countKey =
      attrs.length === 1
        ? "pageTypes.requiresDialog.attrCountOne"
        : "pageTypes.requiresDialog.attrCountMany";
    const fallback = attrs.length === 1 ? "{n} atributo" : "{n} atributos";
    const countText = t(countKey, fallback).replace("{n}", String(attrs.length));
    return listed ? `${countText} (${listed}${more})` : countText;
  }
  if (c.kind === "currency") {
    const currency = c.currency;
    const displayName = currency?.displayName?.trim();
    const code = currency?.code?.trim();
    const kind = currency?.kind;
    const parts = [
      displayName || t("pageTypes.requiresDialog.currencyNoName", "(sem nome)"),
      code ? `${t("pageTypes.requiresDialog.currencyCodeLabel", "código")} ${code}` : null,
      kind ? `${t("pageTypes.requiresDialog.currencyKindLabel", "tipo")} ${kind}` : null,
    ].filter(Boolean) as string[];
    return parts.join(" · ");
  }
  return "";
}

export function PageTypeRequiresDialog({
  open,
  pageType,
  requiredPageType,
  candidates,
  onConfirm,
  onCancel,
  introCopy,
  askNameOnCreateNew,
  createNewNameLabel,
  createNewNamePlaceholder,
  defaultCreateNewName,
  allowEmptyCreateNewName,
  title: titleOverride,
  linkExistingHeader,
  otherOptionsHeader,
  createNewLabel,
  createNewDescription,
  skipLabel,
  skipDescription,
  showRecipeSettings,
  defaultRecipeSettings,
}: Props) {
  const { t } = useI18n();

  const defaultSelection: Selection = useMemo(
    () =>
      candidates.length > 0
        ? { kind: "candidate", candidateId: candidates[0].sectionId + "::" + candidates[0].addonId }
        : { kind: "create-new" },
    [candidates]
  );
  const [selection, setSelection] = useState<Selection>(defaultSelection);
  const [createNewName, setCreateNewName] = useState<string>(defaultCreateNewName ?? "");
  const [ingredientQty, setIngredientQty] = useState<number>(defaultRecipeSettings?.ingredientQty ?? 10);
  const [outputQty, setOutputQty] = useState<number>(defaultRecipeSettings?.outputQty ?? 1);
  const [craftTimeSeconds, setCraftTimeSeconds] = useState<number>(
    defaultRecipeSettings?.craftTimeSeconds ?? 60
  );

  useEffect(() => {
    if (!open) return;
    setSelection(defaultSelection);
    setCreateNewName(defaultCreateNewName ?? "");
    setIngredientQty(defaultRecipeSettings?.ingredientQty ?? 10);
    setOutputQty(defaultRecipeSettings?.outputQty ?? 1);
    setCraftTimeSeconds(defaultRecipeSettings?.craftTimeSeconds ?? 60);
  }, [open, defaultSelection, defaultCreateNewName, defaultRecipeSettings]);

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

  if (!open || !pageType || !requiredPageType) return null;

  const pageTypeLabel = getPageTypeLabel(pageType, t);
  const requiredLabel = getPageTypeLabel(requiredPageType, t);
  const titlePrefix = t("pageTypes.requiresDialog.titlePrefix", "Vincular");
  const titleConnector = t("pageTypes.requiresDialog.titleConnector", "a");
  const defaultTitleText = `${titlePrefix} ${pageType.emoji} ${pageTypeLabel} ${titleConnector} ${requiredPageType.emoji} ${requiredLabel}`;
  const titleText = titleOverride ?? defaultTitleText;
  const ariaLabel = titleOverride ?? `${titlePrefix} ${pageTypeLabel} ${titleConnector} ${requiredLabel}`;
  const resolvedLinkExistingHeader =
    linkExistingHeader ??
    t("pageTypes.requiresDialog.linkExistingHeader", "Vincular a página existente");
  const showOtherOptionsHeader = candidates.length > 0 && otherOptionsHeader !== "";
  const resolvedOtherOptionsHeader =
    otherOptionsHeader ??
    t("pageTypes.requiresDialog.otherOptionsHeader", "Outras opções");
  const resolvedCreateNewLabel =
    createNewLabel ??
    `${t("pageTypes.requiresDialog.createNewLabelPrefix", "Criar nova página")} ${requiredPageType.emoji} ${requiredLabel}`;
  const resolvedCreateNewDescription =
    createNewDescription ??
    t(
      "pageTypes.requiresDialog.createNewDescription",
      "Cria ambas de uma vez e vincula a nova página."
    );
  const resolvedSkipLabel =
    skipLabel ?? t("pageTypes.requiresDialog.skipLabel", "Continuar sem vincular");
  const resolvedSkipDescription =
    skipDescription ??
    t(
      "pageTypes.requiresDialog.skipDescription",
      "Cria a página sem referência; você pode vincular depois manualmente."
    );
  const defaultIntro = t(
    "pageTypes.requiresDialog.introDefault",
    "Páginas de {page} costumam vincular a uma página de {required}. Escolha abaixo como vincular."
  )
    .replace("{page}", pageTypeLabel.toLowerCase())
    .replace("{required}", requiredLabel.toLowerCase());
  const intro = introCopy ?? defaultIntro;

  const handleConfirm = () => {
    const recipeSettings: RecipeSettings | undefined = showRecipeSettings
      ? {
          ingredientQty: Math.max(1, Math.floor(ingredientQty)),
          outputQty: Math.max(1, Math.floor(outputQty)),
          craftTimeSeconds: Math.max(0, Math.floor(craftTimeSeconds)),
        }
      : undefined;
    if (selection.kind === "candidate") {
      const picked = candidates.find(
        (c) => c.sectionId + "::" + c.addonId === selection.candidateId
      );
      if (!picked) return;
      onConfirm({ mode: "link-existing", candidate: picked, recipeSettings });
    } else if (selection.kind === "create-new") {
      const trimmed = createNewName.trim();
      onConfirm({ mode: "create-new", name: trimmed || undefined, recipeSettings });
    } else {
      onConfirm({ mode: "skip", recipeSettings });
    }
  };

  const confirmDisabled =
    selection.kind === "create-new" &&
    askNameOnCreateNew &&
    !allowEmptyCreateNewName &&
    !createNewName.trim();

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
          aria-label={ariaLabel}
          className="w-full max-w-xl mt-16 rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-100">{titleText}</h3>
              <p className="mt-1 text-xs text-gray-400 leading-relaxed">{intro}</p>
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

          <div className="px-5 py-4 max-h-[min(60vh,520px)] overflow-y-auto space-y-2">
            {candidates.length > 0 && (
              <>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  {resolvedLinkExistingHeader}
                </h4>
                {candidates.map((c) => {
                  const id = c.sectionId + "::" + c.addonId;
                  const active =
                    selection.kind === "candidate" && selection.candidateId === id;
                  const previewText = buildCandidatePreview(c, t);
                  return (
                    <label
                      key={id}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                        active
                          ? "border-indigo-400/70 bg-gradient-to-r from-indigo-600/25 to-fuchsia-600/20"
                          : "border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/70"
                      }`}
                    >
                      <input
                        type="radio"
                        name="page-type-requires"
                        className="sr-only"
                        checked={active}
                        onChange={() =>
                          setSelection({ kind: "candidate", candidateId: id })
                        }
                      />
                      <span
                        aria-hidden
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          active
                            ? "border-indigo-300 bg-gradient-to-br from-indigo-500 to-fuchsia-500"
                            : "border-gray-500 bg-gray-900"
                        }`}
                      >
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="flex-1 min-w-0 text-sm text-gray-100">
                        <span className="block font-medium truncate">{c.sectionTitle}</span>
                        <span className="block text-xs text-gray-400 mt-0.5 truncate">
                          {c.addonName}
                          {previewText && (
                            <>
                              {" · "}
                              {previewText}
                            </>
                          )}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </>
            )}

            {showOtherOptionsHeader && (
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mt-3 mb-1">
                {resolvedOtherOptionsHeader}
              </h4>
            )}
            <label
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                selection.kind === "create-new"
                  ? "border-emerald-400/70 bg-gradient-to-r from-emerald-600/25 to-teal-600/20"
                  : "border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/70"
              }`}
            >
              <input
                type="radio"
                name="page-type-requires"
                className="sr-only"
                checked={selection.kind === "create-new"}
                onChange={() => setSelection({ kind: "create-new" })}
              />
              <span
                aria-hidden
                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  selection.kind === "create-new"
                    ? "border-emerald-300 bg-gradient-to-br from-emerald-500 to-teal-500"
                    : "border-gray-500 bg-gray-900"
                }`}
              >
                {selection.kind === "create-new" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <span className="flex-1 min-w-0 text-sm text-gray-100">
                <span className="block font-medium">{resolvedCreateNewLabel}</span>
                <span className="block text-xs text-gray-400 mt-0.5">
                  {resolvedCreateNewDescription}
                </span>
                {askNameOnCreateNew && selection.kind === "create-new" && (
                  <span className="mt-2 block" onClick={(e) => e.preventDefault()}>
                    {createNewNameLabel && (
                      <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                        {createNewNameLabel}
                      </span>
                    )}
                    <input
                      type="text"
                      value={createNewName}
                      onChange={(e) => setCreateNewName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={createNewNamePlaceholder}
                      className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                    />
                  </span>
                )}
              </span>
            </label>

            <label
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                selection.kind === "skip"
                  ? "border-gray-400/70 bg-gray-700/40"
                  : "border-gray-700 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/70"
              }`}
            >
              <input
                type="radio"
                name="page-type-requires"
                className="sr-only"
                checked={selection.kind === "skip"}
                onChange={() => setSelection({ kind: "skip" })}
              />
              <span
                aria-hidden
                className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  selection.kind === "skip"
                    ? "border-gray-200 bg-gray-300"
                    : "border-gray-500 bg-gray-900"
                }`}
              >
                {selection.kind === "skip" && <span className="h-1.5 w-1.5 rounded-full bg-gray-900" />}
              </span>
              <span className="flex-1 min-w-0 text-sm text-gray-100">
                <span className="block font-medium">{resolvedSkipLabel}</span>
                <span className="block text-xs text-gray-400 mt-0.5">
                  {resolvedSkipDescription}
                </span>
              </span>
            </label>

            {showRecipeSettings && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  {t(
                    "pageTypes.requiresDialog.recipeSettings.header",
                    "Quantidades e tempo de produção"
                  )}
                </h4>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  {t(
                    "pageTypes.requiresDialog.recipeSettings.description",
                    "Esses valores vão para o addon de Produção da receita. Você pode ajustar depois."
                  )}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                      {t(
                        "pageTypes.requiresDialog.recipeSettings.ingredientQtyLabel",
                        "Qtde. de ingrediente"
                      )}
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={ingredientQty}
                      onChange={(e) => setIngredientQty(Number(e.target.value))}
                      className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                      {t(
                        "pageTypes.requiresDialog.recipeSettings.outputQtyLabel",
                        "Qtde. produzida"
                      )}
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={outputQty}
                      onChange={(e) => setOutputQty(Number(e.target.value))}
                      className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                      {t(
                        "pageTypes.requiresDialog.recipeSettings.craftTimeLabel",
                        "Tempo (seg.)"
                      )}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={craftTimeSeconds}
                      onChange={(e) => setCraftTimeSeconds(Number(e.target.value))}
                      className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                    />
                  </label>
                </div>
              </div>
            )}
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
              disabled={confirmDisabled}
              className="ui-btn-primary-gradient inline-flex items-center h-9 rounded-lg px-4 text-sm font-medium shadow-md shadow-indigo-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {t("pageTypes.requiresDialog.confirm", "Confirmar e criar")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
