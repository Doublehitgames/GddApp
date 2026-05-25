"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { ActivityLogEvent } from "@/store/slices/activityLogSlice";
import { toSlug } from "@/lib/utils/slug";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  projectId: string;      // slug — usado nas URLs
  realProjectId: string;  // UUID — usado para buscar no store/Supabase
}

const INITIAL_LIMIT = 6;

const ACTION_STYLES: Record<
  ActivityLogEvent["action"],
  { badge: string; dot: string }
> = {
  created:  { badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-500/60" },
  deleted:  { badge: "border-red-500/30    bg-red-500/10    text-red-400",       dot: "bg-red-500/60"    },
  renamed:  { badge: "border-amber-500/30  bg-amber-500/10  text-amber-400",     dot: "bg-amber-500/60"  },
};

function useTimeAgo() {
  const { t } = useI18n();
  return (dateStr: string): string => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diffMs / 60_000);
    const hours = Math.floor(diffMs / 3_600_000);
    const days  = Math.floor(diffMs / 86_400_000);
    if (mins  < 1)   return t("activityLog.timeJustNow");
    if (mins  < 60)  return t("activityLog.timeMinutes").replace("{n}", String(mins));
    if (hours < 24)  return t("activityLog.timeHours").replace("{n}", String(hours));
    if (days  === 1) return t("activityLog.timeYesterday");
    if (days  < 7)   return t("activityLog.timeDays").replace("{n}", String(days));
    if (days  < 30)  return t("activityLog.timeWeeks").replace("{n}", String(Math.floor(days / 7)));
    if (days  < 365) return t("activityLog.timeMonths").replace("{n}", String(Math.floor(days / 30)));
    return t("activityLog.timeYears").replace("{n}", String(Math.floor(days / 365)));
  };
}

function ActivityCard({
  event,
  projectId,
  onNavigate,
}: {
  event: ActivityLogEvent;
  projectId: string;
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const timeAgo = useTimeAgo();
  const style     = ACTION_STYLES[event.action];
  const isDeleted = event.action === "deleted";

  const actionLabels: Record<ActivityLogEvent["action"], string> = {
    created: t("activityLog.actionCreated"),
    deleted: t("activityLog.actionDeleted"),
    renamed: t("activityLog.actionRenamed"),
  };

  const inner = (
    <>
      <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none border ${style.badge}`}>
        {actionLabels[event.action]}
      </span>

      <p className={`line-clamp-2 text-sm font-medium leading-snug transition-colors ${
        isDeleted ? "text-gray-500 line-through" : "text-gray-100 group-hover:text-white"
      }`}>
        {event.section_title}
      </p>

      {event.action === "renamed" && event.old_title && (
        <p className="text-[11px] text-gray-600 truncate -mt-1">
          {t("activityLog.renamedFrom").replace("{title}", event.old_title)}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-0.5 pt-0.5">
        {event.user_name && (
          <span className="truncate text-xs text-gray-400">{event.user_name}</span>
        )}
        <span className="text-xs text-gray-500">{timeAgo(event.created_at)}</span>
      </div>
    </>
  );

  if (isDeleted) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-gray-800/60 bg-gray-900/30 p-3 opacity-60 cursor-default">
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={`/projects/${projectId}/sections/${toSlug(event.section_title)}`}
      prefetch={false}
      onClick={onNavigate}
      className="group flex flex-col gap-2 rounded-xl border border-gray-700/80 bg-gray-900/50 p-3 transition-all duration-150 hover:border-indigo-500/50 hover:bg-gray-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {inner}
    </Link>
  );
}

function HistoryModal({
  events,
  projectId,
  onClose,
}: {
  events: ActivityLogEvent[];
  projectId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const countLabel = events.length === 1
    ? `1 ${t("activityLog.eventSingular")}`
    : `${events.length} ${t("activityLog.eventPlural")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">{t("activityLog.modalTitle")}</span>
            <span className="rounded-full bg-gray-700/60 px-2 py-0.5 text-[11px] text-gray-400">
              {countLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            aria-label={t("activityLog.modalClose")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {events.map((event) => (
              <ActivityCard key={event.id} event={event} projectId={projectId} onNavigate={onClose} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RecentActivityWidget({ projectId, realProjectId }: Props) {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);

  const fetchActivityLog     = useProjectStore((s) => s.fetchActivityLog);
  const activityLogByProject = useProjectStore((s) => s.activityLogByProject);

  useEffect(() => {
    if (realProjectId) fetchActivityLog(realProjectId);
  }, [realProjectId, fetchActivityLog]);

  const events  = useMemo(() => activityLogByProject[realProjectId] ?? [], [activityLogByProject, realProjectId]);
  const visible = events.slice(0, INITIAL_LIMIT);
  const extra   = events.length - INITIAL_LIMIT;

  if (events.length === 0) return null;

  const actionLabels: Record<ActivityLogEvent["action"], string> = {
    created: t("activityLog.actionCreated"),
    deleted: t("activityLog.actionDeleted"),
    renamed: t("activityLog.actionRenamed"),
  };

  const extraLabel = extra === 1 ? t("activityLog.eventSingular") : t("activityLog.eventPlural");

  return (
    <>
      <section className="ui-card-premium p-0 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-gray-800/60">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">{t("activityLog.widgetTitle")}</span>

          <div className="ml-auto flex items-center gap-2.5">
            {(["created", "renamed", "deleted"] as const).map((action) => (
              <span key={action} className="flex items-center gap-1 text-[11px] text-gray-500">
                <span className={`inline-block h-2 w-2 rounded-full ${ACTION_STYLES[action].dot}`} />
                {actionLabels[action]}
              </span>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {visible.map((event) => (
              <ActivityCard key={event.id} event={event} projectId={projectId} />
            ))}
          </div>

          {extra > 0 && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="mt-3 text-xs text-violet-400 hover:text-violet-200 transition-colors"
            >
              {t("activityLog.seeMore")
                .replace("{count}", String(extra))
                .replace("{label}", extraLabel)}
            </button>
          )}
        </div>
      </section>

      {modalOpen && (
        <HistoryModal events={events} projectId={projectId} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
