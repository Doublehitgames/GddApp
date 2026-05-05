"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import type { AgendaTask, TaskPriority, SubTask } from "@/lib/agenda/types";
import { useI18n } from "@/lib/i18n/provider";
import { toSlug } from "@/lib/utils/slug";

interface Props {
  task: AgendaTask;
  isActive: boolean;
  readOnly?: boolean;
  /** Slug do projeto — necessário para montar o link de navegação até a seção vinculada */
  projectSlug?: string;
  onClose: () => void;
  onPlay: () => void;
  onPause: () => void;
  onFinish: () => void;
  onDelete: () => void;
  onRenameTitle: (title: string) => void;
  onUpdateDetail: (patch: Partial<Pick<AgendaTask, "description" | "priority" | "category">>) => void;
  onAddSubTask: (title: string) => void;
  onToggleSubTask: (subTaskId: string) => void;
  onDeleteSubTask: (subTaskId: string) => void;
}

const PRIORITY_STYLE: Record<TaskPriority, { dot: string; bg: string; text: string; border: string }> = {
  low:    { dot: "bg-slate-400",  bg: "bg-slate-500/15", text: "text-slate-300",  border: "border-slate-600/50" },
  medium: { dot: "bg-amber-400",  bg: "bg-amber-500/15", text: "text-amber-300",  border: "border-amber-600/50" },
  high:   { dot: "bg-rose-400",   bg: "bg-rose-500/15",  text: "text-rose-300",   border: "border-rose-600/50"  },
};

const CATEGORY_KEYS = ["meeting", "design", "code", "review", "qa", "planning", "docs", "research"] as const;

function SubTaskRow({ sub, readOnly, onToggle, onDelete }: {
  sub: SubTask;
  readOnly?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-800/50 transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${sub.done ? "border-emerald-500 bg-emerald-500/30" : "border-gray-600 bg-transparent hover:border-gray-400"}`}
      >
        {sub.done && (
          <svg className="h-2.5 w-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-sm ${sub.done ? "line-through text-gray-500" : "text-gray-200"}`}>
        {sub.title}
      </span>
      {!readOnly && (
        <button
          type="button"
          onClick={onDelete}
          className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-gray-700 opacity-0 group-hover:opacity-100 hover:text-rose-400 transition-all"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export default function TaskDetailDrawer({
  task, isActive, readOnly, projectSlug, onClose,
  onPlay, onPause, onFinish, onDelete,
  onRenameTitle, onUpdateDetail,
  onAddSubTask, onToggleSubTask, onDeleteSubTask,
}: Props) {
  const { t } = useI18n();

  const CATEGORY_PRESETS = CATEGORY_KEYS.map((key) => ({
    key,
    label: t(`agenda.categories.${key}`),
  }));

  const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string; bg: string; text: string; border: string }> = {
    low:    { label: t("agenda.priorityLow"),    ...PRIORITY_STYLE.low    },
    medium: { label: t("agenda.priorityMedium"), ...PRIORITY_STYLE.medium },
    high:   { label: t("agenda.priorityHigh"),   ...PRIORITY_STYLE.high   },
  };

  const [titleValue, setTitleValue] = useState(task.title);
  const [descValue, setDescValue] = useState(task.description ?? "");
  const [categoryValue, setCategoryValue] = useState(task.category ?? "");
  const [customCategory, setCustomCategory] = useState(
    task.category && !CATEGORY_PRESETS.some((c) => c.label === task.category) ? task.category : ""
  );
  const [newSubTask, setNewSubTask] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when task prop changes (e.g. switching tasks)
  useEffect(() => {
    setTitleValue(task.title);
    setDescValue(task.description ?? "");
    setCategoryValue(task.category ?? "");
    setCustomCategory(task.category && !CATEGORY_PRESETS.some((c) => c.label === task.category) ? task.category : "");
  }, [task.id]);

  // Live timer — driven by open session directly, not isActive
  useEffect(() => {
    const openSession = task.sessions.find((s) => !s.endedAt);
    if (!openSession) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - new Date(openSession.startedAt).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [task.sessions]);

  const openSession = task.sessions.find((s) => !s.endedAt);
  const liveMs = openSession
    ? task.totalMs + elapsed
    : task.totalMs;
  const isDone = task.status === "done";
  const isRunning = task.status === "running";
  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter((s) => s.done).length;

  const commitTitle = useCallback(() => {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== task.title) onRenameTitle(trimmed);
    else setTitleValue(task.title);
  }, [titleValue, task.title, onRenameTitle]);

  const commitDesc = useCallback(() => {
    if (descValue !== (task.description ?? "")) {
      onUpdateDetail({ description: descValue || undefined });
    }
  }, [descValue, task.description, onUpdateDetail]);

  const setCategory = (cat: string) => {
    setCategoryValue(cat);
    onUpdateDetail({ category: cat || undefined });
  };

  const commitCustomCategory = () => {
    const trimmed = customCategory.trim();
    if (trimmed) { setCategoryValue(trimmed); onUpdateDetail({ category: trimmed }); }
    else if (!categoryValue) onUpdateDetail({ category: undefined });
  };

  const submitSubTask = () => {
    const trimmed = newSubTask.trim();
    if (!trimmed) return;
    onAddSubTask(trimmed);
    setNewSubTask("");
    subInputRef.current?.focus();
  };

  // Trap focus & close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const priorityCfg = task.priority ? PRIORITY_CONFIG[task.priority] : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-700/80 bg-gray-950 shadow-2xl shadow-black/60 animate-in slide-in-from-right duration-200"
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 border-b border-gray-800 px-5 py-4">
          {/* Priority dot */}
          {task.priority && (
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY_CONFIG[task.priority].dot}`} />
          )}

          <input
            ref={titleRef}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === "Enter") titleRef.current?.blur(); }}
            disabled={isDone || readOnly}
            className="flex-1 min-w-0 bg-transparent text-base font-semibold text-white outline-none placeholder:text-gray-500 disabled:opacity-60 focus:border-b focus:border-sky-500 pb-0.5"
            placeholder="Nome da atividade"
          />
          {readOnly && (
            <span className="shrink-0 rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gray-500">
              {t("agenda.historyBadge")}
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
            aria-label="Fechar"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Timer block */}
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            isRunning ? "border-sky-500/40 bg-sky-950/40" : isDone ? "border-emerald-800/40 bg-emerald-950/20" : "border-gray-700/60 bg-gray-900/50"
          }`}>
            <div className="flex-1">
              <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
                {isRunning ? t("agenda.statusRunning") : isDone ? t("agenda.statusDone") : task.status === "paused" ? t("agenda.statusPaused") : t("agenda.statusPending")}
              </p>
              <p className={`mt-0.5 font-mono text-2xl font-bold tabular-nums leading-none ${
                isRunning ? "text-sky-300" : isDone ? "text-emerald-400" : liveMs > 0 ? "text-amber-300" : "text-gray-600"
              }`}>
                {liveMs > 0 ? formatDuration(liveMs) : "—"}
              </p>
            </div>

            {!isDone && !readOnly && (
              <div className="flex gap-2">
                {isRunning ? (
                  <button onClick={onPause} className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors" title={t("agenda.pause")}>
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  </button>
                ) : (
                  <button onClick={onPlay} className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition-colors" title={t("agenda.play")}>
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                )}
                <button onClick={onFinish} className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors" title={t("agenda.finish")}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t("agenda.priorityLabel")}</p>
            <div className={`flex gap-2 ${readOnly ? "pointer-events-none opacity-60" : ""}`}>
              {(["low", "medium", "high"] as TaskPriority[]).map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const active = task.priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onUpdateDetail({ priority: active ? undefined : p })}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
                      active ? `${cfg.bg} ${cfg.text} ${cfg.border}` : "border-gray-700 bg-gray-900/60 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t("agenda.categoryLabel")}</p>
            <div className={`flex flex-wrap gap-1.5 ${readOnly ? "pointer-events-none opacity-60" : ""}`}>
              {CATEGORY_PRESETS.map(({ key, label }) => {
                const active = categoryValue === label;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(active ? "" : label)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      active
                        ? "border-sky-500/60 bg-sky-500/20 text-sky-200"
                        : "border-gray-700 bg-gray-900/60 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              onBlur={commitCustomCategory}
              onKeyDown={(e) => { if (e.key === "Enter") commitCustomCategory(); }}
              placeholder={t("agenda.categoryOther")}
              readOnly={readOnly}
              disabled={readOnly}
              className={`w-full rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/20 ${readOnly ? "opacity-60 cursor-default" : ""}`}
            />
          </div>

          {/* Seção vinculada */}
          {task.sectionTitle && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t("agenda.sectionPanel.sectionBadge")}</p>
              {projectSlug ? (
                <Link
                  href={`/projects/${projectSlug}/sections/${toSlug(task.sectionTitle)}`}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-700/40 bg-violet-900/20 px-3 py-1.5 text-sm font-medium text-violet-300 hover:bg-violet-900/40 hover:text-violet-200 transition-colors"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {task.sectionTitle}
                  <svg className="h-3 w-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-700/40 bg-violet-900/20 px-3 py-1.5 text-sm font-medium text-violet-300">
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {task.sectionTitle}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t("agenda.descriptionLabel")}</p>
            <textarea
              ref={descRef}
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              onBlur={commitDesc}
              rows={4}
              readOnly={readOnly}
              placeholder={readOnly ? "—" : t("agenda.descriptionPlaceholder")}
              className={`w-full resize-y rounded-xl border border-gray-700 bg-gray-900/60 px-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/20 leading-relaxed ${readOnly ? "opacity-60 cursor-default resize-none" : ""}`}
            />
          </div>

          {/* Subtasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{t("agenda.subtasksLabel")}</p>
              {subtasks.length > 0 && (
                <span className="text-xs text-gray-500">
                  {t("agenda.subtasksDone").replace("{done}", String(doneSubtasks)).replace("{total}", String(subtasks.length))}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {subtasks.length > 0 && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(doneSubtasks / subtasks.length) * 100}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {subtasks.map((sub) => (
                <SubTaskRow
                  key={sub.id}
                  sub={sub}
                  readOnly={readOnly}
                  onToggle={() => onToggleSubTask(sub.id)}
                  onDelete={() => onDeleteSubTask(sub.id)}
                />
              ))}

              {/* Add subtask inline */}
              {!readOnly && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-700 px-2 py-1.5 focus-within:border-sky-500/50 focus-within:bg-sky-950/20 transition-colors">
                  <svg className="h-3.5 w-3.5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <input
                    ref={subInputRef}
                    type="text"
                    value={newSubTask}
                    onChange={(e) => setNewSubTask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitSubTask(); }}
                    placeholder={t("agenda.addSubtask")}
                    className="flex-1 bg-transparent text-sm text-gray-300 placeholder:text-gray-600 outline-none"
                  />
                  {newSubTask.trim() && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); submitSubTask(); }}
                      className="shrink-0 rounded px-1.5 py-0.5 text-xs text-sky-400 hover:text-sky-200 transition-colors"
                    >
                      ↵
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        {!readOnly && (
          <div className="border-t border-gray-800 px-5 py-4">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-3">
                <p className="flex-1 text-sm text-gray-400">{t("agenda.confirmDelete")}</p>
                <button onClick={() => setShowDeleteConfirm(false)} className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors">
                  {t("agenda.cancel")}
                </button>
                <button onClick={onDelete} className="rounded-lg border border-rose-700/50 bg-rose-900/30 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-800/40 transition-colors">
                  {t("agenda.delete")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-rose-400 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t("agenda.deleteTask")}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
