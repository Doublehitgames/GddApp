"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  DataSchemaAddonDraft,
  FieldLibraryAddonDraft,
  ProgressionTableAddonDraft,
} from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { LibraryLabelPath } from "@/components/common/LibraryLabelPath";
import { toSlug } from "@/lib/utils/slug";

interface FieldLibraryAddonReadOnlyProps {
  addon: FieldLibraryAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

type Usage = {
  projectId: string;
  sectionId: string;
  sectionTitle: string;
  where: string;
};

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

export function FieldLibraryAddonReadOnly({ addon, theme = "dark", bare = false }: FieldLibraryAddonReadOnlyProps) {
  const { t } = useI18n();
  const isLight = theme === "light";
  const entries = addon.entries || [];
  const projects = useProjectStore((state) => state.projects);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
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

  /** Map entryId → list of places that reference it via libraryRef. */
  const usagesByEntryId = useMemo(() => {
    const map = new Map<string, Usage[]>();
    for (const entry of entries) map.set(entry.id, []);
    for (const project of projects) {
      for (const section of project.sections || []) {
        const sectionTitle = section.title?.trim() || section.id;
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type === "dataSchema" || sectionAddon.type === "genericStats") {
            const data = sectionAddon.data as DataSchemaAddonDraft;
            const schemaName = sectionAddon.name || data.name || "Schema";
            for (const dsEntry of data.entries || []) {
              if (
                dsEntry.libraryRef?.libraryAddonId === addon.id &&
                map.has(dsEntry.libraryRef.entryId)
              ) {
                map.get(dsEntry.libraryRef.entryId)!.push({
                  projectId: project.id,
                  sectionId: section.id,
                  sectionTitle,
                  where: `${schemaName} (Data Schema)`,
                });
              }
            }
            continue;
          }
          if (sectionAddon.type === "progressionTable") {
            const data = sectionAddon.data as ProgressionTableAddonDraft;
            const tableName = sectionAddon.name || data.name || "Tabela";
            for (const col of data.columns || []) {
              if (
                col.libraryRef?.libraryAddonId === addon.id &&
                map.has(col.libraryRef.entryId)
              ) {
                map.get(col.libraryRef.entryId)!.push({
                  projectId: project.id,
                  sectionId: section.id,
                  sectionTitle,
                  where: `${tableName} (Tabela)`,
                });
              }
            }
            continue;
          }
        }
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, addon.id, entries.map((e) => e.id).join("|")]);

  // Close anchor preview on click-outside/Escape
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

  const renderSectionLink = (sectionId: string, label: string): ReactNode => {
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

  const totalCount = entries.length;
  const totalUsages = Array.from(usagesByEntryId.values()).reduce((acc, list) => acc + list.length, 0);

  const shellClass = bare
    ? ""
    : isLight
    ? "rounded-xl border border-gray-300 bg-white p-3"
    : "rounded-xl border border-gray-700 bg-gray-900/40 p-3";
  const titleClass = isLight ? "text-gray-900" : "text-gray-200";
  const mutedClass = isLight ? "text-gray-500" : "text-gray-400";
  const subtleClass = isLight ? "text-gray-600" : "text-gray-400";
  const headerRowClass = isLight
    ? "bg-gray-100 text-gray-600"
    : "bg-gray-800/70 text-gray-400";
  const rowBorderClass = isLight ? "border-gray-200" : "border-gray-800";
  const badgeNeutralClass = isLight
    ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
    : "bg-gray-700/70 text-gray-200 hover:bg-gray-600/80";
  const badgeMutedClass = isLight
    ? "bg-gray-100 text-gray-400"
    : "bg-gray-800/60 text-gray-500";

  return (
    <div className={shellClass}>
      {/* Header: title + count summary */}
      {!bare && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h5 className={`text-sm font-semibold ${titleClass}`}>
            {addon.name || t("fieldLibraryAddon.defaultName", "Biblioteca de Campos")}
          </h5>
          <div className={`text-xs ${mutedClass}`}>
            {t("fieldLibraryAddon.summaryCount", "{count} campos definidos").replace(
              "{count}",
              String(totalCount)
            )}
            {totalUsages > 0 && (
              <span className="ml-1.5">
                {"· "}
                {t("fieldLibraryAddon.summaryUsages", "{count} usos no projeto").replace(
                  "{count}",
                  String(totalUsages)
                )}
              </span>
            )}
          </div>
        </div>
      )}

      {totalCount === 0 ? (
        <p className={`${bare ? "" : "mt-2"} text-xs ${subtleClass}`}>
          {t("fieldLibraryAddon.readOnlyEmpty", "Nenhum campo definido.")}
        </p>
      ) : (
        <div className={`${bare ? "" : "mt-3"} overflow-x-auto`}>
          <table className={`w-full ${bare ? "" : "text-sm"}`}>
            <thead>
              <tr className={`text-[11px] uppercase tracking-wide ${headerRowClass}`}>
                <th className="px-2.5 py-1.5 text-left font-semibold">
                  {t("fieldLibraryAddon.readOnlyColLabel", "Nome")}
                </th>
                <th className="px-2.5 py-1.5 text-left font-semibold">
                  {t("fieldLibraryAddon.readOnlyColKey", "Chave")}
                </th>
                <th className="px-2.5 py-1.5 text-left font-semibold">
                  {t("fieldLibraryAddon.readOnlyColDescription", "Descrição")}
                </th>
                <th className="px-2.5 py-1.5 text-left font-semibold w-[140px]">
                  {t("fieldLibraryAddon.readOnlyColUsage", "Usado em")}
                </th>
              </tr>
            </thead>
            <tbody className={isLight ? "text-gray-900" : "text-gray-200"}>
              {entries.map((entry) => {
                const usages = usagesByEntryId.get(entry.id) || [];
                const usageCount = usages.length;
                const isExpanded = expandedEntryId === entry.id;
                return (
                  <Fragment key={entry.id}>
                    <tr className={`border-t ${rowBorderClass}`}>
                      <td className="px-2.5 py-1.5 align-top">
                        <LibraryLabelPath
                          value={entry.label || entry.key}
                          className="font-medium"
                        />
                      </td>
                      <td className="px-2.5 py-1.5 align-top whitespace-nowrap">
                        <code className={`text-xs font-mono ${mutedClass}`}>{entry.key}</code>
                      </td>
                      <td className={`px-2.5 py-1.5 align-top text-xs ${subtleClass}`}>
                        {entry.description || ""}
                      </td>
                      <td className="px-2.5 py-1.5 align-top">
                        {usageCount === 0 ? (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${badgeMutedClass}`}>
                            {t("fieldLibraryAddon.notUsedBadge", "Não usado")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setExpandedEntryId((prev) => (prev === entry.id ? null : entry.id))}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-colors ${badgeNeutralClass}`}
                            aria-expanded={isExpanded}
                          >
                            {t("fieldLibraryAddon.usedInBadge", "{count} usos").replace(
                              "{count}",
                              String(usageCount)
                            )}
                            <span className="text-[9px]" aria-hidden>
                              {isExpanded ? "▲" : "▼"}
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && usageCount > 0 && (
                      <tr className={`border-t ${rowBorderClass}`}>
                        <td colSpan={4} className={`px-2.5 py-2 ${isLight ? "bg-gray-50" : "bg-gray-900/60"}`}>
                          <ul className="space-y-1 text-xs">
                            {usages.map((usage, index) => (
                              <li key={`${usage.sectionId}-${index}`}>
                                {renderSectionLink(usage.sectionId, usage.sectionTitle)}
                                <span className={`ml-1.5 ${mutedClass}`}>— {usage.where}</span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Anchor preview popup — same pattern as DataSchemaAddonReadOnly */}
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
