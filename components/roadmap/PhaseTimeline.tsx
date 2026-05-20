"use client";

import { useRef, useState } from "react";
import type { RoadmapPhase, RoadmapItem } from "@/lib/roadmap/types";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  phases: RoadmapPhase[];
  items: RoadmapItem[];
  selectedPhaseId: string | null;
  onSelectPhase: (phaseId: string) => void;
  onAddPhase: (name: string) => void;
  readOnly?: boolean;
}

const PHASE_STATUS_STYLES = {
  planned:   { dot: "bg-slate-400",                      tab: "border-slate-600/50",  active: "border-slate-400 bg-slate-800/60" },
  active:    { dot: "bg-emerald-400 animate-pulse",       tab: "border-emerald-700/50", active: "border-emerald-400 bg-emerald-950/60" },
  completed: { dot: "bg-gray-500",                        tab: "border-gray-700/40",   active: "border-gray-500 bg-gray-800/60" },
  cancelled: { dot: "bg-rose-400",                        tab: "border-rose-700/40",   active: "border-rose-400 bg-rose-950/40" },
};

function formatTargetDate(raw: string): string {
  const [year, month] = raw.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export default function PhaseTimeline({ phases, items, selectedPhaseId, onSelectPhase, onAddPhase, readOnly }: Props) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAddPhase() {
    setAdding(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleConfirm() {
    const name = draft.trim();
    if (name) {
      onAddPhase(name);
    }
    setDraft("");
    setAdding(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") { setDraft(""); setAdding(false); }
  }

  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1 px-1">
      {phases.map((phase) => {
        const phaseItems = items.filter((i) => i.phaseId === phase.id);
        const doneCount = phaseItems.filter((i) => i.status === "done").length;
        const total = phaseItems.length;
        const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        const style = PHASE_STATUS_STYLES[phase.status];
        const isSelected = phase.id === selectedPhaseId;

        return (
          <button
            key={phase.id}
            type="button"
            onClick={() => onSelectPhase(phase.id)}
            className={`group shrink-0 flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-left transition-all duration-200 min-w-[148px] ${
              isSelected
                ? style.active + " shadow-md"
                : "border-gray-700/60 bg-gray-900/50 hover:border-gray-600 hover:bg-gray-800/50"
            }`}
          >
            {/* Status dot + name */}
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
              <span className={`text-sm font-semibold truncate max-w-[110px] ${isSelected ? "text-white" : "text-gray-300 group-hover:text-white"}`}>
                {phase.name}
              </span>
            </div>

            {/* Target date */}
            {phase.targetDate && (
              <span className="text-[11px] text-gray-500 pl-4">
                {formatTargetDate(phase.targetDate)}
              </span>
            )}

            {/* Progress */}
            <div className="pl-4 flex flex-col gap-1">
              <span className="text-[11px] text-gray-600 tabular-nums">
                {total === 0
                  ? t("roadmap.timeline.noItems")
                  : t("roadmap.timeline.itemsProgress")
                      .replace("{done}", String(doneCount))
                      .replace("{total}", String(total))}
              </span>
              {total > 0 && (
                <div className="h-1 w-full rounded-full bg-gray-700/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      phase.status === "completed" ? "bg-gray-500" :
                      phase.status === "cancelled" ? "bg-rose-500" :
                      "bg-emerald-500"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          </button>
        );
      })}

      {/* Add phase — hidden for read-only members */}
      {!readOnly && (adding ? (
        <div className="shrink-0 flex items-center gap-2 rounded-xl border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 min-w-[180px]">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleConfirm}
            placeholder={t("roadmap.timeline.phaseName")}
            className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
          <button type="button" onClick={handleConfirm} className="text-emerald-400 hover:text-emerald-200 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAddPhase}
          className="shrink-0 flex items-center gap-2 rounded-xl border border-dashed border-gray-700 px-4 py-3 text-sm text-gray-500 hover:border-emerald-700/60 hover:text-emerald-400 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t("roadmap.timeline.addPhase")}
        </button>
      ))}
    </div>
  );
}
