"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";
import type { PhaseStatus, ItemStatus, RoadmapItem, RoadmapPhase, RoadmapItemTag } from "@/lib/roadmap/types";
import { ITEM_TAG_CONFIG, ITEM_TAGS } from "@/lib/roadmap/types";
import { MarkdownContent } from "@/components/common/MarkdownContent";

const ITEM_STATUS_DOT: Record<ItemStatus, string> = {
  planned:     "bg-slate-400",
  in_progress: "bg-sky-500",
  done:        "bg-emerald-500",
  cut:         "bg-rose-400",
};

const ITEM_STATUS_TEXT: Record<ItemStatus, string> = {
  planned:     "text-slate-700",
  in_progress: "text-sky-700",
  done:        "text-emerald-700 line-through opacity-60",
  cut:         "text-rose-500 line-through opacity-50",
};

const ITEM_STATUS_CHIP: Record<ItemStatus, string> = {
  planned:     "border-slate-200 bg-slate-50 hover:bg-slate-100",
  in_progress: "border-sky-200 bg-sky-50 hover:bg-sky-100",
  done:        "border-emerald-200 bg-emerald-50 hover:bg-emerald-100",
  cut:         "border-rose-200 bg-rose-50 hover:bg-rose-100",
};

const ITEM_STATUS_BADGE: Record<ItemStatus, string> = {
  planned:     "border-slate-200 bg-slate-50 text-slate-600",
  in_progress: "border-sky-200 bg-sky-50 text-sky-700",
  done:        "border-emerald-200 bg-emerald-50 text-emerald-700",
  cut:         "border-rose-200 bg-rose-50 text-rose-600",
};

const PHASE_STATUS_DOT: Record<PhaseStatus, string> = {
  planned:   "bg-slate-400",
  active:    "bg-emerald-500",
  completed: "bg-gray-400",
  cancelled: "bg-rose-400",
};

const PHASE_STATUS_BADGE: Record<PhaseStatus, string> = {
  planned:   "border-slate-200 bg-slate-50 text-slate-600",
  active:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  completed: "border-gray-200 bg-gray-50 text-gray-500",
  cancelled: "border-rose-200 bg-rose-50 text-rose-600",
};

const THEME_BORDER: Record<string, string> = {
  sky:     "border-l-sky-400",
  emerald: "border-l-emerald-400",
  amber:   "border-l-amber-400",
  violet:  "border-l-violet-400",
  rose:    "border-l-rose-400",
  pink:    "border-l-pink-400",
  indigo:  "border-l-indigo-400",
  slate:   "border-l-slate-400",
};

const THEME_TEXT: Record<string, string> = {
  sky:     "text-sky-700",
  emerald: "text-emerald-700",
  amber:   "text-amber-700",
  violet:  "text-violet-700",
  rose:    "text-rose-700",
  pink:    "text-pink-700",
  indigo:  "text-indigo-700",
  slate:   "text-slate-600",
};

const THEME_ROW_BG: Record<string, string> = {
  sky:     "bg-sky-50/60",
  emerald: "bg-emerald-50/60",
  amber:   "bg-amber-50/60",
  violet:  "bg-violet-50/60",
  rose:    "bg-rose-50/60",
  pink:    "bg-pink-50/60",
  indigo:  "bg-indigo-50/60",
  slate:   "bg-slate-50/60",
};

function formatPhaseDate(targetDate?: string, headerType?: string): string | null {
  if (!targetDate || headerType === "title") return null;
  const [y, m] = targetDate.split("-").map(Number);
  switch (headerType) {
    case "month":    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    case "quarter":  return `Q${Math.ceil(m / 3)} ${y}`;
    case "semester": return `S${m <= 6 ? 1 : 2} ${y}`;
    case "year":     return String(y);
    default:         return null;
  }
}

function ItemDetailModal({ item, onClose, t }: { item: RoadmapItem; onClose: () => void; t: (k: string) => string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={ref} className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ITEM_STATUS_DOT[item.status]}`} />
            <h3 className="text-sm font-semibold text-gray-800 leading-snug">{item.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status + tag badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${ITEM_STATUS_BADGE[item.status]}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${ITEM_STATUS_DOT[item.status]}`} />
            {t("roadmap.status." + item.status)}
          </span>
          {item.tag && (
            <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold ${ITEM_TAG_CONFIG[item.tag].docStyle}`}>
              {ITEM_TAG_CONFIG[item.tag].label}
            </span>
          )}
          {!item.isPublic && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-500">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              {t("roadmap.item.private")}
            </span>
          )}
        </div>

        {/* Description */}
        <div className="border-t border-gray-100 pt-3">
          {item.description ? (
            <MarkdownContent theme="light">{item.description}</MarkdownContent>
          ) : (
            <p className="text-xs text-gray-400 italic">{t("roadmap.item.descriptionPlaceholder")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseDetailModal({ phase, onClose, t }: { phase: RoadmapPhase; onClose: () => void; t: (k: string) => string }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const dateLabel = formatPhaseDate(phase.targetDate, phase.headerType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-2xl p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-800 leading-snug">{phase.name}</h3>
          <button type="button" onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PHASE_STATUS_BADGE[phase.status]}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${PHASE_STATUS_DOT[phase.status]}`} />
            {t("roadmap.phaseStatus." + phase.status)}
          </span>
          {dateLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs text-gray-500">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {dateLabel}
            </span>
          )}
        </div>

        {/* Description */}
        <div className="border-t border-gray-100 pt-3">
          {phase.description ? (
            <MarkdownContent theme="light">{phase.description}</MarkdownContent>
          ) : (
            <p className="text-xs text-gray-400 italic">{t("roadmap.phase.descriptionPlaceholder")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  projectId: string;
  /** URL slug — used to build the link to the roadmap manager */
  projectSlug?: string;
}

export default function RoadmapDocView({ projectId, projectSlug }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const getRoadmapPhases   = useProjectStore((s) => s.getRoadmapPhases);
  const getRoadmapThemes   = useProjectStore((s) => s.getRoadmapThemes);
  const getRoadmapItems    = useProjectStore((s) => s.getRoadmapItems);
  const getActiveRoadmapId = useProjectStore((s) => s.getActiveRoadmapId);
  const roadmapsByProject  = useProjectStore((s) => s.roadmapsByProject);

  const activeRoadmapId = useMemo(
    () => getActiveRoadmapId(projectId),
    [getActiveRoadmapId, projectId, roadmapsByProject],
  );

  const allPhases = useMemo(
    () => activeRoadmapId ? getRoadmapPhases(projectId, activeRoadmapId) : [],
    [getRoadmapPhases, projectId, activeRoadmapId],
  );
  const themes    = useMemo(
    () => activeRoadmapId ? getRoadmapThemes(projectId, activeRoadmapId) : [],
    [getRoadmapThemes, projectId, activeRoadmapId],
  );
  const allItems  = useMemo(
    () => activeRoadmapId ? getRoadmapItems(projectId, activeRoadmapId) : [],
    [getRoadmapItems, projectId, activeRoadmapId],
  );

  const phases = allPhases.filter((p) => p.isPublic);
  const items  = allItems.filter((i) => i.isPublic);

  const [selectedItem, setSelectedItem]   = useState<RoadmapItem | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<RoadmapPhase | null>(null);
  const [showNavMenu, setShowNavMenu]     = useState(false);
  const navMenuRef                        = useRef<HTMLDivElement>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterStatuses, setFilterStatuses] = useState<ItemStatus[]>([]);
  const [filterTags, setFilterTags]         = useState<RoadmapItemTag[]>([]);

  const activeFilterCount = filterStatuses.length + filterTags.length;

  function toggleStatus(s: ItemStatus) {
    setFilterStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }
  function toggleTag(tag: RoadmapItemTag) {
    setFilterTags((prev) => prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]);
  }

  useEffect(() => {
    if (!showNavMenu) return;
    const handler = (e: MouseEvent) => {
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) setShowNavMenu(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showNavMenu]);

  // Scroll to section when navigating from the roadmap manager via anchor link
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#roadmap-section") {
      const el = document.getElementById("roadmap-section");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  if (phases.length === 0) return null;

  const itemStatuses: ItemStatus[] = ["planned", "in_progress", "done", "cut"];

  // Apply filters
  const filteredItems = items.filter((i) => {
    if (filterStatuses.length > 0 && !filterStatuses.includes(i.status)) return false;
    if (filterTags.length > 0 && (!i.tag || !filterTags.includes(i.tag))) return false;
    return true;
  });

  return (
    <div id="roadmap-section" className="mt-10 pt-8 border-t-2 border-gray-200">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 shrink-0">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div className="relative" ref={navMenuRef}>
          <button
            type="button"
            onClick={() => setShowNavMenu((v) => !v)}
            className="flex items-center gap-1.5 group/title"
          >
            <h2 className="text-xl font-bold text-gray-800 group-hover/title:text-violet-700 transition-colors">
              {t("roadmap.pageTitle")}
            </h2>
            <svg className="h-4 w-4 text-gray-400 group-hover/title:text-violet-500 transition-colors mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showNavMenu && projectSlug && (
            <div className="absolute left-0 top-full mt-1 z-30 min-w-[200px] rounded-xl border border-gray-200 bg-white shadow-lg py-1">
              <button
                type="button"
                onClick={() => { setShowNavMenu(false); router.push(`/projects/${projectSlug}/roadmap`); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                {t("roadmap.openManager")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
        {/* Status chips */}
        {itemStatuses.map((s) => {
          const active = filterStatuses.includes(s);
          const dotCls = ITEM_STATUS_DOT[s];
          const activeCls = ITEM_STATUS_BADGE[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                active ? activeCls : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotCls}`} />
              {t("roadmap.status." + s)}
            </button>
          );
        })}

        {/* Separator */}
        {ITEM_TAGS.length > 0 && <div className="h-4 w-px bg-gray-200" />}

        {/* Tag chips */}
        {ITEM_TAGS.map((tag) => {
          const cfg = ITEM_TAG_CONFIG[tag];
          const active = filterTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded border px-2 py-0.5 text-[11px] font-bold transition-colors ${
                active ? cfg.docStyle : "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500"
              }`}
            >
              {cfg.label}
            </button>
          );
        })}

        {/* Clear */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => { setFilterStatuses([]); setFilterTags([]); }}
            className="ml-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
          >
            {t("roadmap.filter.clear")}
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-32 shrink-0 border-r border-gray-200 px-3 py-3 text-left">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {t("roadmap.grid.themes")}
                </span>
              </th>
              {phases.map((phase) => {
                const phaseItems = items.filter((i) => i.phaseId === phase.id);
                const done  = phaseItems.filter((i) => i.status === "done").length;
                const total = phaseItems.length;
                return (
                  <th key={phase.id} className="border-r border-gray-200 px-4 py-3 text-left align-top last:border-r-0 min-w-[160px]">
                    <button
                      type="button"
                      onClick={() => setSelectedPhase(phase)}
                      className="flex items-center gap-1.5 text-left group/phase w-full"
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${PHASE_STATUS_DOT[phase.status]}`} />
                      <span className="font-semibold text-gray-800 text-sm group-hover/phase:underline underline-offset-2">
                        {phase.name}
                      </span>
                      {formatPhaseDate(phase.targetDate, phase.headerType) && (
                        <span className="text-[11px] text-gray-400 font-normal">
                          · {formatPhaseDate(phase.targetDate, phase.headerType)}
                        </span>
                      )}
                    </button>
                    {total > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 pl-3.5">
                        <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${done === total ? "bg-emerald-400" : "bg-sky-400"}`}
                            style={{ width: `${Math.round((done / total) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{done}/{total}</span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {themes.map((theme, ti) => (
              <tr key={theme.id} className={`border-b border-gray-100 last:border-b-0 ${THEME_ROW_BG[theme.color] ?? "bg-white"}`}>
                <td className={`border-r border-gray-200 border-l-4 px-3 py-3 align-top ${THEME_BORDER[theme.color] ?? "border-l-gray-300"}`}>
                  <span className={`text-xs font-semibold ${THEME_TEXT[theme.color] ?? "text-gray-600"}`}>
                    {theme.name}
                  </span>
                </td>
                {phases.map((phase) => {
                  const cellItems = filteredItems.filter((i) => i.phaseId === phase.id && i.themeId === theme.id);
                  return (
                    <td key={phase.id} className="border-r border-gray-200 px-4 py-3 align-top last:border-r-0">
                      {cellItems.length === 0 ? (
                        <span className="text-gray-300 text-xs select-none">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {cellItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedItem(item)}
                              title={item.title || undefined}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors max-w-full overflow-hidden ${ITEM_STATUS_CHIP[item.status]}`}
                            >
                              {item.tag && (
                                <span className={`shrink-0 inline-flex items-center rounded px-1 text-[9px] font-bold leading-4 ${ITEM_TAG_CONFIG[item.tag].docStyle}`}>
                                  {ITEM_TAG_CONFIG[item.tag].label}
                                </span>
                              )}
                              <span className={`truncate ${ITEM_STATUS_TEXT[item.status]}`}>{item.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 mb-10 inline-flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
        {itemStatuses.map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className={`h-1.5 w-1.5 rounded-full ${ITEM_STATUS_DOT[s]}`} />
            <span>{t("roadmap.status." + s)}</span>
          </div>
        ))}
      </div>

      {/* Item detail modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          t={t}
        />
      )}

      {/* Phase detail modal */}
      {selectedPhase && (
        <PhaseDetailModal
          phase={selectedPhase}
          onClose={() => setSelectedPhase(null)}
          t={t}
        />
      )}
    </div>
  );
}
