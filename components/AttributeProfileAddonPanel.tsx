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
import type { AttributeProfileAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { ToggleSwitch } from "@/components/ToggleSwitch";

interface AttributeProfileAddonPanelProps {
  addon: AttributeProfileAddonDraft;
  onChange: (next: AttributeProfileAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_CLASS = "rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-gray-100 hover:bg-gray-700";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

function toNumberOrZero(raw: string): number {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}

function clampNumber(value: number, min?: number, max?: number): number {
  let next = value;
  if (typeof min === "number" && Number.isFinite(min)) next = Math.max(min, next);
  if (typeof max === "number" && Number.isFinite(max)) next = Math.min(max, next);
  return next;
}

export function AttributeProfileAddonPanel({ addon, onChange, onRemove }: AttributeProfileAddonPanelProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const values = addon.values || [];
  const [collapsedValues, setCollapsedValues] = useState<Record<string, boolean>>({});
  const rowIdSignature = useMemo(() => values.map((item) => item.id).join("|"), [values]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const definitionOptions = useMemo(() => {
    const out: Array<{
      refId: string;
      label: string;
      attributes: Array<{
        key: string;
        label: string;
        valueType: "int" | "float" | "percent" | "boolean";
        unit?: string;
        min?: number;
        max?: number;
      }>;
    }> = [];
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "attributeDefinitions") continue;
          out.push({
            refId: section.id,
            label: `${section.title || section.id} - ${sectionAddon.name || sectionAddon.data.name}`,
            attributes: (sectionAddon.data.attributes || []).map((item) => ({
              key: item.key,
              label: item.label || item.key,
              valueType: item.valueType,
              unit: item.unit,
              min: item.min,
              max: item.max,
            })),
          });
        }
      }
    }
    return out;
  }, [projects]);

  const selectedDefinition = definitionOptions.find((item) => item.refId === addon.definitionsRef);
  const selectedAttributes = selectedDefinition?.attributes || [];

  useEffect(() => {
    setCollapsedValues((prev) => {
      const next: Record<string, boolean> = {};
      for (const row of values) {
        next[row.id] = prev[row.id] ?? true;
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key])) {
        return prev;
      }
      return next;
    });
  }, [values, rowIdSignature]);

  const commit = (nextValues: AttributeProfileAddonDraft["values"]) => {
    onChange({
      ...addon,
      values: nextValues,
    });
  };

  const addValue = () => {
    const nextId = `attr-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const firstMeta = selectedAttributes[0];
    const firstKey = firstMeta?.key || "";
    const firstType = firstMeta?.valueType || "int";
    const firstDefaultValue =
      firstType === "boolean"
        ? false
        : clampNumber(typeof firstMeta?.min === "number" ? firstMeta.min : 0, firstMeta?.min, firstMeta?.max);
    commit([
      ...values,
      {
        id: nextId,
        attributeKey: firstKey,
        value: firstDefaultValue,
      },
    ]);
    setCollapsedValues((prev) => ({ ...prev, [nextId]: true }));
  };

  const updateRow = (id: string, patch: Partial<AttributeProfileAddonDraft["values"][number]>) => {
    commit(
      values.map((item) => {
        if (item.id !== id) return item;
        return { ...item, ...patch };
      })
    );
  };

  const toggleRowCollapsed = (id: string) => {
    setCollapsedValues((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true),
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = values.findIndex((item) => item.id === String(active.id));
    const newIndex = values.findIndex((item) => item.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    commit(arrayMove(values, oldIndex, newIndex));
  };

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-3">
        <div className={PANEL_BLOCK_CLASS}>
          <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
            {t("attributeProfileAddon.definitionsRefBlockLabel", "Referência")}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">
              {t("attributeProfileAddon.definitionsRefLabel", "Referência de definições")}
            </span>
            <select
              value={addon.definitionsRef || ""}
              onChange={(event) =>
                onChange({
                  ...addon,
                  definitionsRef: event.target.value || undefined,
                  values: [],
                })
              }
              className={INPUT_CLASS}
            >
              <option value="">{t("attributeProfileAddon.selectNone", "Sem referência")}</option>
              {definitionOptions.map((option) => (
                <option key={option.refId} value={option.refId}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-100">
            {t("attributeProfileAddon.valuesTitle", "Valores do perfil")}
          </h4>
          <button type="button" onClick={addValue} className={BUTTON_CLASS} disabled={selectedAttributes.length === 0}>
            {t("attributeProfileAddon.addValueButton", "+ Valor")}
          </button>
        </div>

        {values.length === 0 && (
          <div className={PANEL_BLOCK_CLASS}>
            <p className="text-xs text-gray-300">
              {t("attributeProfileAddon.emptyState", "Nenhum valor configurado ainda.")}
            </p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={values.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {values.map((row) => {
                const meta = selectedAttributes.find((item) => item.key === row.attributeKey);
                const isBoolean = meta?.valueType === "boolean";
                const title =
                  meta?.label ||
                  row.attributeKey ||
                  t("attributeProfileAddon.fallbackTitle", "Valor");
                return (
                  <SortableProfileValueBlock key={row.id} id={row.id}>
                    <div className={PANEL_BLOCK_CLASS}>
                      <button
                        type="button"
                        onClick={() => toggleRowCollapsed(row.id)}
                        aria-expanded={!collapsedValues[row.id]}
                        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left hover:bg-gray-800/40"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                          <span
                            className="inline-flex cursor-grab items-center text-gray-400 active:cursor-grabbing"
                            data-drag-handle
                            onClick={(event) => event.stopPropagation()}
                            aria-label={t("attributeProfileAddon.dragAria", "Arrastar bloco")}
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
                        <span className="text-[10px] text-gray-400">{row.attributeKey || "key"}</span>
                        <span
                          className="text-[11px] text-gray-300 transition-transform duration-200"
                          style={{ transform: collapsedValues[row.id] ? "rotate(0deg)" : "rotate(180deg)" }}
                        >
                          ▼
                        </span>
                      </button>

                      {!collapsedValues[row.id] && (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                              {t("attributeProfileAddon.valueBlockLabel", "Valor")}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label>
                                <span className="mb-1 block text-xs text-gray-400">
                                  {t("attributeProfileAddon.attributeLabel", "Atributo")}
                                </span>
                                <select
                                  value={row.attributeKey}
                                  onChange={(event) => {
                                    const nextKey = event.target.value;
                                    const nextMeta = selectedAttributes.find((item) => item.key === nextKey);
                                    updateRow(row.id, {
                                      attributeKey: nextKey,
                                      value:
                                        nextMeta?.valueType === "boolean"
                                          ? false
                                          : clampNumber(
                                              typeof nextMeta?.min === "number" ? nextMeta.min : 0,
                                              nextMeta?.min,
                                              nextMeta?.max
                                            ),
                                    });
                                  }}
                                  className={INPUT_CLASS}
                                >
                                  <option value="">{t("attributeProfileAddon.selectAttribute", "Selecione um atributo")}</option>
                                  {selectedAttributes.map((item) => (
                                    <option key={item.key} value={item.key}>
                                      {item.label} ({item.key})
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span className="mb-1 block text-xs text-gray-400">
                                  {t("attributeProfileAddon.valueLabel", "Valor")}
                                </span>
                                {isBoolean ? (
                                  <div className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2">
                                    <ToggleSwitch
                                      checked={Boolean(row.value)}
                                      onChange={(next) => updateRow(row.id, { value: next })}
                                      ariaLabel={`toggle-profile-${row.id}`}
                                    />
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    step={meta?.valueType === "float" || meta?.valueType === "percent" ? "0.01" : "1"}
                                    min={meta?.min}
                                    max={meta?.max}
                                    value={typeof row.value === "number" ? row.value : 0}
                                    onChange={(event) =>
                                      updateRow(row.id, {
                                        value: clampNumber(toNumberOrZero(event.target.value), meta?.min, meta?.max),
                                      })
                                    }
                                    className={INPUT_CLASS}
                                  />
                                )}
                              </label>
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => commit(values.filter((item) => item.id !== row.id))}
                              className={BUTTON_DANGER_CLASS}
                            >
                              {t("attributeProfileAddon.removeValueButton", "Remover valor")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </SortableProfileValueBlock>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onRemove} className={BUTTON_DANGER_CLASS}>
          {t("attributeProfileAddon.removeAddonButton", "Remover addon")}
        </button>
      </div>
    </section>
  );
}

function SortableProfileValueBlock({
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

