"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { AgendaTask } from "@/lib/agenda/types";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  task: AgendaTask;
  isActive: boolean;
  readOnly?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onFinish: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onOpenDetail: () => void;
}

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-amber-400",
  high: "bg-rose-400",
};

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function formatDurationShort(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `0min ${String(s).padStart(2, "0")}s`;
}

export default function TaskRow({ task, isActive, readOnly, onPlay, onPause, onFinish, onDelete, onRename, onOpenDetail }: Props) {
  const { t } = useI18n();
  const [elapsed, setElapsed] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  // Live timer tick — driven by open session directly, not isActive
  useEffect(() => {
    const openSession = task.sessions.find((s) => !s.endedAt);
    if (!openSession) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - new Date(openSession.startedAt).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [task.sessions]);

  // totalMs already excludes the open session's durationMs (it's 0 while running),
  // so liveMs = completed sessions + current session elapsed
  const openSession = task.sessions.find((s) => !s.endedAt);
  const liveMs = openSession
    ? task.totalMs + elapsed
    : task.totalMs;
  const isDone = task.status === "done";
  const isRunning = task.status === "running";
  const isPaused = task.status === "paused";
  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter((s) => s.done).length;

  // Dismiss actions panel on outside click
  useEffect(() => {
    if (!showActions) return;
    const handler = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) setShowActions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showActions]);

  return (
    <div
      ref={rowRef}
      className={`group relative flex flex-col gap-1.5 rounded-xl border px-4 py-3 transition-all duration-200 ${
        isRunning
          ? "border-sky-500/50 bg-sky-950/40 shadow-md shadow-sky-900/20"
          : isDone
          ? "border-emerald-800/40 bg-emerald-950/20 opacity-70"
          : isPaused
          ? "border-amber-700/40 bg-amber-950/20"
          : "border-gray-700/60 bg-gray-900/50 hover:border-gray-600 hover:bg-gray-800/60"
      }`}
    >
      {/* Running pulse indicator */}
      {isRunning && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 ml-[-1px] h-8 w-0.5 rounded-full bg-sky-400 animate-pulse" />
      )}

      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Status circle */}
        <button
          type="button"
          onClick={() => (isDone || readOnly) ? undefined : isRunning ? onPause() : onPlay()}
          disabled={isDone || readOnly}
          className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
            isDone
              ? "border-emerald-500 bg-emerald-500/30 cursor-default"
              : isRunning
              ? "border-sky-400 bg-sky-400/20 hover:bg-sky-400/30"
              : isPaused
              ? "border-amber-400 bg-amber-400/10 hover:bg-amber-400/20"
              : "border-gray-600 bg-transparent hover:border-gray-400"
          }`}
          title={isDone ? t("agenda.statusDone") : isRunning ? t("agenda.pause") : t("agenda.play")}
        >
          {isDone && (
            <svg className="h-2.5 w-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isRunning && (
            <span className="flex gap-px">
              <span className="h-2 w-0.5 rounded-sm bg-sky-400" />
              <span className="h-2 w-0.5 rounded-sm bg-sky-400" />
            </span>
          )}
          {isPaused && (
            <svg className="h-2.5 w-2.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Priority dot */}
        {task.priority && (
          <span className={`shrink-0 h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority]}`} />
        )}

        {/* Title — click opens detail drawer */}
        <button
          type="button"
          onClick={onOpenDetail}
          className={`flex-1 min-w-0 text-left text-sm leading-snug transition-colors ${
            isDone
              ? "line-through text-gray-500"
              : isRunning
              ? "text-white font-medium hover:text-sky-100"
              : "text-gray-200 hover:text-white"
          }`}
          title={t("agenda.details")}
        >
          <span className="block truncate">{task.title}</span>
        </button>

        {/* Timer display */}
        {liveMs > 0 && (
          <span className={`shrink-0 font-mono text-xs tabular-nums ${
            isRunning ? "text-sky-300" : isDone ? "text-emerald-500" : isPaused ? "text-amber-400" : "text-gray-500"
          }`}>
            {isRunning ? formatDuration(liveMs) : formatDurationShort(liveMs)}
          </span>
        )}

        {/* Action buttons */}
        {!isDone && !readOnly && (
          <div className={`shrink-0 flex items-center gap-1 transition-opacity ${showActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            {isRunning ? (
              <button type="button" onClick={onPause} className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors" title={t("agenda.pause")}>
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              </button>
            ) : (
              <button type="button" onClick={onPlay} className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition-colors" title={t("agenda.play")}>
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            )}
            <button type="button" onClick={onFinish} className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors" title={t("agenda.finish")}>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <div className="relative">
              <button type="button" onClick={() => setShowActions((v) => !v)} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors" title={t("agenda.moreActions")}>
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {showActions && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[130px] rounded-xl border border-gray-700 bg-gray-900 shadow-xl py-1">
                  <button type="button" onClick={() => { onOpenDetail(); setShowActions(false); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
                    {t("agenda.details")}
                  </button>
                  <button type="button" onClick={() => { onDelete(); setShowActions(false); }} className="w-full text-left px-3 py-1.5 text-sm text-rose-400 hover:bg-gray-800 hover:text-rose-300 transition-colors">
                    {t("agenda.delete")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {isDone && !readOnly && (
          <button type="button" onClick={onDelete} className="flex h-6 w-6 opacity-0 group-hover:opacity-100 items-center justify-center rounded text-gray-600 hover:text-rose-400 transition-all" title={t("agenda.delete")}>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Metadata row: section + category + description preview + subtasks */}
      {(task.sectionTitle || task.category || task.description || subtasks.length > 0) && (
        <div className="flex items-center gap-2 pl-8 flex-wrap">
          {task.sectionTitle && (
            <span className="flex items-center gap-1 rounded-full border border-violet-700/40 bg-violet-900/20 px-2 py-0.5 text-[11px] font-medium text-violet-400">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {task.sectionTitle}
            </span>
          )}
          {task.category && (
            <span className="rounded-full border border-sky-700/40 bg-sky-900/20 px-2 py-0.5 text-[11px] font-medium text-sky-400">
              {task.category}
            </span>
          )}
          {task.description && (
            <span className="text-[11px] text-gray-500 truncate max-w-[200px]">
              {task.description}
            </span>
          )}
          {subtasks.length > 0 && (
            <span className={`ml-auto text-[11px] font-medium tabular-nums ${doneSubtasks === subtasks.length ? "text-emerald-500" : "text-gray-500"}`}>
              {t("agenda.subtasksDone").replace("{done}", String(doneSubtasks)).replace("{total}", String(subtasks.length))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
