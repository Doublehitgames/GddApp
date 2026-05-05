"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import WeekStrip from "@/components/agenda/WeekStrip";
import TaskRow from "@/components/agenda/TaskRow";
import AddTaskInline from "@/components/agenda/AddTaskInline";
import TaskDetailDrawer from "@/components/agenda/TaskDetailDrawer";
import type { AgendaTask } from "@/lib/agenda/types";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  projectId: string;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekStart(referenceDate: Date): Date {
  const d = new Date(referenceDate);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateHeading(isoDate: string, locale: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

function formatTotalTime(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m > 0 ? `${m}min` : ""}`.trim();
  if (m > 0) return `${m}min`;
  return "";
}

export default function AgendaClient({ projectId }: Props) {
  const { t, locale } = useI18n();
  const getProjectBySlug = useProjectStore((s) => s.getProjectBySlug);
  const projects = useProjectStore((s) => s.projects);
  const tasksByProject = useProjectStore((s) => s.tasksByProject);
  const activeTaskId = useProjectStore((s) => s.activeTaskId);
  const addAgendaTask = useProjectStore((s) => s.addAgendaTask);
  const carryOverAgendaTask = useProjectStore((s) => s.carryOverAgendaTask);
  const updateAgendaTask = useProjectStore((s) => s.updateAgendaTask);
  const deleteAgendaTask = useProjectStore((s) => s.deleteAgendaTask);
  const playAgendaTask = useProjectStore((s) => s.playAgendaTask);
  const pauseAgendaTask = useProjectStore((s) => s.pauseAgendaTask);
  const finishAgendaTask = useProjectStore((s) => s.finishAgendaTask);
  const updateAgendaTaskDetail = useProjectStore((s) => s.updateAgendaTaskDetail);
  const addSubTask = useProjectStore((s) => s.addSubTask);
  const toggleSubTask = useProjectStore((s) => s.toggleSubTask);
  const deleteSubTask = useProjectStore((s) => s.deleteSubTask);

  const project = useMemo(
    () => getProjectBySlug(projectId),
    [getProjectBySlug, projectId, projects]
  );
  const realProjectId = project?.id ?? projectId;

  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(() => toISODate(new Date()));
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [carryOverDismissed, setCarryOverDismissed] = useState(false);

  const todayStr = toISODate(new Date());
  const isPast = selectedDate < todayStr;
  const isToday = selectedDate === todayStr;


  const allTasks: AgendaTask[] = tasksByProject[realProjectId] ?? [];
  const drawerTask = drawerTaskId ? (allTasks.find((t) => t.id === drawerTaskId) ?? null) : null;

  const taskCountByDate = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    for (const t of allTasks) {
      if (!map[t.date]) map[t.date] = { total: 0, done: 0 };
      map[t.date].total++;
      if (t.status === "done") map[t.date].done++;
    }
    return map;
  }, [allTasks]);

  const selectedDayTasks = useMemo(
    () => allTasks.filter((t) => t.date === selectedDate).sort((a, b) => a.order - b.order),
    [allTasks, selectedDate]
  );

  const pendingTasks = selectedDayTasks.filter((t) => t.status !== "done");
  const doneTasks = selectedDayTasks.filter((t) => t.status === "done");

  const totalTimeToday = useMemo(
    () => selectedDayTasks.reduce((sum, t) => sum + t.totalMs, 0),
    [selectedDayTasks]
  );

  const runningTask = activeTaskId ? allTasks.find((t) => t.id === activeTaskId) : null;
  const runningTaskIsElsewhere = runningTask && runningTask.date !== selectedDate;

  // Carry-over: unfinished past tasks that haven't been carried over yet
  const pastUnfinished = useMemo(
    () => allTasks.filter((t) => t.date < todayStr && t.status !== "done" && !t.carriedOver),
    [allTasks, todayStr]
  );

  const showCarryOverBanner = isToday && !carryOverDismissed && pastUnfinished.length > 0;

  const handleCarryOver = useCallback(() => {
    for (const task of pastUnfinished) {
      carryOverAgendaTask(realProjectId, task, todayStr);
    }
    setCarryOverDismissed(true);
  }, [pastUnfinished, carryOverAgendaTask, realProjectId, todayStr]);

  const prevWeek = useCallback(() => {
    setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; });
  }, []);

  const nextWeek = useCallback(() => {
    setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; });
  }, []);

  const goToToday = useCallback(() => {
    setWeekStart(getWeekStart(new Date()));
    setSelectedDate(toISODate(new Date()));
  }, []);

  return (
    <div className="relative flex h-full min-h-screen flex-col bg-gray-950">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-base font-semibold text-white">{t("agenda.pageTitle")}</h1>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={goToToday}
              className="rounded-lg border border-gray-700 px-3 py-1 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors"
            >
              {t("agenda.today")}
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 flex flex-col gap-6">
        {/* Week navigation */}
        <WeekStrip
          weekStart={weekStart}
          onPrev={prevWeek}
          onNext={nextWeek}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          taskCountByDate={taskCountByDate}
        />

        {/* Running task elsewhere banner */}
        {runningTaskIsElsewhere && (
          <div className="flex items-center gap-3 rounded-xl border border-sky-700/50 bg-sky-950/40 px-4 py-3 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-sky-300">
              {t("agenda.runningElsewhere")}{" "}
              <span className="font-medium text-white">{runningTask!.title}</span>
            </span>
            <button
              type="button"
              onClick={() => setSelectedDate(runningTask!.date)}
              className="ml-auto shrink-0 text-xs text-sky-400 hover:text-sky-200 underline"
            >
              {t("agenda.see")}
            </button>
          </div>
        )}

        {/* Carry-over banner */}
        {showCarryOverBanner && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm">
            <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="flex-1 text-amber-200">
              {pastUnfinished.length === 1
                ? t("agenda.carryOverSingle")
                : t("agenda.carryOverPlural").replace("{count}", String(pastUnfinished.length))}
            </span>
            <button
              type="button"
              onClick={handleCarryOver}
              className="shrink-0 rounded-lg bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/30 transition-colors"
            >
              {t("agenda.carryOverBring")}
            </button>
            <button
              type="button"
              onClick={() => setCarryOverDismissed(true)}
              className="shrink-0 text-xs text-amber-600 hover:text-amber-400 transition-colors"
            >
              {t("agenda.carryOverIgnore")}
            </button>
          </div>
        )}

        {/* Day heading */}
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold capitalize text-gray-100">
            {formatDateHeading(selectedDate, locale)}
          </h2>
          {totalTimeToday > 0 && (
            <span className="shrink-0 text-sm font-medium text-gray-400">
              {formatTotalTime(totalTimeToday)} {t("agenda.registered")}
            </span>
          )}
        </div>

        {/* Pending tasks */}
        <div className="flex flex-col gap-2">
          {pendingTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isActive={activeTaskId === task.id}
              readOnly={isPast}
              onPlay={() => playAgendaTask(realProjectId, task.id)}
              onPause={() => pauseAgendaTask(realProjectId, task.id)}
              onFinish={() => finishAgendaTask(realProjectId, task.id)}
              onDelete={() => deleteAgendaTask(realProjectId, task.id)}
              onRename={(title) => updateAgendaTask(realProjectId, task.id, { title })}
              onOpenDetail={() => setDrawerTaskId(task.id)}
            />
          ))}
          {isToday && (
            <AddTaskInline onAdd={(title) => addAgendaTask(realProjectId, selectedDate, title)} />
          )}
        </div>

        {/* Done tasks */}
        {doneTasks.length > 0 && (
          <details className="group" open={pendingTasks.length === 0}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors select-none">
              <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {t("agenda.doneTasks")} ({doneTasks.length})
              {formatTotalTime(doneTasks.reduce((s, t) => s + t.totalMs, 0)) && (
                <span className="ml-auto text-xs text-emerald-600">
                  {formatTotalTime(doneTasks.reduce((s, t) => s + t.totalMs, 0))}
                </span>
              )}
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {doneTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isActive={false}
                  readOnly={isPast}
                  onPlay={() => {}}
                  onPause={() => {}}
                  onFinish={() => {}}
                  onDelete={() => deleteAgendaTask(realProjectId, task.id)}
                  onRename={(title) => updateAgendaTask(realProjectId, task.id, { title })}
                  onOpenDetail={() => setDrawerTaskId(task.id)}
                />
              ))}
            </div>
          </details>
        )}

        {/* Empty state */}
        {selectedDayTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-700 bg-gray-900/60">
              <svg className="h-7 w-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            {isPast ? (
              <p className="text-sm text-gray-500">{t("agenda.noTasksPast")}</p>
            ) : (
              <>
                <p className="text-sm text-gray-500">{t("agenda.noTasksToday")}</p>
                <p className="text-xs text-gray-600">{t("agenda.addTaskTip")}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {drawerTask && (
        <TaskDetailDrawer
          task={drawerTask}
          isActive={activeTaskId === drawerTask.id}
          readOnly={drawerTask.date < todayStr}
          onClose={() => setDrawerTaskId(null)}
          onPlay={() => playAgendaTask(realProjectId, drawerTask.id)}
          onPause={() => pauseAgendaTask(realProjectId, drawerTask.id)}
          onFinish={() => { finishAgendaTask(realProjectId, drawerTask.id); setDrawerTaskId(null); }}
          onDelete={() => { deleteAgendaTask(realProjectId, drawerTask.id); setDrawerTaskId(null); }}
          onRenameTitle={(title) => updateAgendaTask(realProjectId, drawerTask.id, { title })}
          onUpdateDetail={(patch) => updateAgendaTaskDetail(realProjectId, drawerTask.id, patch)}
          onAddSubTask={(title) => addSubTask(realProjectId, drawerTask.id, title)}
          onToggleSubTask={(subId) => toggleSubTask(realProjectId, drawerTask.id, subId)}
          onDeleteSubTask={(subId) => deleteSubTask(realProjectId, drawerTask.id, subId)}
        />
      )}
    </div>
  );
}
