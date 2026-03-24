"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EconomyLinkAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface EconomyLinkAddonReadOnlyProps {
  addon: EconomyLinkAddonDraft;
  theme?: "dark" | "light";
}

type SectionMeta = {
  id: string;
  title: string;
  content: string;
  hasXpBalance: boolean;
};

type GlobalVariableCalcMeta = {
  valueType: "percent" | "multiplier" | "flat" | "boolean";
  defaultValue: number | boolean;
};

type PendingAnchorNavigation = {
  sectionId: string;
  title: string;
  shortDescription: string;
};

function renderMaybeValue(value: string | number | undefined, fallback: string): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function formatDisplayNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function clampInteger(value: number, min?: number, max?: number): number {
  let next = value;
  if (typeof min === "number" && Number.isFinite(min)) next = Math.max(min, next);
  if (typeof max === "number" && Number.isFinite(max)) next = Math.min(max, next);
  return Math.floor(next);
}

function computeEffectiveValue(
  baseValue: number | undefined,
  modifiers: Array<{ refId: string }>,
  globalVariableByRefId: Map<string, GlobalVariableCalcMeta>,
  bounds?: { min?: number; max?: number }
): number | undefined {
  if (baseValue == null || !Number.isFinite(baseValue)) return undefined;
  if (!Array.isArray(modifiers) || modifiers.length === 0) {
    if (bounds?.min != null || bounds?.max != null) {
      return clampInteger(baseValue, bounds?.min, bounds?.max);
    }
    return undefined;
  }
  let next = baseValue;
  let appliedCount = 0;
  for (const modifier of modifiers) {
    const meta = globalVariableByRefId.get(modifier.refId);
    if (!meta) continue;
    if (typeof meta.defaultValue !== "number" || !Number.isFinite(meta.defaultValue)) continue;
    const modifierValue = meta.defaultValue;
    if (meta.valueType === "percent") {
      next += (next * modifierValue) / 100;
      appliedCount += 1;
      continue;
    }
    if (meta.valueType === "multiplier") {
      next *= modifierValue;
      appliedCount += 1;
      continue;
    }
    if (meta.valueType === "flat") {
      next += modifierValue;
      appliedCount += 1;
      continue;
    }
  }
  if (appliedCount === 0) {
    if (bounds?.min != null || bounds?.max != null) {
      return clampInteger(baseValue, bounds?.min, bounds?.max);
    }
    return undefined;
  }
  const nonNegative = Math.max(0, next);
  return clampInteger(nonNegative, bounds?.min, bounds?.max);
}

function toShortDescription(markdownContent: string): string {
  const plain = markdownContent
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/[#>*`~_-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
}

export function EconomyLinkAddonReadOnly({
  addon,
  theme = "dark",
}: EconomyLinkAddonReadOnlyProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const isLight = theme === "light";
  const buyModifiers = addon.buyModifiers || [];
  const sellModifiers = addon.sellModifiers || [];
  const hasBuyConfig = addon.hasBuyConfig ?? Boolean(addon.buyCurrencyRef || addon.buyValue != null || buyModifiers.length > 0);
  const hasSellConfig = addon.hasSellConfig ?? Boolean(addon.sellCurrencyRef || addon.sellValue != null || sellModifiers.length > 0);
  const hasUnlockConfig = addon.hasUnlockConfig ?? Boolean(addon.unlockRef || addon.unlockValue != null);
  const [pendingAnchorNavigation, setPendingAnchorNavigation] = useState<PendingAnchorNavigation | null>(null);
  const anchorPreviewCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingAnchorNavigation) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (anchorPreviewCardRef.current?.contains(event.target as Node)) return;
      setPendingAnchorNavigation(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingAnchorNavigation(null);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingAnchorNavigation]);

  const sectionsById = useMemo(() => {
    const map = new Map<string, SectionMeta>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        let hasXpBalance = false;
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type === "xpBalance") hasXpBalance = true;
        }
        map.set(section.id, {
          id: section.id,
          title: section.title || section.id,
          content: section.content || "",
          hasXpBalance,
        });
      }
    }
    return map;
  }, [projects]);

  const globalVariableByRefId = useMemo(() => {
    const map = new Map<string, GlobalVariableCalcMeta>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "globalVariable") continue;
          if (map.has(section.id)) continue;
          map.set(section.id, {
            valueType: sectionAddon.data.valueType,
            defaultValue: sectionAddon.data.defaultValue,
          });
        }
      }
    }
    return map;
  }, [projects]);

  const buyEffectiveValue = useMemo(
    () =>
      computeEffectiveValue(addon.buyValue, buyModifiers, globalVariableByRefId, {
        min: addon.minBuyValue,
      }),
    [addon.buyValue, addon.minBuyValue, buyModifiers, globalVariableByRefId]
  );

  const sellEffectiveValue = useMemo(
    () =>
      computeEffectiveValue(addon.sellValue, sellModifiers, globalVariableByRefId, {
        max: addon.maxSellValue,
      }),
    [addon.sellValue, addon.maxSellValue, sellModifiers, globalVariableByRefId]
  );

  const navigateToDocumentAnchor = (sectionId: string) => {
    const targetId = `section-${sectionId}`;
    const targetElement =
      (document.getElementById(targetId) as HTMLElement | null) ||
      (document.querySelector(`[data-section-anchor="${sectionId}"]`) as HTMLElement | null);
    if (!targetElement) return;
    const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - 180;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    window.history.replaceState(null, "", `#${targetId}`);
    targetElement.classList.add("gdd-anchor-highlight");
    window.setTimeout(() => targetElement.classList.remove("gdd-anchor-highlight"), 1800);
  };

  const renderSectionLink = (
    refId: string,
    meta: SectionMeta
  ): ReactNode => {
    return (
      <a
        href={`#section-${refId}`}
        onClick={(event) => {
          event.preventDefault();
          setPendingAnchorNavigation({
            sectionId: refId,
            title: meta.title,
            shortDescription: toShortDescription(meta.content),
          });
        }}
        className="gdd-inline-anchor text-blue-600 hover:text-blue-800 underline cursor-pointer"
        title={t("view.anchorPreview.goToSection")}
      >
        {meta.title}
      </a>
    );
  };

  const renderRef = (
    refId: string | undefined,
    validator?: (meta: SectionMeta) => boolean,
    invalidMessage?: string
  ): ReactNode => {
    if (!refId) return t("economyLinkAddon.emptyValue", "nao informado");
    const meta = sectionsById.get(refId);
    if (!meta) return `${refId} (${t("economyLinkAddon.refNotFound", "referencia nao encontrada")})`;
    if (validator && !validator(meta)) {
      return `${meta.title} (${invalidMessage || t("economyLinkAddon.refNotFound", "referencia nao encontrada")})`;
    }
    return renderSectionLink(refId, meta);
  };

  const renderRefList = (items: Array<{ refId: string }>): ReactNode => {
    if (items.length === 0) return t("economyLinkAddon.none", "nenhuma");
    return items.map((item, index) => (
      <span key={`${item.refId}-${index}`}>
        {index > 0 ? ", " : ""}
        {renderRef(item.refId)}
      </span>
    ));
  };

  const renderNeutralBadge = (
    label: string,
    value: string | number | undefined,
    options?: { prefix?: string }
  ): ReactNode => (
    <span
      className={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        isLight ? "border-gray-400 bg-white text-gray-900" : "border-gray-500 bg-gray-800 text-gray-100"
      }`}
    >
      {label}: {options?.prefix || ""}
      {renderMaybeValue(value, t("economyLinkAddon.emptyValue", "nao informado"))}
    </span>
  );

  const renderBuySummary = (): ReactNode => {
    const hasBuyValue = addon.buyValue != null;
    const hasBuyCurrency = typeof addon.buyCurrencyRef === "string" && addon.buyCurrencyRef.trim().length > 0;
    const hasBuyModifiers = buyModifiers.length > 0;
    const hasMinBuyValue = addon.minBuyValue != null;
    if (!hasBuyValue && !hasBuyCurrency && !hasBuyModifiers && !hasMinBuyValue) {
      return t("economyLinkAddon.emptyValue", "nao informado");
    }

    return (
      <>
        {t("economyLinkAddon.buySummaryStart", "Compre por")}{" "}
        {hasBuyValue
          ? renderMaybeValue(addon.buyValue, t("economyLinkAddon.emptyValue", "nao informado"))
          : t("economyLinkAddon.emptyValue", "nao informado")}
        {hasBuyCurrency ? (
          <>
            {" "}
            {renderRef(addon.buyCurrencyRef)}
          </>
        ) : null}
        {hasBuyModifiers ? (
          <>
            {t("economyLinkAddon.buySummaryModifierPrefix", " com desconto aplicado de ")}
            {renderRefList(buyModifiers)}
          </>
        ) : null}
        {hasMinBuyValue ? (
          <>
            {t("economyLinkAddon.buySummaryMinSuffix", " com minimo final de ")}
            {renderNeutralBadge(
              t("economyLinkAddon.minBuyValue", "Minimo de compra"),
              addon.minBuyValue
            )}
          </>
        ) : null}
        {buyEffectiveValue != null ? (
          <>
            {" "}
            {renderNeutralBadge(
              t("economyLinkAddon.effectiveValueLabel", "Valor final"),
              formatDisplayNumber(buyEffectiveValue),
              hasBuyCurrency ? { prefix: "$ " } : undefined
            )}
          </>
        ) : null}
        .
      </>
    );
  };

  const renderSellSummary = (): ReactNode => {
    const hasSellValue = addon.sellValue != null;
    const hasSellCurrency = typeof addon.sellCurrencyRef === "string" && addon.sellCurrencyRef.trim().length > 0;
    const hasSellModifiers = sellModifiers.length > 0;
    const hasMaxSellValue = addon.maxSellValue != null;
    if (!hasSellValue && !hasSellCurrency && !hasSellModifiers && !hasMaxSellValue) {
      return t("economyLinkAddon.emptyValue", "nao informado");
    }

    return (
      <>
        {t("economyLinkAddon.sellSummaryStart", "Venda por")}{" "}
        {hasSellValue
          ? renderMaybeValue(addon.sellValue, t("economyLinkAddon.emptyValue", "nao informado"))
          : t("economyLinkAddon.emptyValue", "nao informado")}
        {hasSellCurrency ? (
          <>
            {" "}
            {renderRef(addon.sellCurrencyRef)}
          </>
        ) : null}
        {hasSellModifiers ? (
          <>
            {t("economyLinkAddon.sellSummaryModifierPrefix", " com bonus de ")}
            {renderRefList(sellModifiers)}
          </>
        ) : null}
        {hasMaxSellValue ? (
          <>
            {t("economyLinkAddon.sellSummaryMaxSuffix", " com maximo final de ")}
            {renderNeutralBadge(
              t("economyLinkAddon.maxSellValue", "Maximo de venda"),
              addon.maxSellValue
            )}
          </>
        ) : null}
        {sellEffectiveValue != null ? (
          <>
            {" "}
            {renderNeutralBadge(
              t("economyLinkAddon.effectiveValueLabel", "Valor final"),
              formatDisplayNumber(sellEffectiveValue),
              hasSellCurrency ? { prefix: "$ " } : undefined
            )}
          </>
        ) : null}
        .
      </>
    );
  };

  const renderUnlockSummary = (): ReactNode => {
    const unlockValue = addon.unlockValue;
    const hasUnlockValue = typeof unlockValue === "number" && Number.isFinite(unlockValue);
    const hasUnlockRef = typeof addon.unlockRef === "string" && addon.unlockRef.trim().length > 0;

    if (!hasUnlockValue && !hasUnlockRef) {
      return t("economyLinkAddon.emptyValue", "nao informado");
    }

    if (hasUnlockValue && hasUnlockRef) {
      return (
        <>
          {t("economyLinkAddon.unlockSummaryStart", "Libera no LV")}{" "}
          {renderMaybeValue(addon.unlockValue, t("economyLinkAddon.emptyValue", "nao informado"))}
          {" de "}
          {renderRef(
            addon.unlockRef,
            (meta) => meta.hasXpBalance,
            t("economyLinkAddon.invalidUnlockRefShort", "referencia invalida para XP")
          )}
          .
        </>
      );
    }

    if (hasUnlockValue) {
      return (
        <>
          {t("economyLinkAddon.unlockSummaryStart", "Libera no LV")}{" "}
          {renderMaybeValue(addon.unlockValue, t("economyLinkAddon.emptyValue", "nao informado"))}.
        </>
      );
    }

    return (
      <>
        {t("economyLinkAddon.unlockSummaryRefOnly", "Liberado por")}{" "}
        {renderRef(
          addon.unlockRef,
          (meta) => meta.hasXpBalance,
          t("economyLinkAddon.invalidUnlockRefShort", "referencia invalida para XP")
        )}
        .
      </>
    );
  };

  return (
    <div
      className={`mt-3 rounded-xl p-3 ${
        isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"
      }`}
    >
      <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
        {addon.name || t("economyLinkAddon.defaultName", "Economy Link")}
      </h5>

      <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
        {hasBuyConfig && (
        <div className={`rounded-lg p-2 ${isLight ? "border border-gray-300 bg-gray-50" : "border border-gray-700 bg-gray-900/60"}`}>
          <p className={isLight ? "text-gray-700" : "text-gray-300"}>
            <strong>{t("economyLinkAddon.buySummaryLabel", "Compra")}:</strong>{" "}
            {renderBuySummary()}
          </p>
        </div>
        )}

        {hasSellConfig && (
        <div className={`rounded-lg p-2 ${isLight ? "border border-gray-300 bg-gray-50" : "border border-gray-700 bg-gray-900/60"}`}>
          <p className={isLight ? "text-gray-700" : "text-gray-300"}>
            <strong>{t("economyLinkAddon.sellSummaryLabel", "Venda")}:</strong>{" "}
            {renderSellSummary()}
          </p>
        </div>
        )}

        {hasUnlockConfig && (
        <div className={`rounded-lg p-2 ${isLight ? "border border-gray-300 bg-gray-50" : "border border-gray-700 bg-gray-900/60"}`}>
          <p className={isLight ? "text-gray-700" : "text-gray-300"}>
            <strong>{t("economyLinkAddon.unlockSummaryLabel", "Desbloqueio")}:</strong>{" "}
            {renderUnlockSummary()}
          </p>
        </div>
        )}
      </div>

      {pendingAnchorNavigation && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4 flex items-center justify-center">
          <div
            ref={anchorPreviewCardRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("view.anchorPreview.title")}
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("view.anchorPreview.title")}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">
                {pendingAnchorNavigation.title}
              </h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-6 text-gray-700">
                {pendingAnchorNavigation.shortDescription || t("view.anchorPreview.noDescription")}
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAnchorNavigation(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  navigateToDocumentAnchor(pendingAnchorNavigation.sectionId);
                  setPendingAnchorNavigation(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("view.anchorPreview.goButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
