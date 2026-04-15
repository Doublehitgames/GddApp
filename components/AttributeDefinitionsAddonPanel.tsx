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
import type { AttributeDefinitionEntry, AttributeDefinitionsAddonDraft, AttributeValueType } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { ToggleSwitch } from "@/components/ToggleSwitch";

interface AttributeDefinitionsAddonPanelProps {
  addon: AttributeDefinitionsAddonDraft;
  onChange: (next: AttributeDefinitionsAddonDraft) => void;
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
    .replace(/[^a-zA-Z0-9_\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function toNumberOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

function normalizeBounds(min?: number, max?: number): { min?: number; max?: number } {
  if (min == null || max == null) return { min, max };
  return min <= max ? { min, max } : { min: max, max: min };
}

function coerceDefaultValue(valueType: AttributeValueType, raw: unknown): number | boolean {
  if (valueType === "boolean") return Boolean(raw);
  const parsed = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  if (valueType === "int") return Math.floor(parsed);
  return parsed;
}

function clampNumericValue(value: number, min?: number, max?: number): number {
  let next = value;
  if (min != null) next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  return next;
}

export function AttributeDefinitionsAddonPanel({ addon, onChange, onRemove }: AttributeDefinitionsAddonPanelProps) {
  const { t } = useI18n();
  const attributes = addon.attributes || [];
  const [collapsedAttributes, setCollapsedAttributes] = useState<Record<string, boolean>>({});
  const attributeIdSignature = useMemo(() => attributes.map((entry) => entry.id).join("|"), [attributes]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    setCollapsedAttributes((prev) => {
      const next: Record<string, boolean> = {};
      for (const attribute of attributes) {
        next[attribute.id] = prev[attribute.id] ?? true;
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key])) {
        return prev;
      }
      return next;
    });
  }, [attributes, attributeIdSignature]);

  const commit = (nextAttributes: AttributeDefinitionEntry[]) => {
    onChange({
      ...addon,
      attributes: nextAttributes,
    });
  };

  const updateAttribute = (id: string, patch: Partial<AttributeDefinitionEntry>) => {
    const next = attributes.map((entry) => {
      if (entry.id !== id) return entry;
      const merged = { ...entry, ...patch };
      const bounds = normalizeBounds(merged.min, merged.max);
      merged.min = bounds.min;
      merged.max = bounds.max;

      if (merged.valueType === "boolean") {
        merged.min = undefined;
        merged.max = undefined;
        merged.defaultValue = coerceDefaultValue("boolean", merged.defaultValue);
      } else {
        const numeric = coerceDefaultValue(merged.valueType, merged.defaultValue);
        const numericValue = typeof numeric === "number" ? numeric : 0;
        const clamped = clampNumericValue(numericValue, merged.min, merged.max);
        merged.defaultValue = merged.valueType === "int" ? Math.floor(clamped) : clamped;
      }
      return merged;
    });
    commit(next);
  };

  const addAttribute = () => {
    const id = `attr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    commit([
      ...attributes,
      {
        id,
        key: `attribute_${attributes.length + 1}`,
        label: `${t("attributeDefinitionsAddon.newAttribute", "Novo atributo")} ${attributes.length + 1}`,
        valueType: "int",
        defaultValue: 0,
      },
    ]);
    setCollapsedAttributes((prev) => ({ ...prev, [id]: true }));
  };

  const removeAttribute = (id: string) => {
    commit(attributes.filter((entry) => entry.id !== id));
  };

  const toggleAttributeCollapsed = (id: string) => {
    setCollapsedAttributes((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true),
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = attributes.findIndex((entry) => entry.id === String(active.id));
    const newIndex = attributes.findIndex((entry) => entry.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    commit(arrayMove(attributes, oldIndex, newIndex));
  };

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-100">
          {t("attributeDefinitionsAddon.defaultName", "Definições de Atributos")}
        </h4>
        <button type="button" onClick={addAttribute} className={BUTTON_CLASS}>
          {t("attributeDefinitionsAddon.addButton", "+ Atributo")}
        </button>
      </div>

      <div className="space-y-3">
        {attributes.length === 0 && (
          <div className={PANEL_BLOCK_CLASS}>
            <p className="text-xs text-gray-300">
              {t("attributeDefinitionsAddon.emptyState", "Nenhum atributo definido ainda.")}
            </p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={attributes.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {attributes.map((entry) => {
                const supportsBounds = entry.valueType !== "boolean";
                const useBounds = supportsBounds && (entry.min != null || entry.max != null);
                const title =
                  entry.label?.trim() ||
                  entry.key?.trim() ||
                  t("attributeDefinitionsAddon.fallbackTitle", "Atributo");
                return (
                  <SortableAttributeBlock key={entry.id} id={entry.id}>
                    <div className={PANEL_BLOCK_CLASS}>
                      <button
                        type="button"
                        onClick={() => toggleAttributeCollapsed(entry.id)}
                        aria-expanded={!collapsedAttributes[entry.id]}
                        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left hover:bg-gray-800/40"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                          <span
                            className="inline-flex cursor-grab items-center text-gray-400 active:cursor-grabbing"
                            data-drag-handle
                            onClick={(event) => event.stopPropagation()}
                            aria-label={t("attributeDefinitionsAddon.dragAria", "Arrastar bloco")}
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
                          style={{ transform: collapsedAttributes[entry.id] ? "rotate(0deg)" : "rotate(180deg)" }}
                        >
                          ▼
                        </span>
                      </button>

                      {!collapsedAttributes[entry.id] && (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                              {t("attributeDefinitionsAddon.identificationBlockLabel", "Identificação")}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label>
                                <span className="mb-1 block text-xs text-gray-400">{t("attributeDefinitionsAddon.labelLabel", "Nome")}</span>
                                <input
                                  type="text"
                                  value={entry.label}
                                  onChange={(event) => updateAttribute(entry.id, { label: event.target.value })}
                                  className={INPUT_CLASS}
                                />
                              </label>
                              <label>
                                <span className="mb-1 block text-xs text-gray-400">{t("attributeDefinitionsAddon.keyLabel", "Chave")}</span>
                                <input
                                  type="text"
                                  value={entry.key}
                                  onChange={(event) => updateAttribute(entry.id, { key: normalizeKey(event.target.value) })}
                                  className={INPUT_CLASS}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                              {t("attributeDefinitionsAddon.valueBlockLabel", "Valor")}
                            </p>
                            <div className="flex flex-wrap items-end gap-2">
                              <label className="min-w-[130px]">
                                <span className="mb-1 block text-xs text-gray-400">{t("attributeDefinitionsAddon.typeLabel", "Tipo")}</span>
                                <select
                                  value={entry.valueType}
                                  onChange={(event) => {
                                    const nextType = event.target.value as AttributeValueType;
                                    updateAttribute(entry.id, {
                                      valueType: nextType,
                                      defaultValue: coerceDefaultValue(nextType, entry.defaultValue),
                                    });
                                  }}
                                  className={INPUT_CLASS}
                                >
                                  <option value="int">int</option>
                                  <option value="float">float</option>
                                  <option value="percent">percent</option>
                                  <option value="boolean">boolean</option>
                                </select>
                              </label>

                              {entry.valueType === "boolean" ? (
                                <div className="min-w-[130px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2">
                                  <span className="mb-1 block text-xs text-gray-400">
                                    {t("attributeDefinitionsAddon.defaultValueLabel", "Valor padrão")}
                                  </span>
                                  <ToggleSwitch
                                    checked={Boolean(entry.defaultValue)}
                                    onChange={(next) => updateAttribute(entry.id, { defaultValue: next })}
                                    ariaLabel={`toggle-default-${entry.key}`}
                                  />
                                </div>
                              ) : (
                                <label className="min-w-[130px]">
                                  <span className="mb-1 block text-xs text-gray-400">
                                    {t("attributeDefinitionsAddon.defaultValueLabel", "Valor padrão")}
                                  </span>
                                  <input
                                    type="number"
                                    step={entry.valueType === "float" || entry.valueType === "percent" ? "0.01" : "1"}
                                    min={entry.min}
                                    max={entry.max}
                                    value={typeof entry.defaultValue === "number" ? entry.defaultValue : 0}
                                    onChange={(event) =>
                                      updateAttribute(entry.id, {
                                        defaultValue: Number(event.target.value.replace(",", ".")) || 0,
                                      })
                                    }
                                    className={INPUT_CLASS}
                                  />
                                </label>
                              )}

                              <label className="min-w-[130px]">
                                <span className="mb-1 block text-xs text-gray-400">
                                  {t("attributeDefinitionsAddon.unitLabel", "Unidade (opcional)")}
                                </span>
                                <input
                                  type="text"
                                  value={entry.unit ?? ""}
                                  onChange={(event) => updateAttribute(entry.id, { unit: event.target.value || undefined })}
                                  className={INPUT_CLASS}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                                {t("attributeDefinitionsAddon.boundsBlockLabel", "Limites")}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-300">{t("attributeDefinitionsAddon.useBoundsLabel", "Usar")}</span>
                                <ToggleSwitch
                                  checked={useBounds}
                                  onChange={(next) => {
                                    if (!supportsBounds) return;
                                    if (!next) {
                                      updateAttribute(entry.id, { min: undefined, max: undefined });
                                    } else {
                                      const numericDefault =
                                        typeof entry.defaultValue === "number" && Number.isFinite(entry.defaultValue)
                                          ? entry.defaultValue
                                          : 0;
                                      const normalizedDefault =
                                        entry.valueType === "int" ? Math.floor(numericDefault) : numericDefault;
                                      updateAttribute(entry.id, {
                                        min: 0,
                                        max: Math.max(0, normalizedDefault),
                                      });
                                    }
                                  }}
                                  ariaLabel={t("attributeDefinitionsAddon.useBoundsLabel", "Usar")}
                                  disabled={!supportsBounds}
                                />
                              </div>
                            </div>

                            {useBounds ? (
                              <div className="flex flex-wrap items-end gap-2">
                                <label className="min-w-[120px]">
                                  <span className="mb-1 block text-xs text-gray-400">{t("attributeDefinitionsAddon.minLabel", "Mínimo")}</span>
                                  <input
                                    type="number"
                                    value={entry.min ?? ""}
                                    onChange={(event) => updateAttribute(entry.id, { min: toNumberOrUndefined(event.target.value) })}
                                    className={INPUT_CLASS}
                                  />
                                </label>
                                <label className="min-w-[120px]">
                                  <span className="mb-1 block text-xs text-gray-400">{t("attributeDefinitionsAddon.maxLabel", "Máximo")}</span>
                                  <input
                                    type="number"
                                    value={entry.max ?? ""}
                                    onChange={(event) => updateAttribute(entry.id, { max: toNumberOrUndefined(event.target.value) })}
                                    className={INPUT_CLASS}
                                  />
                                </label>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex justify-end">
                            <button type="button" onClick={() => removeAttribute(entry.id)} className={BUTTON_DANGER_CLASS}>
                              {t("attributeDefinitionsAddon.removeAttribute", "Remover atributo")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </SortableAttributeBlock>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

    </section>
  );
}

function SortableAttributeBlock({
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

