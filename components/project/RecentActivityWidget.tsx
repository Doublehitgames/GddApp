"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import type { ActivityLogEvent } from "@/store/slices/activityLogSlice";
import { readChangelogSeen } from "@/lib/changelog/seen";
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
  modified: { badge: "border-blue-500/30   bg-blue-500/10   text-blue-400",      dot: "bg-blue-500/60"   },
};

/**
 * `detail` guarda um token, não uma frase — o app é traduzido e o banco não
 * pode ficar com português cravado dentro. A frase nasce aqui.
 *
 * Tokens vivos: 'description' e 'batch:<n>'. Linhas antigas guardam a faceta do
 * addon que mudou ('dataSchema', 'fieldLibrary'), e essas aparecem como estão.
 */
function useDetailLabel() {
  const { t } = useI18n();
  return (detail: string): string => {
    if (detail === "description") {
      return t("activityLog.detailDescription", "descrição");
    }
    const batch = /^batch:(\d+)$/.exec(detail);
    if (batch) {
      // O card já nomeia uma das páginas; o rótulo conta as outras.
      const others = Number(batch[1]) - 1;
      if (others < 1) return "";
      return others === 1
        ? t("activityLog.detailBatchOne", "e 1 outra página nesta ação")
        : t("activityLog.detailBatch", "e {n} outras páginas nesta ação").replace(
            "{n}",
            String(others)
          );
    }
    return detail;
  };
}

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
  const detailLabel = useDetailLabel();
  const style     = ACTION_STYLES[event.action];
  const isDeleted = event.action === "deleted";
  const isAgent   = event.origin === "mcp";
  const detailText = event.detail ? detailLabel(event.detail) : "";

  const actionLabels: Record<ActivityLogEvent["action"], string> = {
    created:  t("activityLog.actionCreated"),
    deleted:  t("activityLog.actionDeleted"),
    renamed:  t("activityLog.actionRenamed"),
    modified: t("activityLog.actionModified"),
  };

  const inner = (
    <>
      <div className="flex w-full items-center gap-1.5">
        <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none border ${style.badge}`}>
          {actionLabels[event.action]}
        </span>
        {isAgent && (
          <span className="w-fit rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold leading-none text-violet-300">
            {t("activityLog.originMcp", "via MCP")}
          </span>
        )}
      </div>

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
      {detailText && (
        <p className="text-[11px] text-blue-500/70 truncate -mt-1">{detailText}</p>
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
  const [originFilter, setOriginFilter] = useState<"all" | "app" | "mcp">("all");

  const fetchActivityLog     = useProjectStore((s) => s.fetchActivityLog);
  const activityLogByProject = useProjectStore((s) => s.activityLogByProject);

  useEffect(() => {
    if (realProjectId) fetchActivityLog(realProjectId);
  }, [realProjectId, fetchActivityLog]);

  const events = useMemo(() => activityLogByProject[realProjectId] ?? [], [activityLogByProject, realProjectId]);

  // Selo de novidade: quantos eventos são posteriores à última leitura do
  // changelog neste aparelho. Lido depois da montagem porque o marcador mora no
  // localStorage e o servidor não tem como saber dele.
  const [changelogSeenAt, setChangelogSeenAt] = useState<string | null>(null);
  useEffect(() => {
    setChangelogSeenAt(readChangelogSeen(realProjectId));
  }, [realProjectId]);
  // Por instante, não por texto: o Postgres devolve "+00:00" e o marcador local
  // grava "Z", e os dois não ordenam igual como string.
  const unreadCount = useMemo(() => {
    if (!changelogSeenAt) return 0;
    const seen = new Date(changelogSeenAt).getTime();
    return events.filter((e) => new Date(e.created_at).getTime() > seen).length;
  }, [events, changelogSeenAt]);

  // O filtro de origem só aparece quando há as duas origens no log — num projeto
  // que ninguém automatizou ele seria um controle sem nada para controlar.
  const hasAgentEvents = events.some((e) => e.origin === "mcp");
  const hasAppEvents   = events.some((e) => e.origin !== "mcp");
  const showOriginFilter = hasAgentEvents && hasAppEvents;

  const filtered = useMemo(() => {
    if (originFilter === "mcp") return events.filter((e) => e.origin === "mcp");
    if (originFilter === "app") return events.filter((e) => e.origin !== "mcp");
    return events;
  }, [events, originFilter]);

  const visible = filtered.slice(0, INITIAL_LIMIT);
  const extra   = filtered.length - INITIAL_LIMIT;

  if (events.length === 0) return null;

  const actionLabels: Record<ActivityLogEvent["action"], string> = {
    created:  t("activityLog.actionCreated"),
    deleted:  t("activityLog.actionDeleted"),
    renamed:  t("activityLog.actionRenamed"),
    modified: t("activityLog.actionModified"),
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

          {/* O widget mostra o que aconteceu; o changelog mostra o que mudou no
              texto. Quem quer o diff sai por aqui. */}
          <Link
            href={`/projects/${projectId}/changelog`}
            prefetch={false}
            className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] text-violet-400 transition-colors hover:bg-violet-500/10 hover:text-violet-200"
          >
            {t("activityLog.openChangelog", "o que mudou")}
            {unreadCount > 0 && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-300">
                {unreadCount}
              </span>
            )}
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {showOriginFilter && (
              <div className="flex items-center gap-0.5 rounded-lg bg-gray-800/60 p-0.5">
                {([
                  ["all", t("activityLog.originAll",   "Tudo")],
                  ["app", t("activityLog.originApp",   "Você")],
                  ["mcp", t("activityLog.originAgent", "Agente")],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOriginFilter(value)}
                    className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                      originFilter === value
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Legenda só das ações que o log realmente tem. 'modified' ficou
                órfã por um tempo (era dos addons) e aparecia num projeto que
                nunca teve um evento desses. */}
            <div className="flex items-center gap-2.5">
              {(["created", "modified", "renamed", "deleted"] as const)
                .filter((action) => filtered.some((e) => e.action === action))
                .map((action) => (
                  <span key={action} className="flex items-center gap-1 text-[11px] text-gray-500">
                    <span className={`inline-block h-2 w-2 rounded-full ${ACTION_STYLES[action].dot}`} />
                    {actionLabels[action]}
                  </span>
                ))}
            </div>
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
        <HistoryModal events={filtered} projectId={projectId} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
