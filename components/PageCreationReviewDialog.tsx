"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useResetOnOpen } from "@/hooks/useResetOnOpen";
import {
  getPageType,
  getPageTypeLabel,
  type PageType,
  type PageTypeId,
  type RequirementKind,
} from "@/lib/pageTypes/registry";
import type { PageTypeRequiresChoice } from "./PageTypeRequiresDialog";

export type PageCreationReviewPending = {
  title: string;
  parentSectionId: string | null;
  pageTypeId: PageTypeId;
  resolved: Partial<Record<RequirementKind, PageTypeRequiresChoice>>;
};

type Props = {
  open: boolean;
  pending: PageCreationReviewPending | null;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
};

/** One derived summary line. Shown as a bullet in the review dialog. */
type SummaryLine = {
  emoji: string;
  /** Primary label: e.g. "Moeda", "Atributos", "Ingrediente". */
  label: string;
  /** Human summary of what will happen: "Coins (existente)". */
  value: string;
  /** Optional indented sub-lines (per-attr modifiers, per-modifier pcts, etc.). */
  detail?: string[];
};

/**
 * Turns a `PendingCreate` (page type + user's resolved choices) into a flat
 * list of human-readable summary lines for the review dialog. Keeps the
 * `t()` lookups here so the caller only hands in raw data.
 */
function summarizePending(
  pending: PageCreationReviewPending,
  pageType: PageType,
  t: (key: string, fallback?: string) => string
): SummaryLine[] {
  const lines: SummaryLine[] = [];
  const resolved = pending.resolved;

  const formatChoiceBase = (choice: PageTypeRequiresChoice, existingTag: string, newTag: string) => {
    if (choice.mode === "link-existing") {
      return `${choice.candidate.sectionTitle} ${existingTag}`;
    }
    if (choice.mode === "create-new") {
      const name = choice.name?.trim();
      return name ? `${newTag} "${name}"` : newTag;
    }
    return t("pageCreationReview.skip", "deixar em branco");
  };

  const existingTag = t("pageCreationReview.existingTag", "(existente)");
  const newTag = t("pageCreationReview.newTag", "nova página");

  // Currency ------------------------------------------------------------------
  const currency = resolved.currency;
  if (currency) {
    lines.push({
      emoji: "🪙",
      label: t("pageCreationReview.currencyLabel", "Moeda"),
      value: formatChoiceBase(currency, existingTag, newTag),
    });

    const econ = "economySettings" in currency ? currency.economySettings : undefined;
    if (econ) {
      const priceLine = t(
        "pageCreationReview.priceLine",
        "Compra {buy}, venda {sell}"
      )
        .replace("{buy}", String(econ.buyValue))
        .replace("{sell}", String(econ.sellValue));
      const detail: string[] = [priceLine];

      lines.push({
        emoji: "💰",
        label: t("pageCreationReview.economyLabel", "Economia"),
        value: priceLine,
      });

      // Modifier pages are separate sections in the project — emit them as
      // their own review lines so the user sees that extra pages will be
      // created (not just a percentage buried in the economy summary).
      if (econ.modifiersMode === "new") {
        if (econ.applyBuyDiscount) {
          const name =
            econ.buyDiscountName?.trim() ||
            t("pageCreationReview.discountDefaultName", "Desconto");
          lines.push({
            emoji: "📉",
            label: t("pageCreationReview.newDiscountLabel", "Nova página de desconto"),
            value: t("pageCreationReview.newDiscountValue", "\"{name}\" ({pct}%)")
              .replace("{name}", name)
              .replace("{pct}", String(econ.buyDiscountPct)),
          });
        }
        if (econ.applySellMarkup) {
          const name =
            econ.sellMarkupName?.trim() ||
            t("pageCreationReview.markupDefaultName", "Bônus");
          lines.push({
            emoji: "📈",
            label: t("pageCreationReview.newMarkupLabel", "Nova página de bônus"),
            value: t("pageCreationReview.newMarkupValue", "\"{name}\" (+{pct}%)")
              .replace("{name}", name)
              .replace("{pct}", String(econ.sellMarkupPct)),
          });
        }
      } else if (econ.modifiersMode === "existing") {
        const activeBuys = econ.applyBuyDiscount ? econ.selectedBuyDiscountSectionIds.length : 0;
        const activeSells = econ.applySellMarkup ? econ.selectedSellMarkupSectionIds.length : 0;
        if (activeBuys + activeSells > 0) {
          lines.push({
            emoji: "🔗",
            label: t("pageCreationReview.appliedModifiersLabel", "Modificadores aplicados"),
            value: t(
              "pageCreationReview.existingModifiers",
              "{buy} desconto(s) e {sell} bônus existentes"
            )
              .replace("{buy}", String(activeBuys))
              .replace("{sell}", String(activeSells)),
          });
        }
      }
    }
  }

  // Attribute definitions -----------------------------------------------------
  const attrs = resolved.attributeDefinitions;
  if (attrs) {
    if (attrs.mode === "link-existing") {
      const attrCount = attrs.candidate.kind === "attributeDefinitions"
        ? (attrs.candidate.attributes || []).length
        : 0;
      const countLabel =
        attrCount === 1
          ? t("pageCreationReview.attrCountOne", "{n} atributo").replace("{n}", "1")
          : t("pageCreationReview.attrCountMany", "{n} atributos").replace("{n}", String(attrCount));
      lines.push({
        emoji: "🎯",
        label: t("pageCreationReview.attributesLabel", "Atributos"),
        value: `${attrs.candidate.sectionTitle} ${existingTag}, ${countLabel}`,
      });

      const plan = "attributeModifiersPlan" in attrs ? attrs.attributeModifiersPlan : undefined;
      if (plan && plan.length > 0) {
        const effects = plan.map((p) => {
          const op = p.mode === "add" ? "+" : p.mode === "mult" ? "×" : "=";
          return `${p.attributeKey.toUpperCase()} ${op}${p.value}`;
        });
        lines.push({
          emoji: "✨",
          label: t("pageCreationReview.effectsLabel", "Efeitos"),
          value: effects.join(", "),
        });
      }
    } else if (attrs.mode === "create-new") {
      const cs = "characterSettings" in attrs ? attrs.characterSettings : undefined;
      const presetCount = cs?.selectedAttrKeys.length ?? 0;
      const customCount = cs?.customAttrs.length ?? 0;
      const total = presetCount + customCount;
      const totalLabel =
        total === 1
          ? t("pageCreationReview.attrCountOne", "{n} atributo").replace("{n}", "1")
          : t("pageCreationReview.attrCountMany", "{n} atributos").replace("{n}", String(total));
      const name = attrs.name?.trim();
      lines.push({
        emoji: "🎯",
        label: t("pageCreationReview.attributesLabel", "Atributos"),
        value: name
          ? `${newTag} "${name}" · ${totalLabel}`
          : `${newTag} · ${totalLabel}`,
      });

      // Show progression only for page types that actually seed a progressionTable
      // (characters). EquipmentItem also carries character settings via the slots
      // picker, but its startLevel/endLevel/growthRate are never consumed.
      const hasProgressionTable = pageType.addons.some(
        (a) => a.type === "progressionTable"
      );
      if (cs && hasProgressionTable) {
        lines.push({
          emoji: "📈",
          label: t("pageCreationReview.progressionLabel", "Progressão"),
          value: t(
            "pageCreationReview.progressionValue",
            "níveis {start}–{end}, crescimento {growth}"
          )
            .replace("{start}", String(cs.startLevel))
            .replace("{end}", String(cs.endLevel))
            .replace("{growth}", String(cs.growthRate)),
        });
      }
    } else {
      lines.push({
        emoji: "🎯",
        label: t("pageCreationReview.attributesLabel", "Atributos"),
        value: t("pageCreationReview.skip", "deixar em branco"),
      });
    }
  }

  // Recipe ingredient + output ------------------------------------------------
  const ingredient = resolved.itemIngredient;
  if (ingredient) {
    lines.push({
      emoji: "🧪",
      label: t("pageCreationReview.ingredientLabel", "Ingrediente"),
      value: formatChoiceBase(ingredient, existingTag, newTag),
    });

    const recipe = "recipeSettings" in ingredient ? ingredient.recipeSettings : undefined;
    if (recipe) {
      lines.push({
        emoji: "⚙️",
        label: t("pageCreationReview.recipeLabel", "Receita"),
        value: t(
          "pageCreationReview.recipeValue",
          "{inQty} ingrediente(s) → {outQty} resultado(s), {time}s"
        )
          .replace("{inQty}", String(recipe.ingredientQty))
          .replace("{outQty}", String(recipe.outputQty))
          .replace("{time}", String(recipe.craftTimeSeconds)),
      });
    }
  }

  const output = resolved.itemOutput;
  if (output) {
    lines.push({
      emoji: "🎁",
      label: t("pageCreationReview.outputLabel", "Resultado"),
      value: formatChoiceBase(output, existingTag, newTag),
    });
  }

  // Default addons (always created with the page) ------------------------------
  const addonNames = pageType.addons
    .map((a) => a.nameOverride)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
  if (addonNames.length > 0) {
    lines.push({
      emoji: "🧩",
      label: t("pageCreationReview.addonsLabel", "Addons"),
      value: addonNames.join(", "),
    });
  }

  return lines;
}

/**
 * Final confirmation dialog shown after the user finishes every wizard step
 * but before the actual create happens. Lists every derived side-effect so
 * the user can commit or go back to tweak.
 */
export function PageCreationReviewDialog({
  open,
  pending,
  onConfirm,
  onBack,
  onCancel,
}: Props) {
  const { t } = useI18n();
  useResetOnOpen(open, () => {
    /* nothing to reset — the dialog is fully derived from props. */
  });

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

  if (!open || !pending) return null;
  const pageType = getPageType(pending.pageTypeId);
  if (!pageType) return null;

  const pageTypeLabel = getPageTypeLabel(pageType, t);
  const lines = summarizePending(pending, pageType, t);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("pageCreationReview.ariaLabel", "Revisar criação")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-xl rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-100">
            {t("pageCreationReview.title", "Pronto para criar")}
          </h3>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed">
            {t(
              "pageCreationReview.description",
              "Confira o que vai ser criado e vinculado antes de confirmar. Se algo estiver errado, clique em Voltar pra ajustar."
            )}
          </p>
        </div>

        {/* Main page summary */}
        <div className="mb-4 rounded-lg border border-indigo-500/40 bg-indigo-900/10 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              {pageType.emoji}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-100">
                {pending.title || pageTypeLabel}
              </div>
              <div className="text-xs text-gray-400">{pageTypeLabel}</div>
            </div>
          </div>
        </div>

        {/* Bullet summary of derived actions */}
        {lines.length > 0 && (
          <ul className="mb-5 space-y-1.5">
            {lines.map((line, idx) => (
              <li
                key={idx}
                className="rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-base">
                    {line.emoji}
                  </span>
                  <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-gray-400">
                    {line.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-gray-200">
                    {line.value}
                  </span>
                </div>
                {line.detail && line.detail.length > 0 && (
                  <ul className="mt-1 ml-6 space-y-0.5 text-xs text-gray-400">
                    {line.detail.map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-700 bg-transparent px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
          >
            {t("pageCreationReview.cancel", "Cancelar tudo")}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
            >
              {t("pageCreationReview.back", "Voltar")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md border border-blue-500 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              {t("pageCreationReview.confirm", "Criar tudo")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
