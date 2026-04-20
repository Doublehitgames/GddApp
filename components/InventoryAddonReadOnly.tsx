"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { InventoryAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface InventoryAddonReadOnlyProps {
  addon: InventoryAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

type SectionMeta = {
  id: string;
  title: string;
  content: string;
};

type ProducedByEntry = SectionMeta & {
  sourceKind: "passive" | "recipe";
};

type PendingAnchorNavigation = {
  sectionId: string;
  title: string;
  shortDescription: string;
};

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

export function InventoryAddonReadOnly({ addon, theme = "dark", bare = false }: InventoryAddonReadOnlyProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const isLight = theme === "light";
  const [pendingAnchorNavigation, setPendingAnchorNavigation] = useState<PendingAnchorNavigation | null>(null);
  const anchorPreviewCardRef = useRef<HTMLDivElement>(null);

  const labelClass = isLight ? "text-gray-700" : "text-gray-300";
  const mutedClass = isLight ? "text-gray-600" : "text-gray-400";
  const category = addon.inventoryCategory || t("inventoryAddon.emptyValue", "nao informado");
  const maxStack = addon.stackable ? addon.maxStack : 1;
  const hasDurabilityConfig = addon.hasDurabilityConfig ?? (addon.durability > 0 || (addon.maxDurability ?? 0) > 0);
  const hasVolumeConfig = addon.hasVolumeConfig ?? (addon.volume ?? 0) > 0;

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
          if (sectionAddon.type !== "inventory") continue;
          if (sectionAddon.id === addon.id || sectionAddon.data?.id === addon.id) {
            return section.id;
          }
        }
      }
    }
    return null;
  }, [addon.id, projects]);

  const producedBySections = useMemo(() => {
    if (!currentSectionId) return [] as ProducedByEntry[];
    const out: ProducedByEntry[] = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        const sourceKind = (section.addons || []).reduce<ProducedByEntry["sourceKind"] | null>((acc, sectionAddon) => {
          if (acc) return acc;
          if (sectionAddon.type !== "production") return null;
          const data = sectionAddon.data;
          if (data.mode === "passive") {
            if (data.outputRef === currentSectionId) {
              return "passive";
            }
            return null;
          }
          const hasRecipeOutput = (data.outputs || []).some((output) => output.itemRef === currentSectionId);
          if (hasRecipeOutput) return "recipe";
          return null;
        }, null);
        if (!sourceKind || seen.has(section.id)) continue;
        seen.add(section.id);
        out.push({
          id: section.id,
          title: section.title || section.id,
          content: section.content || "",
          sourceKind,
        });
      }
    }
    return out.sort((a, b) => {
      const kindWeight = a.sourceKind === b.sourceKind ? 0 : a.sourceKind === "passive" ? -1 : 1;
      if (kindWeight !== 0) return kindWeight;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
  }, [currentSectionId, projects]);

  const ingredientForSections = useMemo(() => {
    if (!currentSectionId) return [] as SectionMeta[];
    const out: SectionMeta[] = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        const usesAsIngredient = (section.addons || []).some((sectionAddon) => {
          if (sectionAddon.type !== "production") return false;
          const data = sectionAddon.data;
          if (data.mode !== "recipe") return false;
          return (data.ingredients || []).some((ingredient) => ingredient.itemRef === currentSectionId);
        });
        if (!usesAsIngredient || seen.has(section.id)) continue;
        seen.add(section.id);
        out.push({
          id: section.id,
          title: section.title || section.id,
          content: section.content || "",
        });
      }
    }
    return out.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
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
      if (match) window.location.href = `/projects/${match[1]}/sections/${sectionId}`;
      return;
    }
    const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - 180;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    window.history.replaceState(null, "", `#${targetId}`);
    targetElement.classList.add("gdd-anchor-highlight");
    window.setTimeout(() => targetElement.classList.remove("gdd-anchor-highlight"), 1800);
  };

  const renderSectionLinks = (sections: Array<SectionMeta | ProducedByEntry>) =>
    sections.map((meta, index) => (
      <span key={meta.id}>
        {index > 0 ? ", " : ""}
        <a
          href={`#section-${meta.id}`}
          onClick={(event) => {
            event.preventDefault();
            setPendingAnchorNavigation({
              sectionId: meta.id,
              title: meta.title,
              shortDescription: toShortDescription(meta.content),
            });
          }}
          className={`gdd-inline-anchor underline cursor-pointer ${isLight ? "text-blue-600 hover:text-blue-800" : "text-sky-300 hover:text-sky-200"}`}
          title={t("view.anchorPreview.goToSection")}
        >
          {sectionsById.get(meta.id)?.title || meta.id}
        </a>
        {"sourceKind" in meta && (
          <span className="ml-1 rounded-full border border-gray-500/80 bg-gray-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-300">
            {meta.sourceKind === "passive"
              ? t("productionAddon.mode.passive", "Passiva")
              : t("productionAddon.mode.recipe", "Receita")}
          </span>
        )}
      </span>
    ));

  const outerClass = bare
    ? ""
    : `rounded-xl p-3 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"}`;

  return (
    <div className={outerClass}>
      {!bare && (
        <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {addon.name || t("inventoryAddon.defaultName", "Inventory")}
        </h5>
      )}
      <div className={`${bare ? "" : "mt-2 text-xs"} grid gap-2`}>
        <p className={labelClass}>
          {t("inventoryAddon.summaryStart", "Item de categoria")} {category}.{" "}
          {t("inventoryAddon.summaryWeightPrefix", "Peso")} {addon.weight}
          {hasVolumeConfig ? `, ${t("inventoryAddon.summarySlotPrefix", "usa")} ${addon.slotSize} slot(s)` : ""},{" "}
          {addon.stackable
            ? `${t("inventoryAddon.summaryStackable", "permite pilha")} (${t("inventoryAddon.summaryMaxStackPrefix", "max")} ${maxStack})`
            : t("inventoryAddon.summaryNotStackable", "nao permite pilha")}
          .{" "}
          {hasDurabilityConfig
            ? `${t("inventoryAddon.summaryDurabilityPrefix", "Durabilidade")} ${addon.durability}, ${t("inventoryAddon.summaryMaxDurabilityPrefix", "durabilidade maxima")} ${addon.maxDurability ?? 0}. `
            : ""}
          {hasVolumeConfig ? `${t("inventoryAddon.summaryVolumePrefix", "Volume")} ${addon.volume ?? 0}, ` : ""}
          {t("inventoryAddon.summaryBindPrefix", "vinculo")} {t(`inventoryAddon.bindType.${addon.bindType}`, addon.bindType)}.{" "}
          {t("inventoryAddon.summaryShopPrefix", "Loja")}:{" "}
          {addon.showInShop ? t("inventoryAddon.boolean.true", "Sim") : t("inventoryAddon.boolean.false", "Nao")},{" "}
          {t("inventoryAddon.summaryConsumablePrefix", "consumivel")}:{" "}
          {addon.consumable ? t("inventoryAddon.boolean.true", "Sim") : t("inventoryAddon.boolean.false", "Nao")},{" "}
          {t("inventoryAddon.summaryDiscardablePrefix", "descartavel")}:{" "}
          {addon.discardable ? t("inventoryAddon.boolean.true", "Sim") : t("inventoryAddon.boolean.false", "Nao")}.
        </p>
        {addon.notes ? <p className={mutedClass}>{addon.notes}</p> : null}
        {producedBySections.length > 0 && (
          <p className={labelClass}>
            <strong>{t("inventoryAddon.producedByLabel", "Produzido por")}:</strong>{" "}
            {renderSectionLinks(producedBySections)}.
          </p>
        )}
        {ingredientForSections.length > 0 && (
          <p className={labelClass}>
            <strong>{t("inventoryAddon.ingredientForLabel", "Ingrediente para")}:</strong>{" "}
            {renderSectionLinks(ingredientForSections)}.
          </p>
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
