"use client";

import { useState, useMemo, useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  /** UUID real do projeto */
  projectId: string;
  /** ID da seção */
  sectionId: string;
  /** Título da seção (snapshot para gravar na tarefa) */
  sectionTitle: string;
}

function formatTaskDate(isoDate: string, locale: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (isoDate === today) return "hoje";
  if (isoDate === yesterday) return "ontem";
  if (isoDate === tomorrow) return "amanhã";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

const STATUS_DOT: Record<string, string> = {
  pending: "bg-gray-500",
  running: "bg-sky-400 animate-pulse",
  paused:  "bg-amber-400",
  done:    "bg-emerald-500",
};

export default function SectionTasksPanel({ projectId, sectionId, sectionTitle }: Props) {
  const { t, locale } = useI18n();
  const tasksByProject = useProjectStore((s) => s.tasksByProject);
  const addAgendaTask  = useProjectStore((s) => s.addAgendaTask);
  const finishAgendaTask = useProjectStore((s) => s.finishAgendaTask);
  const deleteAgendaTask = useProjectStore((s) => s.deleteAgendaTask);
  const playAgendaTask   = useProjectStore((s) => s.playAgendaTask);
  const pauseAgendaTask  = useProjectStore((s) => s.pauseAgendaTask);
  const activeTaskId     = useProjectStore((s) => s.activeTaskId);

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const sectionTasks = useMemo(() => {
    const all = tasksByProject[projectId] ?? [];
    return all
      .filter((t) => t.sectionId === sectionId)
      .sort((a, b) => {
        // Pendentes primeiro, depois por data desc
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;
        return b.date.localeCompare(a.date);
      });
  }, [tasksByProject, projectId, sectionId]);

  const pendingCount = sectionTasks.filter((t) => t.status !== "done").length;

  const handleAdd = useCallback(() => {
    const title = inputValue.trim();
    if (!title) return;
    addAgendaTask(projectId, todayStr, title, { sectionId, sectionTitle });
    setInputValue("");
    if (!open) setOpen(true);
  }, [inputValue, projectId, todayStr, sectionId, sectionTitle, addAgendaTask, open]);

  return (
    <div className="mt-6 mb-4 max-w-6xl mx-auto">
      {/* Cabeçalho colapsável */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-2.5 rounded-xl border border-gray-700/60 bg-gray-900/50 px-4 py-3 text-left transition-all hover:border-gray-600 hover:bg-gray-800/60"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/20 text-sky-400">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <span className="flex-1 text-sm font-medium text-gray-200">
          {t("agenda.sectionPanel.title")}
        </span>
        {pendingCount > 0 && (
          <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] font-medium text-sky-400">
            {pendingCount}
          </span>
        )}
        {sectionTasks.length > 0 && pendingCount === 0 && (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
            {t("agenda.widget.allDone")}
          </span>
        )}
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Painel expandido */}
      {open && (
        <div className="mt-1 rounded-xl border border-gray-700/60 bg-gray-900/40 overflow-hidden">
          {/* Lista de tarefas */}
          {sectionTasks.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-500">
              {t("agenda.sectionPanel.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-gray-800/60">
              {sectionTasks.map((task) => {
                const isRunning = task.status === "running";
                const isPaused  = task.status === "paused";
                const isDone    = task.status === "done";
                const isToday   = task.date === todayStr;
                const isActive  = activeTaskId === task.id;

                return (
                  <li
                    key={task.id}
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      isRunning ? "bg-sky-950/30" : isDone ? "opacity-60" : ""
                    }`}
                  >
                    {/* Status dot / play-pause button */}
                    {!isDone && isToday ? (
                      <button
                        type="button"
                        onClick={() => isRunning ? pauseAgendaTask(projectId, task.id) : playAgendaTask(projectId, task.id)}
                        className={`shrink-0 h-5 w-5 flex items-center justify-center rounded-full border-2 transition-colors ${
                          isRunning
                            ? "border-sky-400 bg-sky-400/20 hover:bg-sky-400/30"
                            : isPaused
                            ? "border-amber-400 bg-amber-400/10 hover:bg-amber-400/20"
                            : "border-gray-600 hover:border-gray-400"
                        }`}
                        title={isRunning ? t("agenda.pause") : t("agenda.play")}
                      >
                        {isRunning && (
                          <span className="flex gap-px">
                            <span className="h-2 w-0.5 rounded-sm bg-sky-400" />
                            <span className="h-2 w-0.5 rounded-sm bg-sky-400" />
                          </span>
                        )}
                        {!isRunning && (
                          <svg className={`h-2.5 w-2.5 ${isPaused ? "text-amber-400" : "text-gray-500"}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <span className={`shrink-0 h-2 w-2 rounded-full ${STATUS_DOT[task.status]}`} />
                    )}

                    {/* Título */}
                    <span className={`flex-1 min-w-0 text-sm truncate ${isDone ? "line-through text-gray-500" : "text-gray-200"}`}>
                      {task.title}
                    </span>

                    {/* Data chip */}
                    <span className="shrink-0 text-[11px] text-gray-500 tabular-nums">
                      {formatTaskDate(task.date, locale)}
                    </span>

                    {/* Ações */}
                    <div className="shrink-0 flex items-center gap-1">
                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => finishAgendaTask(projectId, task.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-gray-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          title={t("agenda.finish")}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteAgendaTask(projectId, task.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-700 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title={t("agenda.delete")}
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Input de nova tarefa */}
          <div className="border-t border-gray-800/60 px-4 py-3 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder={t("agenda.sectionPanel.placeholder")}
              className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 placeholder:text-gray-600 outline-none"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!inputValue.trim()}
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("agenda.sectionPanel.add")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
