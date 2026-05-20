"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";
import type { PhaseStatus } from "@/lib/roadmap/types";
import { ITEM_TAG_CONFIG } from "@/lib/roadmap/types";

interface Props {
  projectId: string;
  realProjectId: string;
}

const PHASE_STATUS_DOT: Record<PhaseStatus, string> = {
  planned:   "bg-slate-400",
  active:    "bg-emerald-400 animate-pulse",
  completed: "bg-gray-500",
  cancelled: "bg-rose-400",
};

export default function RoadmapWidget({ projectId, realProjectId }: Props) {
  const { t } = useI18n();
  const getRoadmapPhases   = useProjectStore((s) => s.getRoadmapPhases);
  const getRoadmapItems    = useProjectStore((s) => s.getRoadmapItems);
  const getActiveRoadmapId = useProjectStore((s) => s.getActiveRoadmapId);
  const roadmapsByProject  = useProjectStore((s) => s.roadmapsByProject);

  const activeRoadmapId = useMemo(
    () => getActiveRoadmapId(realProjectId),
    [getActiveRoadmapId, realProjectId, roadmapsByProject],
  );

  const phases = useMemo(
    () => activeRoadmapId ? getRoadmapPhases(realProjectId, activeRoadmapId) : [],
    [getRoadmapPhases, realProjectId, activeRoadmapId],
  );
  const allItems = useMemo(
    () => activeRoadmapId ? getRoadmapItems(realProjectId, activeRoadmapId) : [],
    [getRoadmapItems, realProjectId, activeRoadmapId],
  );

  // ── Active phase (most relevant) ──────────────────────────────────────────
  const activePhase = useMemo(() => {
    if (!phases.length) return null;
    const activeNotDone = phases.find((p) => {
      if (p.status !== "active") return false;
      const phaseItems = allItems.filter((i) => i.phaseId === p.id);
      if (phaseItems.length === 0) return true;
      return phaseItems.filter((i) => i.status === "done").length < phaseItems.length;
    });
    if (activeNotDone) return activeNotDone;
    const withInProgress = phases.find((p) =>
      allItems.some((i) => i.phaseId === p.id && i.status === "in_progress")
    );
    if (withInProgress) return withInProgress;
    return phases.find((p) => p.status === "active") ?? phases[0] ?? null;
  }, [phases, allItems]);

  // ── Current phase metrics ──────────────────────────────────────────────────
  const activeItems     = activePhase ? allItems.filter((i) => i.phaseId === activePhase.id) : [];
  const plannedCount    = activeItems.filter((i) => i.status === "planned").length;
  const inProgressCount = activeItems.filter((i) => i.status === "in_progress").length;
  const doneCount       = activeItems.filter((i) => i.status === "done").length;
  const cutCount        = activeItems.filter((i) => i.status === "cut").length;
  const total           = activeItems.length;
  const progress        = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // ── In-progress items (up to 4) ────────────────────────────────────────────
  const inProgressItems = activeItems.filter((i) => i.status === "in_progress").slice(0, 4);

  // ── Overall roadmap progress ───────────────────────────────────────────────
  const totalItems      = allItems.length;
  const totalDone       = allItems.filter((i) => i.status === "done").length;
  const overallProgress = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

  // ── Next phase ─────────────────────────────────────────────────────────────
  const activePhaseIdx = activePhase ? phases.indexOf(activePhase) : -1;
  const nextPhase = activePhaseIdx >= 0
    ? phases.slice(activePhaseIdx + 1).find((p) => p.status !== "completed" && p.status !== "cancelled") ?? null
    : null;
  const nextPhaseItems = nextPhase ? allItems.filter((i) => i.phaseId === nextPhase.id).length : 0;

  const completedPhases = phases.filter((p) => p.status === "completed").length;
  const href = `/projects/${projectId}/roadmap`;

  return (
    <section className="ui-card-premium p-0 overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">{t("roadmap.widget.title")}</span>
          {activePhase?.status === "active" && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t("roadmap.widget.activeBadge")}
            </span>
          )}
        </div>
        <Link
          href={href}
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-200 transition-colors"
        >
          {t("roadmap.widget.open")}
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex flex-col gap-3">

        {/* Empty state */}
        {phases.length === 0 && (
          <Link
            href={href}
            className="flex items-center gap-3 rounded-xl border border-dashed border-gray-700 px-3 py-4 text-gray-500 hover:border-violet-700/50 hover:text-violet-400 transition-colors"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">{t("roadmap.widget.empty")}</span>
          </Link>
        )}

        {activePhase && (
          <>
            {/* ── Phase name + date ─────────────────────────────────────── */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${PHASE_STATUS_DOT[activePhase.status]}`} />
                <span className="text-sm font-semibold text-white truncate">{activePhase.name}</span>
                {activePhase.targetDate && (
                  <span className="ml-auto shrink-0 text-[11px] text-gray-500">
                    {new Date(activePhase.targetDate + "-01").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
              {activePhase.description && (
                <p className="text-xs text-gray-500 leading-relaxed pl-4 line-clamp-2">{activePhase.description}</p>
              )}
            </div>

            {/* ── Phase progress bar ────────────────────────────────────── */}
            {total > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">
                    {t("roadmap.widget.progress")
                      .replace("{done}", String(doneCount))
                      .replace("{total}", String(total))}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400 tabular-nums">{progress}%</span>
                </div>
              </div>
            )}

            {/* ── [2] Status distribution ───────────────────────────────── */}
            {total > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                {plannedCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 shrink-0" />
                    {plannedCount} {t("roadmap.widget.statusPlanned")}
                  </span>
                )}
                {inProgressCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-sky-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
                    {inProgressCount} {t("roadmap.widget.statusInProgress")}
                  </span>
                )}
                {doneCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {doneCount} {t("roadmap.widget.statusDone")}
                  </span>
                )}
                {cutCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-rose-400/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                    {cutCount} {t("roadmap.widget.statusCut")}
                  </span>
                )}
              </div>
            )}

            {/* ── [1] In-progress items ─────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                {t("roadmap.widget.inProgressTitle")}
              </span>
              {inProgressItems.length === 0 ? (
                <p className="text-[11px] text-gray-600 italic">{t("roadmap.widget.noInProgress")}</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {inProgressItems.map((item) => {
                    const tagCfg = item.tag ? ITEM_TAG_CONFIG[item.tag] : null;
                    return (
                      <div key={item.id} className="flex items-center gap-1.5 rounded-lg border border-sky-800/40 bg-sky-950/20 px-2 py-1">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                        {tagCfg && (
                          <span className={`shrink-0 rounded px-1 text-[9px] font-bold leading-4 ${tagCfg.chipStyle}`}>
                            {tagCfg.label}
                          </span>
                        )}
                        <span className="flex-1 min-w-0 text-xs text-sky-200 truncate">{item.title || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Divider ───────────────────────────────────────────────── */}
            <div className="border-t border-gray-800/60" />

            {/* ── [4] Overall roadmap progress ──────────────────────────── */}
            {totalItems > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                    {t("roadmap.widget.overallTitle")}
                  </span>
                  <span className="text-[11px] text-gray-500 tabular-nums">
                    {totalDone}/{totalItems} · {overallProgress}%
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gray-500 transition-all duration-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                {completedPhases > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <svg className="h-2.5 w-2.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("roadmap.widget.completedPhases").replace("{count}", String(completedPhases))}
                    <span className="text-gray-600">·</span>
                    {t("roadmap.widget.phases").replace("{count}", String(phases.length))}
                  </div>
                )}
              </div>
            )}

            {/* ── [3] Next phase ────────────────────────────────────────── */}
            {nextPhase && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                    {t("roadmap.widget.nextPhaseTitle")}
                  </span>
                  <span className="text-xs text-gray-300 truncate">{nextPhase.name}</span>
                </div>
                <span className="shrink-0 text-[11px] text-gray-600 tabular-nums">
                  {t("roadmap.widget.nextPhaseItems").replace("{count}", String(nextPhaseItems))}
                </span>
                <svg className="h-3.5 w-3.5 shrink-0 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
