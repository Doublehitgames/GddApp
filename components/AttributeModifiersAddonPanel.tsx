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
import type {
  AttributeModifiersAddonDraft,
  AttributeModifierMode,
  AttributeModifierStacking,
  AttributeModifierCategory,
} from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { CommitNumberInput, CommitTextInput } from "@/components/common/CommitInput";

interface AttributeModifiersAddonPanelProps {
  addon: AttributeModifiersAddonDraft;
  onChange: (next: AttributeModifiersAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_CLASS = "rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-gray-100 hover:bg-gray-700";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

export function AttributeModifiersAddonPanel({ addon, onChange, onRemove }: AttributeModifiersAddonPanelProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const modifiers = addon.modifiers || [];
  const [collapsedModifiers, setCollapsedModifiers] = useState<Record<string, boolean>>({});
  const modifierIdSignature = useMemo(() => modifiers.map((item) => item.id).join("|"), [modifiers]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const definitionOptions = useMemo(() => {
    const out: Array<{
      refId: string;
      label: string;
      attributes: Array<{ key: string; label: string; valueType: "int" | "float" | "percent" | "boolean" }>;
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
    setCollapsedModifiers((prev) => {
      const next: Record<string, boolean> = {};
      for (const modifier of modifiers) {
        next[modifier.id] = prev[modifier.id] ?? true;
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((key) => prev[key] === next[key])) {
        return prev;
      }
      return next;
    });
  }, [modifiers, modifierIdSignature]);

  const commit = (next: AttributeModifiersAddonDraft["modifiers"]) => {
    onChange({
      ...addon,
      modifiers: next,
    });
  };

  const addModifier = () => {
    const nextId = `attr-mod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const firstKey = selectedAttributes[0]?.key || "";
    const firstType = selectedAttributes[0]?.valueType || "int";
    commit([
      ...modifiers,
      {
        id: nextId,
        attributeKey: firstKey,
        mode: "add",
        value: firstType === "boolean" ? true : 0,
      },
    ]);
    setCollapsedModifiers((prev) => ({ ...prev, [nextId]: true }));
  };

  const updateRow = (id: string, patch: Partial<AttributeModifiersAddonDraft["modifiers"][number]>) => {
    commit(
      modifiers.map((item) => {
        if (item.id !== id) return item;
        return { ...item, ...patch };
      })
    );
  };

  const toggleModifierCollapsed = (id: string) => {
    setCollapsedModifiers((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true),
    }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = modifiers.findIndex((item) => item.id === String(active.id));
    const newIndex = modifiers.findIndex((item) => item.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    commit(arrayMove(modifiers, oldIndex, newIndex));
  };

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-3">
        <div className={PANEL_BLOCK_CLASS}>
          <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
            {t("attributeModifiersAddon.definitionsRefBlockLabel", "Referência")}
          </p>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">
              {t("attributeModifiersAddon.definitionsRefLabel", "Referência de definições")}
            </span>
            <select
              value={addon.definitionsRef || ""}
              onChange={(event) =>
                onChange({
                  ...addon,
                  definitionsRef: event.target.value || undefined,
                  modifiers: [],
                })
              }
              className={INPUT_CLASS}
            >
              <option value="">{t("attributeModifiersAddon.selectNone", "Sem referência")}</option>
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
            {t("attributeModifiersAddon.modifiersTitle", "Modificadores")}
          </h4>
          <button type="button" onClick={addModifier} className={BUTTON_CLASS} disabled={selectedAttributes.length === 0}>
            {t("attributeModifiersAddon.addModifierButton", "+ Modificador")}
          </button>
        </div>

        {modifiers.length === 0 && (
          <div className={PANEL_BLOCK_CLASS}>
            <p className="text-xs text-gray-300">
              {t("attributeModifiersAddon.emptyState", "Nenhum modificador configurado ainda.")}
            </p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={modifiers.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {modifiers.map((row) => {
                const meta = selectedAttributes.find((item) => item.key === row.attributeKey);
                const isBoolean = meta?.valueType === "boolean";
                // Prefer the user-provided name when present; fall back to the
                // attribute label/key, then a generic placeholder. The right-side
                // chip keeps showing the attributeKey so you still see "what"
                // even when the title is a custom label like "Fireball impact".
                const customName = row.name?.trim();
                const title =
                  customName ||
                  meta?.label ||
                  row.attributeKey ||
                  t("attributeModifiersAddon.fallbackTitle", "Modificador");
                return (
                  <SortableModifierBlock key={row.id} id={row.id}>
                    <div className={PANEL_BLOCK_CLASS}>
                      <button
                        type="button"
                        onClick={() => toggleModifierCollapsed(row.id)}
                        aria-expanded={!collapsedModifiers[row.id]}
                        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left hover:bg-gray-800/40"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                          <span
                            className="inline-flex cursor-grab items-center text-gray-400 active:cursor-grabbing"
                            data-drag-handle
                            onClick={(event) => event.stopPropagation()}
                            aria-label={t("attributeModifiersAddon.dragAria", "Arrastar bloco")}
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
                          style={{ transform: collapsedModifiers[row.id] ? "rotate(0deg)" : "rotate(180deg)" }}
                        >
                          ▼
                        </span>
                      </button>

                      {!collapsedModifiers[row.id] && (
                        <div className="space-y-3">
                          <label className="block">
                            <span className="mb-1 block text-xs text-gray-400">
                              Nome (opcional)
                            </span>
                            <CommitTextInput
                              value={row.name || ""}
                              onCommit={(next) =>
                                updateRow(row.id, { name: next.trim() ? next.trim() : undefined })
                              }
                              placeholder="Ex.: Fireball impact, Burn DoT, Iron Skin..."
                              className={INPUT_CLASS}
                            />
                          </label>
                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                              {t("attributeModifiersAddon.modifierBlockLabel", "Modificador")}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <label>
                                <span className="mb-1 block text-xs text-gray-400">
                                  {t("attributeModifiersAddon.attributeLabel", "Atributo")}
                                </span>
                                <select
                                  value={row.attributeKey}
                                  onChange={(event) => {
                                    const nextKey = event.target.value;
                                    const nextMeta = selectedAttributes.find((item) => item.key === nextKey);
                                    updateRow(row.id, {
                                      attributeKey: nextKey,
                                      value: nextMeta?.valueType === "boolean" ? true : 0,
                                    });
                                  }}
                                  className={INPUT_CLASS}
                                >
                                  <option value="">{t("attributeModifiersAddon.selectAttribute", "Selecione um atributo")}</option>
                                  {selectedAttributes.map((item) => (
                                    <option key={item.key} value={item.key}>
                                      {item.label} ({item.key})
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span className="mb-1 block text-xs text-gray-400">{t("attributeModifiersAddon.modeLabel", "Modo")}</span>
                                <select
                                  value={row.mode}
                                  onChange={(event) => updateRow(row.id, { mode: event.target.value as AttributeModifierMode })}
                                  className={INPUT_CLASS}
                                >
                                  <option value="add">add</option>
                                  <option value="mult">mult</option>
                                  <option value="set">set</option>
                                </select>
                              </label>
                              <label>
                                <span className="mb-1 block text-xs text-gray-400">{t("attributeModifiersAddon.valueLabel", "Valor")}</span>
                                {isBoolean ? (
                                  <div className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2">
                                    <ToggleSwitch
                                      checked={Boolean(row.value)}
                                      onChange={(next) => updateRow(row.id, { value: next })}
                                      ariaLabel={`toggle-modifier-${row.id}`}
                                    />
                                  </div>
                                ) : (
                                  <CommitNumberInput
                                    value={typeof row.value === "number" ? row.value : 0}
                                    onCommit={(next) => updateRow(row.id, { value: next })}
                                    step={meta?.valueType === "float" || meta?.valueType === "percent" ? "0.01" : "1"}
                                    integer={meta?.valueType === "int"}
                                    className={INPUT_CLASS}
                                  />
                                )}
                              </label>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <div>
                                <span className="mb-1 block text-xs text-gray-400">
                                  {t("attributeModifiersAddon.temporaryLabel", "Temporário")}
                                </span>
                                <div className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2">
                                  <ToggleSwitch
                                    checked={Boolean(row.temporary)}
                                    onChange={(next) =>
                                      updateRow(row.id, {
                                        temporary: next,
                                        durationSeconds: next ? (row.durationSeconds ?? 0) : undefined,
                                      })
                                    }
                                    ariaLabel={`toggle-temporary-${row.id}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateRow(row.id, {
                                        temporary: !row.temporary,
                                        durationSeconds: !row.temporary ? (row.durationSeconds ?? 0) : undefined,
                                      })
                                    }
                                    className="text-[11px] text-gray-400 hover:text-gray-200"
                                  >
                                    {row.temporary
                                      ? t("attributeModifiersAddon.temporaryOn", "Por tempo limitado")
                                      : t("attributeModifiersAddon.temporaryOff", "Permanente")}
                                  </button>
                                </div>
                              </div>
                              {row.temporary && (
                                <div>
                                  <span className="mb-1 block text-xs text-gray-400">
                                    {t("attributeModifiersAddon.durationLabel", "Duração (segundos)")}
                                  </span>
                                  <CommitNumberInput
                                    value={row.durationSeconds ?? 0}
                                    onCommit={(next) =>
                                      updateRow(row.id, { durationSeconds: next < 0 ? 0 : next })
                                    }
                                    step="0.1"
                                    className={INPUT_CLASS}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="mt-3 rounded-lg border border-gray-700 bg-gray-900/50 p-2.5">
                              <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                                {t("attributeModifiersAddon.behaviorBlockLabel", "Comportamento")}
                              </p>
                              <div className="grid gap-2 sm:grid-cols-3">
                                <label>
                                  <span className="mb-1 block text-xs text-gray-400">
                                    {t("attributeModifiersAddon.stackingLabel", "Empilhamento")}
                                  </span>
                                  <select
                                    value={row.stackingRule || ""}
                                    onChange={(event) =>
                                      updateRow(row.id, {
                                        stackingRule: (event.target.value || undefined) as
                                          | AttributeModifierStacking
                                          | undefined,
                                      })
                                    }
                                    className={INPUT_CLASS}
                                  >
                                    <option value="">{t("attributeModifiersAddon.stackingDefault", "Padrão")}</option>
                                    <option value="unique">{t("attributeModifiersAddon.stackingUnique", "Único (ignora se já ativo)")}</option>
                                    <option value="refresh">{t("attributeModifiersAddon.stackingRefresh", "Renovar (reseta duração)")}</option>
                                    <option value="stack">{t("attributeModifiersAddon.stackingStack", "Acumular")}</option>
                                  </select>
                                </label>
                                <label>
                                  <span className="mb-1 block text-xs text-gray-400">
                                    {t("attributeModifiersAddon.categoryLabel", "Categoria")}
                                  </span>
                                  <select
                                    value={row.category || ""}
                                    onChange={(event) =>
                                      updateRow(row.id, {
                                        category: (event.target.value || undefined) as
                                          | AttributeModifierCategory
                                          | undefined,
                                      })
                                    }
                                    className={INPUT_CLASS}
                                  >
                                    <option value="">{t("attributeModifiersAddon.categoryNone", "Não definida")}</option>
                                    <option value="buff">{t("attributeModifiersAddon.categoryBuff", "Buff")}</option>
                                    <option value="debuff">{t("attributeModifiersAddon.categoryDebuff", "Debuff")}</option>
                                    <option value="neutral">{t("attributeModifiersAddon.categoryNeutral", "Neutro")}</option>
                                  </select>
                                </label>
                                {row.temporary && (
                                  <label>
                                    <span className="mb-1 block text-xs text-gray-400">
                                      {t("attributeModifiersAddon.tickIntervalLabel", "Intervalo de tick (s)")}
                                    </span>
                                    <CommitNumberInput
                                      value={row.tickIntervalSeconds ?? 0}
                                      onCommit={(next) =>
                                        updateRow(row.id, {
                                          tickIntervalSeconds: next > 0 ? next : undefined,
                                        })
                                      }
                                      step="0.1"
                                      className={INPUT_CLASS}
                                    />
                                  </label>
                                )}
                              </div>
                              <label className="mt-2 block">
                                <span className="mb-1 block text-xs text-gray-400">
                                  {t("attributeModifiersAddon.tagsLabel", "Tags (separadas por vírgula)")}
                                </span>
                                <CommitTextInput
                                  value={(row.tags || []).join(", ")}
                                  onCommit={(next) => {
                                    const parsed = next
                                      .split(",")
                                      .map((s) => s.trim().toLowerCase())
                                      .filter(Boolean);
                                    const unique = Array.from(new Set(parsed));
                                    updateRow(row.id, { tags: unique.length > 0 ? unique : undefined });
                                  }}
                                  className={INPUT_CLASS}
                                  placeholder={t("attributeModifiersAddon.tagsPlaceholder", "ex: poison, magical")}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => commit(modifiers.filter((item) => item.id !== row.id))}
                              className={BUTTON_DANGER_CLASS}
                            >
                              {t("attributeModifiersAddon.removeModifierButton", "Remover modificador")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </SortableModifierBlock>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

    </section>
  );
}

function SortableModifierBlock({
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

