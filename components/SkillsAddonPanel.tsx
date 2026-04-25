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
  SkillsAddonDraft,
  SkillEntry,
  SkillCost,
  SkillEffectRef,
  SkillKind,
  SkillCostType,
  AttributeModifierEntry,
  AttributeModifierStacking,
} from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import { CommitNumberInput, CommitOptionalNumberInput, CommitTextInput } from "@/components/common/CommitInput";

interface SkillsAddonPanelProps {
  addon: SkillsAddonDraft;
  onChange: (next: SkillsAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const SUB_BLOCK_CLASS = "rounded-lg border border-gray-700 bg-gray-900/50 p-2.5";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_CLASS = "rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-gray-100 hover:bg-gray-700";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";
const BUTTON_TINY_CLASS = "rounded-md border border-gray-600 bg-gray-800 px-2 py-0.5 text-[11px] text-gray-100 hover:bg-gray-700";

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function formatModifierLabel(entry: AttributeModifierEntry, attributeLabel: string): string {
  const numericValue = typeof entry.value === "number" ? entry.value : null;
  const sign =
    entry.mode === "set"
      ? "="
      : entry.mode === "mult"
      ? "×"
      : numericValue != null && numericValue >= 0
      ? "+"
      : "";
  const valueStr = typeof entry.value === "boolean" ? (entry.value ? "true" : "false") : String(entry.value);
  let suffix = "";
  if (entry.temporary && entry.durationSeconds && entry.durationSeconds > 0) {
    suffix = ` (${entry.durationSeconds}s${entry.tickIntervalSeconds ? `, tick ${entry.tickIntervalSeconds}s` : ""})`;
  }
  return `${sign}${valueStr} ${attributeLabel}${suffix}`;
}

export function SkillsAddonPanel({ addon, onChange }: SkillsAddonPanelProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const currentProjectId = useCurrentProjectId();
  const entries = addon.entries || [];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const idSignature = useMemo(() => entries.map((e) => e.id).join("|"), [entries]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ── Catalogues from the project ──────────────────────────────

  const definitionOptions = useMemo(() => {
    const out: Array<{
      refId: string;
      label: string;
      attributes: Array<{ key: string; label: string }>;
    }> = [];
    const scoped = currentProjectId
      ? projects.filter((p) => p.id === currentProjectId)
      : projects;
    for (const project of scoped) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "attributeDefinitions") continue;
          out.push({
            refId: section.id,
            label: `${section.title || section.id} - ${sectionAddon.name || sectionAddon.data.name}`,
            attributes: (sectionAddon.data.attributes || []).map((item) => ({
              key: item.key,
              label: item.label || item.key,
            })),
          });
        }
      }
    }
    return out;
  }, [projects, currentProjectId]);

  const attributesByDefinitionRef = useMemo(() => {
    const map = new Map<string, Array<{ key: string; label: string }>>();
    for (const d of definitionOptions) map.set(d.refId, d.attributes);
    return map;
  }, [definitionOptions]);

  const currencyOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string }> = [];
    const scoped = currentProjectId
      ? projects.filter((p) => p.id === currentProjectId)
      : projects;
    for (const project of scoped) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "currency") continue;
          const display = sectionAddon.data.displayName?.trim() || sectionAddon.data.name || section.title || section.id;
          const code = sectionAddon.data.code?.trim();
          out.push({
            refId: section.id,
            label: code && code !== display ? `${display} (${code})` : display,
          });
        }
      }
    }
    return out;
  }, [projects, currentProjectId]);

  const xpBalanceOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string }> = [];
    const scoped = currentProjectId
      ? projects.filter((p) => p.id === currentProjectId)
      : projects;
    for (const project of scoped) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "xpBalance") continue;
          out.push({
            refId: section.id,
            label: section.title || section.id,
          });
        }
      }
    }
    return out;
  }, [projects, currentProjectId]);

  const itemOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string }> = [];
    const scoped = currentProjectId
      ? projects.filter((p) => p.id === currentProjectId)
      : projects;
    for (const project of scoped) {
      for (const section of project.sections || []) {
        const hasInventory = (section.addons || []).some((a) => a.type === "inventory");
        if (!hasInventory) continue;
        out.push({
          refId: section.id,
          label: section.title || section.id,
        });
      }
    }
    return out;
  }, [projects, currentProjectId]);

  /**
   * Find which section the *current* Skills addon lives in by matching its ID.
   * Each addon ID is unique across the project, so a single sweep is enough.
   * Returns `null` while the addon hasn't been persisted yet (rare race).
   */
  const hostSectionId = useMemo(() => {
    const scoped = currentProjectId
      ? projects.filter((p) => p.id === currentProjectId)
      : projects;
    for (const project of scoped) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.id === addon.id) return section.id;
        }
      }
    }
    return null;
  }, [projects, currentProjectId, addon.id]);

  /**
   * AttributeModifiers entries from the SAME SECTION as this Skills addon.
   * (Singleton enforcement means there is at most one Modifiers addon per
   * page, but we keep the iteration generic in case that ever changes.)
   */
  const effectCatalog = useMemo(() => {
    type Item = {
      sectionId: string;
      sectionTitle: string;
      addonId: string;
      addonName: string;
      entryId: string;
      /** Auto-formatted technical label (e.g. "+10 ATK 30s"). Always present. */
      label: string;
      /** User-provided display name on the source modifier entry, when set. */
      entryName?: string;
      /** Effect duration in seconds (from the source modifier). 0 / undefined = instantâneo. */
      durationSeconds?: number;
      /** True when the modifier persists with no fixed duration (permanente). */
      permanent: boolean;
      /** Stacking rule from the source modifier (default = refresh when absent). */
      stackingRule?: AttributeModifierStacking;
      /** Tick interval — present means it's a DoT-style modifier. */
      tickIntervalSeconds?: number;
    };
    const out: Item[] = [];
    if (!hostSectionId) return out;
    const scoped = currentProjectId
      ? projects.filter((p) => p.id === currentProjectId)
      : projects;
    for (const project of scoped) {
      for (const section of project.sections || []) {
        if (section.id !== hostSectionId) continue;
        // Build attribute key → label map for THIS section's attributeModifiers
        // (resolved via the modifiers' definitionsRef — which still points at a
        // potentially remote AttributeDefinitions section).
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "attributeModifiers") continue;
          const defsRef = sectionAddon.data.definitionsRef;
          const labelByKey = new Map<string, string>();
          if (defsRef) {
            for (const sp of scoped) {
              for (const sec of sp.sections || []) {
                if (sec.id !== defsRef) continue;
                for (const sa of sec.addons || []) {
                  if (sa.type !== "attributeDefinitions") continue;
                  for (const a of sa.data.attributes || []) {
                    labelByKey.set(a.key, a.label || a.key);
                  }
                }
              }
            }
          }
          for (const entry of sectionAddon.data.modifiers || []) {
            const attrLabel = labelByKey.get(entry.attributeKey) || entry.attributeKey;
            const duration = entry.temporary ? entry.durationSeconds : undefined;
            const trimmedName = entry.name?.trim();
            out.push({
              sectionId: section.id,
              sectionTitle: section.title || section.id,
              addonId: sectionAddon.id,
              addonName: sectionAddon.name || sectionAddon.data.name || "Modifiers",
              entryId: entry.id,
              label: formatModifierLabel(entry, attrLabel),
              entryName: trimmedName || undefined,
              durationSeconds: duration,
              permanent: !entry.temporary,
              stackingRule: entry.stackingRule,
              tickIntervalSeconds: entry.temporary ? entry.tickIntervalSeconds : undefined,
            });
          }
        }
      }
    }
    return out;
  }, [projects, currentProjectId, hostSectionId]);

  // ── Collapsed entries housekeeping ────────────────────────────

  useEffect(() => {
    setCollapsed((prev) => {
      const next: Record<string, boolean> = {};
      for (const e of entries) next[e.id] = prev[e.id] ?? true;
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((k) => prev[k] === next[k])) return prev;
      return next;
    });
  }, [entries, idSignature]);

  // ── Mutations ────────────────────────────────────────────────

  const commit = (next: SkillEntry[]) => {
    onChange({ ...addon, entries: next });
  };

  const addEntry = () => {
    const id = newId("skill");
    const nextEntry: SkillEntry = {
      id,
      name: "",
      kind: "active",
    };
    commit([...entries, nextEntry]);
    setCollapsed((prev) => ({ ...prev, [id]: false }));
  };

  const updateEntry = (id: string, patch: Partial<SkillEntry>) => {
    commit(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEntry = (id: string) => {
    commit(entries.filter((e) => e.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = entries.findIndex((e) => e.id === String(active.id));
    const newIndex = entries.findIndex((e) => e.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    commit(arrayMove(entries, oldIndex, newIndex));
  };

  // ── Cost / Effect / Unlock helpers ───────────────────────────

  const addCost = (entryId: string, type: SkillCostType) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const cost: SkillCost = { id: newId("cost"), type, amount: 1 };
    updateEntry(entryId, { costs: [...(entry.costs || []), cost] });
  };

  const updateCost = (entryId: string, costId: string, patch: Partial<SkillCost>) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const next = (entry.costs || []).map((c) => (c.id === costId ? { ...c, ...patch } : c));
    updateEntry(entryId, { costs: next });
  };

  const removeCost = (entryId: string, costId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    updateEntry(entryId, { costs: (entry.costs || []).filter((c) => c.id !== costId) });
  };

  /** Toggle helper — adds the effect when checked, removes ALL effects matching the entry when unchecked. */
  const toggleEffectByKey = (entryId: string, sectionId: string, addonId: string, modEntryId: string, checked: boolean) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    if (checked) {
      // Avoid duplicate effects pointing to the same entry.
      const exists = (entry.effects || []).some(
        (eff) =>
          eff.attributeModifiersSectionId === sectionId &&
          eff.attributeModifiersAddonId === addonId &&
          eff.modifierEntryId === modEntryId
      );
      if (exists) return;
      const next: SkillEffectRef = {
        id: newId("eff"),
        attributeModifiersSectionId: sectionId,
        attributeModifiersAddonId: addonId,
        modifierEntryId: modEntryId,
      };
      updateEntry(entryId, { effects: [...(entry.effects || []), next] });
    } else {
      const next = (entry.effects || []).filter(
        (eff) =>
          !(
            eff.attributeModifiersSectionId === sectionId &&
            eff.attributeModifiersAddonId === addonId &&
            eff.modifierEntryId === modEntryId
          )
      );
      updateEntry(entryId, { effects: next });
    }
  };

  /** Bulk: add (or remove) ALL entries from a single AttributeModifiers addon at once. */
  const toggleAllEffectsFromAddon = (entryId: string, sectionId: string, addonId: string, addAll: boolean) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const groupItems = effectCatalog.filter((it) => it.sectionId === sectionId && it.addonId === addonId);
    if (addAll) {
      const have = new Set(
        (entry.effects || [])
          .filter((eff) => eff.attributeModifiersSectionId === sectionId && eff.attributeModifiersAddonId === addonId)
          .map((eff) => eff.modifierEntryId)
      );
      const additions: SkillEffectRef[] = [];
      for (const item of groupItems) {
        if (have.has(item.entryId)) continue;
        additions.push({
          id: newId("eff"),
          attributeModifiersSectionId: sectionId,
          attributeModifiersAddonId: addonId,
          modifierEntryId: item.entryId,
        });
      }
      if (additions.length === 0) return;
      updateEntry(entryId, { effects: [...(entry.effects || []), ...additions] });
    } else {
      const next = (entry.effects || []).filter(
        (eff) => !(eff.attributeModifiersSectionId === sectionId && eff.attributeModifiersAddonId === addonId)
      );
      updateEntry(entryId, { effects: next });
    }
  };

  const toggleUnlockSection = (entryId: string, kind: "level" | "currency" | "item", enabled: boolean) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const unlock = { ...(entry.unlock || {}) };
    if (kind === "level") unlock.level = { ...(unlock.level || { enabled: false }), enabled };
    if (kind === "currency") unlock.currency = { ...(unlock.currency || { enabled: false }), enabled };
    if (kind === "item") unlock.item = { ...(unlock.item || { enabled: false }), enabled };
    const allDisabled = !unlock.level?.enabled && !unlock.currency?.enabled && !unlock.item?.enabled;
    updateEntry(entryId, { unlock: allDisabled ? undefined : unlock });
  };

  const updateUnlockLevel = (entryId: string, patch: Partial<NonNullable<SkillEntry["unlock"]>["level"]>) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const unlock = { ...(entry.unlock || {}) };
    unlock.level = { enabled: true, ...(unlock.level || {}), ...patch };
    updateEntry(entryId, { unlock });
  };

  const updateUnlockCurrency = (entryId: string, patch: Partial<NonNullable<SkillEntry["unlock"]>["currency"]>) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const unlock = { ...(entry.unlock || {}) };
    unlock.currency = { enabled: true, ...(unlock.currency || {}), ...patch };
    updateEntry(entryId, { unlock });
  };

  const updateUnlockItem = (entryId: string, patch: Partial<NonNullable<SkillEntry["unlock"]>["item"]>) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const unlock = { ...(entry.unlock || {}) };
    unlock.item = { enabled: true, ...(unlock.item || {}), ...patch };
    updateEntry(entryId, { unlock });
  };

  // ── Rendering helpers ────────────────────────────────────────

  const renderCostRow = (entry: SkillEntry, cost: SkillCost): ReactNode => {
    const isAttribute = cost.type === "attribute";
    const isCharges = cost.type === "charges";

    if (isAttribute) {
      const attrsForSelected = cost.definitionsRef
        ? attributesByDefinitionRef.get(cost.definitionsRef) || []
        : [];
      return (
        <div key={cost.id} className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[120px_1fr_120px_auto] items-end">
            <div>
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                {t("skillsAddon.costType", "Tipo")}
              </span>
              <select
                value={cost.type}
                onChange={(e) =>
                  updateCost(entry.id, cost.id, {
                    type: e.target.value as SkillCostType,
                    currencyRef: e.target.value === "currency" ? cost.currencyRef : undefined,
                    definitionsRef: e.target.value === "attribute" ? cost.definitionsRef : undefined,
                    attributeKey: e.target.value === "attribute" ? cost.attributeKey : undefined,
                  })
                }
                className={INPUT_CLASS}
              >
                <option value="currency">{t("skillsAddon.costTypeCurrency", "Moeda")}</option>
                <option value="attribute">{t("skillsAddon.costTypeAttribute", "Atributo")}</option>
                <option value="charges">{t("skillsAddon.costTypeCharges", "Cargas")}</option>
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                  {t("skillsAddon.costDefinitionsRef", "Definição de Atributo")}
                </span>
                <select
                  value={cost.definitionsRef || ""}
                  onChange={(e) =>
                    updateCost(entry.id, cost.id, {
                      definitionsRef: e.target.value || undefined,
                      // Clear stale attribute key when switching definitions.
                      attributeKey: undefined,
                    })
                  }
                  className={INPUT_CLASS}
                  disabled={definitionOptions.length === 0}
                >
                  <option value="">{t("skillsAddon.selectNone", "Selecione")}</option>
                  {definitionOptions.map((d) => (
                    <option key={d.refId} value={d.refId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                  {t("skillsAddon.costAttributeKey", "Atributo")}
                </span>
                <select
                  value={cost.attributeKey || ""}
                  onChange={(e) => updateCost(entry.id, cost.id, { attributeKey: e.target.value || undefined })}
                  className={INPUT_CLASS}
                  disabled={attrsForSelected.length === 0}
                >
                  <option value="">{t("skillsAddon.selectNone", "Selecione")}</option>
                  {attrsForSelected.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label} ({a.key})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
                {t("skillsAddon.costAmount", "Quantidade")}
              </span>
              <CommitNumberInput
                value={cost.amount}
                onCommit={(next) => updateCost(entry.id, cost.id, { amount: next < 0 ? 0 : next })}
                min={0}
                step={1}
                integer={false}
                className={INPUT_CLASS}
              />
            </div>
            <button type="button" onClick={() => removeCost(entry.id, cost.id)} className={BUTTON_DANGER_CLASS}>
              {t("common.remove", "Remover")}
            </button>
          </div>
          {definitionOptions.length === 0 && (
            <p className="text-[11px] text-amber-300">
              {t(
                "skillsAddon.costNoDefinitionsHint",
                "Nenhuma página de Atributos no projeto. Crie uma pra usar atributos como custo."
              )}
            </p>
          )}
        </div>
      );
    }

    // Currency cost — full row with currencyRef in the middle.
    if (isCharges) {
      return (
        <div key={cost.id} className="grid gap-2 sm:grid-cols-[120px_1fr_120px_auto] items-end">
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
              {t("skillsAddon.costType", "Tipo")}
            </span>
            <select
              value={cost.type}
              onChange={(e) =>
                updateCost(entry.id, cost.id, {
                  type: e.target.value as SkillCostType,
                  currencyRef: e.target.value === "currency" ? cost.currencyRef : undefined,
                  definitionsRef: e.target.value === "attribute" ? cost.definitionsRef : undefined,
                  attributeKey: e.target.value === "attribute" ? cost.attributeKey : undefined,
                })
              }
              className={INPUT_CLASS}
            >
              <option value="currency">{t("skillsAddon.costTypeCurrency", "Moeda")}</option>
              <option value="attribute">{t("skillsAddon.costTypeAttribute", "Atributo")}</option>
              <option value="charges">{t("skillsAddon.costTypeCharges", "Cargas")}</option>
            </select>
          </div>
          <p className="text-[11px] text-gray-500 self-center">
            {t("skillsAddon.chargesHelp", "Apenas a quantidade — sem referência cruzada.")}
          </p>
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
              {t("skillsAddon.costAmount", "Quantidade")}
            </span>
            <CommitNumberInput
              value={cost.amount}
              onCommit={(next) => updateCost(entry.id, cost.id, { amount: next < 0 ? 0 : next })}
              min={0}
              step={1}
              integer={false}
              className={INPUT_CLASS}
            />
          </div>
          <button type="button" onClick={() => removeCost(entry.id, cost.id)} className={BUTTON_DANGER_CLASS}>
            {t("common.remove", "Remover")}
          </button>
        </div>
      );
    }

    // Currency
    return (
      <div key={cost.id} className="grid gap-2 sm:grid-cols-[120px_1fr_120px_auto] items-end">
        <div>
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
            {t("skillsAddon.costType", "Tipo")}
          </span>
          <select
            value={cost.type}
            onChange={(e) =>
              updateCost(entry.id, cost.id, {
                type: e.target.value as SkillCostType,
                currencyRef: e.target.value === "currency" ? cost.currencyRef : undefined,
                definitionsRef: e.target.value === "attribute" ? cost.definitionsRef : undefined,
                attributeKey: e.target.value === "attribute" ? cost.attributeKey : undefined,
              })
            }
            className={INPUT_CLASS}
          >
            <option value="currency">{t("skillsAddon.costTypeCurrency", "Moeda")}</option>
            <option value="attribute">{t("skillsAddon.costTypeAttribute", "Atributo")}</option>
            <option value="charges">{t("skillsAddon.costTypeCharges", "Cargas")}</option>
          </select>
        </div>
        <div>
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
            {t("skillsAddon.costCurrencyRef", "Moeda")}
          </span>
          <select
            value={cost.currencyRef || ""}
            onChange={(e) => updateCost(entry.id, cost.id, { currencyRef: e.target.value || undefined })}
            className={INPUT_CLASS}
            disabled={currencyOptions.length === 0}
          >
            <option value="">{t("skillsAddon.selectNone", "Selecione")}</option>
            {currencyOptions.map((o) => (
              <option key={o.refId} value={o.refId}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-gray-400">
            {t("skillsAddon.costAmount", "Quantidade")}
          </span>
          <CommitNumberInput
            value={cost.amount}
            onCommit={(next) => updateCost(entry.id, cost.id, { amount: next < 0 ? 0 : next })}
            min={0}
            step={1}
            integer={false}
            className={INPUT_CLASS}
          />
        </div>
        <button type="button" onClick={() => removeCost(entry.id, cost.id)} className={BUTTON_DANGER_CLASS}>
          {t("common.remove", "Remover")}
        </button>
      </div>
    );
  };

  /**
   * Renders the "Recarga entre usos" UX:
   * - input + live derived label (sem limite / X usos por segundo / 1 a cada Ns)
   * - quick presets (chips)
   * - timeline comparing caster recharge vs longest linked-effect duration,
   *   only shown when at least one linked effect has a finite duration.
   */
  const renderCooldownBlock = (entry: SkillEntry): ReactNode => {
    const cd = entry.cooldownSeconds;
    // Resolve linked effects (from this skill) against the catalog.
    const linkedItems = (entry.effects || [])
      .map((eff) =>
        effectCatalog.find(
          (it) =>
            it.sectionId === eff.attributeModifiersSectionId &&
            it.addonId === eff.attributeModifiersAddonId &&
            it.entryId === eff.modifierEntryId
        )
      )
      .filter((it): it is NonNullable<typeof it> => Boolean(it));
    const finiteDurations = linkedItems
      .map((it) => it.durationSeconds)
      .filter((d): d is number => typeof d === "number" && d > 0);
    const longestDuration = finiteDurations.length > 0 ? Math.max(...finiteDurations) : 0;
    const shortestDuration = finiteDurations.length > 0 ? Math.min(...finiteDurations) : 0;
    const hasMixedDurations =
      finiteDurations.length > 1 && shortestDuration !== longestDuration;
    const hasPermanent = linkedItems.some((it) => it.permanent);

    // Pick the dominant linked effect (the one driving the longest bar) — its
    // stacking rule and tick interval are the ones we visualise.
    const dominantItem =
      finiteDurations.length > 0
        ? linkedItems.find((it) => it.durationSeconds === longestDuration)
        : undefined;
    const dominantStacking: AttributeModifierStacking =
      dominantItem?.stackingRule ?? "refresh";
    const dominantTick = dominantItem?.tickIntervalSeconds;
    // Are stacking rules mixed across linked effects?
    const stackingRules = new Set(
      linkedItems
        .map((it) => it.stackingRule ?? "refresh")
        .filter((_, idx) => (linkedItems[idx].durationSeconds ?? 0) > 0)
    );
    const hasMixedStacking = stackingRules.size > 1;

    // Derived "what does this mean" label.
    let derivedLabel: string;
    let derivedTone: "muted" | "info" | "warn" = "muted";
    if (cd == null) {
      derivedLabel = t(
        "skillsAddon.cooldownDerivedNoLimit",
        "Sem limite — dispara enquanto o input estiver ativo"
      );
      derivedTone = "warn";
    } else if (cd <= 0) {
      derivedLabel = t(
        "skillsAddon.cooldownDerivedZero",
        "0s — sem espera entre usos (autofire)"
      );
      derivedTone = "warn";
    } else if (cd < 1) {
      const perSec = (1 / cd).toFixed(cd < 0.2 ? 0 : 1);
      derivedLabel = t(
        "skillsAddon.cooldownDerivedSubSecond",
        `≈ ${perSec} usos por segundo (autofire limitado)`
      ).replace("{perSec}", perSec);
      derivedTone = "info";
    } else if (cd === 1) {
      derivedLabel = t("skillsAddon.cooldownDerivedOne", "1 uso por segundo");
      derivedTone = "info";
    } else if (cd < 60) {
      derivedLabel = t(
        "skillsAddon.cooldownDerivedManySeconds",
        `1 uso a cada ${cd}s`
      ).replace("{seconds}", String(cd));
      derivedTone = "info";
    } else {
      const minutes = (cd / 60).toFixed(cd % 60 === 0 ? 0 : 1);
      derivedLabel = t(
        "skillsAddon.cooldownDerivedUlti",
        `Ultimate — 1 uso a cada ${minutes}min`
      ).replace("{minutes}", minutes);
      derivedTone = "info";
    }

    const toneClass =
      derivedTone === "warn"
        ? "text-amber-300"
        : derivedTone === "info"
        ? "text-indigo-300"
        : "text-gray-400";

    type Preset = { label: string; value: number | undefined };
    const presets: Preset[] = [
      { label: t("skillsAddon.cooldownPresetNone", "♾ Sem limite"), value: undefined },
      { label: t("skillsAddon.cooldownPresetAttack", "⚔ Ataque (1s)"), value: 1 },
      { label: t("skillsAddon.cooldownPresetSkill", "✨ Skill (5s)"), value: 5 },
      { label: t("skillsAddon.cooldownPresetUlti", "🔥 Ultimate (60s)"), value: 60 },
    ];
    const isPresetActive = (p: Preset) =>
      (p.value === undefined && cd == null) || (p.value !== undefined && cd === p.value);

    // Timeline visualization.
    // Use whichever is bigger (cooldown vs longest effect duration) as the scale.
    const scale = Math.max(cd ?? 0, longestDuration, 1);
    const cooldownPct = cd && cd > 0 ? Math.min(100, (cd / scale) * 100) : 0;
    const effectPct = longestDuration > 0 ? Math.min(100, (longestDuration / scale) * 100) : 0;

    // Stacking summary — the wording (and color) depend on the dominant
    // modifier's stackingRule, because each rule reads completely differently:
    //   • unique  → second cast does nothing while the first is active
    //   • refresh → each cast resets the duration
    //   • stack   → casts pile up as independent applicators
    let stackingHint: string | null = null;
    let stackingTone: "neutral" | "warn" | "danger" = "neutral";
    if (cd != null && cd > 0 && longestDuration > 0) {
      const castsInWindow = Math.floor(longestDuration / cd) + 1;
      if (dominantStacking === "unique") {
        const effective = Math.max(cd, longestDuration);
        const cooldownTooShort = cd < longestDuration;
        stackingHint = `Empilhamento "único": recasts antes de ${longestDuration}s são ignorados. Cooldown efetivo = ${effective}s.`;
        stackingTone = cooldownTooShort ? "warn" : "neutral";
      } else if (dominantStacking === "stack") {
        stackingHint = `Empilhamento "stack": em ${longestDuration}s podem coexistir até ${castsInWindow} instâncias do efeito.`;
        stackingTone = castsInWindow >= 5 ? "danger" : "warn";
      } else {
        stackingHint = `Empilhamento "refresh": cada cast renova os ${longestDuration}s. Em ${longestDuration}s podem ocorrer ${castsInWindow} casts.`;
        stackingTone = "neutral";
      }
    } else if (cd == null && longestDuration > 0) {
      if (dominantStacking === "unique") {
        stackingHint = `Sem limite de recarga + empilhamento "único": só vale o primeiro cast a cada janela de ${longestDuration}s.`;
        stackingTone = "warn";
      } else if (dominantStacking === "stack") {
        stackingHint = `Sem limite de recarga + empilhamento "stack": pode acumular incontáveis instâncias do efeito ao segurar o input.`;
        stackingTone = "danger";
      } else {
        stackingHint = `Sem limite de recarga: o efeito de ${longestDuration}s é reaplicado a cada input.`;
        stackingTone = "warn";
      }
    }
    if (hasMixedStacking && stackingHint) {
      stackingHint += " Atenção: efeitos vinculados usam regras de empilhamento diferentes.";
      stackingTone = stackingTone === "danger" ? "danger" : "warn";
    }
    if (hasMixedDurations && stackingHint) {
      stackingHint += ` Durações variam de ${shortestDuration}s a ${longestDuration}s.`;
    }
    const stackingToneClass =
      stackingTone === "danger"
        ? "text-rose-300"
        : stackingTone === "warn"
        ? "text-amber-300"
        : "text-gray-300";

    return (
      <div className={SUB_BLOCK_CLASS}>
        <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
          {t("skillsAddon.cooldownSectionLabel", "Recarga entre usos")}
        </p>

        <div className="grid gap-2 sm:grid-cols-[160px_1fr] items-center">
          <CommitOptionalNumberInput
            value={entry.cooldownSeconds}
            onCommit={(next) => updateEntry(entry.id, { cooldownSeconds: next })}
            min={0}
            step={0.1}
            integer={false}
            placeholder={t("skillsAddon.cooldownPlaceholder", "vazio = sem limite")}
            className={INPUT_CLASS}
          />
          <span className={`text-[11px] ${toneClass}`}>{derivedLabel}</span>
        </div>

        {/* Presets */}
        <div className="mt-2 flex flex-wrap gap-1">
          {presets.map((p) => {
            const active = isPresetActive(p);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => updateEntry(entry.id, { cooldownSeconds: p.value })}
                className={
                  active
                    ? "rounded-md border border-indigo-400/60 bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-100"
                    : BUTTON_TINY_CLASS
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Timeline (only when there's something to compare). */}
        {(longestDuration > 0 || hasPermanent) && (
          <div className="mt-3 rounded-md border border-gray-700 bg-gray-900/50 p-2.5">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-500">
              {t("skillsAddon.cooldownTimelineLabel", "Linha do tempo")}
            </p>
            <div className="space-y-1.5">
              {/* Caster row */}
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] text-gray-400" title={t("skillsAddon.cooldownCasterTooltip", "Tempo do caster — quando você pode usar de novo")}>
                  🧙 {t("skillsAddon.cooldownCasterShort", "Você")}
                </span>
                <div className="relative h-3 flex-1 overflow-hidden rounded bg-gray-800">
                  {cd != null && cd > 0 ? (
                    <>
                      <div
                        className="absolute inset-y-0 left-0 bg-indigo-500/60"
                        style={{ width: `${cooldownPct}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-indigo-50">
                        {t("skillsAddon.cooldownTimelineCasterLabel", `recarga ${cd}s`).replace("{seconds}", String(cd))}
                      </span>
                    </>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-amber-300">
                      {t("skillsAddon.cooldownTimelineCasterNoLimit", "sem limite — pronto sempre")}
                    </span>
                  )}
                </div>
              </div>

              {/* Target row */}
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[10px] text-gray-400" title={t("skillsAddon.cooldownTargetTooltip", "Tempo do alvo — quanto tempo o efeito permanece aplicado")}>
                  🎯 {t("skillsAddon.cooldownTargetShort", "Alvo")}
                </span>
                <div className="relative h-3 flex-1 overflow-hidden rounded bg-gray-800">
                  {hasPermanent && longestDuration === 0 ? (
                    <>
                      <div className="absolute inset-0 bg-emerald-500/40" />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-emerald-50">
                        {t("skillsAddon.cooldownTimelineTargetPermanent", "permanente")}
                      </span>
                    </>
                  ) : longestDuration > 0 ? (
                    <>
                      <div
                        className="absolute inset-y-0 left-0 bg-emerald-500/60"
                        style={{ width: `${effectPct}%` }}
                      />
                      {/* Tick dividers — only when the dominant effect is a DoT
                          (tickIntervalSeconds > 0). Renders evenly-spaced thin
                          vertical lines inside the green portion of the bar. */}
                      {dominantTick && dominantTick > 0 && longestDuration > dominantTick && (
                        <>
                          {Array.from({ length: Math.floor(longestDuration / dominantTick) }).map(
                            (_, i) => {
                              const t = (i + 1) * dominantTick;
                              if (t >= longestDuration) return null;
                              const leftPct = (t / scale) * 100;
                              return (
                                <span
                                  key={`tick-${i}`}
                                  className="absolute inset-y-0 w-px bg-emerald-200/70"
                                  style={{ left: `${leftPct}%` }}
                                  aria-hidden="true"
                                />
                              );
                            }
                          )}
                        </>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-emerald-50">
                        {dominantTick && dominantTick > 0
                          ? `efeito ${longestDuration}s · ${Math.floor(longestDuration / dominantTick)} ticks`
                          : `efeito ${longestDuration}s`}
                      </span>
                    </>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-500">
                      {t("skillsAddon.cooldownTimelineTargetInstant", "instantâneo")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {stackingHint && (
              <p className={`mt-2 text-[11px] ${stackingToneClass}`}>
                {stackingTone === "danger" ? "⚠️" : stackingTone === "warn" ? "⚠" : "💡"} {stackingHint}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderUnlockBlock = (entry: SkillEntry): ReactNode => {
    const unlock = entry.unlock;
    return (
      <div className={SUB_BLOCK_CLASS}>
        <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
          {t("skillsAddon.unlockLabel", "Desbloqueio")}
        </p>
        <div className="space-y-2">
          {/* Level */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={Boolean(unlock?.level?.enabled)}
              onChange={(e) => toggleUnlockSection(entry.id, "level", e.target.checked)}
              className="mt-1 h-4 w-4 accent-indigo-500"
            />
            <div className="flex-1">
              <span className="block text-xs text-gray-200">
                {t("skillsAddon.unlockLevel", "Nível mínimo")}
              </span>
              {unlock?.level?.enabled && (
                <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_120px]">
                  <select
                    value={unlock.level.xpAddonRef || ""}
                    onChange={(e) => updateUnlockLevel(entry.id, { xpAddonRef: e.target.value || undefined })}
                    className={INPUT_CLASS}
                    disabled={xpBalanceOptions.length === 0}
                  >
                    <option value="">{t("skillsAddon.selectXpPage", "Selecione página de XP")}</option>
                    {xpBalanceOptions.map((o) => (
                      <option key={o.refId} value={o.refId}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <CommitOptionalNumberInput
                    value={unlock.level.level}
                    onCommit={(next) => updateUnlockLevel(entry.id, { level: next })}
                    min={0}
                    step={1}
                    integer
                    className={INPUT_CLASS}
                  />
                </div>
              )}
            </div>
          </div>
          {/* Currency */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={Boolean(unlock?.currency?.enabled)}
              onChange={(e) => toggleUnlockSection(entry.id, "currency", e.target.checked)}
              className="mt-1 h-4 w-4 accent-indigo-500"
            />
            <div className="flex-1">
              <span className="block text-xs text-gray-200">
                {t("skillsAddon.unlockCurrency", "Custo em moeda (opcional)")}
              </span>
              {unlock?.currency?.enabled && (
                <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_120px]">
                  <select
                    value={unlock.currency.currencyAddonRef || ""}
                    onChange={(e) =>
                      updateUnlockCurrency(entry.id, { currencyAddonRef: e.target.value || undefined })
                    }
                    className={INPUT_CLASS}
                    disabled={currencyOptions.length === 0}
                  >
                    <option value="">{t("skillsAddon.selectNone", "Selecione")}</option>
                    {currencyOptions.map((o) => (
                      <option key={o.refId} value={o.refId}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <CommitOptionalNumberInput
                    value={unlock.currency.amount}
                    onCommit={(next) => updateUnlockCurrency(entry.id, { amount: next })}
                    min={0}
                    step={1}
                    integer={false}
                    className={INPUT_CLASS}
                  />
                </div>
              )}
            </div>
          </div>
          {/* Item */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={Boolean(unlock?.item?.enabled)}
              onChange={(e) => toggleUnlockSection(entry.id, "item", e.target.checked)}
              className="mt-1 h-4 w-4 accent-indigo-500"
            />
            <div className="flex-1">
              <span className="block text-xs text-gray-200">
                {t("skillsAddon.unlockItem", "Item necessário (opcional)")}
              </span>
              {unlock?.item?.enabled && (
                <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_120px]">
                  <select
                    value={unlock.item.itemRef || ""}
                    onChange={(e) => updateUnlockItem(entry.id, { itemRef: e.target.value || undefined })}
                    className={INPUT_CLASS}
                    disabled={itemOptions.length === 0}
                  >
                    <option value="">{t("skillsAddon.selectNone", "Selecione")}</option>
                    {itemOptions.map((o) => (
                      <option key={o.refId} value={o.refId}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <CommitOptionalNumberInput
                    value={unlock.item.quantity}
                    onCommit={(next) => updateUnlockItem(entry.id, { quantity: next })}
                    min={0}
                    step={1}
                    integer
                    className={INPUT_CLASS}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-100">{t("skillsAddon.entriesTitle", "Habilidades")}</h4>
          <button type="button" onClick={addEntry} className={BUTTON_CLASS}>
            {t("skillsAddon.addEntryButton", "+ Habilidade")}
          </button>
        </div>

        {entries.length === 0 && (
          <div className={PANEL_BLOCK_CLASS}>
            <p className="text-xs text-gray-300">
              {t("skillsAddon.emptyState", "Nenhuma habilidade ainda. Adicione uma pra começar.")}
            </p>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {entries.map((entry) => {
                const isOpen = !collapsed[entry.id];
                const titleText = entry.name?.trim() || t("skillsAddon.untitled", "(sem nome)");
                return (
                  <SortableSkillBlock key={entry.id} id={entry.id}>
                    <div className={PANEL_BLOCK_CLASS}>
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsed((prev) => ({ ...prev, [entry.id]: !(prev[entry.id] ?? true) }))
                        }
                        className="mb-2 flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left hover:bg-gray-800/40"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                          <span
                            className="inline-flex cursor-grab items-center text-gray-400 active:cursor-grabbing"
                            data-drag-handle
                            onClick={(e) => e.stopPropagation()}
                            aria-label={t("skillsAddon.dragAria", "Arrastar habilidade")}
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
                          {entry.kind === "active" ? "⚡" : "🛡"} {titleText}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {entry.kind === "active"
                            ? t("skillsAddon.kindActive", "ativa")
                            : t("skillsAddon.kindPassive", "passiva")}
                        </span>
                        <span
                          className="text-[11px] text-gray-300 transition-transform duration-200"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                        >
                          ▼
                        </span>
                      </button>

                      {isOpen && (
                        <div className="space-y-3">
                          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                            <label>
                              <span className="mb-1 block text-xs text-gray-400">
                                {t("skillsAddon.nameLabel", "Nome")}
                              </span>
                              <CommitTextInput
                                value={entry.name}
                                onCommit={(next) => updateEntry(entry.id, { name: next })}
                                placeholder={t("skillsAddon.namePlaceholder", "Ex.: Fireball")}
                                className={INPUT_CLASS}
                              />
                            </label>
                            <label>
                              <span className="mb-1 block text-xs text-gray-400">
                                {t("skillsAddon.kindLabel", "Tipo")}
                              </span>
                              <select
                                value={entry.kind}
                                onChange={(e) => updateEntry(entry.id, { kind: e.target.value as SkillKind })}
                                className={INPUT_CLASS}
                              >
                                <option value="active">{t("skillsAddon.kindActive", "Ativa")}</option>
                                <option value="passive">{t("skillsAddon.kindPassive", "Passiva")}</option>
                              </select>
                            </label>
                          </div>

                          <label className="block">
                            <span className="mb-1 block text-xs text-gray-400">
                              {t("skillsAddon.descriptionLabel", "Descrição")}
                            </span>
                            <CommitTextInput
                              value={entry.description || ""}
                              onCommit={(next) => updateEntry(entry.id, { description: next.trim() ? next : undefined })}
                              placeholder={t("skillsAddon.descriptionPlaceholder", "O que essa habilidade faz?")}
                              className={INPUT_CLASS}
                            />
                          </label>

                          {entry.kind === "active" && renderCooldownBlock(entry)}

                          {/* Costs */}
                          <div className={SUB_BLOCK_CLASS}>
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                                {t("skillsAddon.costsLabel", "Custos")}
                              </p>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => addCost(entry.id, "currency")} className={BUTTON_TINY_CLASS}>
                                  + {t("skillsAddon.costTypeCurrency", "Moeda")}
                                </button>
                                <button type="button" onClick={() => addCost(entry.id, "attribute")} className={BUTTON_TINY_CLASS}>
                                  + {t("skillsAddon.costTypeAttribute", "Atributo")}
                                </button>
                                <button type="button" onClick={() => addCost(entry.id, "charges")} className={BUTTON_TINY_CLASS}>
                                  + {t("skillsAddon.costTypeCharges", "Cargas")}
                                </button>
                              </div>
                            </div>
                            {(entry.costs || []).length === 0 ? (
                              <p className="text-[11px] text-gray-500">
                                {t("skillsAddon.costsEmpty", "Sem custos. Use os botões acima pra adicionar.")}
                              </p>
                            ) : (
                              <div className="space-y-2">{(entry.costs || []).map((c) => renderCostRow(entry, c))}</div>
                            )}
                          </div>

                          {/* Effects */}
                          <div className={SUB_BLOCK_CLASS}>
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                              {t("skillsAddon.effectsLabel", "Efeitos")}
                            </p>
                            {effectCatalog.length === 0 ? (
                              <p className="text-[11px] text-amber-300">
                                {t(
                                  "skillsAddon.noEffectsHintLocal",
                                  "Adicione um addon de Modificadores de Atributos nesta mesma página pra poder vincular efeitos aqui."
                                )}
                              </p>
                            ) : (
                              (() => {
                                // Singleton enforcement guarantees at most one Modifiers addon
                                // per section, so we render the entries flat (no group headers).
                                const linkedKeys = new Set(
                                  (entry.effects || []).map(
                                    (eff) =>
                                      `${eff.attributeModifiersSectionId}::${eff.attributeModifiersAddonId}::${eff.modifierEntryId}`
                                  )
                                );
                                const total = effectCatalog.length;
                                const checkedCount = effectCatalog.filter((it) =>
                                  linkedKeys.has(`${it.sectionId}::${it.addonId}::${it.entryId}`)
                                ).length;
                                const allChecked = total > 0 && checkedCount === total;
                                // All items share the same section/addon (host page).
                                const hostAddonId = effectCatalog[0].addonId;
                                const hostSectionIdLocal = effectCatalog[0].sectionId;
                                return (
                                  <>
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                      <p className="text-[11px] text-gray-400">
                                        {t(
                                          "skillsAddon.effectsHintLocal",
                                          "Marque os modificadores desta página que esta habilidade aplica."
                                        )}
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-500">
                                          ({checkedCount}/{total})
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleAllEffectsFromAddon(
                                              entry.id,
                                              hostSectionIdLocal,
                                              hostAddonId,
                                              !allChecked
                                            )
                                          }
                                          className={BUTTON_TINY_CLASS}
                                        >
                                          {allChecked
                                            ? t("skillsAddon.deselectAll", "Desmarcar todos")
                                            : t("skillsAddon.selectAll", "Marcar todos")}
                                        </button>
                                      </div>
                                    </div>
                                    <ul className="space-y-1">
                                      {effectCatalog.map((it) => {
                                        const itemKey = `${it.sectionId}::${it.addonId}::${it.entryId}`;
                                        const checked = linkedKeys.has(itemKey);
                                        return (
                                          <li key={itemKey}>
                                            <label className="flex items-start gap-2 rounded px-1.5 py-1 text-xs text-gray-200 hover:bg-gray-800/40 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={(e) =>
                                                  toggleEffectByKey(
                                                    entry.id,
                                                    it.sectionId,
                                                    it.addonId,
                                                    it.entryId,
                                                    e.target.checked
                                                  )
                                                }
                                                className="mt-0.5 h-3.5 w-3.5 accent-indigo-500"
                                              />
                                              <span className="flex-1">
                                                {it.entryName ? (
                                                  <>
                                                    <span className="block font-medium text-gray-100">
                                                      {it.entryName}
                                                    </span>
                                                    <span className="block text-[10px] text-gray-400">
                                                      {it.label}
                                                    </span>
                                                  </>
                                                ) : (
                                                  it.label
                                                )}
                                              </span>
                                            </label>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </>
                                );
                              })()
                            )}
                          </div>

                          {/* Unlock */}
                          {renderUnlockBlock(entry)}

                          {/* Tags */}
                          <label className="block">
                            <span className="mb-1 block text-xs text-gray-400">
                              {t("skillsAddon.tagsLabel", "Tags (separadas por vírgula)")}
                            </span>
                            <CommitTextInput
                              value={(entry.tags || []).join(", ")}
                              onCommit={(next) => {
                                const parsed = next
                                  .split(",")
                                  .map((s) => s.trim().toLowerCase())
                                  .filter(Boolean);
                                const unique = Array.from(new Set(parsed));
                                updateEntry(entry.id, { tags: unique.length > 0 ? unique : undefined });
                              }}
                              placeholder={t("skillsAddon.tagsPlaceholder", "Ex.: fire, single-target")}
                              className={INPUT_CLASS}
                            />
                          </label>

                          <div className="flex justify-end">
                            <button type="button" onClick={() => removeEntry(entry.id)} className={BUTTON_DANGER_CLASS}>
                              {t("skillsAddon.removeEntryButton", "Remover habilidade")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </SortableSkillBlock>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </section>
  );
}

function SortableSkillBlock({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const stableTransform = transform ? { ...transform, scaleX: 1, scaleY: 1 } : null;
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
          if (target?.closest("[data-drag-handle]")) listeners?.onPointerDown?.(event);
        }}
        onKeyDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-drag-handle]")) listeners?.onKeyDown?.(event);
        }}
        {...attributes}
      >
        {children}
      </div>
    </div>
  );
}
