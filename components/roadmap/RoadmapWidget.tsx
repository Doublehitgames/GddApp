"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";
import type { PhaseStatus } from "@/lib/roadmap/types";

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

  const phases   = useMemo(
    () => activeRoadmapId ? getRoadmapPhases(realProjectId, activeRoadmapId) : [],
    [getRoadmapPhases, realProjectId, activeRoadmapId],
  );
  const allItems = useMemo(
    () => activeRoadmapId ? getRoadmapItems(realProjectId, activeRoadmapId) : [],
    [getRoadmapItems, realProjectId, activeRoadmapId],
  );

  const activePhase = phases.find((p) => p.status === "active") ?? phases[0] ?? null;
  const activeItems = activePhase ? allItems.filter((i) => i.phaseId === activePhase.id) : [];
  const doneCount   = activeItems.filter((i) => i.status === "done").length;
  const total       = activeItems.length;
  const progress    = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const completedPhases = phases.filter((p) => p.status === "completed").length;

  const href = `/projects/${projectId}/roadmap`;

  return (
    <section className="ui-card-premium p-0 overflow-hidden">
      {/* Header */}
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

      {/* Body */}
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

        {/* Active/current phase */}
        {activePhase && (
          <>
            {/* Phase info */}
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

            {/* Progress */}
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

            {/* Phase summary chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-gray-500">
                {t("roadmap.widget.phases").replace("{count}", String(phases.length))}
              </span>
              {completedPhases > 0 && (
                <span className="flex items-center gap-1 rounded-full border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-[11px] text-gray-400">
                  <svg className="h-2.5 w-2.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {t("roadmap.widget.completedPhases").replace("{count}", String(completedPhases))}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
