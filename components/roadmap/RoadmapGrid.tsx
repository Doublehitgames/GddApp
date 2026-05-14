"use client";

import { useEffect, useRef, useState } from "react";
import type { RoadmapPhase, RoadmapTheme, RoadmapItem, PhaseStatus, PhaseHeaderType, ThemeColor } from "@/lib/roadmap/types";
import { THEME_COLORS } from "@/lib/roadmap/types";
import ItemChip from "./ItemChip";
import { CommitTextInput, CommitTextarea } from "@/components/common/CommitInput";
import { useI18n } from "@/lib/i18n/provider";

// ─── Constants ────────────────────────────────────────────────────────────────

const THEME_LABEL_W = "w-36";   // 144px — sticky left column
const PHASE_COL_W   = "w-52";   // 208px — each phase column

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
  planned:   { dot: "bg-slate-500",           badge: "border-slate-700/50 bg-slate-800/50",         text: "text-slate-400" },
  active:    { dot: "bg-emerald-400 animate-pulse", badge: "border-emerald-700/50 bg-emerald-950/50", text: "text-emerald-300" },
  completed: { dot: "bg-gray-600",            badge: "border-gray-700/40 bg-gray-800/40",           text: "text-gray-500" },
  cancelled: { dot: "bg-rose-500",            badge: "border-rose-700/40 bg-rose-950/30",           text: "text-rose-400" },
};

const HEADER_TYPE_OPTIONS: PhaseHeaderType[] = ["title", "month", "quarter", "semester", "year"];

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatPhaseHeader(phase: RoadmapPhase, locale = "pt-BR"): string {
  if (phase.headerType === "title" || !phase.targetDate) return phase.name;
  const [y, m] = phase.targetDate.split("-").map(Number);
  switch (phase.headerType) {
    case "month":    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "short", year: "numeric" });
    case "quarter":  return `Q${Math.ceil(m / 3)} ${y}`;
    case "semester": return `S${m <= 6 ? 1 : 2} ${y}`;
    case "year":     return String(y);
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseHeaderCell({ phase, onUpdate, onDelete, t }: {
  phase: RoadmapPhase;
  onUpdate: (patch: Partial<Pick<RoadmapPhase, "name" | "description" | "headerType" | "targetDate" | "status" | "isPublic">>) => void;
  onDelete: () => void;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const st = PHASE_STATUS_STYLES[phase.status];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className={`${PHASE_COL_W} shrink-0 relative`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-col items-start gap-1 px-3 py-3 rounded-t-xl border border-b-0 border-gray-700/60 bg-gray-900/80 hover:bg-gray-800/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2 w-full">
          <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
          <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">
            {formatPhaseHeader(phase)}
          </span>
          <svg className="h-3 w-3 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        {phase.headerType !== "title" && phase.name && (
          <span className="text-[11px] text-gray-500 pl-4 truncate w-full">{phase.name}</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-3 flex flex-col gap-2.5">
          {/* Name */}
          <CommitTextInput
            value={phase.name}
            onCommit={(v) => onUpdate({ name: v })}
            autoFocus
            placeholder={t("roadmap.phase.namePlaceholder")}
            className="w-full bg-gray-800 rounded-lg border border-gray-700 px-2.5 py-1.5 text-sm text-white outline-none focus:border-gray-500 placeholder-gray-600"
          />

          {/* Description */}
          <CommitTextarea
            value={phase.description ?? ""}
            onCommit={(v) => onUpdate({ description: v || undefined })}
            rows={2}
            placeholder={t("roadmap.phase.descriptionPlaceholder")}
            className="w-full bg-gray-800 rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs text-gray-300 outline-none focus:border-gray-500 placeholder-gray-600 resize-none leading-relaxed"
          />

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
              onClick={() => { onDelete(); setOpen(false); }}
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
    </div>
  );
}

// ─── Main Grid ────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  phases: RoadmapPhase[];
  themes: RoadmapTheme[];
  items: RoadmapItem[];
  onAddPhase: (name: string) => void;
  onUpdatePhase: (phaseId: string, patch: Partial<Pick<RoadmapPhase, "name" | "description" | "headerType" | "targetDate" | "status" | "isPublic">>) => void;
  onDeletePhase: (phaseId: string) => void;
  onAddTheme: (name: string) => void;
  onUpdateTheme: (themeId: string, patch: Partial<Pick<RoadmapTheme, "name" | "color">>) => void;
  onDeleteTheme: (themeId: string) => void;
  onAddItem: (phaseId: string, themeId: string, title: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<Pick<RoadmapItem, "title" | "description" | "status" | "isPublic">>) => void;
  onDeleteItem: (itemId: string) => void;
}

export default function RoadmapGrid({
  phases, themes, items,
  onAddPhase, onUpdatePhase, onDeletePhase,
  onAddTheme, onUpdateTheme, onDeleteTheme,
  onAddItem, onUpdateItem, onDeleteItem,
}: Props) {
  const { t } = useI18n();

  // Adding states
  const [addingPhase, setAddingPhase]   = useState(false);
  const [phaseDraft, setPhaseDraft]     = useState("");
  const [addingTheme, setAddingTheme]   = useState(false);
  const [themeDraft, setThemeDraft]     = useState("");
  const [addingItem, setAddingItem]     = useState<{ phaseId: string; themeId: string } | null>(null);
  const [itemDraft, setItemDraft]       = useState("");

  // Theme editing
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);

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
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { setAddingPhase(true); }}
            className="flex items-center gap-2 rounded-xl border border-violet-700/50 bg-violet-950/30 px-4 py-2 text-sm text-violet-300 hover:bg-violet-950/50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t("roadmap.timeline.addPhase")}
          </button>
        </div>
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
    <div className="h-full overflow-auto rounded-xl border border-gray-800/60">
      <div className="min-w-max">

        {/* ── Header row ────────────────────────────────────────────────── */}
        <div className="flex">
          {/* Corner cell */}
          <div className={`${THEME_LABEL_W} shrink-0 sticky left-0 z-20 bg-gray-950 border-b border-r border-gray-800/60 px-3 py-3 flex items-end`}>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-600">{t("roadmap.grid.themes")}</span>
          </div>

          {/* Phase header cells */}
          {phases.map((phase) => (
            <div key={phase.id} className={`${PHASE_COL_W} shrink-0 border-b border-r border-gray-800/60`}>
              <PhaseHeaderCell
                phase={phase}
                onUpdate={(patch) => onUpdatePhase(phase.id, patch)}
                onDelete={() => onDeletePhase(phase.id)}
                t={t}
              />
            </div>
          ))}

          {/* Add phase cell */}
          <div className="shrink-0 border-b border-gray-800/60 px-2 py-3 flex items-end">
            {addingPhase ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/20 px-2 py-1.5">
                <input
                  autoFocus
                  value={phaseDraft}
                  onChange={(e) => setPhaseDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddPhase(); if (e.key === "Escape") { setPhaseDraft(""); setAddingPhase(false); }}}
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
          </div>
        </div>

        {/* ── Theme rows ────────────────────────────────────────────────── */}
        {themes.map((theme) => {
          const cs = THEME_COLOR_STYLES[theme.color];
          return (
            <div key={theme.id} className={`flex border-b border-gray-800/40 ${cs.row}`}>
              {/* Theme label — sticky left */}
              <div className={`${THEME_LABEL_W} shrink-0 sticky left-0 z-10 border-r border-l-[6px] border-gray-800/60 ${cs.border} bg-gray-950/95 px-3 py-3 flex flex-col gap-1 justify-center`}>
                {editingThemeId === theme.id ? (
                  <CommitTextInput
                    value={theme.name}
                    onCommit={(v) => { onUpdateTheme(theme.id, { name: v }); setEditingThemeId(null); }}
                    autoFocus
                    className="w-full bg-gray-800 rounded border border-gray-700 px-1.5 py-0.5 text-xs text-white outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingThemeId(theme.id)}
                    className={`text-xs font-semibold text-left leading-snug ${cs.text} hover:opacity-80 transition-opacity`}
                  >
                    {theme.name}
                  </button>
                )}

                {/* Color dots */}
                <div className="flex items-center gap-1 flex-wrap">
                  {THEME_COLORS.map((c) => {
                    const dot = THEME_COLOR_STYLES[c];
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onUpdateTheme(theme.id, { color: c })}
                        className={`h-2 w-2 rounded-full transition-transform hover:scale-125 ${dot.dot}`}
                        style={{ opacity: theme.color === c ? 1 : 0.35 }}
                      />
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => onDeleteTheme(theme.id)}
                    className="ml-auto text-gray-700 hover:text-rose-400 transition-colors"
                    title={t("roadmap.theme.delete")}
                  >
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Phase cells */}
              {phases.map((phase) => {
                const cellItems = items.filter((i) => i.phaseId === phase.id && i.themeId === theme.id);
                const isAddingHere = addingItem?.phaseId === phase.id && addingItem?.themeId === theme.id;

                return (
                  <div
                    key={phase.id}
                    className={`${PHASE_COL_W} shrink-0 border-r border-gray-800/30 px-2 py-2 flex flex-col gap-1.5 min-h-[72px]`}
                  >
                    {cellItems.map((item) => (
                      <ItemChip
                        key={item.id}
                        item={item}
                        onUpdate={(patch) => onUpdateItem(item.id, patch)}
                        onDelete={() => onDeleteItem(item.id)}
                      />
                    ))}

                    {isAddingHere ? (
                      <div className="flex items-center gap-1 rounded-lg border border-emerald-700/50 bg-emerald-950/20 px-2 py-1">
                        <input
                          autoFocus
                          value={itemDraft}
                          onChange={(e) => setItemDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); if (e.key === "Escape") { setItemDraft(""); setAddingItem(null); }}}
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
                    )}
                  </div>
                );
              })}

            </div>
          );
        })}

        {/* ── Add theme row ─────────────────────────────────────────────── */}
        <div className="flex">
          <div className={`${THEME_LABEL_W} shrink-0 sticky left-0 z-10 bg-gray-950/95 border-r border-gray-800/60 px-3 py-3`}>
            {addingTheme ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-violet-700/60 bg-violet-950/20 px-2 py-1.5">
                <input
                  autoFocus
                  value={themeDraft}
                  onChange={(e) => setThemeDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTheme(); if (e.key === "Escape") { setThemeDraft(""); setAddingTheme(false); }}}
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
        </div>

      </div>
    </div>
  );
}
