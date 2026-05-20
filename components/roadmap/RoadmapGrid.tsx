"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  PointerSensor, useSensor, useSensors, closestCenter,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  RoadmapPhase, RoadmapTheme, RoadmapItem,
  PhaseStatus, PhaseHeaderType, ThemeColor,
} from "@/lib/roadmap/types";
import { THEME_COLORS } from "@/lib/roadmap/types";
import ItemChip from "./ItemChip";
import { CommitTextInput, CommitTextarea } from "@/components/common/CommitInput";
import { MarkdownContent } from "@/components/common/MarkdownContent";
import { useI18n } from "@/lib/i18n/provider";

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_LABEL_W = "w-36";
const PHASE_COL_W   = "w-52";

const THEME_COLOR_STYLES: Record<ThemeColor, { border: string; dot: string; label: string; text: string; row: string }> = {
  sky:     { border: "border-l-sky-400",     dot: "bg-sky-400",     label: "bg-sky-900/50 border-sky-600/60",         text: "text-sky-200",     row: "bg-sky-950/30" },
  emerald: { border: "border-l-emerald-400", dot: "bg-emerald-400", label: "bg-emerald-900/50 border-emerald-600/60", text: "text-emerald-200", row: "bg-emerald-950/30" },
  amber:   { border: "border-l-amber-400",   dot: "bg-amber-400",   label: "bg-amber-900/50 border-amber-600/60",     text: "text-amber-200",   row: "bg-amber-950/30" },
  violet:  { border: "border-l-violet-400",  dot: "bg-violet-400",  label: "bg-violet-900/50 border-violet-600/60",   text: "text-violet-200",  row: "bg-violet-950/30" },
  rose:    { border: "border-l-rose-400",    dot: "bg-rose-400",    label: "bg-rose-900/50 border-rose-600/60",       text: "text-rose-200",    row: "bg-rose-950/30" },
  pink:    { border: "border-l-pink-400",    dot: "bg-pink-400",    label: "bg-pink-900/50 border-pink-600/60",       text: "text-pink-200",    row: "bg-pink-950/30" },
  indigo:  { border: "border-l-indigo-400",  dot: "bg-indigo-400",  label: "bg-indigo-900/50 border-indigo-600/60",   text: "text-indigo-200",  row: "bg-indigo-950/30" },
  slate:   { border: "border-l-slate-400",   dot: "bg-slate-400",   label: "bg-slate-700/50 border-slate-500/60",     text: "text-slate-200",   row: "bg-slate-800/30" },
};

const PHASE_STATUS_STYLES: Record<PhaseStatus, { dot: string; badge: string; text: string }> = {
  planned:   { dot: "bg-slate-500",                badge: "border-slate-700/50 bg-slate-800/50",          text: "text-slate-400" },
  active:    { dot: "bg-emerald-400 animate-pulse", badge: "border-emerald-700/50 bg-emerald-950/50",     text: "text-emerald-300" },
  completed: { dot: "bg-gray-600",                 badge: "border-gray-700/40 bg-gray-800/40",            text: "text-gray-500" },
  cancelled: { dot: "bg-rose-500",                 badge: "border-rose-700/40 bg-rose-950/30",            text: "text-rose-400" },
};

const HEADER_TYPE_OPTIONS: PhaseHeaderType[] = ["title", "month", "quarter", "semester", "year"];

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatPhaseHeader(phase: RoadmapPhase): string {
  if (phase.headerType === "title" || !phase.targetDate) return phase.name;
  const [y, m] = phase.targetDate.split("-").map(Number);
  switch (phase.headerType) {
    case "month":    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    case "quarter":  return `Q${Math.ceil(m / 3)} ${y}`;
    case "semester": return `S${m <= 6 ? 1 : 2} ${y}`;
    case "year":     return String(y);
  }
}

// ─── GripIcon ─────────────────────────────────────────────────────────────────

function GripIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
    </svg>
  );
}

// ─── PhaseHeaderCell ──────────────────────────────────────────────────────────

function PhaseHeaderCell({
  phase, onUpdate, onDelete, t, dragListeners, dragAttributes, progress, readOnly,
}: {
  phase: RoadmapPhase;
  onUpdate: (patch: Partial<Pick<RoadmapPhase, "name" | "description" | "headerType" | "targetDate" | "status" | "isPublic">>) => void;
  onDelete: () => void;
  t: (key: string) => string;
  dragListeners?: Record<string, unknown>;
  dragAttributes?: Record<string, unknown>;
  progress?: { done: number; total: number };
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [descTab, setDescTab] = useState<"write" | "preview">("write");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const st = PHASE_STATUS_STYLES[phase.status];

  useEffect(() => {
    if (!open) return;
    let mousedownInside = false;
    const onMouseDown = (e: MouseEvent) => {
      mousedownInside = !!ref.current?.contains(e.target as Node);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (mousedownInside) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative w-full h-full">
      <button
        type="button"
        onClick={() => { if (!readOnly) setOpen((v) => !v); }}
        className={`w-full h-full flex flex-col items-start justify-start gap-1 px-3 py-3 pr-8 rounded-t-xl border border-b-0 border-gray-700/60 bg-gray-900/80 transition-colors text-left ${readOnly ? "cursor-default" : "hover:bg-gray-800/80"}`}
      >
        <div className="flex items-center gap-2 w-full">
          <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
          <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">
            {formatPhaseHeader(phase)}
          </span>
          {!readOnly && (
            <svg className="h-3 w-3 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          )}
        </div>
        {phase.headerType !== "title" && phase.name && (
          <span className="text-[11px] text-gray-500 pl-4 truncate w-full">{phase.name}</span>
        )}
        <div className="flex items-center gap-1.5 w-full pl-4 mt-0.5">
          <div className="flex-1 h-1 rounded-full bg-gray-700/40 overflow-hidden">
            {progress && progress.total > 0 && (
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress.done === progress.total ? "bg-emerald-400" : "bg-sky-500"
                }`}
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            )}
          </div>
          {progress && progress.total > 0 && (
            <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">
              {progress.done}/{progress.total}
            </span>
          )}
        </div>
      </button>

      {/* Drag handle — top-right corner of header */}
      {dragListeners && (
        <button
          type="button"
          {...(dragListeners as React.HTMLAttributes<HTMLButtonElement>)}
          {...(dragAttributes as React.HTMLAttributes<HTMLButtonElement>)}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-1.5 p-1 cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-400 touch-none transition-colors"
          tabIndex={-1}
        >
          <GripIcon className="h-3 w-3 rotate-90" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[576px] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-3 flex flex-col gap-2.5">
          {/* Name */}
          <CommitTextInput
            value={phase.name}
            onCommit={(v) => onUpdate({ name: v })}
            autoFocus
            placeholder={t("roadmap.phase.namePlaceholder")}
            className="w-full bg-gray-800 rounded-lg border border-gray-700 px-2.5 py-1.5 text-sm text-white outline-none focus:border-gray-500 placeholder-gray-600"
          />

          {/* Description */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                {t("roadmap.phase.descriptionLabel")}
              </label>
              <div className="flex rounded-md overflow-hidden border border-gray-700 text-[10px]">
                <button
                  type="button"
                  onClick={() => setDescTab("write")}
                  className={`px-2 py-0.5 transition-colors ${descTab === "write" ? "bg-gray-700 text-gray-200" : "text-gray-500 hover:text-gray-300"}`}
                >
                  {t("common.tabWrite")}
                </button>
                <button
                  type="button"
                  onClick={() => setDescTab("preview")}
                  className={`px-2 py-0.5 transition-colors ${descTab === "preview" ? "bg-gray-700 text-gray-200" : "text-gray-500 hover:text-gray-300"}`}
                >
                  {t("common.tabPreview")}
                </button>
              </div>
            </div>
            {descTab === "write" ? (
              <CommitTextarea
                value={phase.description ?? ""}
                onCommit={(v) => onUpdate({ description: v || undefined })}
                rows={5}
                placeholder={t("roadmap.phase.descriptionPlaceholder")}
                className="w-full bg-gray-800 rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-gray-500 placeholder-gray-600 resize-y leading-relaxed min-h-[80px]"
              />
            ) : (
              <div className="min-h-[80px] rounded-lg border border-gray-700 bg-gray-800/50 px-2.5 py-1.5">
                {phase.description ? (
                  <MarkdownContent theme="dark">{phase.description}</MarkdownContent>
                ) : (
                  <p className="text-xs text-gray-600 italic">{t("roadmap.phase.descriptionPlaceholder")}</p>
                )}
              </div>
            )}
          </div>

          {/* Header type */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider">{t("roadmap.phase.headerType")}</label>
            <div className="flex flex-wrap gap-1">
              {HEADER_TYPE_OPTIONS.map((ht) => (
                <button
                  key={ht}
                  type="button"
                  onClick={() => onUpdate({ headerType: ht })}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    phase.headerType === ht
                      ? "border-emerald-700 bg-emerald-950/50 text-emerald-300"
                      : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                  }`}
                >
                  {t("roadmap.headerType." + ht)}
                </button>
              ))}
            </div>
          </div>

          {/* Target date */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-500 uppercase tracking-wider">{t("roadmap.phase.targetDate")}</label>
            <input
              type="month"
              value={phase.targetDate ?? ""}
              onChange={(e) => onUpdate({ targetDate: e.target.value || undefined })}
              className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 outline-none focus:border-gray-500 [color-scheme:dark]"
            />
          </div>

          {/* Status */}
          <div className="flex flex-wrap gap-1">
            {(["planned", "active", "completed", "cancelled"] as PhaseStatus[]).map((s) => {
              const ss = PHASE_STATUS_STYLES[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onUpdate({ status: s })}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    phase.status === s ? ss.badge + " " + ss.text : "border-gray-700 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                  {t("roadmap.phaseStatus." + s)}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-0.5 border-t border-gray-800">
            <button
              type="button"
              onClick={() => onUpdate({ isPublic: !phase.isPublic })}
              className={`flex items-center gap-1.5 text-xs transition-colors ${phase.isPublic ? "text-emerald-400" : "text-gray-600"}`}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
              {phase.isPublic ? t("roadmap.phase.public") : t("roadmap.phase.private")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-rose-400 transition-colors"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t("roadmap.phase.delete")}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation popup */}
      {confirmDelete && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setConfirmDelete(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-rose-700/60 bg-gray-900 p-5 shadow-2xl min-w-[280px] max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-gray-200 mb-1">
              {t("roadmap.phase.deleteConfirmQuestion")}{" "}
              <strong className="text-white">{phase.name}</strong>?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {t("roadmap.phase.deleteWarning")}
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                onClick={() => setConfirmDelete(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg border border-rose-700/60 bg-rose-900/40 px-4 py-1.5 text-xs text-rose-200 hover:bg-rose-900/60 transition-colors"
                onClick={() => { setConfirmDelete(false); onDelete(); setOpen(false); }}
              >
                {t("roadmap.phase.delete")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── SortablePhaseHeader ──────────────────────────────────────────────────────

function SortablePhaseHeader({
  phase, onUpdate, onDelete, t, progress, readOnly,
}: {
  phase: RoadmapPhase;
  onUpdate: (patch: Partial<Pick<RoadmapPhase, "name" | "description" | "headerType" | "targetDate" | "status" | "isPublic">>) => void;
  onDelete: () => void;
  t: (k: string) => string;
  progress?: { done: number; total: number };
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: phase.id,
    data: { type: "phase" },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${PHASE_COL_W} shrink-0 border-b border-r border-gray-800/60 ${isDragging ? "opacity-40 z-50" : ""}`}
    >
      <PhaseHeaderCell
        phase={phase}
        onUpdate={onUpdate}
        onDelete={onDelete}
        t={t}
        progress={progress}
        readOnly={readOnly}
        dragListeners={readOnly ? undefined : (listeners as unknown as Record<string, unknown>)}
        dragAttributes={readOnly ? undefined : (attributes as unknown as Record<string, unknown>)}
      />
    </div>
  );
}

// ─── SortableItemWrapper ──────────────────────────────────────────────────────

function SortableItemWrapper({
  item, onUpdate, onDelete, readOnly,
}: {
  item: RoadmapItem;
  onUpdate: (patch: Partial<Pick<RoadmapItem, "title" | "description" | "tag" | "status" | "isPublic">>) => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: "item", phaseId: item.phaseId, themeId: item.themeId },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40 scale-95" : ""}
    >
      <ItemChip
        item={item}
        onUpdate={onUpdate}
        onDelete={onDelete}
        readOnly={readOnly}
        dragHandleListeners={readOnly ? undefined : (listeners as unknown as Record<string, unknown>)}
        dragHandleAttributes={readOnly ? undefined : (attributes as unknown as Record<string, unknown>)}
      />
    </div>
  );
}

// ─── DroppableCell ────────────────────────────────────────────────────────────

function DroppableCell({
  phaseId, themeId, children,
}: {
  phaseId: string;
  themeId: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${phaseId}:${themeId}`,
    data: { type: "cell", phaseId, themeId },
  });
  return (
    <div
      ref={setNodeRef}
      className={`${PHASE_COL_W} shrink-0 border-r border-gray-800/30 px-2 py-2 flex flex-col gap-1.5 min-h-[72px] transition-colors duration-150 ${
        isOver ? "bg-violet-950/25 ring-1 ring-inset ring-violet-700/40 rounded-sm" : ""
      }`}
    >
      {children}
    </div>
  );
}

// ─── SortableThemeRow ─────────────────────────────────────────────────────────

function SortableThemeRow({
  theme, phases, items,
  onUpdateTheme, onDeleteTheme,
  onAddItem, onUpdateItem, onDeleteItem,
  editingThemeId, setEditingThemeId,
  addingItem, setAddingItem,
  itemDraft, setItemDraft,
  handleAddItem, t, readOnly,
}: {
  theme: RoadmapTheme;
  phases: RoadmapPhase[];
  items: RoadmapItem[];
  onUpdateTheme: (themeId: string, patch: Partial<Pick<RoadmapTheme, "name" | "color">>) => void;
  onDeleteTheme: (themeId: string) => void;
  onAddItem: (phaseId: string, themeId: string, title: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<Pick<RoadmapItem, "title" | "description" | "thumbUrl" | "tag" | "status" | "isPublic" | "order" | "phaseId" | "themeId">>) => void;
  onDeleteItem: (itemId: string) => void;
  editingThemeId: string | null;
  setEditingThemeId: (id: string | null) => void;
  addingItem: { phaseId: string; themeId: string } | null;
  setAddingItem: (v: { phaseId: string; themeId: string } | null) => void;
  itemDraft: string;
  setItemDraft: (v: string) => void;
  handleAddItem: () => void;
  t: (k: string) => string;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: theme.id,
    data: { type: "theme" },
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cs = THEME_COLOR_STYLES[theme.color];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex border-b border-gray-800/40 ${cs.row} ${isDragging ? "opacity-40" : ""}`}
    >
      {/* Theme label — sticky left */}
      <div className={`${THEME_LABEL_W} shrink-0 sticky left-0 z-10 border-r border-l-[6px] border-gray-800/60 ${cs.border} bg-gray-950/95 px-2 py-3 flex flex-col gap-1 justify-center`}>
        {/* Drag handle + name row */}
        <div className="flex items-center gap-1">
          {/* Drag handle — hidden for read-only members */}
          {!readOnly && (
            <button
              type="button"
              {...(listeners as React.HTMLAttributes<HTMLButtonElement>)}
              {...(attributes as React.HTMLAttributes<HTMLButtonElement>)}
              className="shrink-0 cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-400 touch-none transition-colors"
              tabIndex={-1}
            >
              <GripIcon className="h-2.5 w-2.5" />
            </button>
          )}

          {readOnly ? (
            /* Static theme name for members */
            <span className={`flex-1 text-xs font-semibold leading-snug ${cs.text} truncate`}>
              {theme.name}
            </span>
          ) : editingThemeId === theme.id ? (
            <CommitTextInput
              value={theme.name}
              onCommit={(v) => { onUpdateTheme(theme.id, { name: v }); setEditingThemeId(null); }}
              autoFocus
              className="flex-1 bg-gray-800 rounded border border-gray-700 px-1.5 py-0.5 text-xs text-white outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingThemeId(theme.id)}
              className={`flex-1 text-xs font-semibold text-left leading-snug ${cs.text} hover:opacity-80 transition-opacity truncate`}
            >
              {theme.name}
            </button>
          )}
        </div>

        {/* Color dots + delete — hidden for read-only members */}
        {!readOnly && (
          <div className="flex items-center gap-1 flex-wrap pl-3.5">
            {THEME_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onUpdateTheme(theme.id, { color: c })}
                className={`h-2 w-2 rounded-full transition-transform hover:scale-125 ${THEME_COLOR_STYLES[c].dot}`}
                style={{ opacity: theme.color === c ? 1 : 0.35 }}
              />
            ))}
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto text-gray-700 hover:text-rose-400 transition-colors"
              title={t("roadmap.theme.delete")}
            >
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Phase cells */}
      {phases.map((phase) => {
        const cellItems = items.filter((i) => i.phaseId === phase.id && i.themeId === theme.id);
        const isAddingHere = addingItem?.phaseId === phase.id && addingItem?.themeId === theme.id;

        return (
          <DroppableCell key={phase.id} phaseId={phase.id} themeId={theme.id}>
            <SortableContext items={cellItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {cellItems.map((item) => (
                <SortableItemWrapper
                  key={item.id}
                  item={item}
                  onUpdate={(patch) => onUpdateItem(item.id, patch)}
                  onDelete={() => onDeleteItem(item.id)}
                  readOnly={readOnly}
                />
              ))}
            </SortableContext>

            {/* Add item — hidden for read-only members */}
            {!readOnly && (isAddingHere ? (
              <div className="flex items-center gap-1 rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-2 py-1">
                <input
                  autoFocus
                  value={itemDraft}
                  onChange={(e) => setItemDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddItem();
                    if (e.key === "Escape") { setItemDraft(""); setAddingItem(null); }
                  }}
                  onBlur={handleAddItem}
                  placeholder={t("roadmap.item.newPlaceholder")}
                  className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-gray-500 outline-none"
                />
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => { setAddingItem({ phaseId: phase.id, themeId: theme.id }); setItemDraft(""); }}
                onKeyDown={(e) => e.key === "Enter" && (setAddingItem({ phaseId: phase.id, themeId: theme.id }), setItemDraft(""))}
                className="flex-1 min-h-[28px] w-full rounded border border-dashed border-gray-700/40 flex items-center justify-center cursor-pointer hover:border-violet-700/50 hover:bg-violet-950/10 transition-all group/add"
              >
                <svg className="h-3 w-3 text-gray-700 group-hover/add:text-violet-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            ))}
          </DroppableCell>
        );
      })}

      {/* Delete theme confirmation popup */}
      {confirmDelete && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setConfirmDelete(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-rose-700/60 bg-gray-900 p-5 shadow-2xl min-w-[280px] max-w-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-gray-200 mb-1">
              {t("roadmap.theme.deleteConfirmQuestion")}{" "}
              <strong className="text-white">{theme.name}</strong>?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {t("roadmap.theme.deleteWarning")}
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                onClick={() => setConfirmDelete(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="rounded-lg border border-rose-700/60 bg-rose-900/40 px-4 py-1.5 text-xs text-rose-200 hover:bg-rose-900/60 transition-colors"
                onClick={() => { setConfirmDelete(false); onDeleteTheme(theme.id); }}
              >
                {t("roadmap.theme.delete")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  phases: RoadmapPhase[];
  themes: RoadmapTheme[];
  items: RoadmapItem[];
  phaseProgress?: Record<string, { done: number; total: number }>;
  onAddPhase: (name: string) => void;
  onUpdatePhase: (phaseId: string, patch: Partial<Pick<RoadmapPhase, "name" | "description" | "headerType" | "targetDate" | "status" | "isPublic">>) => void;
  onDeletePhase: (phaseId: string) => void;
  onAddTheme: (name: string) => void;
  onUpdateTheme: (themeId: string, patch: Partial<Pick<RoadmapTheme, "name" | "color">>) => void;
  onDeleteTheme: (themeId: string) => void;
  onAddItem: (phaseId: string, themeId: string, title: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<Pick<RoadmapItem, "title" | "description" | "thumbUrl" | "tag" | "status" | "isPublic" | "order" | "phaseId" | "themeId">>) => void;
  onDeleteItem: (itemId: string) => void;
  onReorderPhases: (orderedIds: string[]) => void;
  onReorderThemes: (orderedIds: string[]) => void;
  onReorderItems: (phaseId: string, themeId: string, orderedIds: string[]) => void;
  /** When true, hides all edit/add/delete controls (member view) */
  readOnly?: boolean;
}

// ─── Main Grid ────────────────────────────────────────────────────────────────

export default function RoadmapGrid({
  phases, themes, items, phaseProgress,
  onAddPhase, onUpdatePhase, onDeletePhase,
  onAddTheme, onUpdateTheme, onDeleteTheme,
  onAddItem, onUpdateItem, onDeleteItem,
  onReorderPhases, onReorderThemes, onReorderItems,
  readOnly,
}: Props) {
  const { t } = useI18n();

  const [addingPhase, setAddingPhase] = useState(false);
  const [phaseDraft, setPhaseDraft]   = useState("");
  const [addingTheme, setAddingTheme] = useState(false);
  const [themeDraft, setThemeDraft]   = useState("");
  const [addingItem, setAddingItem]   = useState<{ phaseId: string; themeId: string } | null>(null);
  const [itemDraft, setItemDraft]     = useState("");
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId]     = useState<string | null>(null);

  const activeItem = activeItemId ? items.find((i) => i.id === activeItemId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleAddPhase() {
    const name = phaseDraft.trim();
    if (name) { onAddPhase(name); setPhaseDraft(""); }
    setAddingPhase(false);
  }

  function handleAddTheme() {
    const name = themeDraft.trim();
    if (name) { onAddTheme(name); setThemeDraft(""); }
    setAddingTheme(false);
  }

  function handleAddItem() {
    if (!addingItem) return;
    const title = itemDraft.trim();
    if (title) onAddItem(addingItem.phaseId, addingItem.themeId, title);
    setItemDraft("");
    setAddingItem(null);
  }

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "item") {
      setActiveItemId(String(event.active.id));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItemId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const type = active.data.current?.type as string;

    if (type === "phase") {
      const oldIdx = phases.findIndex((p) => p.id === active.id);
      const newIdx = phases.findIndex((p) => p.id === over.id);
      if (oldIdx !== newIdx) onReorderPhases(arrayMove(phases, oldIdx, newIdx).map((p) => p.id));
    } else if (type === "theme") {
      const oldIdx = themes.findIndex((t) => t.id === active.id);
      const newIdx = themes.findIndex((t) => t.id === over.id);
      if (oldIdx !== newIdx) onReorderThemes(arrayMove(themes, oldIdx, newIdx).map((t) => t.id));
    } else if (type === "item") {
      const { phaseId, themeId } = active.data.current as { phaseId: string; themeId: string };

      // Determine target cell from the drop target
      let toPhaseId = phaseId;
      let toThemeId = themeId;
      if (over.data.current?.type === "item") {
        toPhaseId = over.data.current.phaseId as string;
        toThemeId = over.data.current.themeId as string;
      } else if (over.data.current?.type === "cell") {
        toPhaseId = over.data.current.phaseId as string;
        toThemeId = over.data.current.themeId as string;
      } else {
        return;
      }

      if (toPhaseId === phaseId && toThemeId === themeId) {
        // Same cell → reorder
        const cellItems = items.filter((i) => i.phaseId === phaseId && i.themeId === themeId);
        const oldIdx = cellItems.findIndex((i) => i.id === active.id);
        const newIdx = cellItems.findIndex((i) => i.id === over.id);
        if (oldIdx !== newIdx) onReorderItems(phaseId, themeId, arrayMove(cellItems, oldIdx, newIdx).map((i) => i.id));
      } else {
        // Different cell → move item there, place at end
        const targetItems = items.filter((i) => i.phaseId === toPhaseId && i.themeId === toThemeId);
        onUpdateItem(String(active.id), { phaseId: toPhaseId, themeId: toThemeId, order: targetItems.length });
      }
    }
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (phases.length === 0 && themes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-gray-700 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-gray-300">{t("roadmap.empty.title")}</p>
          <p className="text-xs text-gray-600 max-w-xs leading-relaxed">{t("roadmap.empty.subtitle")}</p>
        </div>
        {!readOnly && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAddingPhase(true)}
              className="flex items-center gap-2 rounded-xl border border-violet-700/50 bg-violet-950/30 px-4 py-2 text-sm text-violet-300 hover:bg-violet-950/50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("roadmap.timeline.addPhase")}
            </button>
          </div>
        )}
        {addingPhase && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-700/60 bg-emerald-950/20 px-4 py-2 mt-2">
            <input
              autoFocus
              value={phaseDraft}
              onChange={(e) => setPhaseDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddPhase(); if (e.key === "Escape") setAddingPhase(false); }}
              onBlur={handleAddPhase}
              placeholder={t("roadmap.timeline.phaseName")}
              className="bg-transparent text-sm text-white placeholder-gray-500 outline-none w-40"
            />
          </div>
        )}
      </div>
    );
  }

  // ── Grid ───────────────────────────────────────────────────────────────────
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full overflow-auto rounded-xl border border-gray-800/60">
        <div className="min-w-max">

          {/* ── Header row ────────────────────────────────────────────────── */}
          <div className="flex">
            {/* Corner cell */}
            <div className={`${THEME_LABEL_W} shrink-0 sticky left-0 z-20 bg-gray-950 border-b border-r border-gray-800/60 px-3 py-3 flex items-end`}>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-600">{t("roadmap.grid.themes")}</span>
            </div>

            {/* Sortable phase headers */}
            <SortableContext items={phases.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
              {phases.map((phase) => (
                <SortablePhaseHeader
                  key={phase.id}
                  phase={phase}
                  onUpdate={(patch) => onUpdatePhase(phase.id, patch)}
                  onDelete={() => onDeletePhase(phase.id)}
                  t={t}
                  progress={phaseProgress?.[phase.id]}
                  readOnly={readOnly}
                />
              ))}
            </SortableContext>

            {/* Add phase — hidden for read-only members */}
            {!readOnly && <div className="shrink-0 border-b border-gray-800/60 px-2 py-3 flex items-end">
              {addingPhase ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/20 px-2 py-1.5">
                  <input
                    autoFocus
                    value={phaseDraft}
                    onChange={(e) => setPhaseDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddPhase(); if (e.key === "Escape") { setPhaseDraft(""); setAddingPhase(false); } }}
                    onBlur={handleAddPhase}
                    placeholder={t("roadmap.timeline.phaseName")}
                    className="bg-transparent text-sm text-white placeholder-gray-500 outline-none w-32"
                  />
                  <button type="button" onClick={handleAddPhase} className="text-emerald-400 hover:text-emerald-200">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingPhase(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-700 px-3 py-1.5 text-xs text-gray-500 hover:border-violet-700/50 hover:text-violet-400 transition-colors whitespace-nowrap"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t("roadmap.timeline.addPhase")}
                </button>
              )}
            </div>}
          </div>

          {/* ── Sortable theme rows ───────────────────────────────────────── */}
          <SortableContext items={themes.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {themes.map((theme) => (
              <SortableThemeRow
                key={theme.id}
                theme={theme}
                phases={phases}
                items={items}
                onUpdateTheme={onUpdateTheme}
                onDeleteTheme={onDeleteTheme}
                onAddItem={onAddItem}
                onUpdateItem={onUpdateItem}
                onDeleteItem={onDeleteItem}
                editingThemeId={editingThemeId}
                setEditingThemeId={setEditingThemeId}
                addingItem={addingItem}
                setAddingItem={setAddingItem}
                itemDraft={itemDraft}
                setItemDraft={setItemDraft}
                handleAddItem={handleAddItem}
                t={t}
                readOnly={readOnly}
              />
            ))}
          </SortableContext>

          {/* ── Add theme row — hidden for read-only members ──────────────── */}
          {!readOnly && <div className="flex">
            <div className={`${THEME_LABEL_W} shrink-0 sticky left-0 z-10 bg-gray-950/95 border-r border-gray-800/60 px-3 py-3`}>
              {addingTheme ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-violet-700/60 bg-violet-950/20 px-2 py-1.5">
                  <input
                    autoFocus
                    value={themeDraft}
                    onChange={(e) => setThemeDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddTheme(); if (e.key === "Escape") { setThemeDraft(""); setAddingTheme(false); } }}
                    onBlur={handleAddTheme}
                    placeholder={t("roadmap.theme.namePlaceholder")}
                    className="bg-transparent text-xs text-white placeholder-gray-500 outline-none w-full"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingTheme(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-violet-400 transition-colors whitespace-nowrap"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t("roadmap.theme.add")}
                </button>
              )}
            </div>
            {phases.map((phase) => (
              <div key={phase.id} className={`${PHASE_COL_W} shrink-0 border-r border-gray-800/20 px-2 py-3`} />
            ))}
          </div>}

        </div>
      </div>

      {/* Drag overlay — floating chip while dragging across columns */}
      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <div className={`${PHASE_COL_W} rotate-1 opacity-90 shadow-2xl`}>
            <ItemChip item={activeItem} onUpdate={() => {}} onDelete={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
