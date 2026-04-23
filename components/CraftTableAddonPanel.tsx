"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CraftTableAddonDraft, CraftTableEntry, CraftTableUnlock } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { CommitTextInput, CommitOptionalNumberInput } from "@/components/common/CommitInput";
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

interface CraftTableAddonPanelProps {
  addon: CraftTableAddonDraft;
  onChange: (next: CraftTableAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const DANGER_BUTTON =
  "rounded-lg border border-rose-700/60 bg-rose-900/30 px-2 py-1 text-xs text-rose-200 hover:bg-rose-900/50";
const PRIMARY_BUTTON =
  "rounded-lg border border-emerald-600 bg-emerald-700/50 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-700/70";

type RefOption = {
  refId: string;
  label: string;
};

type ProductionRefOption = RefOption & {
  mode: "passive" | "recipe";
};

function resequence(entries: CraftTableEntry[]): CraftTableEntry[] {
  return entries.map((entry, index) => ({ ...entry, order: index }));
}

function newEntryId(): string {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function CraftTableAddonPanel({ addon, onChange, onRemove }: CraftTableAddonPanelProps) {
  const { t } = useI18n();
  const allProjects = useProjectStore((state) => state.projects);
  const currentProjectId = useCurrentProjectId();
  const scopedProjects = useMemo(
    () => (currentProjectId ? allProjects.filter((p) => p.id === currentProjectId) : allProjects),
    [allProjects, currentProjectId]
  );

  const sortedEntries = useMemo(
    () => [...addon.entries].sort((a, b) => a.order - b.order),
    [addon.entries]
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCollapsed((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;
      for (const entry of sortedEntries) {
        next[entry.id] = prev[entry.id] ?? true;
        if (next[entry.id] !== prev[entry.id]) changed = true;
      }
      if (!changed && Object.keys(prev).length === Object.keys(next).length) return prev;
      return next;
    });
  }, [sortedEntries]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const productionOptions = useMemo<ProductionRefOption[]>(() => {
    const out: ProductionRefOption[] = [];
    const seen = new Set<string>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "production") continue;
          if (seen.has(section.id)) continue;
          seen.add(section.id);
          const sectionTitle = section.title?.trim() || section.id;
          const addonName = sectionAddon.name?.trim() || "Production";
          out.push({
            refId: section.id,
            label: `${sectionTitle} — ${addonName}`,
            mode: sectionAddon.data.mode,
          });
          break;
        }
      }
    }
    return out;
  }, [scopedProjects]);

  const productionLabelByRef = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of productionOptions) map.set(option.refId, option.label);
    return map;
  }, [productionOptions]);

  const sectionThumbByRef = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        const thumb = (section as { thumbImageUrl?: string | null }).thumbImageUrl ?? null;
        map.set(section.id, thumb);
      }
    }
    return map;
  }, [scopedProjects]);

  const xpOptions = useMemo<RefOption[]>(() => {
    const out: RefOption[] = [];
    const seen = new Set<string>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        const hasXp = (section.addons || []).some((item) => item.type === "xpBalance");
        if (!hasXp) continue;
        if (seen.has(section.id)) continue;
        seen.add(section.id);
        out.push({ refId: section.id, label: section.title?.trim() || section.id });
      }
    }
    return out;
  }, [scopedProjects]);

  const currencyOptions = useMemo<RefOption[]>(() => {
    const out: RefOption[] = [];
    const seen = new Set<string>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "currency") continue;
          if (seen.has(section.id)) continue;
          seen.add(section.id);
          const displayName = sectionAddon.data.displayName?.trim() || sectionAddon.name || section.title;
          const code = sectionAddon.data.code?.trim();
          out.push({ refId: section.id, label: code ? `${displayName} (${code})` : displayName });
        }
      }
    }
    return out;
  }, [scopedProjects]);

  const itemOptions = useMemo<RefOption[]>(() => {
    const out: RefOption[] = [];
    const seen = new Set<string>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        const hasInv = (section.addons || []).some((item) => item.type === "inventory");
        if (!hasInv) continue;
        if (seen.has(section.id)) continue;
        seen.add(section.id);
        out.push({ refId: section.id, label: section.title?.trim() || section.id });
      }
    }
    return out;
  }, [scopedProjects]);

  const knownCategories = useMemo(() => {
    const set = new Set<string>();
    for (const entry of addon.entries) {
      if (entry.category && entry.category.trim()) set.add(entry.category.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [addon.entries]);

  const categoriesListId = `craft-table-categories-${addon.id}`;

  const commit = (patch: Partial<CraftTableAddonDraft>) => {
    onChange({ ...addon, ...patch });
  };

  const commitEntries = (nextEntries: CraftTableEntry[]) => {
    commit({ entries: resequence(nextEntries) });
  };

  const commitEntry = (entryId: string, patch: Partial<CraftTableEntry>) => {
    const nextEntries = sortedEntries.map((entry) =>
      entry.id === entryId ? { ...entry, ...patch } : entry
    );
    commitEntries(nextEntries);
  };

  const commitUnlock = (entryId: string, slotPatch: Partial<CraftTableUnlock>) => {
    const entry = sortedEntries.find((item) => item.id === entryId);
    if (!entry) return;
    const nextUnlock: CraftTableUnlock = { ...(entry.unlock || {}), ...slotPatch };
    const isEmpty = !nextUnlock.level && !nextUnlock.currency && !nextUnlock.item;
    commitEntry(entryId, { unlock: isEmpty ? undefined : nextUnlock });
  };

  const addEntry = () => {
    const newEntry: CraftTableEntry = {
      id: newEntryId(),
      order: sortedEntries.length,
    };
    commit({ entries: [...sortedEntries, newEntry] });
    setCollapsed((prev) => ({ ...prev, [newEntry.id]: false }));
  };

  const removeEntry = (entryId: string) => {
    commitEntries(sortedEntries.filter((entry) => entry.id !== entryId));
  };

  const toggleEntryCollapsed = (entryId: string) => {
    setCollapsed((prev) => ({ ...prev, [entryId]: !(prev[entryId] ?? true) }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedEntries.findIndex((entry) => entry.id === String(active.id));
    const newIndex = sortedEntries.findIndex((entry) => entry.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    commitEntries(arrayMove(sortedEntries, oldIndex, newIndex));
  };

  const entryTitle = (entry: CraftTableEntry, index: number): string => {
    if (entry.productionRef) {
      const label = productionLabelByRef.get(entry.productionRef);
      if (label) return label;
      return t("craftTableAddon.unknownRecipe", "Receita não encontrada");
    }
    return t("craftTableAddon.newRecipe", "Nova receita") + ` #${index + 1}`;
  };

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs uppercase tracking-wide text-gray-400">
            {t("craftTableAddon.entriesTitle", "Receitas da mesa")}
          </h4>
          <button type="button" className={PRIMARY_BUTTON} onClick={addEntry}>
            + {t("craftTableAddon.addEntry", "Adicionar receita")}
          </button>
        </div>

        {sortedEntries.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-4 text-xs text-gray-400">
            {t("craftTableAddon.noEntries", "Nenhuma receita ainda. Clique em 'Adicionar receita' para começar.")}
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedEntries.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sortedEntries.map((entry, index) => {
                const productionKnown = entry.productionRef
                  ? productionOptions.some((option) => option.refId === entry.productionRef)
                  : false;
                const unlockLevel = entry.unlock?.level;
                const unlockCurrency = entry.unlock?.currency;
                const unlockItem = entry.unlock?.item;
                const levelXpKnown = unlockLevel?.xpAddonRef
                  ? xpOptions.some((option) => option.refId === unlockLevel.xpAddonRef)
                  : false;
                const currencyKnown = unlockCurrency?.currencyAddonRef
                  ? currencyOptions.some((option) => option.refId === unlockCurrency.currencyAddonRef)
                  : false;
                const itemKnown = unlockItem?.itemRef
                  ? itemOptions.some((option) => option.refId === unlockItem.itemRef)
                  : false;
                const isCollapsed = collapsed[entry.id] ?? true;

                return (
                  <SortableCraftEntryBlock key={entry.id} id={entry.id}>
                    <div className={PANEL_BLOCK_CLASS}>
                      <div className="mb-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleEntryCollapsed(entry.id)}
                          aria-expanded={!isCollapsed}
                          className="flex flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left hover:bg-gray-800/40"
                        >
                          <DragHandle ariaLabel={t("craftTableAddon.dragAria", "Arrastar receita")} />
                          {entry.productionRef && sectionThumbByRef.get(entry.productionRef) ? (
                            <img
                              src={sectionThumbByRef.get(entry.productionRef) as string}
                              alt=""
                              loading="lazy"
                              className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-gray-600/80 object-cover"
                            />
                          ) : null}
                          <span className="flex-1 text-xs font-semibold text-gray-200">
                            {entryTitle(entry, index)}
                          </span>
                          {entry.hidden && (
                            <span className="rounded-full border border-amber-600/60 bg-amber-900/20 px-2 py-0.5 text-[10px] text-amber-200">
                              {t("craftTableAddon.unavailable", "Indisponível")}
                            </span>
                          )}
                          {entry.category && (
                            <span className="rounded-full border border-gray-700 bg-gray-900/40 px-2 py-0.5 text-[10px] text-gray-400">
                              {entry.category}
                            </span>
                          )}
                          <span
                            className="text-[11px] text-gray-300 transition-transform duration-200"
                            style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)" }}
                          >
                            ▼
                          </span>
                        </button>
                        <label
                          className="flex items-center gap-1 text-[11px] text-gray-400"
                          onClick={(event) => event.stopPropagation()}
                          title={t("craftTableAddon.availableTitle", "Quando desligado, a receita fica marcada como indisponível no export do jogo.")}
                        >
                          <ToggleSwitch
                            checked={!entry.hidden}
                            onChange={(next) => commitEntry(entry.id, { hidden: next ? undefined : true })}
                            ariaLabel={t("craftTableAddon.available", "Disponível no jogo")}
                          />
                          <span>{t("craftTableAddon.available", "Disponível no jogo")}</span>
                        </label>
                        <button
                          type="button"
                          className={DANGER_BUTTON}
                          onClick={() => removeEntry(entry.id)}
                        >
                          {t("craftTableAddon.removeEntry", "Remover")}
                        </button>
                      </div>

                      {!isCollapsed && (
                        <div className="space-y-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-xs text-gray-400">
                                {t("craftTableAddon.productionRef", "Receita (Production)")}
                              </span>
                              <select
                                value={
                                  entry.productionRef
                                    ? productionKnown
                                      ? entry.productionRef
                                      : "__invalid__"
                                    : ""
                                }
                                onChange={(event) => {
                                  const next = event.target.value;
                                  if (next === "__invalid__") return;
                                  commitEntry(entry.id, { productionRef: next || undefined });
                                }}
                                className={INPUT_CLASS}
                              >
                                <option value="">{t("craftTableAddon.selectNone", "Sem receita")}</option>
                                {entry.productionRef && !productionKnown && (
                                  <option value="__invalid__">
                                    {t("craftTableAddon.invalidProductionRef", "Receita não encontrada")}
                                  </option>
                                )}
                                {productionOptions.map((option) => (
                                  <option key={option.refId} value={option.refId}>
                                    {option.label}
                                    {option.mode === "passive"
                                      ? ` • ${t("craftTableAddon.passiveHint", "passiva")}`
                                      : ""}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="block">
                              <span className="mb-1 block text-xs text-gray-400">
                                {t("craftTableAddon.category", "Categoria")}
                              </span>
                              <CommitTextInput
                                value={entry.category || ""}
                                onCommit={(next) => commitEntry(entry.id, { category: next ? next : undefined })}
                                placeholder={t("craftTableAddon.categoryPlaceholder", "Ex: Armas, Consumíveis")}
                                className={INPUT_CLASS}
                                list={categoriesListId}
                              />
                            </label>
                          </div>

                          <div className="space-y-2">
                            <span className="text-[11px] uppercase tracking-wide text-gray-500">
                              {t("craftTableAddon.unlockTitle", "Desbloqueio")}
                            </span>

                            <UnlockRow
                              label={t("craftTableAddon.unlockLevel", "Nível")}
                              enabled={Boolean(unlockLevel?.enabled)}
                              onToggle={(enabled) =>
                                commitUnlock(entry.id, {
                                  level: enabled
                                    ? { ...(unlockLevel || {}), enabled: true }
                                    : unlockLevel
                                      ? { ...unlockLevel, enabled: false }
                                      : undefined,
                                })
                              }
                            >
                              <select
                                value={
                                  unlockLevel?.xpAddonRef
                                    ? levelXpKnown
                                      ? unlockLevel.xpAddonRef
                                      : "__invalid__"
                                    : ""
                                }
                                onChange={(event) => {
                                  const next = event.target.value;
                                  if (next === "__invalid__") return;
                                  commitUnlock(entry.id, {
                                    level: { ...(unlockLevel || { enabled: true }), xpAddonRef: next || undefined },
                                  });
                                }}
                                className={INPUT_CLASS}
                                disabled={!unlockLevel?.enabled}
                              >
                                <option value="">{t("craftTableAddon.selectXp", "Página de XP")}</option>
                                {unlockLevel?.xpAddonRef && !levelXpKnown && (
                                  <option value="__invalid__">
                                    {t("craftTableAddon.invalidXpRef", "XP não encontrado")}
                                  </option>
                                )}
                                {xpOptions.map((option) => (
                                  <option key={option.refId} value={option.refId}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <CommitOptionalNumberInput
                                value={unlockLevel?.level}
                                onCommit={(next) =>
                                  commitUnlock(entry.id, {
                                    level: { ...(unlockLevel || { enabled: true }), level: next },
                                  })
                                }
                                placeholder={t("craftTableAddon.levelPlaceholder", "LV")}
                                min={1}
                                integer
                                step={1}
                                className={INPUT_CLASS}
                                disabled={!unlockLevel?.enabled}
                              />
                            </UnlockRow>

                            <UnlockRow
                              label={t("craftTableAddon.unlockCurrency", "Moeda")}
                              enabled={Boolean(unlockCurrency?.enabled)}
                              onToggle={(enabled) =>
                                commitUnlock(entry.id, {
                                  currency: enabled
                                    ? { ...(unlockCurrency || {}), enabled: true }
                                    : unlockCurrency
                                      ? { ...unlockCurrency, enabled: false }
                                      : undefined,
                                })
                              }
                            >
                              <select
                                value={
                                  unlockCurrency?.currencyAddonRef
                                    ? currencyKnown
                                      ? unlockCurrency.currencyAddonRef
                                      : "__invalid__"
                                    : ""
                                }
                                onChange={(event) => {
                                  const next = event.target.value;
                                  if (next === "__invalid__") return;
                                  commitUnlock(entry.id, {
                                    currency: {
                                      ...(unlockCurrency || { enabled: true }),
                                      currencyAddonRef: next || undefined,
                                    },
                                  });
                                }}
                                className={INPUT_CLASS}
                                disabled={!unlockCurrency?.enabled}
                              >
                                <option value="">{t("craftTableAddon.selectCurrency", "Selecione a moeda")}</option>
                                {unlockCurrency?.currencyAddonRef && !currencyKnown && (
                                  <option value="__invalid__">
                                    {t("craftTableAddon.invalidCurrencyRef", "Moeda não encontrada")}
                                  </option>
                                )}
                                {currencyOptions.map((option) => (
                                  <option key={option.refId} value={option.refId}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <CommitOptionalNumberInput
                                value={unlockCurrency?.amount}
                                onCommit={(next) =>
                                  commitUnlock(entry.id, {
                                    currency: { ...(unlockCurrency || { enabled: true }), amount: next },
                                  })
                                }
                                placeholder={t("craftTableAddon.amountPlaceholder", "Valor")}
                                min={0}
                                integer
                                step={1}
                                className={INPUT_CLASS}
                                disabled={!unlockCurrency?.enabled}
                              />
                            </UnlockRow>

                            <UnlockRow
                              label={t("craftTableAddon.unlockItem", "Item")}
                              enabled={Boolean(unlockItem?.enabled)}
                              onToggle={(enabled) =>
                                commitUnlock(entry.id, {
                                  item: enabled
                                    ? { ...(unlockItem || {}), enabled: true }
                                    : unlockItem
                                      ? { ...unlockItem, enabled: false }
                                      : undefined,
                                })
                              }
                            >
                              <select
                                value={
                                  unlockItem?.itemRef
                                    ? itemKnown
                                      ? unlockItem.itemRef
                                      : "__invalid__"
                                    : ""
                                }
                                onChange={(event) => {
                                  const next = event.target.value;
                                  if (next === "__invalid__") return;
                                  commitUnlock(entry.id, {
                                    item: { ...(unlockItem || { enabled: true }), itemRef: next || undefined },
                                  });
                                }}
                                className={INPUT_CLASS}
                                disabled={!unlockItem?.enabled}
                              >
                                <option value="">{t("craftTableAddon.selectItem", "Selecione o item")}</option>
                                {unlockItem?.itemRef && !itemKnown && (
                                  <option value="__invalid__">
                                    {t("craftTableAddon.invalidItemRef", "Item não encontrado")}
                                  </option>
                                )}
                                {itemOptions.map((option) => (
                                  <option key={option.refId} value={option.refId}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <CommitOptionalNumberInput
                                value={unlockItem?.quantity}
                                onCommit={(next) =>
                                  commitUnlock(entry.id, {
                                    item: { ...(unlockItem || { enabled: true }), quantity: next },
                                  })
                                }
                                placeholder={t("craftTableAddon.quantityPlaceholder", "Qtd")}
                                min={1}
                                integer
                                step={1}
                                className={INPUT_CLASS}
                                disabled={!unlockItem?.enabled}
                              />
                            </UnlockRow>
                          </div>
                        </div>
                      )}
                    </div>
                  </SortableCraftEntryBlock>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <datalist id={categoriesListId}>
          {knownCategories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        <div className="flex justify-end">
          <button type="button" className={DANGER_BUTTON} onClick={onRemove}>
            {t("craftTableAddon.removeAddon", "Remover addon")}
          </button>
        </div>
      </div>
    </section>
  );
}

function DragHandle({ ariaLabel }: { ariaLabel: string }) {
  return (
    <span
      className="inline-flex cursor-grab items-center text-gray-400 active:cursor-grabbing"
      data-drag-handle
      onClick={(event) => event.stopPropagation()}
      aria-label={ariaLabel}
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
  );
}

function SortableCraftEntryBlock({ id, children }: { id: string; children: ReactNode }) {
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

function UnlockRow({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-2">
      <div className="mb-1 flex items-center gap-2">
        <ToggleSwitch checked={enabled} onChange={onToggle} ariaLabel={label} />
        <span className="text-xs text-gray-300">{label}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}
