"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  /** Slug do projeto — usado para montar a URL de navegação */
  projectId: string;
  /** UUID real do projeto — usado para buscar tarefas no store */
  realProjectId: string;
}

function formatTime(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ""}`;
  if (m > 0) return `${m}min`;
  if (s > 0) return `${s}s`;
  return "";
}

function formatTimerLive(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export default function AgendaWidget({ projectId, realProjectId }: Props) {
  const { t } = useI18n();
  const tasksByProject = useProjectStore((s) => s.tasksByProject);
  const activeTaskId = useProjectStore((s) => s.activeTaskId);
  const [elapsed, setElapsed] = useState(0);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const allTasks = tasksByProject[realProjectId] ?? [];

  const todayTasks = useMemo(
    () => allTasks.filter((t) => t.date === todayStr),
    [allTasks, todayStr]
  );
  const doneTasks = useMemo(
    () => todayTasks.filter((t) => t.status === "done"),
    [todayTasks]
  );
  const pendingTasks = useMemo(
    () => todayTasks.filter((t) => t.status !== "done"),
    [todayTasks]
  );

  const runningTask = activeTaskId ? allTasks.find((t) => t.id === activeTaskId) : null;

  // Timer ao vivo — baseado diretamente na sessão aberta
  useEffect(() => {
    if (!runningTask) {
      setElapsed(0);
      return;
    }
    const openSession = runningTask.sessions.find((s) => !s.endedAt);
    if (!openSession) {
      setElapsed(0);
      return;
    }
    const tick = () =>
      setElapsed(Date.now() - new Date(openSession.startedAt).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [runningTask?.id, runningTask?.sessions]);

  const runningMs = runningTask ? runningTask.totalMs + elapsed : 0;
  const totalMs =
    todayTasks.reduce((sum, t) => sum + t.totalMs, 0) +
    (runningTask ? elapsed : 0);

  const progress =
    todayTasks.length > 0 ? doneTasks.length / todayTasks.length : 0;
  const allDone =
    todayTasks.length > 0 && doneTasks.length === todayTasks.length;

  const agendaHref = `/projects/${projectId}/agenda`;

  return (
    <section className="ui-card-premium p-0 overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white">
            {t("agenda.widget.title")}
          </span>
          {allDone && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              {t("agenda.widget.allDone")}
            </span>
          )}
        </div>
        <Link
          href={agendaHref}
          className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-200 transition-colors"
        >
          {t("agenda.widget.open")}
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>

      {/* Corpo */}
      <div className="px-4 py-3 flex flex-col gap-3">
        {/* Tarefa em execução */}
        {runningTask && (
          <div className="flex items-center gap-3 rounded-xl border border-sky-700/40 bg-sky-950/40 px-3 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400 animate-pulse" />
            <span className="flex-1 min-w-0 text-sm text-white font-medium truncate">
              {runningTask.title}
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-sky-300">
              {formatTimerLive(runningMs)}
            </span>
          </div>
        )}

        {/* Estado vazio */}
        {todayTasks.length === 0 && (
          <Link
            href={agendaHref}
            className="flex items-center gap-3 rounded-xl border border-dashed border-gray-700 px-3 py-4 text-gray-500 hover:border-sky-700/50 hover:text-sky-400 transition-colors"
          >
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="text-sm">{t("agenda.widget.noTasks")}</span>
          </Link>
        )}

        {/* Progresso do dia */}
        {todayTasks.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400">
                {t("agenda.widget.progress")
                  .replace("{done}", String(doneTasks.length))
                  .replace("{total}", String(todayTasks.length))}
              </span>
              {totalMs > 0 && (
                <span className="text-xs font-medium text-gray-400">
                  {formatTime(totalMs)} {t("agenda.widget.registered")}
                </span>
              )}
            </div>

            {/* Barra de progresso */}
            <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  allDone ? "bg-emerald-500" : "bg-sky-500"
                }`}
                style={{
                  width: `${Math.max(progress * 100, todayTasks.length > 0 ? 3 : 0)}%`,
                }}
              />
            </div>

            {/* Chips das tarefas pendentes */}
            {pendingTasks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pendingTasks.slice(0, 4).map((task) => (
                  <span
                    key={task.id}
                    className={`rounded-full border px-2 py-0.5 text-[11px] truncate max-w-[150px] ${
                      task.status === "running"
                        ? "border-sky-700/50 bg-sky-950/30 text-sky-400"
                        : task.status === "paused"
                        ? "border-amber-700/50 bg-amber-950/20 text-amber-400"
                        : "border-gray-700/60 bg-gray-900/50 text-gray-400"
                    }`}
                  >
                    {task.title}
                  </span>
                ))}
                {pendingTasks.length > 4 && (
                  <span className="rounded-full border border-gray-700/60 bg-gray-900/50 px-2 py-0.5 text-[11px] text-gray-500">
                    +{pendingTasks.length - 4}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
