import type { AgendaTask, AgendaState, AgendaActions, SubTask, RecurrenceRule } from "@/lib/agenda/types";
import { persistAgendaTasks } from "./storageHelpers";
import { upsertAgendaTasks } from "@/lib/supabase/agendaSync";

type StoreSet = (partial: Partial<AgendaState & AgendaActions> | ((state: AgendaState & AgendaActions) => Partial<AgendaState & AgendaActions>)) => void;
type StoreGet = () => AgendaState & AgendaActions & { tasksByProject: Record<string, AgendaTask[]>; activeTaskId: string | null; userId?: string | null };

const syncTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function scheduleSyncToSupabase(projectId: string, get: StoreGet) {
  clearTimeout(syncTimers[projectId]);
  syncTimers[projectId] = setTimeout(async () => {
    const state = get();
    if (!state.userId) return;
    const tasks = state.tasksByProject[projectId] ?? [];
    await upsertAgendaTasks(state.userId, projectId, tasks);
  }, 2000);
}

function closeActiveSession(task: AgendaTask): AgendaTask {
  const now = new Date().toISOString();
  const sessions = task.sessions.map((s) => {
    if (!s.endedAt) {
      const durationMs = Date.now() - new Date(s.startedAt).getTime();
      return { ...s, endedAt: now, durationMs };
    }
    return s;
  });
  const totalMs = sessions.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  return { ...task, sessions, totalMs };
}

function sp(
  set: StoreSet,
  get: StoreGet,
  updater: (state: AgendaState & AgendaActions) => Partial<AgendaState & AgendaActions>
) {
  set(updater);
  persistAgendaTasks(get().tasksByProject);
}

export function createAgendaSlice(set: StoreSet, get: StoreGet) {
  return {
    tasksByProject: {} as Record<string, AgendaTask[]>,
    activeTaskId: null as string | null,

    addAgendaTask: (projectId: string, date: string, title: string, opts?: { sectionId?: string; sectionTitle?: string }): string => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const existing = get().tasksByProject[projectId] ?? [];
      const dayTasks = existing.filter((t) => t.date === date);
      const newTask: AgendaTask = {
        id,
        projectId,
        title: title.trim(),
        date,
        status: "pending",
        sessions: [],
        totalMs: 0,
        createdAt: now,
        order: dayTasks.length,
        ...(opts?.sectionId ? { sectionId: opts.sectionId, sectionTitle: opts.sectionTitle } : {}),
      };
      sp(set, get, (state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: [...(state.tasksByProject[projectId] ?? []), newTask],
        },
      }));
      scheduleSyncToSupabase(projectId, get);
      return id;
    },

    carryOverAgendaTask: (projectId: string, sourceTask: AgendaTask, targetDate: string): string => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const existing = get().tasksByProject[projectId] ?? [];
      const dayTasks = existing.filter((t) => t.date === targetDate);

      // Close any open session (task may have been running when browser closed)
      const sessions = sourceTask.sessions.map((s) => {
        if (!s.endedAt) {
          const durationMs = new Date(now).getTime() - new Date(s.startedAt).getTime();
          return { ...s, endedAt: now, durationMs };
        }
        return s;
      });
      const totalMs = sessions.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

      const newTask: AgendaTask = {
        id,
        projectId,
        title: sourceTask.title,
        date: targetDate,
        // Paused if has accumulated time, pending if never started
        status: totalMs > 0 ? "paused" : "pending",
        sessions,
        totalMs,
        createdAt: now,
        order: dayTasks.length,
        description: sourceTask.description,
        priority: sourceTask.priority,
        category: sourceTask.category,
        subtasks: sourceTask.subtasks ? sourceTask.subtasks.map((s) => ({ ...s })) : undefined,
        ...(sourceTask.sectionId ? { sectionId: sourceTask.sectionId, sectionTitle: sourceTask.sectionTitle } : {}),
      };
      // Mark the source task as carried over so the banner never shows it again,
      // then append the new task — both in one atomic sp() call
      const sourceId = sourceTask.id;
      sp(set, get, (state) => {
        const projectTasks = state.tasksByProject[projectId] ?? [];
        const withSourceMarked = projectTasks.map((t) =>
          t.id === sourceId ? { ...t, carriedOver: true } : t
        );
        return {
          tasksByProject: {
            ...state.tasksByProject,
            [projectId]: [...withSourceMarked, newTask],
          },
        };
      });
      scheduleSyncToSupabase(projectId, get);
      return id;
    },

    updateAgendaTask: (projectId: string, taskId: string, patch: Partial<Pick<AgendaTask, "title" | "date" | "order">>) => {
      sp(set, get, (state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: (state.tasksByProject[projectId] ?? []).map((t) =>
            t.id === taskId ? { ...t, ...patch } : t
          ),
        },
      }));
      scheduleSyncToSupabase(projectId, get);
    },

    deleteAgendaTask: (projectId: string, taskId: string) => {
      sp(set, get, (state) => {
        const wasActive = state.activeTaskId === taskId;
        return {
          activeTaskId: wasActive ? null : state.activeTaskId,
          tasksByProject: {
            ...state.tasksByProject,
            [projectId]: (state.tasksByProject[projectId] ?? []).filter((t) => t.id !== taskId),
          },
        };
      });
      scheduleSyncToSupabase(projectId, get);
    },

    playAgendaTask: (projectId: string, taskId: string) => {
      const state = get();
      const now = new Date().toISOString();
      const runningId = state.activeTaskId;
      let allTasks = { ...state.tasksByProject };
      let pausedProjectId: string | null = null;

      if (runningId && runningId !== taskId) {
        for (const [pid, tasks] of Object.entries(allTasks)) {
          const running = tasks.find((t) => t.id === runningId);
          if (running) {
            pausedProjectId = pid;
            allTasks = {
              ...allTasks,
              [pid]: tasks.map((t) =>
                t.id === runningId ? { ...closeActiveSession(t), status: "paused" as const } : t
              ),
            };
            break;
          }
        }
      }

      allTasks = {
        ...allTasks,
        [projectId]: (allTasks[projectId] ?? []).map((t) =>
          t.id === taskId
            ? { ...t, status: "running" as const, sessions: [...t.sessions, { startedAt: now, durationMs: 0 }] }
            : t
        ),
      };

      set({ tasksByProject: allTasks, activeTaskId: taskId });
      persistAgendaTasks(allTasks);
      scheduleSyncToSupabase(projectId, get);
      if (pausedProjectId && pausedProjectId !== projectId) {
        scheduleSyncToSupabase(pausedProjectId, get);
      }
    },

    pauseAgendaTask: (projectId: string, taskId: string) => {
      sp(set, get, (state) => ({
        activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: (state.tasksByProject[projectId] ?? []).map((t) =>
            t.id === taskId ? { ...closeActiveSession(t), status: "paused" as const } : t
          ),
        },
      }));
      scheduleSyncToSupabase(projectId, get);
    },

    finishAgendaTask: (projectId: string, taskId: string) => {
      const now = new Date().toISOString();
      sp(set, get, (state) => ({
        activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: (state.tasksByProject[projectId] ?? []).map((t) =>
            t.id === taskId
              ? { ...closeActiveSession(t), status: "done" as const, completedAt: now }
              : t
          ),
        },
      }));
      scheduleSyncToSupabase(projectId, get);
    },

    updateAgendaTaskDetail: (projectId: string, taskId: string, patch: Partial<Pick<AgendaTask, "description" | "priority" | "category">>) => {
      sp(set, get, (state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: (state.tasksByProject[projectId] ?? []).map((t) =>
            t.id === taskId ? { ...t, ...patch } : t
          ),
        },
      }));
      scheduleSyncToSupabase(projectId, get);
    },

    addSubTask: (projectId: string, taskId: string, title: string) => {
      const newSub: SubTask = { id: crypto.randomUUID(), title: title.trim(), done: false };
      sp(set, get, (state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: (state.tasksByProject[projectId] ?? []).map((t) =>
            t.id === taskId ? { ...t, subtasks: [...(t.subtasks ?? []), newSub] } : t
          ),
        },
      }));
      scheduleSyncToSupabase(projectId, get);
    },

    toggleSubTask: (projectId: string, taskId: string, subTaskId: string) => {
      sp(set, get, (state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: (state.tasksByProject[projectId] ?? []).map((t) =>
            t.id === taskId
              ? { ...t, subtasks: (t.subtasks ?? []).map((s) => s.id === subTaskId ? { ...s, done: !s.done } : s) }
              : t
          ),
        },
      }));
      scheduleSyncToSupabase(projectId, get);
    },

    deleteSubTask: (projectId: string, taskId: string, subTaskId: string) => {
      sp(set, get, (state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: (state.tasksByProject[projectId] ?? []).map((t) =>
            t.id === taskId
              ? { ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== subTaskId) }
              : t
          ),
        },
      }));
      scheduleSyncToSupabase(projectId, get);
    },

    getAgendaTasksForWeek: (projectId: string, weekStart: string): AgendaTask[] => {
      const start = new Date(weekStart);
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 7);
      return (get().tasksByProject[projectId] ?? []).filter((t) => {
        const d = new Date(t.date);
        return d >= start && d < end;
      });
    },

    setAgendaTaskRecurrence: (projectId: string, taskId: string, recurrence: RecurrenceRule | undefined) => {
      sp(set, get, (state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: (state.tasksByProject[projectId] ?? []).map((t) =>
            t.id === taskId ? { ...t, recurrence } : t
          ),
        },
      }));
      scheduleSyncToSupabase(projectId, get);
    },

    ensureRecurringTasksForRange: (projectId: string, dateStart: string, dateEnd: string) => {
      const allTasks = get().tasksByProject[projectId] ?? [];
      const sources = allTasks.filter((t) => t.recurrence && !t.recurrenceSourceId);
      if (sources.length === 0) return;

      const existingKeys = new Set<string>();
      for (const t of allTasks) {
        if (t.recurrenceSourceId) existingKeys.add(`${t.recurrenceSourceId}|${t.date}`);
      }

      const newTasks: AgendaTask[] = [];
      const rangeStart = new Date(dateStart + "T00:00:00");
      const rangeEnd = new Date(dateEnd + "T00:00:00");

      for (const source of sources) {
        const sourceDow = new Date(source.date + "T00:00:00").getDay();
        for (let d = new Date(rangeStart); d < rangeEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = isoDate(d);
          if (dateStr <= source.date) continue;
          if (source.recurrence!.type === "weekly" && d.getDay() !== sourceDow) continue;
          const key = `${source.id}|${dateStr}`;
          if (existingKeys.has(key)) continue;
          existingKeys.add(key);
          const orderBase =
            allTasks.filter((t) => t.date === dateStr).length +
            newTasks.filter((t) => t.date === dateStr).length;
          newTasks.push({
            id: crypto.randomUUID(),
            projectId,
            title: source.title,
            date: dateStr,
            status: "pending",
            sessions: [],
            totalMs: 0,
            createdAt: new Date().toISOString(),
            order: orderBase,
            description: source.description,
            priority: source.priority,
            category: source.category,
            subtasks: source.subtasks?.map((s) => ({ ...s, id: crypto.randomUUID() })),
            ...(source.sectionId ? { sectionId: source.sectionId, sectionTitle: source.sectionTitle } : {}),
            recurrenceSourceId: source.id,
          });
        }
      }

      if (newTasks.length === 0) return;
      sp(set, get, (state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: [...(state.tasksByProject[projectId] ?? []), ...newTasks],
        },
      }));
      scheduleSyncToSupabase(projectId, get);
    },
  };
}
