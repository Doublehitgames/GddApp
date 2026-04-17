"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FieldLibraryAddonDraft, FieldLibraryEntry } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { CommitTextInput, CommitTextarea } from "@/components/common/CommitInput";

interface FieldLibraryAddonPanelProps {
  addon: FieldLibraryAddonDraft;
  onChange: (next: FieldLibraryAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const TEXTAREA_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500 min-h-[60px] resize-y";
const BUTTON_CLASS = "rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-gray-100 hover:bg-gray-700";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

export function FieldLibraryAddonPanel({ addon, onChange, onRemove }: FieldLibraryAddonPanelProps) {
  const { t } = useI18n();
  const entries = addon.entries || [];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const entryIdSignature = useMemo(() => entries.map((entry) => entry.id).join("|"), [entries]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    setCollapsed((prev) => {
      const next: Record<string, boolean> = {};
      for (const entry of entries) {
        next[entry.id] = prev[entry.id] ?? true;
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key])) {
        return prev;
      }
      return next;
    });
  }, [entries, entryIdSignature]);

  const keyCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      const k = normalizeKey(entry.key);
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }, [entries]);

  const commit = (nextEntries: FieldLibraryEntry[]) => {
    onChange({
      ...addon,
      entries: nextEntries,
    });
  };

  const updateEntry = (id: string, patch: Partial<FieldLibraryEntry>) => {
    commit(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const addEntry = () => {
    const id = `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    commit([
      ...entries,
      {
        id,
        key: `field_${entries.length + 1}`,
        label: `${t("fieldLibraryAddon.newEntryLabel", "Novo campo")} ${entries.length + 1}`,
        description: "",
      },
    ]);
    setCollapsed((prev) => ({ ...prev, [id]: true }));
  };

  const removeEntry = (id: string) => {
    commit(entries.filter((entry) => entry.id !== id));
  };

  const toggleEntry = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = entries.findIndex((entry) => entry.id === String(active.id));
    const newIndex = entries.findIndex((entry) => entry.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    commit(arrayMove(entries, oldIndex, newIndex));
  };

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-100">
          {t("fieldLibraryAddon.defaultName", "Biblioteca de Campos")}
        </h4>
        <button type="button" onClick={addEntry} className={BUTTON_CLASS}>
          {t("fieldLibraryAddon.addEntryButton", "+ Campo")}
        </button>
      </div>

      <p className="mb-3 text-xs text-gray-400">
        {t(
          "fieldLibraryAddon.helpText",
          "Defina aqui campos reutilizáveis. Em uma Tabela de Balanceamento ou Schema de Dados, vincule um campo a uma entrada desta biblioteca para herdar nome e chave."
        )}
      </p>

      <div className="space-y-3">
        {entries.length === 0 && (
          <div className={PANEL_BLOCK_CLASS}>
            <p className="text-xs text-gray-300">
              {t("fieldLibraryAddon.emptyState", "Nenhum campo definido ainda.")}
            </p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {entries.map((entry) => {
                const normalizedKey = normalizeKey(entry.key);
                const isDuplicate = Boolean(normalizedKey) && (keyCounts.get(normalizedKey) || 0) > 1;
                const keyError = !normalizedKey
                  ? t("fieldLibraryAddon.validation.keyRequired", "A chave é obrigatória.")
                  : isDuplicate
                    ? t("fieldLibraryAddon.validation.keyUnique", "A chave deve ser única.")
                    : null;
                const title = entry.label?.trim() || entry.key?.trim() || t("fieldLibraryAddon.fallbackTitle", "Campo");
                return (
                  <SortableEntryBlock key={entry.id} id={entry.id}>
                    <div className={PANEL_BLOCK_CLASS}>
                      <button
                        type="button"
                        onClick={() => toggleEntry(entry.id)}
                        aria-expanded={!collapsed[entry.id]}
                        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left hover:bg-gray-800/40"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                          <span
                            className="inline-flex cursor-grab items-center text-gray-400 active:cursor-grabbing"
                            data-drag-handle
                            onClick={(event) => event.stopPropagation()}
                            aria-label={t("fieldLibraryAddon.dragAria", "Arrastar bloco")}
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <circle cx="6" cy="5" r="1.5" />
                              <circle cx="6" cy="10" r="1.5" />
                              <circle cx="6" cy="15" r="1.5" />
                              <circle cx="12" cy="5" r="1.5" />
                              <circle cx="12" cy="10" r="1.5" />
                              <circle cx="12" cy="15" r="1.5" />
                            </svg>
                          </span>
                          {title}
                        </span>
                        <span className="text-[10px] text-gray-400">{entry.key || "key"}</span>
                        <span
                          className="text-[11px] text-gray-300 transition-transform duration-200"
                          style={{ transform: collapsed[entry.id] ? "rotate(0deg)" : "rotate(180deg)" }}
                        >
                          ▼
                        </span>
                      </button>

                      {!collapsed[entry.id] && (
                        <div className="space-y-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-xs text-gray-400">
                                {t("fieldLibraryAddon.labelLabel", "Nome")}
                              </span>
                              <CommitTextInput
                                value={entry.label}
                                onCommit={(next) => updateEntry(entry.id, { label: next })}
                                placeholder={t("fieldLibraryAddon.labelPlaceholder", "Preço de Venda")}
                                className={INPUT_CLASS}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-xs text-gray-400">
                                {t("fieldLibraryAddon.keyLabel", "Chave")}
                              </span>
                              <CommitTextInput
                                value={entry.key}
                                onCommit={(next) => updateEntry(entry.id, { key: next })}
                                transform={normalizeKey}
                                placeholder={t("fieldLibraryAddon.keyPlaceholder", "sell_price")}
                                className={INPUT_CLASS}
                              />
                            </label>
                          </div>
                          <label className="block">
                            <span className="mb-1 block text-xs text-gray-400">
                              {t("fieldLibraryAddon.descriptionLabel", "Descrição (opcional)")}
                            </span>
                            <CommitTextarea
                              value={entry.description ?? ""}
                              onCommit={(next) => updateEntry(entry.id, { description: next || undefined })}
                              placeholder={t(
                                "fieldLibraryAddon.descriptionPlaceholder",
                                "Para que serve este campo no jogo..."
                              )}
                              className={TEXTAREA_CLASS}
                            />
                          </label>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeEntry(entry.id)}
                              className={BUTTON_DANGER_CLASS}
                            >
                              {t("fieldLibraryAddon.removeEntryButton", "Remover campo")}
                            </button>
                          </div>
                          {keyError ? <p className="mt-1 text-xs text-rose-300">{keyError}</p> : null}
                        </div>
                      )}
                    </div>
                  </SortableEntryBlock>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </section>
  );
}

function SortableEntryBlock({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const stableTransform = transform
    ? {
        ...transform,
        scaleX: 1,
        scaleY: 1,
      }
    : null;
  const style = {
    transform: CSS.Transform.toString(stableTransform),
    transition,
    width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onPointerDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-drag-handle]")) {
            listeners?.onPointerDown?.(event);
          }
        }}
        onKeyDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-drag-handle]")) {
            listeners?.onKeyDown?.(event);
          }
        }}
        {...attributes}
      >
        {children}
      </div>
    </div>
  );
}
