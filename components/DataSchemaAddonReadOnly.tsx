"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DataSchemaAddonDraft, DataSchemaEntry, EconomyLinkAddonDraft, FieldLibraryAddonDraft, ProductionAddonDraft, SectionAddon } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { toSlug } from "@/lib/utils/slug";

interface DataSchemaAddonReadOnlyProps {
  addon: DataSchemaAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

type SectionMeta = {
  id: string;
  title: string;
  content: string;
};

type PendingAnchorNavigation = {
  sectionId: string;
  title: string;
  shortDescription: string;
};

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value ?? "");
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

export function DataSchemaAddonReadOnly({ addon, theme = "dark", bare = false }: DataSchemaAddonReadOnlyProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const rows = addon.entries || [];
  const isLight = theme === "light";
  const [pendingAnchorNavigation, setPendingAnchorNavigation] = useState<PendingAnchorNavigation | null>(null);
  const anchorPreviewCardRef = useRef<HTMLDivElement>(null);
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
  // Find the section containing this addon (for resolving bindings, filtered by group)
  const sectionContext = useMemo(() => {
    for (const project of projects) {
      for (const sec of project.sections || []) {
        const wrapper = (sec.addons || []).find((a) => a.id === addon.id);
        if (wrapper) {
          const myGroup = (wrapper as any).group || "A";
          return { section: sec, addons: (sec.addons || []).filter((a: SectionAddon) => ((a as any).group || "A") === myGroup) };
        }
      }
    }
    return null;
  }, [projects, addon.id]);

  /** Resolve the effective value of an entry, considering active bindings */
  const resolveEntryValue = (entry: DataSchemaEntry): string | number | boolean => {
    if (entry.usePageDataId && sectionContext) {
      return sectionContext.section.dataId ?? "";
    }
    if (entry.economyLinkRef && entry.economyLinkField) {
      const elAddon = (sectionContext?.addons ?? []).find(
        (a: SectionAddon) => a.type === "economyLink" && a.id === entry.economyLinkRef
      );
      if (elAddon) {
        const val = (elAddon.data as EconomyLinkAddonDraft)[entry.economyLinkField as keyof EconomyLinkAddonDraft];
        if (typeof val === "number") return val;
      }
    }
    if (entry.productionRef && entry.productionField) {
      const prodAddon = (sectionContext?.addons ?? []).find(
        (a: SectionAddon) => a.type === "production" && a.id === entry.productionRef
      );
      if (prodAddon) {
        const directFields: Record<string, string> = {
          minOutput: "minOutput", maxOutput: "maxOutput",
          intervalSeconds: "intervalSeconds", craftTimeSeconds: "craftTimeSeconds", capacity: "capacity",
        };
        const field = entry.productionField;
        if (field in directFields) {
          const val = (prodAddon.data as ProductionAddonDraft)[directFields[field] as keyof ProductionAddonDraft];
          if (typeof val === "number") return val;
        }
      }
    }
    return entry.value;
  };

  const libraryEntriesById = useMemo(() => {
    // Map: `${libraryAddonId}:${entryId}` → { key, label }
    const map = new Map<string, { key: string; label: string }>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sa of section.addons || []) {
          if (sa.type !== "fieldLibrary") continue;
          const data = sa.data as FieldLibraryAddonDraft;
          for (const e of data.entries || []) {
            map.set(`${sa.id}:${e.id}`, { key: e.key, label: e.label || e.key });
          }
        }
      }
    }
    return map;
  }, [projects]);

  const resolveEntryLabel = (entry: DataSchemaEntry): string => {
    if (!entry.libraryRef) return entry.label || entry.key || "-";
    const match = libraryEntriesById.get(`${entry.libraryRef.libraryAddonId}:${entry.libraryRef.entryId}`);
    return match?.label || entry.label || entry.key || "-";
  };

  const xpRefLabelBySectionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        if (map.has(section.id)) continue;
        const xpAddon = (section.addons || []).find((sectionAddon) => sectionAddon.type === "xpBalance");
        if (!xpAddon) continue;
        const sectionTitle = section.title?.trim() || section.id;
        const addonName = xpAddon.name?.trim() || "XP";
        map.set(section.id, `${sectionTitle} - ${addonName}`);
      }
    }
    return map;
  }, [projects]);

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

  const renderSectionLink = (
    sectionId: string,
    label: string
  ): ReactNode => {
    const sectionMeta = sectionsById.get(sectionId);
    if (!sectionMeta) return label;
    return (
      <a
        href={`#section-${sectionId}`}
        onClick={(event) => {
          event.preventDefault();
          setPendingAnchorNavigation({
            sectionId,
            title: sectionMeta.title,
            shortDescription: toShortDescription(sectionMeta.content),
          });
        }}
        className={`gdd-inline-anchor underline cursor-pointer ${isLight ? "text-blue-600 hover:text-blue-800" : "text-sky-300 hover:text-sky-200"}`}
        title={t("view.anchorPreview.goToSection")}
      >
        {label}
      </a>
    );
  };

  const outerClass = bare
    ? ""
    : `rounded-xl p-3 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"}`;

  return (
    <div className={outerClass}>
      {!bare && (
        <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {addon.name || t("dataSchemaAddon.defaultName", "Schema de Dados")}
        </h5>
      )}

      {rows.length === 0 ? (
        <p className={`${bare ? "" : "mt-2"} text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
          {t("dataSchemaAddon.readOnlyEmpty", "Nenhum campo configurado.")}
        </p>
      ) : (
        <div className={`${bare ? "" : "mt-2"} space-y-1.5 ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {rows.map((entry) => {
            const lineLabel = resolveEntryLabel(entry);
            const linkedXpName = entry.unitXpRef ? xpRefLabelBySectionId.get(entry.unitXpRef) : undefined;
            return (
              <p key={entry.id} className={bare ? "" : "text-sm"}>
                {lineLabel}: {formatValue(resolveEntryValue(entry))}
                {linkedXpName && entry.unitXpRef ? (
                  <>
                    {" "}
                    (
                    {renderSectionLink(entry.unitXpRef, linkedXpName)}
                    )
                  </>
                ) : entry.unit ? (
                  entry.unit
                ) : null}
              </p>
            );
          })}
        </div>
      )}
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

