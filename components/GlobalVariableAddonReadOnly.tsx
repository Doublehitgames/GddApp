"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobalVariableAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { toSlug } from "@/lib/utils/slug";

interface GlobalVariableAddonReadOnlyProps {
  addon: GlobalVariableAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

type SectionMeta = {
  id: string;
  title: string;
  content: string;
};

type UsageEntry = {
  sectionId: string;
  sectionTitle: string;
  inBuy: boolean;
  inSell: boolean;
};

type PendingAnchorNavigation = {
  sectionId: string;
  title: string;
  shortDescription: string;
};

function displayDefaultValue(value: number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
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

export function GlobalVariableAddonReadOnly({ addon, theme = "dark", bare = false }: GlobalVariableAddonReadOnlyProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const isLight = theme === "light";
  const [pendingAnchorNavigation, setPendingAnchorNavigation] = useState<PendingAnchorNavigation | null>(null);
  const anchorPreviewCardRef = useRef<HTMLDivElement>(null);

  const labelClass = isLight ? "text-gray-700" : "text-gray-300";
  const mutedClass = isLight ? "text-gray-600" : "text-gray-400";
  const usageBadgeClass = isLight
    ? "rounded-full border border-gray-400 bg-gray-200 px-2 py-0.5 text-[10px] text-gray-800"
    : "rounded-full border border-gray-500/80 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-200";
  const displayName = addon.displayName || t("globalVariableAddon.emptyValue", "nao informado");
  const key = addon.key || t("globalVariableAddon.emptyValue", "nao informado");
  const valueType = t(`globalVariableAddon.valueType.${addon.valueType}`, addon.valueType);
  const scope = t(`globalVariableAddon.scope.${addon.scope}`, addon.scope);
  const defaultValueText =
    typeof addon.defaultValue === "boolean"
      ? addon.defaultValue
        ? t("globalVariableAddon.boolean.true", "Verdadeiro")
        : t("globalVariableAddon.boolean.false", "Falso")
      : displayDefaultValue(addon.defaultValue);

  const sectionsById = useMemo(() => {
    const map = new Map<string, SectionMeta>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        map.set(section.id, {
          id: section.id,
          title: section.title || section.id,
          content: section.content || "",
        });
      }
    }
    return map;
  }, [projects]);

  const currentSectionId = useMemo(() => {
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "globalVariable") continue;
          if (sectionAddon.id === addon.id || sectionAddon.data?.id === addon.id) return section.id;
        }
      }
    }
    return null;
  }, [addon.id, projects]);

  const usedBySections = useMemo(() => {
    if (!currentSectionId) return [] as UsageEntry[];
    const out: UsageEntry[] = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        let inBuy = false;
        let inSell = false;
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "economyLink") continue;
          inBuy = inBuy || (sectionAddon.data.buyModifiers || []).some((item) => item.refId === currentSectionId);
          inSell = inSell || (sectionAddon.data.sellModifiers || []).some((item) => item.refId === currentSectionId);
        }
        if (!inBuy && !inSell) continue;
        if (seen.has(section.id)) continue;
        seen.add(section.id);
        out.push({
          sectionId: section.id,
          sectionTitle: section.title || section.id,
          inBuy,
          inSell,
        });
      }
    }
    return out.sort((a, b) => a.sectionTitle.localeCompare(b.sectionTitle, undefined, { sensitivity: "base" }));
  }, [currentSectionId, projects]);

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

  const navigateToDocumentAnchor = (sectionId: string) => {
    const targetId = `section-${sectionId}`;
    const targetElement =
      (document.getElementById(targetId) as HTMLElement | null) ||
      (document.querySelector(`[data-section-anchor="${sectionId}"]`) as HTMLElement | null);
    if (!targetElement) {
      const match = window.location.pathname.match(/\/projects\/([^/]+)/);
      if (match) window.location.href = `/projects/${match[1]}/sections/${toSlug(sectionsById.get(sectionId)?.title ?? "") || sectionId}`;
      return;
    }
    const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - 180;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    window.history.replaceState(null, "", `#${targetId}`);
    targetElement.classList.add("gdd-anchor-highlight");
    window.setTimeout(() => targetElement.classList.remove("gdd-anchor-highlight"), 1800);
  };

  const outerClass = bare
    ? ""
    : `rounded-xl p-3 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"}`;

  return (
    <div className={outerClass}>
      {!bare && (
        <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {addon.name || t("globalVariableAddon.defaultName", "Global Variable")}
        </h5>
      )}
      <div className={`${bare ? "" : "mt-2 text-xs"} grid gap-2`}>
        <p className={labelClass}>
          {t("globalVariableAddon.summaryStart", "Variavel")} &quot;{displayName}&quot; ({key}),{" "}
          {t("globalVariableAddon.summaryTypePrefix", "tipo")} {valueType},{" "}
          {t("globalVariableAddon.summaryDefaultPrefix", "valor padrao")} {defaultValueText},{" "}
          {t("globalVariableAddon.summaryScopePrefix", "escopo")} {scope}.
        </p>
        {addon.notes ? <p className={mutedClass}>{addon.notes}</p> : null}
        {usedBySections.length > 0 && (
          <div className={bare ? "" : "mt-1"}>
            <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${mutedClass}`}>
              {t("globalVariableAddon.usedByTitle", "Usado por")}
            </p>
            {usedBySections.map((usage) => (
              <p key={usage.sectionId} className={labelClass}>
                <a
                  href={`#section-${usage.sectionId}`}
                  onClick={(event) => {
                    event.preventDefault();
                    const meta = sectionsById.get(usage.sectionId);
                    setPendingAnchorNavigation({
                      sectionId: usage.sectionId,
                      title: usage.sectionTitle,
                      shortDescription: toShortDescription(meta?.content || ""),
                    });
                  }}
                  className={`gdd-inline-anchor underline cursor-pointer ${isLight ? "text-blue-600 hover:text-blue-800" : "text-sky-300 hover:text-sky-200"}`}
                  title={t("view.anchorPreview.goToSection")}
                >
                  {usage.sectionTitle}
                </a>
                {usage.inBuy && (
                  <span className={`ml-2 ${usageBadgeClass}`}>
                    {t("globalVariableAddon.usedByBuyBadge", "Compra")}
                  </span>
                )}
                {usage.inSell && (
                  <span className={`ml-1 ${usageBadgeClass}`}>
                    {t("globalVariableAddon.usedBySellBadge", "Venda")}
                  </span>
                )}
              </p>
            ))}
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
