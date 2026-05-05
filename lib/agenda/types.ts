export type TaskStatus = "pending" | "running" | "paused" | "done";

export type TaskPriority = "low" | "medium" | "high";

export type SubTask = {
  id: string;
  title: string;
  done: boolean;
};

export type TimeSession = {
  startedAt: string;
  endedAt?: string;
  durationMs: number;
};

export type AgendaTask = {
  id: string;
  projectId: string;
  title: string;
  /** ISO date string "YYYY-MM-DD" — the day this task belongs to */
  date: string;
  status: TaskStatus;
  /** Each continuous play→pause/finish is one session */
  sessions: TimeSession[];
  /** Sum of all completed sessions in ms */
  totalMs: number;
  createdAt: string;
  completedAt?: string;
  order: number;
  // Detail fields
  description?: string;
  priority?: TaskPriority;
  category?: string;
  subtasks?: SubTask[];
  /** True when this task was carried over to another day — hides it from the carry-over banner */
  carriedOver?: boolean;
  /** ID da seção do projeto à qual esta tarefa está vinculada */
  sectionId?: string;
  /** Título da seção (snapshot no momento da criação) */
  sectionTitle?: string;
};

export type AgendaState = {
  /** projectId → AgendaTask[] */
  tasksByProject: Record<string, AgendaTask[]>;
  /** id of the task currently running (one at a time, across all projects) */
  activeTaskId: string | null;
};

export type AgendaActions = {
  addAgendaTask: (projectId: string, date: string, title: string, opts?: { sectionId?: string; sectionTitle?: string }) => string;
  updateAgendaTask: (projectId: string, taskId: string, patch: Partial<Pick<AgendaTask, "title" | "date" | "order">>) => void;
  updateAgendaTaskDetail: (projectId: string, taskId: string, patch: Partial<Pick<AgendaTask, "description" | "priority" | "category">>) => void;
  addSubTask: (projectId: string, taskId: string, title: string) => void;
  toggleSubTask: (projectId: string, taskId: string, subTaskId: string) => void;
  deleteSubTask: (projectId: string, taskId: string, subTaskId: string) => void;
  deleteAgendaTask: (projectId: string, taskId: string) => void;
  playAgendaTask: (projectId: string, taskId: string) => void;
  pauseAgendaTask: (projectId: string, taskId: string) => void;
  finishAgendaTask: (projectId: string, taskId: string) => void;
  getAgendaTasksForWeek: (projectId: string, weekStart: string) => AgendaTask[];
};
