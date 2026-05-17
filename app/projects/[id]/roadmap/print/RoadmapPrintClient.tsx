"use client";

import { useMemo, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";
import { MarkdownContent } from "@/components/common/MarkdownContent";
import type { RoadmapItem, RoadmapPhase, RoadmapTheme, ItemStatus, PhaseStatus } from "@/lib/roadmap/types";
import { ITEM_TAG_CONFIG } from "@/lib/roadmap/types";

// ─── Status styles (light / print) ────────────────────────────────────────────

const ITEM_STATUS_BADGE: Record<ItemStatus, string> = {
  planned:     "border-slate-200 bg-slate-50 text-slate-600",
  in_progress: "border-sky-200 bg-sky-50 text-sky-700",
  done:        "border-emerald-200 bg-emerald-50 text-emerald-700",
  cut:         "border-rose-200 bg-rose-50 text-rose-600",
};

const ITEM_STATUS_DOT: Record<ItemStatus, string> = {
  planned:     "bg-slate-400",
  in_progress: "bg-sky-500",
  done:        "bg-emerald-500",
  cut:         "bg-rose-400",
};

const ITEM_TITLE_STYLE: Record<ItemStatus, string> = {
  planned:     "text-gray-900",
  in_progress: "text-gray-900",
  done:        "text-gray-400 line-through",
  cut:         "text-gray-400 line-through",
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
  sky:     "border-l-sky-500",
  emerald: "border-l-emerald-500",
  amber:   "border-l-amber-500",
  violet:  "border-l-violet-500",
  rose:    "border-l-rose-500",
  pink:    "border-l-pink-500",
  indigo:  "border-l-indigo-500",
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

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatPhaseLabel(phase: RoadmapPhase): string {
  if (phase.headerType === "title" || !phase.targetDate) return phase.name;
  const [y, m] = phase.targetDate.split("-").map(Number);
  switch (phase.headerType) {
    case "month":    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    case "quarter":  return `Q${Math.ceil(m / 3)} ${y}`;
    case "semester": return `S${m <= 6 ? 1 : 2} ${y}`;
    case "year":     return String(y);
    default:         return phase.name;
  }
}

function formatPhaseSubtitle(phase: RoadmapPhase): string | null {
  if (phase.headerType === "title" || !phase.targetDate) return null;
  return phase.name || null;
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({ item, t }: { item: RoadmapItem; t: (k: string) => string }) {
  const tagCfg = item.tag ? ITEM_TAG_CONFIG[item.tag] : null;
  const hasContent = item.description || item.thumbUrl;

  return (
    <div className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 break-inside-avoid shadow-sm">
      {/* Thumbnail */}
      {item.thumbUrl && (
        <div className="shrink-0 w-28 self-start">
          <img
            src={item.thumbUrl}
            alt=""
            className="w-full rounded-lg object-contain bg-gray-50 max-h-28"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ITEM_STATUS_BADGE[item.status]}`}>
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${ITEM_STATUS_DOT[item.status]}`} />
            {t("roadmap.status." + item.status)}
          </span>

          {/* Tag */}
          {tagCfg && (
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold ${tagCfg.docStyle}`}>
              {tagCfg.label}
            </span>
          )}

          {/* Private badge */}
          {!item.isPublic && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              {t("roadmap.item.private")}
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className={`font-semibold text-base leading-snug ${ITEM_TITLE_STYLE[item.status]} ${hasContent ? "mb-2" : ""}`}>
          {item.title}
        </h4>

        {/* Description */}
        {item.description && (
          <MarkdownContent theme="light" className="text-sm">{item.description}</MarkdownContent>
        )}
      </div>
    </div>
  );
}

// ─── Theme Section ────────────────────────────────────────────────────────────

function ThemeSection({ theme, items, t }: { theme: RoadmapTheme; items: RoadmapItem[]; t: (k: string) => string }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <div className={`flex items-center gap-2 mb-3 pl-3 border-l-4 py-0.5 ${THEME_BORDER[theme.color] ?? "border-l-gray-300"}`}>
        <span className={`text-sm font-bold uppercase tracking-wide ${THEME_TEXT[theme.color] ?? "text-gray-700"}`}>
          {theme.name}
        </span>
        <span className="text-xs text-gray-400">{items.length} {items.length === 1 ? "item" : "itens"}</span>
      </div>
      <div className="flex flex-col gap-3 pl-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} t={t} />
        ))}
      </div>
    </div>
  );
}

// ─── Phase Section ────────────────────────────────────────────────────────────

function PhaseSection({
  phase, themes, items, isLast, t,
}: {
  phase: RoadmapPhase;
  themes: RoadmapTheme[];
  items: RoadmapItem[];
  isLast: boolean;
  t: (k: string) => string;
}) {
  const phaseItems = items.filter((i) => i.phaseId === phase.id);
  const doneCount  = phaseItems.filter((i) => i.status === "done").length;

  const label    = formatPhaseLabel(phase);
  const subtitle = formatPhaseSubtitle(phase);

  return (
    <section className={`${!isLast ? "break-after-page" : ""}`}>
      {/* Phase header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start gap-3 pb-3 border-b-2 border-gray-200 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`h-3 w-3 rounded-full shrink-0 mt-0.5 ${PHASE_STATUS_DOT[phase.status]}`} />
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">{label}</h2>
              {subtitle && (
                <span className="text-base text-gray-500 font-normal">{subtitle}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PHASE_STATUS_BADGE[phase.status]}`}>
              {t("roadmap.phaseStatus." + phase.status)}
            </span>
            {/* Progress */}
            {phaseItems.length > 0 && (
              <span className="text-xs text-gray-500 tabular-nums">
                {doneCount}/{phaseItems.length} {t("roadmap.print.itemsDone")}
              </span>
            )}
          </div>
        </div>

        {/* Phase description */}
        {phase.description && (
          <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4 border border-gray-100">
            <MarkdownContent theme="light" className="text-sm text-gray-600">{phase.description}</MarkdownContent>
          </div>
        )}

        {/* Empty phase */}
        {phaseItems.length === 0 && (
          <p className="text-sm text-gray-400 italic pl-1">{t("roadmap.print.noItems")}</p>
        )}
      </div>

      {/* Themes */}
      {themes.map((theme) => (
        <ThemeSection
          key={theme.id}
          theme={theme}
          items={phaseItems.filter((i) => i.themeId === theme.id)}
          t={t}
        />
      ))}
    </section>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RoadmapPrintClient({ projectId }: { projectId: string }) {
  const { t } = useI18n();

  const projects          = useProjectStore((s) => s.projects);
  const roadmapsByProject = useProjectStore((s) => s.roadmapsByProject);
  const getRoadmaps       = useProjectStore((s) => s.getRoadmaps);
  const getActiveRoadmapId = useProjectStore((s) => s.getActiveRoadmapId);
  const getRoadmapPhases  = useProjectStore((s) => s.getRoadmapPhases);
  const getRoadmapThemes  = useProjectStore((s) => s.getRoadmapThemes);
  const getRoadmapItems   = useProjectStore((s) => s.getRoadmapItems);

  const project        = projects.find((p) => p.id === projectId);
  const activeRoadmapId = useMemo(() => getActiveRoadmapId(projectId), [getActiveRoadmapId, projectId, roadmapsByProject]);
  const roadmaps       = useMemo(() => getRoadmaps(projectId), [getRoadmaps, projectId, roadmapsByProject]);
  const activeRoadmap  = roadmaps.find((r) => r.id === activeRoadmapId);

  const phases = useMemo(
    () => activeRoadmapId ? getRoadmapPhases(projectId, activeRoadmapId) : [],
    [getRoadmapPhases, projectId, activeRoadmapId, roadmapsByProject],
  );
  const themes = useMemo(
    () => activeRoadmapId ? getRoadmapThemes(projectId, activeRoadmapId) : [],
    [getRoadmapThemes, projectId, activeRoadmapId, roadmapsByProject],
  );
  const allItems = useMemo(
    () => activeRoadmapId ? getRoadmapItems(projectId, activeRoadmapId) : [],
    [getRoadmapItems, projectId, activeRoadmapId, roadmapsByProject],
  );

  const exportDate = new Date().toLocaleDateString("pt-BR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">

      {/* ── Toolbar (hidden on print) ──────────────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-50 flex items-center justify-between gap-3 bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
        <a
          href={`/projects/${projectId}/roadmap`}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("roadmap.print.back")}
        </a>
        <span className="text-sm font-semibold text-gray-700">{t("roadmap.print.preview")}</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          {t("roadmap.print.export")}
        </button>
      </div>

      {/* ── Document ──────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-8 py-10 print:px-0 print:py-0 print:max-w-none">
        <div className="bg-white rounded-2xl shadow-sm print:shadow-none print:rounded-none p-10 print:p-12">

          {/* Cover / header */}
          <header className="mb-10 pb-8 border-b-2 border-gray-900">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
              {project?.title ?? projectId}
            </p>
            <h1 className="text-4xl font-black text-gray-900 leading-tight mb-3">
              {activeRoadmap?.name ?? t("roadmap.print.defaultTitle")}
            </h1>
            <p className="text-sm text-gray-400">
              {t("roadmap.print.exportedOn")} {exportDate}
              {"  ·  "}
              {phases.length} {t("roadmap.print.phases")}
              {"  ·  "}
              {allItems.length} {t("roadmap.print.items")}
            </p>
          </header>

          {/* Phases */}
          {phases.length === 0 ? (
            <p className="text-gray-400 italic text-sm">{t("roadmap.print.empty")}</p>
          ) : (
            <div className="flex flex-col gap-12">
              {phases.map((phase, idx) => (
                <PhaseSection
                  key={phase.id}
                  phase={phase}
                  themes={themes}
                  items={allItems}
                  isLast={idx === phases.length - 1}
                  t={t}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          <footer className="mt-12 pt-6 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {project?.title} · {activeRoadmap?.name}
            </p>
            <p className="text-xs text-gray-400">{exportDate}</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
