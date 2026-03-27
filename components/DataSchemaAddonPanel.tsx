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
import type { DataSchemaAddonDraft, DataSchemaEntry, DataSchemaValueType } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useProjectStore } from "@/store/projectStore";

interface DataSchemaAddonPanelProps {
  addon: DataSchemaAddonDraft;
  onChange: (next: DataSchemaAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
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

function toOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeBounds(min?: number, max?: number): { min?: number; max?: number } {
  if (min == null || max == null) return { min, max };
  return min <= max ? { min, max } : { min: max, max: min };
}

function coerceValueByType(valueType: DataSchemaValueType, raw: string | number | boolean): string | number | boolean {
  if (valueType === "boolean") {
    return Boolean(raw);
  }
  if (valueType === "string") {
    return String(raw ?? "");
  }
  const parsed = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  if (valueType === "int" || valueType === "seconds" || valueType === "percent") {
    return Math.floor(parsed);
  }
  return parsed;
}

function clampNumericValue(value: number, min?: number, max?: number): number {
  let next = value;
  if (min != null) next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  return next;
}

function roundToDecimals(value: number, decimals: number): number {
  const safeDecimals = Math.max(0, Math.floor(decimals));
  if (safeDecimals === 0) return Math.floor(value);
  const factor = 10 ** safeDecimals;
  return Math.round(value * factor) / factor;
}

function stepFromDecimals(decimals: number): string {
  const safeDecimals = Math.max(0, Math.floor(decimals));
  if (safeDecimals <= 0) return "1";
  return `0.${"0".repeat(Math.max(0, safeDecimals - 1))}1`;
}

export function DataSchemaAddonPanel({ addon, onChange, onRemove }: DataSchemaAddonPanelProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const entries = addon.entries || [];
  const [collapsedEntries, setCollapsedEntries] = useState<Record<string, boolean>>({});
  const entryIdSignature = useMemo(() => entries.map((entry) => entry.id).join("|"), [entries]);
  const xpRefOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string; decimals: number }> = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "xpBalance") continue;
          const refId = section.id;
          if (seen.has(refId)) continue;
          seen.add(refId);
          const sectionTitle = section.title?.trim() || section.id;
          const addonName = sectionAddon.name?.trim() || "XP";
          out.push({
            refId,
            label: `${sectionTitle} - ${addonName}`,
            decimals:
              typeof sectionAddon.data.decimals === "number" && Number.isFinite(sectionAddon.data.decimals)
                ? Math.max(0, Math.floor(sectionAddon.data.decimals))
                : 0,
          });
        }
      }
    }
    return out;
  }, [projects]);

  useEffect(() => {
    setCollapsedEntries((prev) => {
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const keyCount = new Map<string, number>();
  for (const entry of entries) {
    const normalized = normalizeKey(entry.key);
    if (!normalized) continue;
    keyCount.set(normalized, (keyCount.get(normalized) || 0) + 1);
  }

  const commit = (nextEntries: DataSchemaEntry[]) => {
    onChange({
      ...addon,
      entries: nextEntries,
    });
  };

  const updateEntry = (entryId: string, patch: Partial<DataSchemaEntry>) => {
    const nextEntries = entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      const next = { ...entry, ...patch };
      const bounds = normalizeBounds(next.min, next.max);
      next.min = bounds.min;
      next.max = bounds.max;

      if (next.valueType !== "boolean" && next.valueType !== "string") {
        const numeric = Number(next.value);
        if (Number.isFinite(numeric)) {
          const clamped = clampNumericValue(numeric, next.min, next.max);
          next.value = next.valueType === "float" ? clamped : Math.floor(clamped);
        } else {
          next.value = 0;
        }
      } else if (next.valueType === "boolean") {
        next.value = Boolean(next.value);
        next.min = undefined;
        next.max = undefined;
      } else {
        next.value = String(next.value ?? "");
        next.min = undefined;
        next.max = undefined;
      }
      return next;
    });
    commit(nextEntries);
  };

  const addEntry = () => {
    const nextId = `stat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nextEntries: DataSchemaEntry[] = [
      ...entries,
      {
        id: nextId,
        key: `new_stat_${entries.length + 1}`,
        label: `${t("dataSchemaAddon.newStatLabel", "Novo atributo")} ${entries.length + 1}`,
        valueType: "int",
        value: 0,
      },
    ];
    commit(nextEntries);
    setCollapsedEntries((prev) => ({ ...prev, [nextId]: true }));
  };

  const removeEntry = (entryId: string) => {
    commit(entries.filter((entry) => entry.id !== entryId));
  };

  const toggleEntryCollapsed = (entryId: string) => {
    setCollapsedEntries((prev) => ({
      ...prev,
      [entryId]: !(prev[entryId] ?? true),
    }));
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
          {t("dataSchemaAddon.defaultName", "Schema de Dados")}
        </h4>
        <button type="button" onClick={addEntry} className={BUTTON_CLASS}>
          {t("dataSchemaAddon.addStatButton", "+ Campo")}
        </button>
      </div>

      <div className="space-y-3">
        {entries.length === 0 && (
          <div className={PANEL_BLOCK_CLASS}>
            <p className="text-xs text-gray-300">
              {t("dataSchemaAddon.emptyState", "Nenhum campo ainda. Clique em \"+ Campo\" para começar.")}
            </p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={entries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {entries.map((entry) => {
                const normalizedKey = normalizeKey(entry.key);
                const isDuplicate = Boolean(normalizedKey) && (keyCount.get(normalizedKey) || 0) > 1;
                const keyError = !normalizedKey
                  ? t("dataSchemaAddon.validation.keyRequired", "A chave é obrigatória.")
                  : isDuplicate
                    ? t("dataSchemaAddon.validation.keyUnique", "A chave deve ser única.")
                    : null;
                const linkedXpMeta = entry.unitXpRef ? xpRefOptions.find((item) => item.refId === entry.unitXpRef) : undefined;
                const isLinkedToXp = Boolean(linkedXpMeta);
                const linkedValueType: DataSchemaValueType | null = linkedXpMeta
                  ? linkedXpMeta.decimals > 0
                    ? "float"
                    : "int"
                  : null;
                const effectiveValueType = linkedValueType || entry.valueType;
                const supportsBoundsByType = effectiveValueType !== "boolean" && effectiveValueType !== "string";
                const useBounds = supportsBoundsByType && (entry.min != null || entry.max != null);
                const title =
                  entry.label?.trim() ||
                  entry.key?.trim() ||
                  t("dataSchemaAddon.fallbackTitle", "Campo");
                const unitRefSelectedKnown = entry.unitXpRef
                  ? xpRefOptions.some((item) => item.refId === entry.unitXpRef)
                  : false;

                return (
                  <SortableEntryBlock key={entry.id} id={entry.id}>
                    <div className={PANEL_BLOCK_CLASS}>
                      <button
                        type="button"
                        onClick={() => toggleEntryCollapsed(entry.id)}
                        aria-expanded={!collapsedEntries[entry.id]}
                        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left hover:bg-gray-800/40"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                          <span
                            className="inline-flex cursor-grab items-center text-gray-400 active:cursor-grabbing"
                            data-drag-handle
                            onClick={(event) => event.stopPropagation()}
                            aria-label={t("dataSchemaAddon.dragAria", "Arrastar bloco")}
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
                          style={{ transform: collapsedEntries[entry.id] ? "rotate(0deg)" : "rotate(180deg)" }}
                        >
                          ▼
                        </span>
                      </button>

                      {!collapsedEntries[entry.id] && (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                              {t("dataSchemaAddon.mainBlockLabel", "Identificação e valor")}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="block">
                                <span className="mb-1 block text-xs text-gray-400">{t("dataSchemaAddon.labelLabel", "Nome")}</span>
                                <input
                                  type="text"
                                  value={entry.label}
                                  onChange={(event) => updateEntry(entry.id, { label: event.target.value })}
                                  className={INPUT_CLASS}
                                  placeholder={t("dataSchemaAddon.labelPlaceholder", "XP de colheita")}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-xs text-gray-400">{t("dataSchemaAddon.keyLabel", "Chave")}</span>
                                <input
                                  type="text"
                                  value={entry.key}
                                  onChange={(event) => updateEntry(entry.id, { key: normalizeKey(event.target.value) })}
                                  className={INPUT_CLASS}
                                  placeholder={t("dataSchemaAddon.keyPlaceholder", "harvest_xp")}
                                />
                              </label>
                            </div>
                          </div>
                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                              {t("dataSchemaAddon.unitXpRefLabel", "Vínculo com página de XP (opcional)")}
                            </p>
                            <label className="block">
                              <select
                                value={
                                  entry.unitXpRef
                                    ? unitRefSelectedKnown
                                      ? entry.unitXpRef
                                      : "__invalid__"
                                    : ""
                                }
                                onChange={(event) => {
                                  const next = event.target.value;
                                  if (next === "__invalid__") return;
                                  const nextRef = next || undefined;
                                  const nextLinkedXp = nextRef ? xpRefOptions.find((item) => item.refId === nextRef) : undefined;
                                  const forcedType: DataSchemaValueType | undefined = nextLinkedXp
                                    ? nextLinkedXp.decimals > 0
                                      ? "float"
                                      : "int"
                                    : undefined;
                                  let nextValue = entry.value;
                                  if (nextLinkedXp) {
                                    const parsed =
                                      typeof entry.value === "number"
                                        ? entry.value
                                        : Number(String(entry.value ?? "").replace(",", "."));
                                    const safeNumeric = Number.isFinite(parsed) ? parsed : 0;
                                    nextValue = roundToDecimals(safeNumeric, nextLinkedXp.decimals);
                                  }
                                  updateEntry(entry.id, {
                                    unitXpRef: nextRef,
                                    ...(forcedType ? { valueType: forcedType, value: nextValue } : {}),
                                  });
                                }}
                                className={INPUT_CLASS}
                              >
                                <option value="">{t("dataSchemaAddon.selectNone", "Sem vínculo")}</option>
                                {entry.unitXpRef && !unitRefSelectedKnown && (
                                  <option value="__invalid__">
                                    {t("dataSchemaAddon.invalidUnitXpRef", "Vínculo inválido (página de XP não encontrada)")}
                                  </option>
                                )}
                                {xpRefOptions.map((option) => (
                                  <option key={option.refId} value={option.refId}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                              {t("dataSchemaAddon.valueLabel", "Valor")}
                            </p>
                            <div className="mt-2 flex flex-wrap items-end gap-2">
                              {!isLinkedToXp && (
                                <label className="min-w-[130px]">
                                  <span className="mb-1 block text-xs text-gray-400">{t("dataSchemaAddon.typeLabel", "Tipo")}</span>
                                  <select
                                    value={entry.valueType}
                                    onChange={(event) => {
                                      const nextValueType = event.target.value as DataSchemaValueType;
                                      const nextValue =
                                        nextValueType === "boolean"
                                          ? false
                                          : nextValueType === "string"
                                            ? ""
                                            : coerceValueByType(nextValueType, entry.value);
                                      updateEntry(entry.id, {
                                        valueType: nextValueType,
                                        value: nextValue,
                                      });
                                    }}
                                    className={INPUT_CLASS}
                                  >
                                    <option value="int">int</option>
                                    <option value="float">float</option>
                                    <option value="seconds">seconds</option>
                                    <option value="percent">percent</option>
                                    <option value="boolean">boolean</option>
                                    <option value="string">string</option>
                                  </select>
                                </label>
                              )}
                              {effectiveValueType === "boolean" ? (
                                <div className="min-w-[120px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2">
                                  <span className="mb-1 block text-xs text-gray-400">{t("dataSchemaAddon.valueLabel", "Valor")}</span>
                                  <ToggleSwitch
                                    checked={Boolean(entry.value)}
                                    onChange={(next) => updateEntry(entry.id, { value: next })}
                                    ariaLabel={`toggle-${entry.key || "stat"}`}
                                  />
                                </div>
                              ) : (
                                <label className="min-w-[130px]">
                                  <span className="mb-1 block text-xs text-gray-400">{t("dataSchemaAddon.valueLabel", "Valor")}</span>
                                  {(() => {
                                    const numericDisplayValue =
                                      typeof entry.value === "number"
                                        ? entry.value
                                        : Number(String(entry.value ?? "").replace(",", "."));
                                    const displayValue =
                                      effectiveValueType === "string"
                                        ? String(entry.value ?? "")
                                        : Number.isFinite(numericDisplayValue)
                                          ? String(numericDisplayValue)
                                          : "0";
                                    return (
                                  <input
                                    type={effectiveValueType === "string" ? "text" : "number"}
                                    value={displayValue}
                                    onChange={(event) => {
                                      if (effectiveValueType === "string") {
                                        updateEntry(entry.id, { value: event.target.value });
                                        return;
                                      }
                                      const parsed = Number(event.target.value.replace(",", "."));
                                      if (!Number.isFinite(parsed)) {
                                        updateEntry(entry.id, { value: 0 });
                                        return;
                                      }
                                      if (isLinkedToXp && linkedXpMeta) {
                                        updateEntry(entry.id, {
                                          valueType: linkedXpMeta.decimals > 0 ? "float" : "int",
                                          value: roundToDecimals(parsed, linkedXpMeta.decimals),
                                        });
                                        return;
                                      }
                                      const nextValue = coerceValueByType(effectiveValueType, event.target.value);
                                      updateEntry(entry.id, { value: nextValue });
                                    }}
                                    className={INPUT_CLASS}
                                    step={isLinkedToXp && linkedXpMeta ? stepFromDecimals(linkedXpMeta.decimals) : undefined}
                                  />
                                    );
                                  })()}
                                </label>
                              )}
                              {!isLinkedToXp && (
                                <label className="min-w-[130px]">
                                  <span className="mb-1 block text-xs text-gray-400">
                                    {t("dataSchemaAddon.unitLabel", "Unidade (opcional)")}
                                  </span>
                                  <input
                                    type="text"
                                    value={entry.unit ?? ""}
                                    onChange={(event) => updateEntry(entry.id, { unit: event.target.value || undefined })}
                                    className={INPUT_CLASS}
                                    placeholder={t("dataSchemaAddon.unitPlaceholder", "s, kg, pts")}
                                  />
                                </label>
                              )}
                            </div>
                          </div>

                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                                {t("dataSchemaAddon.boundsBlockLabel", "Limites")}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-300">{t("dataSchemaAddon.useBoundsLabel", "Usar")}</span>
                                <ToggleSwitch
                                  checked={useBounds}
                                  onChange={(next) => {
                                    if (!supportsBoundsByType) return;
                                    if (!next) {
                                      updateEntry(entry.id, { min: undefined, max: undefined });
                                    } else {
                                      const currentNumeric = Number(entry.value);
                                      const safeCurrent = Number.isFinite(currentNumeric)
                                        ? effectiveValueType === "float"
                                          ? currentNumeric
                                          : Math.floor(currentNumeric)
                                        : 0;
                                      updateEntry(entry.id, {
                                        min: 0,
                                        max: Math.max(0, safeCurrent),
                                      });
                                    }
                                  }}
                                  ariaLabel={t("dataSchemaAddon.useBoundsLabel", "Usar")}
                                  disabled={!supportsBoundsByType}
                                />
                              </div>
                            </div>
                            {useBounds ? (
                              <div className="flex flex-wrap items-end gap-2">
                                <label className="min-w-[120px]">
                                  <span className="mb-1 block text-xs text-gray-400">{t("dataSchemaAddon.minLabel", "Mínimo")}</span>
                                  <input
                                    type="number"
                                    value={entry.min ?? ""}
                                    onChange={(event) => updateEntry(entry.id, { min: toOptionalNumber(event.target.value) })}
                                    className={INPUT_CLASS}
                                  />
                                </label>
                                <label className="min-w-[120px]">
                                  <span className="mb-1 block text-xs text-gray-400">{t("dataSchemaAddon.maxLabel", "Máximo")}</span>
                                  <input
                                    type="number"
                                    value={entry.max ?? ""}
                                    onChange={(event) => updateEntry(entry.id, { max: toOptionalNumber(event.target.value) })}
                                    className={INPUT_CLASS}
                                  />
                                </label>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeEntry(entry.id)}
                              className={BUTTON_DANGER_CLASS}
                            >
                              {t("dataSchemaAddon.removeStatButton", "Remover campo")}
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

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onRemove} className={BUTTON_DANGER_CLASS}>
          {t("dataSchemaAddon.removeAddonButton", "Remover addon")}
        </button>
      </div>
    </section>
  );
}

function SortableEntryBlock({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
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

