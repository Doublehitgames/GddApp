"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CraftTableAddonDraft, CraftTableEntry } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface CraftTableAddonReadOnlyProps {
  addon: CraftTableAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

type SectionMeta = {
  id: string;
  title: string;
  content: string;
  thumbImageUrl?: string | null;
};

type PendingAnchorNavigation = {
  sectionId: string;
  title: string;
  shortDescription: string;
};

function toShortDescription(raw: string): string {
  const plain = (raw || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`~_-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
}

export function CraftTableAddonReadOnly({
  addon,
  theme = "dark",
  bare = false,
}: CraftTableAddonReadOnlyProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const isLight = theme === "light";

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
        map.set(section.id, {
          id: section.id,
          title: section.title || section.id,
          content: section.content || "",
          thumbImageUrl: (section as { thumbImageUrl?: string | null }).thumbImageUrl ?? null,
        });
      }
    }
    return map;
  }, [projects]);

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

  const renderSectionLink = (refId: string): ReactNode => {
    const meta = sectionsById.get(refId);
    if (!meta) {
      return (
        <span className={isLight ? "text-rose-700" : "text-rose-300"}>
          {refId} ({t("craftTableAddon.refNotFound", "referência não encontrada")})
        </span>
      );
    }
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
        className={`gdd-inline-anchor underline cursor-pointer ${
          isLight ? "text-blue-600 hover:text-blue-800" : "text-sky-300 hover:text-sky-200"
        }`}
        title={t("view.anchorPreview.goToSection", "Ir para a seção")}
      >
        {meta.title}
      </a>
    );
  };

  const groups = useMemo(() => {
    const sorted = [...addon.entries].sort((a, b) => a.order - b.order);
    const byCategory = new Map<string, CraftTableEntry[]>();
    for (const entry of sorted) {
      const key = entry.category?.trim() || "";
      const bucket = byCategory.get(key) || [];
      bucket.push(entry);
      byCategory.set(key, bucket);
    }
    return [...byCategory.entries()];
  }, [addon.entries]);

  const renderUnlock = (entry: CraftTableEntry): ReactNode => {
    const parts: ReactNode[] = [];
    const level = entry.unlock?.level;
    if (level?.enabled) {
      parts.push(
        <span key="level">
          {t("craftTableAddon.unlockLevel", "Nível")}{" "}
          {level.xpAddonRef ? renderSectionLink(level.xpAddonRef) : "?"}
          {level.level != null ? ` (LV ${level.level})` : ""}
        </span>
      );
    }
    const currency = entry.unlock?.currency;
    if (currency?.enabled) {
      parts.push(
        <span key="currency">
          {t("craftTableAddon.unlockCurrency", "Moeda")}{" "}
          {currency.currencyAddonRef ? renderSectionLink(currency.currencyAddonRef) : "?"}
          {currency.amount != null ? ` × ${currency.amount}` : ""}
        </span>
      );
    }
    const item = entry.unlock?.item;
    if (item?.enabled) {
      parts.push(
        <span key="item">
          {t("craftTableAddon.unlockItem", "Item")}{" "}
          {item.itemRef ? renderSectionLink(item.itemRef) : "?"}
          {item.quantity != null ? ` × ${item.quantity}` : ""}
        </span>
      );
    }
    if (parts.length === 0) {
      return (
        <span className={isLight ? "text-gray-500" : "text-gray-400"}>
          {t("craftTableAddon.alwaysUnlocked", "Sempre desbloqueado")}
        </span>
      );
    }
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {parts.map((part, index) => (
          <span key={index}>{part}</span>
        ))}
      </span>
    );
  };

  const outerClass = bare
    ? ""
    : `rounded-2xl border ${isLight ? "border-gray-300 bg-white" : "border-gray-700 bg-gray-900/60"} p-4`;

  return (
    <div className={outerClass}>
      {addon.entries.length === 0 ? (
        <p className={`text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
          {t("craftTableAddon.noEntriesReadOnly", "Nenhuma receita cadastrada.")}
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map(([category, entries]) => (
            <div key={category || "__uncategorized__"}>
              <h5 className={`mb-1 text-[11px] uppercase tracking-wide ${isLight ? "text-gray-600" : "text-gray-400"}`}>
                {category || t("craftTableAddon.uncategorized", "Sem categoria")}
              </h5>
              <ul className="space-y-1">
                {entries.map((entry) => {
                  const thumb = entry.productionRef
                    ? sectionsById.get(entry.productionRef)?.thumbImageUrl
                    : null;
                  return (
                    <li
                      key={entry.id}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs ${
                        isLight ? "border-gray-200 bg-gray-50" : "border-gray-700 bg-gray-800/50"
                      } ${entry.hidden ? "opacity-60" : ""}`}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          loading="lazy"
                          className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-gray-600/80 object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={isLight ? "font-medium text-gray-900" : "font-medium text-gray-100"}>
                            {entry.productionRef
                              ? renderSectionLink(entry.productionRef)
                              : t("craftTableAddon.noProductionRef", "— sem receita —")}
                          </span>
                          {entry.hidden && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] ${
                                isLight ? "border-amber-400 bg-amber-50 text-amber-800" : "border-amber-600/60 bg-amber-900/20 text-amber-200"
                              }`}
                            >
                              {t("craftTableAddon.unavailable", "Indisponível")}
                            </span>
                          )}
                        </div>
                        <div className={`mt-1 ${isLight ? "text-gray-600" : "text-gray-300"}`}>
                          {renderUnlock(entry)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {pendingAnchorNavigation && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4 flex items-center justify-center">
          <div
            ref={anchorPreviewCardRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("view.anchorPreview.title", "Pré-visualização")}
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("view.anchorPreview.title", "Pré-visualização")}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">
                {pendingAnchorNavigation.title}
              </h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-6 text-gray-700">
                {pendingAnchorNavigation.shortDescription ||
                  t("view.anchorPreview.noDescription", "Sem descrição.")}
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAnchorNavigation(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t("common.cancel", "Cancelar")}
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
                {t("view.anchorPreview.goButton", "Ir")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
