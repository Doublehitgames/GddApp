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
} from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import { CommitNumberInput, CommitOptionalNumberInput, CommitTextInput } from "@/components/common/CommitInput";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { openQuickNewPage } from "@/components/QuickNewPageModal";

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

  /** All AttributeModifiers entries across the project, with display labels. */
  const effectCatalog = useMemo(() => {
    type Item = {
      sectionId: string;
      sectionTitle: string;
      addonId: string;
      addonName: string;
      entryId: string;
      label: string;
    };
    const out: Item[] = [];
    const scoped = currentProjectId
      ? projects.filter((p) => p.id === currentProjectId)
      : projects;
    for (const project of scoped) {
      for (const section of project.sections || []) {
        // Build attribute key → label map for THIS section's attributeModifiers
        // (resolved via the modifiers' definitionsRef).
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
            out.push({
              sectionId: section.id,
              sectionTitle: section.title || section.id,
              addonId: sectionAddon.id,
              addonName: sectionAddon.name || sectionAddon.data.name || "Modifiers",
              entryId: entry.id,
              label: formatModifierLabel(entry, attrLabel),
            });
          }
        }
      }
    }
    return out;
  }, [projects, currentProjectId]);

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

  const addEffect = (entryId: string, key: string) => {
    // key format: `${sectionId}::${addonId}::${entryId}`
    const [sectionId, addonId, modEntryId] = key.split("::");
    if (!sectionId || !addonId || !modEntryId) return;
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const effect: SkillEffectRef = {
      id: newId("eff"),
      attributeModifiersSectionId: sectionId,
      attributeModifiersAddonId: addonId,
      modifierEntryId: modEntryId,
    };
    updateEntry(entryId, { effects: [...(entry.effects || []), effect] });
  };

  const removeEffect = (entryId: string, effectId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    updateEntry(entryId, { effects: (entry.effects || []).filter((e) => e.id !== effectId) });
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

  const renderEmptyHint = (text: string, ctaLabel: string): ReactNode => (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
      <span>{text}</span>
      <button
        type="button"
        onClick={openQuickNewPage}
        className="inline-flex items-center gap-1 rounded-md border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-50 hover:bg-amber-500/30"
      >
        <span aria-hidden="true">+</span>
        <span>{ctaLabel}</span>
      </button>
    </div>
  );

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

                          {entry.kind === "active" && (
                            <label className="block sm:max-w-[200px]">
                              <span className="mb-1 block text-xs text-gray-400">
                                {t("skillsAddon.cooldownLabel", "Cooldown (segundos)")}
                              </span>
                              <CommitOptionalNumberInput
                                value={entry.cooldownSeconds}
                                onCommit={(next) => updateEntry(entry.id, { cooldownSeconds: next })}
                                min={0}
                                step={1}
                                integer
                                className={INPUT_CLASS}
                              />
                            </label>
                          )}

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
                              renderEmptyHint(
                                t(
                                  "skillsAddon.noEffectsHint",
                                  "Nenhuma página com Attribute Modifiers. Crie uma pra usar entries como efeito."
                                ),
                                t("skillsAddon.createModifiersCta", "Criar página de Modificadores")
                              )
                            ) : (
                              (() => {
                                // Group catalog by addon so the user can pick MULTIPLE entries
                                // (and even all entries) of the same modifier addon at once.
                                type Group = {
                                  sectionId: string;
                                  sectionTitle: string;
                                  addonId: string;
                                  addonName: string;
                                  items: typeof effectCatalog;
                                };
                                const groups: Group[] = [];
                                const groupKey = (i: typeof effectCatalog[number]) => `${i.sectionId}::${i.addonId}`;
                                const indexByKey = new Map<string, number>();
                                for (const item of effectCatalog) {
                                  const k = groupKey(item);
                                  let gi = indexByKey.get(k);
                                  if (gi == null) {
                                    gi = groups.length;
                                    indexByKey.set(k, gi);
                                    groups.push({
                                      sectionId: item.sectionId,
                                      sectionTitle: item.sectionTitle,
                                      addonId: item.addonId,
                                      addonName: item.addonName,
                                      items: [],
                                    });
                                  }
                                  groups[gi].items.push(item);
                                }
                                const linkedKeys = new Set(
                                  (entry.effects || []).map(
                                    (eff) =>
                                      `${eff.attributeModifiersSectionId}::${eff.attributeModifiersAddonId}::${eff.modifierEntryId}`
                                  )
                                );
                                return (
                                  <>
                                    <p className="mb-2 text-[11px] text-gray-400">
                                      {t(
                                        "skillsAddon.effectsHint",
                                        "Marque os modificadores que esta habilidade aplica. Você pode escolher quantos quiser, inclusive de addons diferentes."
                                      )}
                                    </p>
                                    <div className="space-y-2">
                                      {groups.map((g) => {
                                        const totalInGroup = g.items.length;
                                        const checkedInGroup = g.items.filter((it) =>
                                          linkedKeys.has(`${it.sectionId}::${it.addonId}::${it.entryId}`)
                                        ).length;
                                        const allChecked = totalInGroup > 0 && checkedInGroup === totalInGroup;
                                        return (
                                          <div
                                            key={`${g.sectionId}::${g.addonId}`}
                                            className="rounded-md border border-gray-700 bg-gray-900/40 p-2"
                                          >
                                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                              <span className="text-[11px] text-gray-300 truncate">
                                                <strong>{g.sectionTitle}</strong>
                                                <span className="ml-1 text-gray-500">· {g.addonName}</span>
                                                <span className="ml-1 text-[10px] text-gray-500">
                                                  ({checkedInGroup}/{totalInGroup})
                                                </span>
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  toggleAllEffectsFromAddon(entry.id, g.sectionId, g.addonId, !allChecked)
                                                }
                                                className={BUTTON_TINY_CLASS}
                                              >
                                                {allChecked
                                                  ? t("skillsAddon.deselectAll", "Desmarcar todos")
                                                  : t("skillsAddon.selectAll", "Marcar todos")}
                                              </button>
                                            </div>
                                            <ul className="space-y-1">
                                              {g.items.map((it) => {
                                                const itemKey = `${it.sectionId}::${it.addonId}::${it.entryId}`;
                                                const checked = linkedKeys.has(itemKey);
                                                return (
                                                  <li key={itemKey}>
                                                    <label className="flex items-center gap-2 rounded px-1.5 py-1 text-xs text-gray-200 hover:bg-gray-800/40 cursor-pointer">
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
                                                        className="h-3.5 w-3.5 accent-indigo-500"
                                                      />
                                                      <span className="flex-1">{it.label}</span>
                                                    </label>
                                                  </li>
                                                );
                                              })}
                                            </ul>
                                          </div>
                                        );
                                      })}
                                    </div>
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
