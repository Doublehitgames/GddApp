"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import RoadmapGrid from "@/components/roadmap/RoadmapGrid";
import { useI18n } from "@/lib/i18n/provider";
import { ITEM_TAGS, ITEM_TAG_CONFIG } from "@/lib/roadmap/types";
import type { ItemStatus, RoadmapItemTag } from "@/lib/roadmap/types";

interface Props { projectId: string; }

export default function RoadmapClient({ projectId }: Props) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const getProjectBySlug   = useProjectStore((s) => s.getProjectBySlug);
  const projects           = useProjectStore((s) => s.projects);
  const getRoadmaps        = useProjectStore((s) => s.getRoadmaps);
  const getActiveRoadmapId = useProjectStore((s) => s.getActiveRoadmapId);
  const createRoadmap      = useProjectStore((s) => s.createRoadmap);
  const updateRoadmap      = useProjectStore((s) => s.updateRoadmap);
  const getRoadmapPhases   = useProjectStore((s) => s.getRoadmapPhases);
  const getRoadmapThemes   = useProjectStore((s) => s.getRoadmapThemes);
  const getRoadmapItems    = useProjectStore((s) => s.getRoadmapItems);
  const addRoadmapPhase    = useProjectStore((s) => s.addRoadmapPhase);
  const updateRoadmapPhase = useProjectStore((s) => s.updateRoadmapPhase);
  const deleteRoadmapPhase = useProjectStore((s) => s.deleteRoadmapPhase);
  const addRoadmapTheme    = useProjectStore((s) => s.addRoadmapTheme);
  const updateRoadmapTheme = useProjectStore((s) => s.updateRoadmapTheme);
  const deleteRoadmapTheme = useProjectStore((s) => s.deleteRoadmapTheme);
  const addRoadmapItem       = useProjectStore((s) => s.addRoadmapItem);
  const updateRoadmapItem    = useProjectStore((s) => s.updateRoadmapItem);
  const deleteRoadmapItem    = useProjectStore((s) => s.deleteRoadmapItem);
  const reorderRoadmapPhases = useProjectStore((s) => s.reorderRoadmapPhases);
  const reorderRoadmapThemes = useProjectStore((s) => s.reorderRoadmapThemes);
  const reorderRoadmapItems  = useProjectStore((s) => s.reorderRoadmapItems);

  const roadmapsByProject = useProjectStore((s) => s.roadmapsByProject);
  const phasesByProject   = useProjectStore((s) => s.phasesByProject);
  const themesByProject   = useProjectStore((s) => s.themesByProject);
  const itemsByProject    = useProjectStore((s) => s.itemsByProject);

  const currentUser = useAuthStore((s) => s.user);

  const project       = useMemo(() => getProjectBySlug(projectId), [getProjectBySlug, projectId, projects]);
  const realProjectId = project?.id ?? projectId;

  // Membro = não é o dono do projeto
  const isOwner  = !project?.ownerId || project.ownerId === currentUser?.id;
  const isMember = !isOwner;

  // ── Roadmap selector state ────────────────────────────────────────────────

  const [viewingRoadmapId, setViewingRoadmapId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown]         = useState(false);
  const [showEndModal, setShowEndModal]         = useState(false);
  const [newRoadmapNameDraft, setNewRoadmapNameDraft] = useState("");
  const [isRenamingId, setIsRenamingId]         = useState<string | null>(null);
  const [renameDraft, setRenameDraft]           = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autoInitRef = useRef(false);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [showFilters, setShowFilters]       = useState(false);
  const [filterStatuses, setFilterStatuses] = useState<ItemStatus[]>([]);
  const [filterTags, setFilterTags]         = useState<RoadmapItemTag[]>([]);

  const activeFilterCount = filterStatuses.length + filterTags.length;

  function toggleStatus(s: ItemStatus) {
    setFilterStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }
  function toggleTag(tag: RoadmapItemTag) {
    setFilterTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  }
  function clearFilters() {
    setFilterStatuses([]);
    setFilterTags([]);
  }

  const roadmaps        = useMemo(() => getRoadmaps(realProjectId), [getRoadmaps, realProjectId, roadmapsByProject]);
  const activeRoadmapId = useMemo(() => getActiveRoadmapId(realProjectId), [getActiveRoadmapId, realProjectId, roadmapsByProject]);

  const currentRoadmapId = viewingRoadmapId ?? activeRoadmapId ?? "";
  const currentRoadmap   = roadmaps.find((r) => r.id === currentRoadmapId) ?? null;
  const isReadOnly       = currentRoadmap?.status === "archived";

  // Auto-create first roadmap for new projects
  useEffect(() => {
    if (!mounted || !realProjectId || autoInitRef.current) return;
    autoInitRef.current = true;
    if (!getActiveRoadmapId(realProjectId)) {
      const newId = createRoadmap(realProjectId, t("roadmap.multiRoadmap.defaultName"));
      setViewingRoadmapId(newId);
    }
  }, [mounted, realProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click-outside for dropdown
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setIsRenamingId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const phases = useMemo(
    () => currentRoadmapId ? getRoadmapPhases(realProjectId, currentRoadmapId) : [],
    [getRoadmapPhases, realProjectId, currentRoadmapId, phasesByProject],
  );
  const themes = useMemo(
    () => currentRoadmapId ? getRoadmapThemes(realProjectId, currentRoadmapId) : [],
    [getRoadmapThemes, realProjectId, currentRoadmapId, themesByProject],
  );
  const items = useMemo(
    () => currentRoadmapId ? getRoadmapItems(realProjectId, currentRoadmapId) : [],
    [getRoadmapItems, realProjectId, currentRoadmapId, itemsByProject],
  );

  // Filtered items — used for grid display
  const filteredItems = useMemo(() => {
    let result = items;
    if (filterStatuses.length > 0) result = result.filter((i) => filterStatuses.includes(i.status));
    if (filterTags.length > 0)     result = result.filter((i) => !!i.tag && filterTags.includes(i.tag));
    return result;
  }, [items, filterStatuses, filterTags]);

  // Phase progress — always computed from unfiltered items
  const phaseProgress = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    for (const phase of phases) {
      const pi = items.filter((i) => i.phaseId === phase.id);
      map[phase.id] = { done: pi.filter((i) => i.status === "done").length, total: pi.length };
    }
    return map;
  }, [items, phases]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleEndRoadmap() {
    if (!currentRoadmapId || !realProjectId) return;
    updateRoadmap(realProjectId, currentRoadmapId, { status: "archived" });
    const defaultName = t("roadmap.multiRoadmap.defaultName").replace("1", String(roadmaps.length + 1));
    const name = newRoadmapNameDraft.trim() || defaultName;
    const newId = createRoadmap(realProjectId, name);
    setViewingRoadmapId(newId);
    setShowEndModal(false);
    setNewRoadmapNameDraft("");
  }

  function handleCreateNew() {
    if (!realProjectId) return;
    const defaultName = t("roadmap.multiRoadmap.defaultName").replace("1", String(roadmaps.length + 1));
    const name = newRoadmapNameDraft.trim() || defaultName;
    const newId = createRoadmap(realProjectId, name);
    setViewingRoadmapId(newId);
    setShowDropdown(false);
    setNewRoadmapNameDraft("");
  }

  function handleReactivate() {
    if (!currentRoadmapId || !realProjectId) return;
    // Archive the current active roadmap (if any) before reactivating this one
    if (activeRoadmapId && activeRoadmapId !== currentRoadmapId) {
      updateRoadmap(realProjectId, activeRoadmapId, { status: "archived" });
    }
    updateRoadmap(realProjectId, currentRoadmapId, { status: "active" });
  }

  function commitRename() {
    if (!isRenamingId || !realProjectId) return;
    const name = renameDraft.trim();
    if (name) updateRoadmap(realProjectId, isRenamingId, { name });
    setIsRenamingId(null);
    setRenameDraft("");
  }

  if (!mounted) return <div className="min-h-screen bg-gray-950" />;

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Top bar */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm px-4 py-3 sm:px-6 relative z-30">
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon */}
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>

          <h1 className="text-base font-semibold text-white shrink-0">{t("roadmap.pageTitle")}</h1>

          {/* Roadmap selector */}
          <div ref={dropdownRef} className="relative ml-1">
            <button
              type="button"
              onClick={() => setShowDropdown((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700/60 bg-gray-800/60 px-3 py-1.5 text-sm text-white hover:bg-gray-700/60 transition-colors"
            >
              {currentRoadmap ? (
                <>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isReadOnly ? "bg-gray-500" : "bg-emerald-400"}`} />
                  <span className="max-w-[140px] truncate">{currentRoadmap.name}</span>
                  {isReadOnly && (
                    <span className="shrink-0 rounded border border-gray-700 px-1 text-[10px] text-gray-500">
                      {t("roadmap.multiRoadmap.statusArchived")}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-gray-500">...</span>
              )}
              <svg className="h-3 w-3 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-1.5 flex flex-col gap-0.5">
                {/* Roadmap list */}
                {roadmaps.map((r) => (
                  <div key={r.id} className="flex items-center gap-1 group/item">
                    {isRenamingId === r.id ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") { setIsRenamingId(null); }
                        }}
                        onBlur={commitRename}
                        className="flex-1 rounded-lg bg-gray-800 border border-gray-600 px-2 py-1.5 text-sm text-white outline-none"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => { setViewingRoadmapId(r.id); setShowDropdown(false); }}
                          className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-gray-800 ${r.id === currentRoadmapId ? "bg-gray-800/60" : ""}`}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${r.status === "active" ? "bg-emerald-400" : "bg-gray-600"}`} />
                          <span className={`flex-1 truncate ${r.id === currentRoadmapId ? "font-semibold text-white" : "text-gray-400"}`}>
                            {r.name}
                          </span>
                          {r.status === "archived" && (
                            <span className="shrink-0 text-[10px] text-gray-600">{t("roadmap.multiRoadmap.statusArchived")}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsRenamingId(r.id); setRenameDraft(r.name); }}
                          className="shrink-0 p-1.5 text-gray-700 opacity-0 group-hover/item:opacity-100 hover:text-gray-300 transition-all"
                          title={t("roadmap.multiRoadmap.rename")}
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                ))}

                {/* Divider + actions */}
                <div className="border-t border-gray-800 pt-1 mt-0.5 flex flex-col gap-0.5">
                  {/* End active + create new */}
                  {!isReadOnly && currentRoadmapId && (
                    <button
                      type="button"
                      onClick={() => { setShowDropdown(false); setShowEndModal(true); setNewRoadmapNameDraft(`Roadmap v${roadmaps.length + 1}`); }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-amber-400 hover:bg-amber-950/20 transition-colors text-left"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t("roadmap.multiRoadmap.endAction")}
                    </button>
                  )}

                  {/* Reactivate (when viewing archived) */}
                  {isReadOnly && (
                    <button
                      type="button"
                      onClick={() => { handleReactivate(); setShowDropdown(false); }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-950/20 transition-colors text-left"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t("roadmap.multiRoadmap.reactivate")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Phase / theme count */}
          {phases.length > 0 && (
            <span className="text-xs text-gray-600 hidden sm:block">
              {phases.length} {t("roadmap.grid.phasesCount")} · {themes.length} {t("roadmap.grid.themesCount")}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors shrink-0 ${
              showFilters || activeFilterCount > 0
                ? "border-violet-600/60 bg-violet-950/40 text-violet-300"
                : "border-gray-700/60 text-gray-400 hover:text-gray-300 hover:border-gray-600"
            }`}
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            {t("roadmap.filter.label")}
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View document link */}
          <a
            href={`/projects/${projectId}/view#roadmap-section`}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-700/60 px-3 py-1.5 text-xs text-gray-400 hover:text-violet-300 hover:border-violet-700/50 transition-colors shrink-0"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t("roadmap.viewDocument")}
          </a>

          {/* Export PDF link */}
          <a
            href={`/projects/${projectId}/roadmap/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-700/60 px-3 py-1.5 text-xs text-gray-400 hover:text-violet-300 hover:border-violet-700/50 transition-colors shrink-0"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            {t("roadmap.print.export")}
          </a>

          {/* Member read-only badge */}
          {isMember && (
            <span className="ml-auto flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1 text-xs text-gray-400 shrink-0">
              <svg className="h-3 w-3 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {t("roadmap.readOnly.badge")}
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-800 bg-gray-900/60 px-4 py-2.5">
          {/* Status filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 mr-0.5">{t("roadmap.filter.byStatus")}</span>
            {(["planned", "in_progress", "done", "cut"] as ItemStatus[]).map((s) => {
              const active = filterStatuses.includes(s);
              const dotCls = { planned: "bg-slate-500", in_progress: "bg-sky-400", done: "bg-emerald-400", cut: "bg-rose-500" }[s];
              const activeCls = { planned: "border-slate-600 bg-slate-800/60 text-slate-300", in_progress: "border-sky-700/60 bg-sky-950/50 text-sky-300", done: "border-emerald-700/60 bg-emerald-950/50 text-emerald-300", cut: "border-rose-700/40 bg-rose-950/30 text-rose-400" }[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${active ? activeCls : "border-gray-700/60 text-gray-600 hover:border-gray-600 hover:text-gray-400"}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotCls}`} />
                  {t("roadmap.status." + s)}
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="hidden sm:block h-4 w-px bg-gray-800" />

          {/* Tag filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 mr-0.5">{t("roadmap.filter.byTag")}</span>
            {ITEM_TAGS.map((tag) => {
              const cfg = ITEM_TAG_CONFIG[tag];
              const active = filterTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded border px-2 py-0.5 text-[11px] font-bold transition-colors ${active ? cfg.style : "border-gray-700/60 text-gray-600 hover:border-gray-600 hover:text-gray-400"}`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto text-xs text-gray-600 hover:text-rose-400 transition-colors"
            >
              {t("roadmap.filter.clear")}
            </button>
          )}
        </div>
      )}

      {/* Archived banner */}
      {isReadOnly && (
        <div className="shrink-0 flex items-center gap-2 bg-amber-950/30 border-b border-amber-800/40 px-4 py-2 text-xs text-amber-300">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {t("roadmap.multiRoadmap.readOnlyBanner")}
        </div>
      )}

      {/* Member read-only banner */}
      {isMember && (
        <div className="shrink-0 flex items-center gap-2 bg-gray-900/80 border-b border-gray-800 px-4 py-2 text-xs text-gray-400">
          <svg className="h-3.5 w-3.5 shrink-0 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t("roadmap.readOnly.banner")}
        </div>
      )}

      {/* Grid */}
      <div className={`flex-1 overflow-hidden px-4 py-4 sm:px-6 ${isReadOnly ? "pointer-events-none select-none opacity-60" : ""}`}>
        <RoadmapGrid
          projectId={realProjectId}
          readOnly={isMember}
          phases={phases}
          themes={themes}
          items={filteredItems}
          phaseProgress={phaseProgress}
          onAddPhase={(name) => { if (currentRoadmapId) addRoadmapPhase(realProjectId, currentRoadmapId, name); }}
          onUpdatePhase={(phaseId, patch) => updateRoadmapPhase(realProjectId, phaseId, patch)}
          onDeletePhase={(phaseId) => deleteRoadmapPhase(realProjectId, phaseId)}
          onAddTheme={(name) => { if (currentRoadmapId) addRoadmapTheme(realProjectId, currentRoadmapId, name); }}
          onUpdateTheme={(themeId, patch) => updateRoadmapTheme(realProjectId, themeId, patch)}
          onDeleteTheme={(themeId) => deleteRoadmapTheme(realProjectId, themeId)}
          onAddItem={(phaseId, themeId, title) => { if (currentRoadmapId) addRoadmapItem(realProjectId, currentRoadmapId, phaseId, themeId, title); }}
          onUpdateItem={(itemId, patch) => updateRoadmapItem(realProjectId, itemId, patch)}
          onDeleteItem={(itemId) => deleteRoadmapItem(realProjectId, itemId)}
          onReorderPhases={(ids) => { if (currentRoadmapId) reorderRoadmapPhases(realProjectId, currentRoadmapId, ids); }}
          onReorderThemes={(ids) => { if (currentRoadmapId) reorderRoadmapThemes(realProjectId, currentRoadmapId, ids); }}
          onReorderItems={(phaseId, themeId, ids) => reorderRoadmapItems(realProjectId, phaseId, themeId, ids)}
        />
      </div>

      {/* End roadmap modal */}
      {showEndModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowEndModal(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">{t("roadmap.multiRoadmap.endTitle")}</h3>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              {t("roadmap.multiRoadmap.endDescription")}
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500 uppercase tracking-wider">
                {t("roadmap.multiRoadmap.newPlaceholder")}
              </label>
              <input
                autoFocus
                value={newRoadmapNameDraft}
                onChange={(e) => setNewRoadmapNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleEndRoadmap(); if (e.key === "Escape") setShowEndModal(false); }}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-gray-500 placeholder-gray-600"
                placeholder={`Roadmap v${roadmaps.length + 1}`}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleEndRoadmap}
                className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                {t("roadmap.multiRoadmap.endConfirm")}
              </button>
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                className="flex-1 rounded-xl border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                {t("roadmap.multiRoadmap.endCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
