"use client";

import { useState, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SectionAddon } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";

interface AddonCardProps {
  addon: SectionAddon;
  emoji: string;
  label: string;
  typeLabel: string;
  isSelected: boolean;
  isDrawerOpen: boolean;
  onOpenEditor: () => void;
  onSelectionClick?: (modifiers: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  onRename: (name: string) => void;
  onCopy?: () => void;
  onMove?: () => void;
  onRemove: () => void;
  children: ReactNode;
}

export function AddonCard({
  addon,
  emoji,
  label,
  typeLabel,
  isSelected,
  isDrawerOpen,
  onOpenEditor,
  onSelectionClick,
  onRename,
  onCopy,
  onMove,
  onRemove,
  children,
}: AddonCardProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: addon.id });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(addon.name || "");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed !== addon.name) onRename(trimmed);
    setIsEditingName(false);
  };

  // Flat style: no heavy border/bg — cards blend into the description card.
  // When selected or with the drawer open, a thin left accent bar signals it.
  const accentClass = isSelected
    ? "border-l-2 border-emerald-500/80"
    : isDrawerOpen
      ? "border-l-2 border-indigo-500/80"
      : "border-l-2 border-transparent";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group pl-2 -ml-2 ${accentClass} transition-colors`}
      onDoubleClick={(event) => {
        // Prevent the parent description block's double-click (which opens WYSIWYG)
        event.stopPropagation();
        onOpenEditor();
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 py-1.5 text-gray-400"
        onClick={(event) => {
          if (!(event.ctrlKey || event.metaKey || event.shiftKey)) return;
          if (!onSelectionClick) return;
          event.preventDefault();
          event.stopPropagation();
          onSelectionClick({
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
          });
        }}
      >
        <span
          className="text-gray-500 cursor-grab active:cursor-grabbing text-[11px] leading-none select-none shrink-0"
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          aria-label={t("addonStackedList.dragHandleAria", "Arrastar para reordenar")}
          title={t("addonStackedList.dragHandleTitle", "Arrastar")}
        >
          ⋮⋮
        </span>
        <span className="text-lg leading-none select-none shrink-0" aria-hidden>
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <input
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                else if (event.key === "Escape") {
                  setDraftName(addon.name || "");
                  setIsEditingName(false);
                }
              }}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              className="w-full bg-transparent border-b border-gray-500 text-sm font-semibold text-white outline-none py-0"
              placeholder={typeLabel}
            />
          ) : (
            <div
              className="text-lg font-semibold text-gray-100 truncate"
              onDoubleClick={(event) => {
                event.stopPropagation();
                setDraftName(addon.name || "");
                setIsEditingName(true);
              }}
              title={t("addonStackedList.renameTitle", "Duplo clique para renomear")}
            >
              {label}
              <span className="ml-1.5 text-[11px] font-normal text-gray-500">{typeLabel}</span>
            </div>
          )}
        </div>

        {/* Action buttons — hidden until card is hovered/focused to reduce visual noise.
            Kept visible when selected or when the editor drawer is open for this card. */}
        <div
          className={`flex items-center gap-0.5 transition-opacity ${
            isSelected || isDrawerOpen
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          }`}
        >
          <button
            type="button"
            className="text-gray-500 hover:text-indigo-300 shrink-0 px-1 py-0.5 rounded transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              onOpenEditor();
            }}
            title={t("addonStackedList.edit", "Editar")}
            aria-label={t("addonStackedList.edit", "Editar")}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {onCopy && (
            <button
              type="button"
              className="text-gray-500 hover:text-sky-400 shrink-0 px-1 py-0.5 rounded"
              onClick={(event) => {
                event.stopPropagation();
                onCopy();
              }}
              title={t("sectionDetail.copy.confirm", "Copiar")}
              aria-label={t("sectionDetail.copy.confirm", "Copiar")}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          {onMove && (
            <button
              type="button"
              className="text-gray-500 hover:text-emerald-400 shrink-0 px-1 py-0.5 rounded"
              onClick={(event) => {
                event.stopPropagation();
                onMove();
              }}
              title={t("sectionDetail.moveAddon.confirm", "Mover")}
              aria-label={t("sectionDetail.moveAddon.confirm", "Mover")}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M20 12H4" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="text-gray-500 hover:text-rose-400 shrink-0 px-1 py-0.5 rounded"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmRemove(true);
            }}
            title={t("sectionDetail.bulk.remove", "Remover")}
            aria-label={t("sectionDetail.bulk.remove", "Remover")}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body — flat; baseline matches the page description (text-base / ~16px).
          Nested tables may still override to text-sm for density. */}
      <div className="py-1 text-base text-gray-200 leading-7">{children}</div>

      {/* Remove confirmation modal */}
      {confirmRemove && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={(event) => {
              event.stopPropagation();
              setConfirmRemove(false);
            }}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-rose-700/60 bg-gray-900 p-5 shadow-2xl min-w-[260px]"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm text-gray-200 mb-1">
              {t("addonStackedList.confirmRemove.question", "Remover")}{" "}
              <strong className="text-white">{label}</strong>?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {t(
                "addonStackedList.confirmRemove.warning",
                "Esta ação não pode ser desfeita. Todos os dados deste addon serão perdidos."
              )}
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
                onClick={() => setConfirmRemove(false)}
              >
                {t("common.cancel", "Cancelar")}
              </button>
              <button
                type="button"
                className="rounded-lg border border-rose-700/60 bg-rose-900/40 px-4 py-1.5 text-xs text-rose-200 hover:bg-rose-900/60"
                onClick={() => {
                  setConfirmRemove(false);
                  onRemove();
                }}
              >
                {t("sectionDetail.bulk.remove", "Remover")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
