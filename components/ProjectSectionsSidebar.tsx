"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { useI18n } from "@/lib/i18n/provider";
import { GAME_DESIGN_DOMAIN_IDS } from "@/lib/gameDesignDomains";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  projectId: string;
}

export default function ProjectSectionsSidebar({ projectId }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { user, profile } = useAuthStore();
  const sectionAuditBy = user
    ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null }
    : undefined;

  const getProject = useProjectStore((s) => s.getProject);
  const projects = useProjectStore((s) => s.projects);
  const addSection = useProjectStore((s) => s.addSection);
  const addSubsection = useProjectStore((s) => s.addSubsection);
  const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
  const reorderSections = useProjectStore((s) => s.reorderSections);

  const [mounted, setMounted] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showSectionTopFade, setShowSectionTopFade] = useState(false);
  const [showSectionBottomFade, setShowSectionBottomFade] = useState(false);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [selectedAddonFilters, setSelectedAddonFilters] = useState<string[]>([]);
  const [tagFilterMenuOpen, setTagFilterMenuOpen] = useState(false);
  const [addonFilterMenuOpen, setAddonFilterMenuOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [nameError, setNameError] = useState("");

  const sectionListRef = useRef<HTMLDivElement | null>(null);
  const tagFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const addonFilterMenuRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setProject(getProject(projectId));
  }, [mounted, projectId, projects, getProject]);

  const currentSectionId = useMemo(() => {
    const match = pathname.match(/\/projects\/[^/]+\/sections\/([^/?#]+)/);
    const rawId = match?.[1] ?? null;
    if (!rawId) return null;
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  }, [pathname]);

  const sectionIds = useMemo(
    () => (project?.sections || []).map((s: any) => s.id),
    [project?.sections]
  );

  const availableDomainTags = useMemo(() => {
    const tags = new Set<string>(GAME_DESIGN_DOMAIN_IDS as unknown as string[]);
    (project?.sections || []).forEach((section: any) => {
      const sectionTags = Array.isArray(section?.domainTags) ? section.domainTags : [];
      sectionTags.forEach((tag: string) => {
        if (tag?.trim()) tags.add(tag.trim());
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [project?.sections]);

  const availableAddonTypes = useMemo(() => {
    const addonTypes = new Set<string>();
    (project?.sections || []).forEach((section: any) => {
      const sectionAddons = Array.isArray(section?.addons)
        ? section.addons
        : Array.isArray(section?.balanceAddons)
          ? section.balanceAddons
          : [];
      sectionAddons.forEach((addon: any) => {
        const type = typeof addon?.type === "string" ? addon.type.trim() : "";
        if (type) addonTypes.add(type);
      });
    });
    return Array.from(addonTypes).sort((a, b) =>
      t(`sectionDetail.history.addonType.${a}`, a).localeCompare(
        t(`sectionDetail.history.addonType.${b}`, b)
      )
    );
  }, [project?.sections, t]);

  const updateSectionFades = useCallback(() => {
    const el = sectionListRef.current;
    if (!el) {
      setShowSectionTopFade(false);
      setShowSectionBottomFade(false);
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = el;
    const hasScrollableContent = scrollHeight - clientHeight > 2;
    if (!hasScrollableContent) {
      setShowSectionTopFade(false);
      setShowSectionBottomFade(false);
      return;
    }
    setShowSectionTopFade(scrollTop > 2);
    setShowSectionBottomFade(scrollTop + clientHeight < scrollHeight - 2);
  }, []);

  useEffect(() => {
    updateSectionFades();
    window.addEventListener("resize", updateSectionFades);
    return () => window.removeEventListener("resize", updateSectionFades);
  }, [updateSectionFades, project?.sections, searchTerm, expandedSections]);

  useEffect(() => {
    setSelectedTagFilters((prev) => prev.filter((tag) => availableDomainTags.includes(tag)));
  }, [availableDomainTags]);

  useEffect(() => {
    setSelectedAddonFilters((prev) => prev.filter((type) => availableAddonTypes.includes(type)));
  }, [availableAddonTypes]);

  useEffect(() => {
    if (!tagFilterMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (tagFilterMenuRef.current?.contains(event.target as Node)) return;
      setTagFilterMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [tagFilterMenuOpen]);

  useEffect(() => {
    if (!addonFilterMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (addonFilterMenuRef.current?.contains(event.target as Node)) return;
      setAddonFilterMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [addonFilterMenuOpen]);

  useEffect(() => {
    if (!currentSectionId) return;
    const sections = project?.sections || [];
    if (sections.length === 0) return;

    const sectionById = new Map<string, any>(
      sections.map((section: any) => [section.id, section])
    );
    const currentSection = sectionById.get(currentSectionId);
    if (!currentSection) return;

    const idsToExpand = new Set<string>();

    // Keep lineage visible so current section is always reachable in the tree.
    let cursor: any = currentSection;
    const visited = new Set<string>();
    while (cursor?.parentId && !visited.has(cursor.id)) {
      const parent = sectionById.get(cursor.parentId);
      if (!parent) break;
      idsToExpand.add(parent.id);
      visited.add(cursor.id);
      cursor = parent;
    }

    // If current section has children, open exactly one level for quick navigation.
    const hasChildren = sections.some((section: any) => section.parentId === currentSectionId);
    if (hasChildren) idsToExpand.add(currentSectionId);

    if (idsToExpand.size === 0) return;
    setExpandedSections((prev) => {
      const next = new Set(prev);
      idsToExpand.forEach((id) => next.add(id));
      return next;
    });
  }, [currentSectionId, project?.sections]);

  const canExpandAll = sectionIds.some((id: string) => !expandedSections.has(id));
  const canCollapseAll = expandedSections.size > 0;

  const handleExpandAllSections = () => {
    setExpandedSections(new Set(sectionIds));
  };

  const handleCollapseAllSections = () => {
    setExpandedSections(new Set());
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleAddonFilter = (type: string) => {
    setSelectedAddonFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleAddByContext = () => {
    const title = newSectionTitle.trim();
    if (!title || nameError) return;
    try {
      if (
        currentSectionId &&
        (project?.sections || []).some((section: any) => section.id === currentSectionId)
      ) {
        addSubsection(projectId, currentSectionId, title, "", sectionAuditBy);
      } else {
        addSection(projectId, title, undefined, sectionAuditBy);
      }
      setNewSectionTitle("");
      setNameError("");
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message === "structural_limit_sections_per_project" ||
          e.message === "structural_limit_sections_total")
      ) {
        setNameError(
          e.message === "structural_limit_sections_total"
            ? t("limits.sectionsTotal")
            : t("limits.sectionsPerProject")
        );
      } else {
        throw e;
      }
    }
  };

  if (!mounted || !project) return null;

  return (
    <aside className="relative overflow-hidden bg-gray-800/75 border border-gray-700/80 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/10 h-full flex flex-col">
      <span
        className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10 pointer-events-none"
        aria-hidden
      />

      <div className="relative mb-4" ref={tagFilterMenuRef}>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("projectDetail.sectionsTitle")}</h2>
          <p className="text-sm text-gray-400 mt-1">{t("projectDetail.sectionsSubtitle")}</p>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-indigo-400/45 bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/20 px-2 text-xs font-semibold text-indigo-100 tabular-nums shadow-sm shadow-indigo-900/25">
            {(project.sections || []).length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExpandAllSections}
              disabled={!canExpandAll || sectionIds.length === 0}
              title={t("projectDetail.expandAllSections")}
              aria-label={t("projectDetail.expandAllSections")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-600 bg-gray-900/75 text-gray-200 transition-all duration-150 hover:border-indigo-400 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7l5 5 5-5M7 13l5 5 5-5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleCollapseAllSections}
              disabled={!canCollapseAll}
              title={t("projectDetail.collapseAllSections")}
              aria-label={t("projectDetail.collapseAllSections")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-600 bg-gray-900/75 text-gray-200 transition-all duration-150 hover:border-indigo-400 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 11l-5-5-5 5M17 17l-5-5-5 5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setTagFilterMenuOpen((v) => !v)}
              title={t("projectDetail.tagFilterLabel")}
              aria-label={t("projectDetail.tagFilterLabel")}
              aria-expanded={tagFilterMenuOpen}
              aria-haspopup="true"
              className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border text-gray-200 transition-all duration-150 hover:-translate-y-px ${
                tagFilterMenuOpen || selectedTagFilters.length > 0
                  ? "border-indigo-400 bg-indigo-600/20 text-indigo-100 shadow-md shadow-indigo-900/30"
                  : "border-gray-600 bg-gray-900/75 hover:border-indigo-400 hover:text-white hover:bg-gray-800/90"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
              </svg>
              {selectedTagFilters.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-indigo-500 text-[10px] font-semibold text-white">
                  {selectedTagFilters.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setAddonFilterMenuOpen((v) => !v)}
              title={t("projectDetail.addonFilterLabel")}
              aria-label={t("projectDetail.addonFilterLabel")}
              aria-expanded={addonFilterMenuOpen}
              aria-haspopup="true"
              className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border text-gray-200 transition-all duration-150 hover:-translate-y-px ${
                addonFilterMenuOpen || selectedAddonFilters.length > 0
                  ? "border-fuchsia-400 bg-fuchsia-600/20 text-fuchsia-100 shadow-md shadow-fuchsia-900/30"
                  : "border-gray-600 bg-gray-900/75 hover:border-fuchsia-400 hover:text-white hover:bg-gray-800/90"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10l2 3-3 2v5l-4 2v-7l-3-2 2-3z" />
              </svg>
              {selectedAddonFilters.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-fuchsia-500 text-[10px] font-semibold text-white">
                  {selectedAddonFilters.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {tagFilterMenuOpen && (
          <div className="ui-menu-pop absolute z-30 right-0 mt-2 w-80 rounded-xl border border-gray-600/90 bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-black/35 p-3">
            <div className="flex items-center justify-between gap-2 px-1 pb-3 border-b border-gray-700/70 mb-3">
              <span className="text-xs font-medium text-gray-300">{t("projectDetail.tagFilterLabel")}</span>
              <button
                type="button"
                onClick={() => setSelectedTagFilters([])}
                disabled={selectedTagFilters.length === 0}
                className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("projectDetail.tagFilterClear")}
              </button>
            </div>
            {availableDomainTags.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 py-3">{t("projectDetail.tagFilterNoTags")}</p>
            ) : (
              <div className="max-h-56 overflow-y-auto scrollbar-premium pr-1 space-y-1.5">
                {availableDomainTags.map((tag) => {
                  const checked = selectedTagFilters.includes(tag);
                  return (
                    <label key={tag} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm cursor-pointer transition-all ${checked ? "border-indigo-400/60 bg-gradient-to-r from-indigo-600/25 to-fuchsia-600/20 text-indigo-100" : "border-gray-700/80 text-gray-200 hover:bg-gray-800/80 hover:border-gray-600"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleTagFilter(tag)} className="sr-only" />
                      <span aria-hidden="true" className={`inline-flex h-4 w-4 items-center justify-center rounded border transition-all duration-150 ${checked ? "border-indigo-300/80 bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-sm shadow-indigo-900/30" : "border-gray-500 bg-gray-900/70"}`}>
                        {checked && (
                          <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{t(`sectionDetail.domain.${tag}`, tag)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {addonFilterMenuOpen && (
          <div ref={addonFilterMenuRef} className="ui-menu-pop absolute z-30 right-0 mt-2 w-80 rounded-xl border border-gray-600/90 bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-black/35 p-3">
            <div className="flex items-center justify-between gap-2 px-1 pb-3 border-b border-gray-700/70 mb-3">
              <span className="text-xs font-medium text-gray-300">{t("projectDetail.addonFilterLabel")}</span>
              <button
                type="button"
                onClick={() => setSelectedAddonFilters([])}
                disabled={selectedAddonFilters.length === 0}
                className="text-xs text-fuchsia-300 hover:text-fuchsia-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("projectDetail.addonFilterClear")}
              </button>
            </div>
            {availableAddonTypes.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 py-3">{t("projectDetail.addonFilterNoAddons")}</p>
            ) : (
              <div className="max-h-56 overflow-y-auto scrollbar-premium pr-1 space-y-1.5">
                {availableAddonTypes.map((type) => {
                  const checked = selectedAddonFilters.includes(type);
                  return (
                    <label key={type} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm cursor-pointer transition-all ${checked ? "border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-600/25 to-indigo-600/20 text-fuchsia-100" : "border-gray-700/80 text-gray-200 hover:bg-gray-800/80 hover:border-gray-600"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleAddonFilter(type)} className="sr-only" />
                      <span aria-hidden="true" className={`inline-flex h-4 w-4 items-center justify-center rounded border transition-all duration-150 ${checked ? "border-fuchsia-300/80 bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow-sm shadow-fuchsia-900/30" : "border-gray-500 bg-gray-900/70"}`}>
                        {checked && (
                          <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{t(`sectionDetail.history.addonType.${type}`, type)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
        </svg>
        <input
          type="text"
          placeholder={t("projectDetail.searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => {
            const term = e.target.value;
            setSearchTerm(term);
            if (term.trim()) {
              const allIds = new Set<string>((project.sections || []).map((s: any) => s.id));
              setExpandedSections(allIds);
            }
          }}
          className="ui-input-dark ui-focus-ring-indigo w-full pl-9 pr-3 py-2.5 text-sm"
        />
      </div>

      <div className="relative flex-1 min-h-0">
        <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-gray-800/90 to-transparent transition-opacity duration-300 ease-out ${showSectionTopFade ? "opacity-90" : "opacity-0"}`} aria-hidden />
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-gray-800/90 to-transparent transition-opacity duration-300 ease-out ${showSectionBottomFade ? "opacity-90" : "opacity-0"}`} aria-hidden />
        <div ref={sectionListRef} onScroll={updateSectionFades} className="scrollbar-premium h-full max-h-[45vh] lg:max-h-none overflow-y-auto overscroll-y-contain pr-1">
          <SectionTree
            sections={project.sections || []}
            projectId={projectId}
            reorderSections={reorderSections}
            sensors={sensors}
            searchTerm={searchTerm}
            selectedTagFilters={selectedTagFilters}
            selectedAddonFilters={selectedAddonFilters}
            activeSectionId={currentSectionId}
            expandedSections={expandedSections}
            setExpandedSections={setExpandedSections}
            labels={{
              resultsFoundOne: t("projectDetail.resultsFoundOne"),
              resultsFoundMany: t("projectDetail.resultsFoundMany"),
              match: t("projectDetail.match"),
              reorder: t("projectDetail.reorder"),
            }}
          />
        </div>
      </div>

      <div className="relative z-20 mt-4 pt-4 border-t border-gray-700/80">
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={newSectionTitle}
            onChange={(e) => {
              const val = e.target.value;
              setNewSectionTitle(val);
              const parentId = currentSectionId ?? undefined;
              if (val.trim() && hasDuplicateName(projectId, val.trim(), parentId)) {
                setNameError(parentId ? t("sectionDetail.subsections.duplicate") : t("projectDetail.rootSectionDuplicate"));
              } else {
                setNameError("");
              }
            }}
            placeholder={
              currentSectionId
                ? t("sectionDetail.subsections.addPlaceholder")
                : t("projectDetail.newSectionPlaceholder")
            }
            className={`ui-input-dark ui-focus-ring-indigo flex-1 min-w-[160px] px-3 py-2 text-sm ${nameError ? "border-red-500" : "border-gray-600"}`}
          />
          <button
            onClick={handleAddByContext}
            className="ui-btn-primary-gradient relative z-20 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-900/30 disabled:opacity-100 disabled:brightness-75 disabled:saturate-50 disabled:cursor-not-allowed"
            disabled={!newSectionTitle.trim() || !!nameError}
          >
            <span className="text-base leading-none">+</span>
            {t("projectDetail.add")}
          </button>
        </div>
        {nameError && <span className="text-red-400 text-sm mt-1 block">{nameError}</span>}
      </div>
    </aside>
  );
}

function SectionTree({
  sections,
  projectId,
  reorderSections,
  sensors,
  searchTerm,
  selectedTagFilters,
  selectedAddonFilters,
  activeSectionId,
  expandedSections,
  setExpandedSections,
  labels,
}: {
  sections: any[];
  projectId: string;
  reorderSections: any;
  sensors: any;
  searchTerm: string;
  selectedTagFilters: string[];
  selectedAddonFilters: string[];
  activeSectionId: string | null;
  expandedSections: Set<string>;
  setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  labels: {
    resultsFoundOne: string;
    resultsFoundMany: string;
    match: string;
    reorder: string;
  };
}) {
  const matchesSearch = (section: any): boolean => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const titleMatch = section.title.toLowerCase().includes(term);
    const contentMatch = section.content?.toLowerCase().includes(term) || false;
    return titleMatch || contentMatch;
  };

  const matchesTags = (section: any): boolean => {
    if (selectedTagFilters.length === 0) return true;
    const sectionTags = Array.isArray(section?.domainTags) ? section.domainTags : [];
    return sectionTags.some((tag: string) => selectedTagFilters.includes(tag));
  };

  const matchesAddons = (section: any): boolean => {
    if (selectedAddonFilters.length === 0) return true;
    const sectionAddons = Array.isArray(section?.addons)
      ? section.addons
      : Array.isArray(section?.balanceAddons)
        ? section.balanceAddons
        : [];
    const addonTypes = sectionAddons
      .map((addon: any) => (typeof addon?.type === "string" ? addon.type : ""))
      .filter(Boolean);
    return addonTypes.some((type: string) => selectedAddonFilters.includes(type));
  };

  const matchesFilters = (section: any): boolean =>
    matchesSearch(section) && matchesTags(section) && matchesAddons(section);

  const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
    const section = allSections.find((s) => s.id === sectionId);
    if (!section) return false;
    if (matchesFilters(section)) return true;
    const children = allSections.filter((s) => s.parentId === sectionId);
    return children.some((child) => sectionMatchesOrHasMatchingChildren(child.id, allSections));
  };

  const roots = sections
    .filter((s) => !s.parentId)
    .filter((s) => sectionMatchesOrHasMatchingChildren(s.id, sections))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const totalMatches =
    searchTerm.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0
      ? sections.filter(matchesFilters).length
      : 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = roots.findIndex((r) => r.id === active.id);
    const newIndex = roots.findIndex((r) => r.id === over.id);
    const newRoots = arrayMove(roots, oldIndex, newIndex);
    const newOrder = newRoots.map((r) => r.id);
    reorderSections(projectId, newOrder);
  }

  return (
    <>
      {(searchTerm.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0) &&
        totalMatches > 0 && (
          <p className="text-sm text-gray-400 mb-2 ml-1">
            {totalMatches} {totalMatches === 1 ? labels.resultsFoundOne : labels.resultsFoundMany}
          </p>
        )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={roots.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {roots.map((sec) => (
              <SortableRootItem
                key={sec.id}
                section={sec}
                sections={sections}
                projectId={projectId}
                searchTerm={searchTerm}
                selectedTagFilters={selectedTagFilters}
                selectedAddonFilters={selectedAddonFilters}
                activeSectionId={activeSectionId}
                expandedSections={expandedSections}
                setExpandedSections={setExpandedSections}
                labels={labels}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </>
  );
}

function SortableRootItem({
  section,
  sections,
  projectId,
  searchTerm,
  selectedTagFilters,
  selectedAddonFilters,
  activeSectionId,
  expandedSections,
  setExpandedSections,
  labels,
}: {
  section: any;
  sections: any[];
  projectId: string;
  searchTerm: string;
  selectedTagFilters: string[];
  selectedAddonFilters: string[];
  activeSectionId: string | null;
  expandedSections: Set<string>;
  setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  labels: {
    match: string;
    reorder: string;
  };
}) {
  const highlightText = (text: string, term?: string) => {
    if (!term || !term.trim()) return text;
    const regex = new RegExp(`(${term})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
    );
  };

  const matchesDirectly = (sec: any): boolean => {
    if (!searchTerm || !searchTerm.trim()) return false;
    const term = searchTerm.toLowerCase();
    return sec.title.toLowerCase().includes(term) || sec.content?.toLowerCase().includes(term);
  };

  const getContentSnippet = (content: string, term: string): string => {
    if (!content || !term) return "";
    const lowerContent = content.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const index = lowerContent.indexOf(lowerTerm);
    if (index === -1) return "";
    const start = Math.max(0, index - 40);
    const end = Math.min(content.length, index + term.length + 40);
    let snippet = content.substring(start, end);
    if (start > 0) snippet = "..." + snippet;
    if (end < content.length) snippet = snippet + "...";
    return snippet;
  };

  const directMatch = matchesDirectly(section);
  const contentSnippet = directMatch && section.content ? getContentSnippet(section.content, searchTerm) : "";
  const isActiveSection = activeSectionId === section.id;
  const hasChildren = sections.some((s: any) => s.parentId === section.id);
  const isExpanded =
    expandedSections.has(section.id) ||
    searchTerm.trim() ||
    selectedTagFilters.length > 0 ||
    selectedAddonFilters.length > 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="mb-2">
      <div className={`group relative overflow-hidden flex items-center gap-2 border p-2.5 rounded-xl transition-all duration-150 ${isActiveSection ? "border-indigo-300/70 bg-indigo-600/20 shadow-md shadow-indigo-900/25" : "border-gray-700 bg-gray-900/70 hover:border-indigo-500/60 hover:-translate-y-px"}`}>
        <span className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none" aria-hidden />
        <span className="relative text-gray-400 cursor-grab active:cursor-grabbing" {...attributes} {...listeners} aria-label={labels.reorder}>
          ⋮⋮
        </span>
        {hasChildren ? (
          <button
            onClick={() => {
              const next = new Set(expandedSections);
              if (next.has(section.id)) next.delete(section.id);
              else next.add(section.id);
              setExpandedSections(next);
            }}
            className={`relative inline-flex items-center justify-center h-5 w-5 rounded-md border text-sm transition-colors ${isActiveSection ? "border-indigo-300/60 text-indigo-100 bg-indigo-500/20" : "border-gray-600 text-gray-300 hover:text-white hover:border-indigo-400"}`}
          >
            {isExpanded ? "−" : "+"}
          </button>
        ) : null}
        {section?.thumbImageUrl && (
          <img
            src={section.thumbImageUrl}
            alt=""
            loading="lazy"
            className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-gray-600/80 object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
        <Link
          href={`/projects/${projectId}/sections/${section.id}`}
          prefetch={false}
          className={`relative flex-1 min-w-0 truncate text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset rounded px-0.5 ${isActiveSection ? "text-indigo-100 font-semibold" : "text-blue-300 hover:text-blue-200"}`}
        >
          {highlightText(section.title, searchTerm)}
        </Link>
        {directMatch && searchTerm.trim() && (
          <span className="relative text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">
            ✓ {labels.match}
          </span>
        )}
      </div>
      {contentSnippet && (
        <div className="ml-8 text-xs text-gray-300 italic mt-1 bg-yellow-950/30 border border-yellow-700/60 p-2 rounded-lg">
          {highlightText(contentSnippet, searchTerm)}
        </div>
      )}
      {hasChildren && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
            <SectionChildren
              parentId={section.id}
              sections={sections}
              projectId={projectId}
              searchTerm={searchTerm}
              selectedTagFilters={selectedTagFilters}
              selectedAddonFilters={selectedAddonFilters}
              activeSectionId={activeSectionId}
              expandedSections={expandedSections}
              setExpandedSections={setExpandedSections}
              labels={labels}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function SectionChildren({
  parentId,
  sections,
  projectId,
  searchTerm,
  selectedTagFilters,
  selectedAddonFilters,
  activeSectionId,
  expandedSections,
  setExpandedSections,
  labels,
}: {
  parentId: string;
  sections: any[];
  projectId: string;
  searchTerm?: string;
  selectedTagFilters: string[];
  selectedAddonFilters: string[];
  activeSectionId: string | null;
  expandedSections: Set<string>;
  setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  labels: {
    match: string;
  };
}) {
  const matchesSearch = (section: any): boolean => {
    if (!searchTerm || !searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const titleMatch = section.title.toLowerCase().includes(term);
    const contentMatch = section.content?.toLowerCase().includes(term) || false;
    return titleMatch || contentMatch;
  };

  const matchesTags = (section: any): boolean => {
    if (selectedTagFilters.length === 0) return true;
    const sectionTags = Array.isArray(section?.domainTags) ? section.domainTags : [];
    return sectionTags.some((tag: string) => selectedTagFilters.includes(tag));
  };

  const matchesAddons = (section: any): boolean => {
    if (selectedAddonFilters.length === 0) return true;
    const sectionAddons = Array.isArray(section?.addons)
      ? section.addons
      : Array.isArray(section?.balanceAddons)
        ? section.balanceAddons
        : [];
    const addonTypes = sectionAddons
      .map((addon: any) => (typeof addon?.type === "string" ? addon.type : ""))
      .filter(Boolean);
    return addonTypes.some((type: string) => selectedAddonFilters.includes(type));
  };

  const matchesFilters = (section: any): boolean =>
    matchesSearch(section) && matchesTags(section) && matchesAddons(section);

  const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
    const section = allSections.find((s) => s.id === sectionId);
    if (!section) return false;
    if (matchesFilters(section)) return true;
    const children = allSections.filter((s) => s.parentId === sectionId);
    return children.some((child) => sectionMatchesOrHasMatchingChildren(child.id, allSections));
  };

  const kids = sections
    .filter((s) => s.parentId === parentId)
    .filter((s) => sectionMatchesOrHasMatchingChildren(s.id, sections))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const highlightText = (text: string, term?: string) => {
    if (!term || !term.trim()) return text;
    const regex = new RegExp(`(${term})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
    );
  };

  const getContentSnippet = (content: string, term: string): string => {
    if (!content || !term) return "";
    const lowerContent = content.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const index = lowerContent.indexOf(lowerTerm);
    if (index === -1) return "";
    const start = Math.max(0, index - 40);
    const end = Math.min(content.length, index + term.length + 40);
    let snippet = content.substring(start, end);
    if (start > 0) snippet = "..." + snippet;
    if (end < content.length) snippet = snippet + "...";
    return snippet;
  };

  if (kids.length === 0) return null;

  return (
    <ul className="ml-4 mt-2 pl-3 border-l border-gray-700/70 space-y-2">
      {kids.map((sec) => {
        const directMatch = matchesSearch(sec);
        const contentSnippet =
          directMatch && sec.content && searchTerm ? getContentSnippet(sec.content, searchTerm) : "";
        const hasChildren = sections.some((s: any) => s.parentId === sec.id);
        const isExpanded =
          expandedSections.has(sec.id) ||
          searchTerm?.trim() ||
          selectedTagFilters.length > 0 ||
          selectedAddonFilters.length > 0;
        const isActiveSection = activeSectionId === sec.id;

        return (
          <li key={sec.id} className="mb-2">
            <div className={`group relative overflow-hidden flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${isActiveSection ? "border-indigo-300/60 bg-indigo-600/20" : "border-gray-700/80 bg-gray-900/50 hover:border-indigo-500/50"}`}>
              {hasChildren ? (
                <button
                  onClick={() => {
                    const next = new Set(expandedSections);
                    if (next.has(sec.id)) next.delete(sec.id);
                    else next.add(sec.id);
                    setExpandedSections(next);
                  }}
                  className={`inline-flex items-center justify-center h-5 w-5 rounded-md border text-sm transition-colors ${isActiveSection ? "border-indigo-300/60 text-indigo-100 bg-indigo-500/20" : "border-gray-600 text-gray-300 hover:text-white hover:border-indigo-400"}`}
                >
                  {isExpanded ? "−" : "+"}
                </button>
              ) : null}
              {sec?.thumbImageUrl && (
                <img
                  src={sec.thumbImageUrl}
                  alt=""
                  loading="lazy"
                  className="h-6 w-6 shrink-0 overflow-hidden rounded-md border border-gray-600/80 object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              )}
              <Link
                href={`/projects/${projectId}/sections/${sec.id}`}
                prefetch={false}
                className={`flex-1 min-w-0 truncate text-sm transition-colors ${isActiveSection ? "text-indigo-100 font-semibold" : "text-blue-300 hover:text-blue-200"}`}
              >
                {highlightText(sec.title, searchTerm)}
              </Link>
              {directMatch && searchTerm && searchTerm.trim() && (
                <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">
                  ✓ {labels.match}
                </span>
              )}
            </div>
            {contentSnippet && (
              <div className="text-xs text-gray-300 italic mt-1 bg-yellow-950/30 border border-yellow-700/60 p-2 rounded ml-4">
                {highlightText(contentSnippet, searchTerm || "")}
              </div>
            )}
            {hasChildren && (
              <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <SectionChildren
                    parentId={sec.id}
                    sections={sections}
                    projectId={projectId}
                    searchTerm={searchTerm}
                    selectedTagFilters={selectedTagFilters}
                    selectedAddonFilters={selectedAddonFilters}
                    activeSectionId={activeSectionId}
                    expandedSections={expandedSections}
                    setExpandedSections={setExpandedSections}
                    labels={labels}
                  />
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
