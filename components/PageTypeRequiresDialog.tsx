"use client";

import { useEffect, useMemo, useState } from "react";
import { useResetOnOpen } from "@/hooks/useResetOnOpen";
import {
  getPageTypeLabel,
  type PageType,
  type RequiresCandidate,
} from "@/lib/pageTypes/registry";
import { useI18n } from "@/lib/i18n/provider";
import {
  AttributeSlotsEditor,
  slugifyAttributeKey,
  uniqueAttributeKey,
} from "./AttributeSlotsEditor";
import {
  AttributeModifiersEditor,
  type AttributeModifierDraft,
  type AttributeModifierMode,
} from "./AttributeModifiersEditor";

export type RecipeSettings = {
  ingredientQty: number;
  outputQty: number;
  craftTimeSeconds: number;
};

/**
 * User-authored plan for seeding an `attributeModifiers` addon on the page
 * being created. Produced by the dialog when the parent page type has an
 * attrModifiers addon and the user picked an existing attributes page.
 * Only enabled entries are emitted.
 */
export type AttributeModifiersPlan = Array<{
  attributeKey: string;
  mode: AttributeModifierMode;
  value: number;
}>;

export type CharacterSettings = {
  /** Subset of preset attribute keys selected (hp/atk/def/spd or customized). */
  selectedAttrKeys: string[];
  /** User-defined extra attributes beyond the presets (name-only slots). */
  customAttrs: Array<{ key: string; label: string }>;
  startLevel: number;
  endLevel: number;
  growthRate: number;
};

export type EconomyModifierCandidateView = {
  sectionId: string;
  sectionTitle: string;
  addonName: string;
  percent: number;
};

export type EconomySettings = {
  buyValue: number;
  sellValue: number;
  /**
   * "existing": link to the discount/markup pages that already exist (read-only %).
   * "new": create fresh modifier pages with unique keys and user-chosen values/names.
   */
  modifiersMode: "existing" | "new";
  /** Master toggle: when false the item is created with no discount modifier at all. */
  applyBuyDiscount: boolean;
  applySellMarkup: boolean;
  /** Section IDs of existing discount pages selected to stack (existing mode only). */
  selectedBuyDiscountSectionIds: string[];
  selectedSellMarkupSectionIds: string[];
  /** Only relevant when modifiersMode === "new". */
  buyDiscountPct: number;
  sellMarkupPct: number;
  buyDiscountName?: string;
  sellMarkupName?: string;
};

export type PageTypeRequiresChoice =
  | {
      mode: "link-existing";
      candidate: RequiresCandidate;
      recipeSettings?: RecipeSettings;
      characterSettings?: CharacterSettings;
      economySettings?: EconomySettings;
      /** Modifier seeds when the parent page type has an attrModifiers addon. */
      attributeModifiersPlan?: AttributeModifiersPlan;
    }
  | {
      mode: "create-new";
      name?: string;
      recipeSettings?: RecipeSettings;
      characterSettings?: CharacterSettings;
      economySettings?: EconomySettings;
      attributeModifiersPlan?: AttributeModifiersPlan;
    }
  | {
      mode: "skip";
      recipeSettings?: RecipeSettings;
      characterSettings?: CharacterSettings;
      economySettings?: EconomySettings;
    };

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
  /**
   * When true, render the attribute slots editor (presets + add custom).
   * Used in any context that creates a new attributeDefinitions page so the
   * user can pick which slots to seed.
   */
  showAttributeSlotsPicker?: boolean;
  /**
   * When true AND the user picked an existing attributes page, render a
   * per-attribute modifier editor (checkbox + value + op). Used by parent
   * page types that seed an `attributeModifiers` addon (equipmentItem,
   * characters).
   */
  showAttributeModifiersPicker?: boolean;
  /**
   * When true, render the character-only settings (level range + growth).
   * Almost always accompanied by `showAttributeSlotsPicker`.
   */
  showCharacterSettings?: boolean;
  /** Default values for the character settings section. */
  defaultCharacterSettings?: CharacterSettings;
  /** Preset attributes shown as checkboxes in the character settings. */
  characterAttributePresets?: ReadonlyArray<{ key: string; label: string }>;
  /** When true, render the economy-settings section (buy/sell values + modifier %). */
  showEconomySettings?: boolean;
  /** Default values for the economy settings section. */
  defaultEconomySettings?: EconomySettings;
  /** All existing discount candidates to show as checkboxes in "existing" mode. */
  existingBuyDiscountCandidates?: ReadonlyArray<EconomyModifierCandidateView>;
  existingSellMarkupCandidates?: ReadonlyArray<EconomyModifierCandidateView>;
  /**
   * When the wizard has more than one user-facing step, `stepIndex` (1-based)
   * and `stepCount` power a "Passo X de Y" chip in the header. Omit both for
   * single-step wizards so the chip is hidden.
   */
  stepIndex?: number;
  stepCount?: number;
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
  showAttributeSlotsPicker,
  showAttributeModifiersPicker,
  showCharacterSettings,
  defaultCharacterSettings,
  characterAttributePresets,
  showEconomySettings,
  defaultEconomySettings,
  existingBuyDiscountCandidates,
  existingSellMarkupCandidates,
  stepIndex,
  stepCount,
}: Props) {
  const buyCands = existingBuyDiscountCandidates || [];
  const sellCands = existingSellMarkupCandidates || [];
  const hasExistingEconomyModifiers = buyCands.length > 0 || sellCands.length > 0;
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
  const initialSelectedAttrs = useMemo(
    () =>
      defaultCharacterSettings?.selectedAttrKeys ??
      (characterAttributePresets || []).map((p) => p.key),
    [defaultCharacterSettings, characterAttributePresets]
  );
  const [selectedAttrKeys, setSelectedAttrKeys] = useState<string[]>(initialSelectedAttrs);
  const [customAttrs, setCustomAttrs] = useState<Array<{ key: string; label: string }>>(
    defaultCharacterSettings?.customAttrs ?? []
  );
  const [startLevel, setStartLevel] = useState<number>(defaultCharacterSettings?.startLevel ?? 1);
  const [endLevel, setEndLevel] = useState<number>(defaultCharacterSettings?.endLevel ?? 100);
  const [growthRate, setGrowthRate] = useState<number>(defaultCharacterSettings?.growthRate ?? 1.15);
  const [buyValue, setBuyValue] = useState<number>(defaultEconomySettings?.buyValue ?? 100);
  const [sellValue, setSellValue] = useState<number>(defaultEconomySettings?.sellValue ?? 50);
  const [modifiersMode, setModifiersMode] = useState<"existing" | "new">(
    defaultEconomySettings?.modifiersMode ?? (hasExistingEconomyModifiers ? "existing" : "new")
  );
  const [buyDiscountPct, setBuyDiscountPct] = useState<number>(
    defaultEconomySettings?.buyDiscountPct ?? -10
  );
  const [sellMarkupPct, setSellMarkupPct] = useState<number>(
    defaultEconomySettings?.sellMarkupPct ?? 10
  );
  const [buyDiscountName, setBuyDiscountName] = useState<string>(
    defaultEconomySettings?.buyDiscountName ?? ""
  );
  const [sellMarkupName, setSellMarkupName] = useState<string>(
    defaultEconomySettings?.sellMarkupName ?? ""
  );
  const [applyBuyDiscount, setApplyBuyDiscount] = useState<boolean>(
    defaultEconomySettings?.applyBuyDiscount ?? true
  );
  const [applySellMarkup, setApplySellMarkup] = useState<boolean>(
    defaultEconomySettings?.applySellMarkup ?? true
  );
  const defaultBuySel = useMemo(
    () =>
      defaultEconomySettings?.selectedBuyDiscountSectionIds ??
      buyCands.map((c) => c.sectionId),
    [defaultEconomySettings, buyCands]
  );
  const defaultSellSel = useMemo(
    () =>
      defaultEconomySettings?.selectedSellMarkupSectionIds ??
      sellCands.map((c) => c.sectionId),
    [defaultEconomySettings, sellCands]
  );
  const [selectedBuyIds, setSelectedBuyIds] = useState<string[]>(defaultBuySel);
  const [selectedSellIds, setSelectedSellIds] = useState<string[]>(defaultSellSel);

  // Per-attribute modifier drafts keyed by attribute key. Only the attrs the
  // user toggles are emitted in the final plan on confirm.
  const [attrModsDrafts, setAttrModsDrafts] = useState<
    Record<string, AttributeModifierDraft>
  >({});

  useResetOnOpen(open, () => {
    setSelection(defaultSelection);
    setCreateNewName(defaultCreateNewName ?? "");
    setIngredientQty(defaultRecipeSettings?.ingredientQty ?? 10);
    setOutputQty(defaultRecipeSettings?.outputQty ?? 1);
    setCraftTimeSeconds(defaultRecipeSettings?.craftTimeSeconds ?? 60);
    setSelectedAttrKeys(initialSelectedAttrs);
    setCustomAttrs(defaultCharacterSettings?.customAttrs ?? []);
    setStartLevel(defaultCharacterSettings?.startLevel ?? 1);
    setEndLevel(defaultCharacterSettings?.endLevel ?? 100);
    setGrowthRate(defaultCharacterSettings?.growthRate ?? 1.15);
    setBuyValue(defaultEconomySettings?.buyValue ?? 100);
    setSellValue(defaultEconomySettings?.sellValue ?? 50);
    setModifiersMode(
      defaultEconomySettings?.modifiersMode ?? (hasExistingEconomyModifiers ? "existing" : "new")
    );
    setBuyDiscountPct(defaultEconomySettings?.buyDiscountPct ?? -10);
    setSellMarkupPct(defaultEconomySettings?.sellMarkupPct ?? 10);
    setBuyDiscountName(defaultEconomySettings?.buyDiscountName ?? "");
    setSellMarkupName(defaultEconomySettings?.sellMarkupName ?? "");
    setApplyBuyDiscount(defaultEconomySettings?.applyBuyDiscount ?? true);
    setApplySellMarkup(defaultEconomySettings?.applySellMarkup ?? true);
    setSelectedBuyIds(defaultBuySel);
    setSelectedSellIds(defaultSellSel);
    setAttrModsDrafts({});
  });

  const toggleBuyId = (id: string) =>
    setSelectedBuyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const toggleSellId = (id: string) =>
    setSelectedSellIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // Attributes coming from the currently selected candidate (when it exists
  // and is an attributeDefinitions candidate). Used by the modifiers editor
  // so the user can tick which attrs this page modifies.
  const selectedCandidateAttrs = useMemo(() => {
    if (selection.kind !== "candidate") return [] as Array<{ key: string; label: string }>;
    const picked = candidates.find(
      (c) => c.sectionId + "::" + c.addonId === selection.candidateId
    );
    if (!picked || picked.kind !== "attributeDefinitions") return [];
    return (picked.attributes || []).map((a) => ({
      key: a.key,
      label: a.label || a.key,
    }));
  }, [selection, candidates]);

  const updateAttrModDraft = (attrKey: string, next: AttributeModifierDraft) => {
    setAttrModsDrafts((prev) => ({ ...prev, [attrKey]: next }));
  };

  const toggleAttrKey = (key: string) => {
    setSelectedAttrKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const addCustomAttr = (label: string) => {
    const presetKeys = (characterAttributePresets || []).map((p) => p.key);
    const customKeys = customAttrs.map((a) => a.key);
    const key = uniqueAttributeKey(
      slugifyAttributeKey(label) || "attr",
      [...presetKeys, ...customKeys]
    );
    setCustomAttrs((prev) => [...prev, { key, label }]);
  };

  const removeCustomAttr = (key: string) => {
    setCustomAttrs((prev) => prev.filter((a) => a.key !== key));
  };

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
    // The caller reads `customAttrs` to seed extra slots on create-new.
    const characterSettings: CharacterSettings | undefined = (showAttributeSlotsPicker ||
      showCharacterSettings)
      ? {
          selectedAttrKeys: selectedAttrKeys.length > 0 ? [...selectedAttrKeys] : [],
          customAttrs: customAttrs.map((a) => ({ key: a.key, label: a.label })),
          startLevel: Math.max(1, Math.floor(startLevel)),
          endLevel: Math.max(Math.max(1, Math.floor(startLevel)), Math.floor(endLevel)),
          growthRate:
            Number.isFinite(growthRate) && growthRate > 0 ? Number(growthRate) : 1.15,
        }
      : undefined;
    const economySettings: EconomySettings | undefined = showEconomySettings
      ? {
          buyValue: Number.isFinite(buyValue) ? Number(buyValue) : 100,
          sellValue: Number.isFinite(sellValue) ? Number(sellValue) : 50,
          modifiersMode,
          applyBuyDiscount,
          applySellMarkup,
          selectedBuyDiscountSectionIds: [...selectedBuyIds],
          selectedSellMarkupSectionIds: [...selectedSellIds],
          buyDiscountPct: Number.isFinite(buyDiscountPct) ? Number(buyDiscountPct) : -10,
          sellMarkupPct: Number.isFinite(sellMarkupPct) ? Number(sellMarkupPct) : 10,
          buyDiscountName: buyDiscountName.trim() || undefined,
          sellMarkupName: sellMarkupName.trim() || undefined,
        }
      : undefined;
    // Build the attribute-modifiers plan from whatever the user toggled in
    // `attrModsDrafts` — only enabled entries make it into the emitted plan.
    const attributeModifiersPlan: AttributeModifiersPlan | undefined =
      showAttributeModifiersPicker
        ? Object.values(attrModsDrafts)
            .filter((d) => d.enabled)
            .map((d) => ({
              attributeKey: d.attributeKey,
              mode: d.mode,
              value: Number.isFinite(d.value) ? Number(d.value) : 0,
            }))
        : undefined;
    const planForEmit =
      attributeModifiersPlan && attributeModifiersPlan.length > 0
        ? attributeModifiersPlan
        : undefined;

    if (selection.kind === "candidate") {
      const picked = candidates.find(
        (c) => c.sectionId + "::" + c.addonId === selection.candidateId
      );
      if (!picked) return;
      onConfirm({
        mode: "link-existing",
        candidate: picked,
        recipeSettings,
        characterSettings,
        economySettings,
        attributeModifiersPlan: planForEmit,
      });
    } else if (selection.kind === "create-new") {
      const trimmed = createNewName.trim();
      onConfirm({
        mode: "create-new",
        name: trimmed || undefined,
        recipeSettings,
        characterSettings,
        economySettings,
        // When creating a new attr page, the user couldn't have picked modifiers
        // (the attrs don't exist yet) — so this is left undefined.
      });
    } else {
      onConfirm({ mode: "skip", recipeSettings, characterSettings, economySettings });
    }
  };

  // Disable confirm when the new-page name is required and empty, OR when
  // the slots picker is active and the user has ticked zero presets AND
  // added zero custom attributes (would create an invalid attrs page).
  const emptySlotsOnCreate =
    selection.kind === "create-new" &&
    showAttributeSlotsPicker &&
    selectedAttrKeys.length === 0 &&
    customAttrs.length === 0;
  const confirmDisabled =
    (selection.kind === "create-new" &&
      askNameOnCreateNew &&
      !allowEmptyCreateNewName &&
      !createNewName.trim()) ||
    emptySlotsOnCreate;

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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-gray-100">{titleText}</h3>
                {typeof stepIndex === "number" &&
                  typeof stepCount === "number" &&
                  stepCount > 1 && (
                    <span className="inline-flex items-center rounded-full border border-indigo-500/50 bg-indigo-900/30 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
                      {t("pageTypes.requiresDialog.stepOf", "Passo {current} de {total}")
                        .replace("{current}", String(stepIndex))
                        .replace("{total}", String(stepCount))}
                    </span>
                  )}
              </div>
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

            {showEconomySettings && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  {t(
                    "pageTypes.requiresDialog.economySettings.header",
                    "Configurações de economia"
                  )}
                </h4>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  {t(
                    "pageTypes.requiresDialog.economySettings.description",
                    "Valores base de compra/venda deste item. Os modificadores (desconto/bônus) são páginas separadas — você pode reusar as existentes ou criar novas só pra este item."
                  )}
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <label className="block">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                      {t(
                        "pageTypes.requiresDialog.economySettings.buyValueLabel",
                        "Compra base"
                      )}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={buyValue}
                      onChange={(e) => setBuyValue(Number(e.target.value))}
                      className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                      {t(
                        "pageTypes.requiresDialog.economySettings.sellValueLabel",
                        "Venda base"
                      )}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={sellValue}
                      onChange={(e) => setSellValue(Number(e.target.value))}
                      className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                    />
                  </label>
                </div>

                <h5 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  {t(
                    "pageTypes.requiresDialog.economySettings.modifiersHeader",
                    "Modificadores (Desconto / Bônus)"
                  )}
                </h5>
                <div className="flex flex-wrap gap-3 mb-3">
                  <label
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition-all ${
                      applyBuyDiscount
                        ? "border-indigo-400/60 bg-indigo-600/20 text-indigo-100"
                        : "border-gray-700 bg-gray-800/60 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={applyBuyDiscount}
                      onChange={() => setApplyBuyDiscount((v) => !v)}
                    />
                    <span
                      aria-hidden
                      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border ${
                        applyBuyDiscount
                          ? "border-indigo-300 bg-gradient-to-br from-indigo-500 to-fuchsia-500"
                          : "border-gray-500 bg-gray-900"
                      }`}
                    >
                      {applyBuyDiscount && (
                        <svg
                          className="h-2.5 w-2.5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>
                    <span>
                      {t(
                        "pageTypes.requiresDialog.economySettings.applyBuyDiscountLabel",
                        "Aplicar desconto de compra"
                      )}
                    </span>
                  </label>
                  <label
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition-all ${
                      applySellMarkup
                        ? "border-indigo-400/60 bg-indigo-600/20 text-indigo-100"
                        : "border-gray-700 bg-gray-800/60 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={applySellMarkup}
                      onChange={() => setApplySellMarkup((v) => !v)}
                    />
                    <span
                      aria-hidden
                      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border ${
                        applySellMarkup
                          ? "border-indigo-300 bg-gradient-to-br from-indigo-500 to-fuchsia-500"
                          : "border-gray-500 bg-gray-900"
                      }`}
                    >
                      {applySellMarkup && (
                        <svg
                          className="h-2.5 w-2.5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>
                    <span>
                      {t(
                        "pageTypes.requiresDialog.economySettings.applySellMarkupLabel",
                        "Aplicar bônus de venda"
                      )}
                    </span>
                  </label>
                </div>
                {hasExistingEconomyModifiers && (applyBuyDiscount || applySellMarkup) && (
                  <div className="space-y-2 mb-3">
                    <label
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                        modifiersMode === "existing"
                          ? "border-indigo-400/70 bg-gradient-to-r from-indigo-600/25 to-fuchsia-600/20"
                          : "border-gray-700 bg-gray-800/40 hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="economy-modifiers-mode"
                        className="sr-only"
                        checked={modifiersMode === "existing"}
                        onChange={() => setModifiersMode("existing")}
                      />
                      <span
                        aria-hidden
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          modifiersMode === "existing"
                            ? "border-indigo-300 bg-gradient-to-br from-indigo-500 to-fuchsia-500"
                            : "border-gray-500 bg-gray-900"
                        }`}
                      >
                        {modifiersMode === "existing" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0 text-sm text-gray-100">
                        <span className="block font-medium">
                          {t(
                            "pageTypes.requiresDialog.economySettings.useExistingLabel",
                            "Escolher entre modificadores existentes"
                          )}
                        </span>
                        <span className="block text-xs text-gray-400 mt-0.5">
                          {t(
                            "pageTypes.requiresDialog.economySettings.useExistingDescription",
                            "Selecione quais páginas de desconto/bônus deste projeto aplicar neste item — os % somam/multiplicam."
                          )}
                        </span>
                      </span>
                    </label>
                    {modifiersMode === "existing" && (
                      <div className="ml-7 space-y-3 pt-1">
                        {applyBuyDiscount && buyCands.length > 0 && (
                          <div>
                            <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                              {t(
                                "pageTypes.requiresDialog.economySettings.discountCandidatesLabel",
                                "Descontos disponíveis"
                              )}
                            </span>
                            <div className="space-y-1">
                              {buyCands.map((c) => {
                                const checked = selectedBuyIds.includes(c.sectionId);
                                return (
                                  <label
                                    key={c.sectionId}
                                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-all ${
                                      checked
                                        ? "border-indigo-400/60 bg-indigo-600/15 text-indigo-100"
                                        : "border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={checked}
                                      onChange={() => toggleBuyId(c.sectionId)}
                                    />
                                    <span
                                      aria-hidden
                                      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border ${
                                        checked
                                          ? "border-indigo-300 bg-gradient-to-br from-indigo-500 to-fuchsia-500"
                                          : "border-gray-500 bg-gray-900"
                                      }`}
                                    >
                                      {checked && (
                                        <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </span>
                                    <span className="flex-1 truncate">{c.sectionTitle}</span>
                                    <span className="shrink-0 tabular-nums text-gray-400">
                                      {c.percent > 0 ? `+${c.percent}` : c.percent}%
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {applySellMarkup && sellCands.length > 0 && (
                          <div>
                            <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                              {t(
                                "pageTypes.requiresDialog.economySettings.markupCandidatesLabel",
                                "Bônus disponíveis"
                              )}
                            </span>
                            <div className="space-y-1">
                              {sellCands.map((c) => {
                                const checked = selectedSellIds.includes(c.sectionId);
                                return (
                                  <label
                                    key={c.sectionId}
                                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-all ${
                                      checked
                                        ? "border-indigo-400/60 bg-indigo-600/15 text-indigo-100"
                                        : "border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-600"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={checked}
                                      onChange={() => toggleSellId(c.sectionId)}
                                    />
                                    <span
                                      aria-hidden
                                      className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border ${
                                        checked
                                          ? "border-indigo-300 bg-gradient-to-br from-indigo-500 to-fuchsia-500"
                                          : "border-gray-500 bg-gray-900"
                                      }`}
                                    >
                                      {checked && (
                                        <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </span>
                                    <span className="flex-1 truncate">{c.sectionTitle}</span>
                                    <span className="shrink-0 tabular-nums text-gray-400">
                                      {c.percent > 0 ? `+${c.percent}` : c.percent}%
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <label
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                        modifiersMode === "new"
                          ? "border-emerald-400/70 bg-gradient-to-r from-emerald-600/25 to-teal-600/20"
                          : "border-gray-700 bg-gray-800/40 hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="economy-modifiers-mode"
                        className="sr-only"
                        checked={modifiersMode === "new"}
                        onChange={() => setModifiersMode("new")}
                      />
                      <span
                        aria-hidden
                        className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          modifiersMode === "new"
                            ? "border-emerald-300 bg-gradient-to-br from-emerald-500 to-teal-500"
                            : "border-gray-500 bg-gray-900"
                        }`}
                      >
                        {modifiersMode === "new" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0 text-sm text-gray-100">
                        <span className="block font-medium">
                          {t(
                            "pageTypes.requiresDialog.economySettings.createNewLabel",
                            "Criar modificadores novos e separados pra este item"
                          )}
                        </span>
                        <span className="block text-xs text-gray-400 mt-0.5">
                          {t(
                            "pageTypes.requiresDialog.economySettings.createNewDescription",
                            "Cria duas novas páginas de modificador (desconto + bônus) que só afetam este item. As existentes ficam intocadas."
                          )}
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                {modifiersMode === "new" && (applyBuyDiscount || applySellMarkup) && (
                  <div className="grid grid-cols-2 gap-3">
                    {applyBuyDiscount && (
                      <>
                        <label className="block">
                          <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                            {t(
                              "pageTypes.requiresDialog.economySettings.buyDiscountNameLabel",
                              "Nome do desconto"
                            )}
                          </span>
                          <input
                            type="text"
                            value={buyDiscountName}
                            onChange={(e) => setBuyDiscountName(e.target.value)}
                            placeholder={t(
                              "pageTypes.requiresDialog.economySettings.buyDiscountNamePlaceholder",
                              "Ex.: Desconto Premium"
                            )}
                            className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                            {t(
                              "pageTypes.requiresDialog.economySettings.buyDiscountPctLabel",
                              "Desconto de compra %"
                            )}
                          </span>
                          <input
                            type="number"
                            step={1}
                            max={0}
                            value={buyDiscountPct}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setBuyDiscountPct(Number.isFinite(v) ? Math.min(0, v) : 0);
                            }}
                            className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                          />
                        </label>
                      </>
                    )}
                    {applySellMarkup && (
                      <>
                        <label className="block">
                          <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                            {t(
                              "pageTypes.requiresDialog.economySettings.sellMarkupNameLabel",
                              "Nome do bônus"
                            )}
                          </span>
                          <input
                            type="text"
                            value={sellMarkupName}
                            onChange={(e) => setSellMarkupName(e.target.value)}
                            placeholder={t(
                              "pageTypes.requiresDialog.economySettings.sellMarkupNamePlaceholder",
                              "Ex.: Bônus Premium"
                            )}
                            className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                          />
                        </label>
                        <label className="block">
                          <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                            {t(
                              "pageTypes.requiresDialog.economySettings.sellMarkupPctLabel",
                              "Bônus de venda %"
                            )}
                          </span>
                          <input
                            type="number"
                            step={1}
                            min={0}
                            value={sellMarkupPct}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setSellMarkupPct(Number.isFinite(v) ? Math.max(0, v) : 0);
                            }}
                            className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                          />
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {showAttributeModifiersPicker &&
              selection.kind === "candidate" &&
              selectedCandidateAttrs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    {t(
                      "pageTypes.requiresDialog.attrModifiersHeader",
                      "Efeitos nos atributos"
                    )}
                  </h4>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    {t(
                      "pageTypes.requiresDialog.attrModifiersDescription",
                      "Marque quais atributos este item/personagem modifica e como: somar (+), multiplicar (×) ou definir direto (=)."
                    )}
                  </p>
                  <AttributeModifiersEditor
                    attributes={selectedCandidateAttrs}
                    drafts={attrModsDrafts}
                    onChange={updateAttrModDraft}
                  />
                </div>
              )}

            {(showAttributeSlotsPicker || showCharacterSettings) &&
              selection.kind === "create-new" && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    {t(
                      "pageTypes.requiresDialog.characterSettings.attributesLabel",
                      "Atributos a criar"
                    )}
                  </h4>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    {t(
                      "pageTypes.requiresDialog.attributeSlotsDescription",
                      "Marque os atributos base e adicione outros que seu jogo precisa."
                    )}
                  </p>
                  <AttributeSlotsEditor
                    presets={characterAttributePresets || []}
                    selectedPresetKeys={selectedAttrKeys}
                    onTogglePreset={toggleAttrKey}
                    customAttributes={customAttrs}
                    onAddCustom={addCustomAttr}
                    onRemoveCustom={removeCustomAttr}
                  />
                </div>
              )}

            {showCharacterSettings && selection.kind === "create-new" && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  {t(
                    "pageTypes.requiresDialog.characterSettings.header",
                    "Configurações do personagem"
                  )}
                </h4>
                <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                  {t(
                    "pageTypes.requiresDialog.characterSettings.description",
                    "Quais atributos criar e de qual nível até qual nível o personagem vai. Dá pra mexer em tudo depois."
                  )}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <label className="block">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                      {t(
                        "pageTypes.requiresDialog.characterSettings.startLevelLabel",
                        "Nível inicial"
                      )}
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={startLevel}
                      onChange={(e) => setStartLevel(Number(e.target.value))}
                      className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                      {t(
                        "pageTypes.requiresDialog.characterSettings.endLevelLabel",
                        "Nível final"
                      )}
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={endLevel}
                      onChange={(e) => setEndLevel(Number(e.target.value))}
                      className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                      {t(
                        "pageTypes.requiresDialog.characterSettings.growthRateLabel",
                        "Crescimento por nível"
                      )}
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={0.01}
                      value={growthRate}
                      onChange={(e) => setGrowthRate(Number(e.target.value))}
                      className="ui-input-dark ui-focus-ring-indigo w-full rounded-md border border-gray-600 bg-gray-900/80 px-2.5 py-1.5 text-sm text-gray-100"
                    />
                  </label>
                </div>
              </div>
            )}

            {showRecipeSettings && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  {t(
                    "pageTypes.requiresDialog.recipeSettings.header",
                    "Quantidades e tempo de produção"
                  )}
                </h4>
                <p className="text-xs text-gray-400 mb-1 leading-relaxed">
                  {t(
                    "pageTypes.requiresDialog.recipeSettings.description",
                    "Quanto entra, quanto sai e em quanto tempo. Pode mudar depois na página da receita."
                  )}
                </p>
                <p className="text-xs text-gray-500 italic mb-3">
                  {t(
                    "pageTypes.requiresDialog.recipeSettings.example",
                    "Ex.: 10 toras → 1 tábua em 30s."
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
