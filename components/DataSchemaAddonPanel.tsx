"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import type { DataSchemaAddonDraft, DataSchemaEntry, DataSchemaValueType, EconomyLinkAddonDraft, EconomyLinkFieldKey, GlobalVariableAddonDraft, ProductionAddonDraft, ProductionFieldKey } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useProjectStore } from "@/store/projectStore";
import {
  CommitNumberInput,
  CommitOptionalNumberInput,
  CommitTextInput,
} from "@/components/common/CommitInput";

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

type LibraryFieldOption = {
  libraryAddonId: string;
  libraryName: string;
  sectionTitle: string;
  entryId: string;
  key: string;
  label: string;
  description?: string;
};

function resolveEntryLabel(entry: DataSchemaEntry, options: LibraryFieldOption[]): string {
  if (!entry.libraryRef) return entry.label;
  const match = options.find(
    (opt) => opt.libraryAddonId === entry.libraryRef!.libraryAddonId && opt.entryId === entry.libraryRef!.entryId
  );
  return match?.label ?? entry.label;
}

function resolveEntryKey(entry: DataSchemaEntry, options: LibraryFieldOption[]): string {
  if (!entry.libraryRef) return entry.key;
  const match = options.find(
    (opt) => opt.libraryAddonId === entry.libraryRef!.libraryAddonId && opt.entryId === entry.libraryRef!.entryId
  );
  return match?.key ?? entry.key;
}

export function DataSchemaAddonPanel({ addon, onChange, onRemove }: DataSchemaAddonPanelProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const entries = addon.entries || [];

  // Find the section that contains this Data Schema addon (for DataID binding)
  const section = useMemo(() => {
    for (const project of projects) {
      for (const sec of project.sections || []) {
        if ((sec.addons || []).some((a) => a.id === addon.id)) return sec;
      }
    }
    return null;
  }, [projects, addon.id]);
  const [collapsedEntries, setCollapsedEntries] = useState<Record<string, boolean>>({});
  const [libraryPickerOpenEntryId, setLibraryPickerOpenEntryId] = useState<string | null>(null);
  const libraryPickerRef = useRef<HTMLDivElement | null>(null);
  const entryIdSignature = useMemo(() => entries.map((entry) => entry.id).join("|"), [entries]);

  const availableLibraryFields = useMemo<LibraryFieldOption[]>(() => {
    const out: LibraryFieldOption[] = [];
    const seenLibraryIds = new Set<string>();
    for (const project of projects) {
      for (const sec of project.sections || []) {
        const sectionTitle = (sec as { title?: string; id: string }).title?.trim() || (sec as { id: string }).id;
        for (const sectionAddon of (sec as { addons?: Array<{ id: string; type: string; name: string; data: Record<string, unknown> }> }).addons || []) {
          if (sectionAddon.type !== "fieldLibrary") continue;
          if (seenLibraryIds.has(sectionAddon.id)) continue;
          seenLibraryIds.add(sectionAddon.id);
          const libraryName = sectionAddon.name || (sectionAddon.data as { name?: string }).name || "Biblioteca";
          const libEntries =
            (sectionAddon.data as {
              entries?: Array<{ id: string; key: string; label: string; description?: string }>;
            }).entries || [];
          for (const entry of libEntries) {
            out.push({
              libraryAddonId: sectionAddon.id,
              libraryName,
              sectionTitle,
              entryId: entry.id,
              key: entry.key,
              label: entry.label || entry.key,
              description: entry.description,
            });
          }
        }
      }
    }
    return out;
  }, [projects]);

  useEffect(() => {
    if (!libraryPickerOpenEntryId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLibraryPickerOpenEntryId(null);
    };
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (libraryPickerRef.current?.contains(target)) return;
      setLibraryPickerOpenEntryId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [libraryPickerOpenEntryId]);
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

  const ECONOMY_LINK_FIELDS: Array<{ key: EconomyLinkFieldKey; label: string }> = [
    { key: "buyValue", label: "Valor de Compra" },
    { key: "minBuyValue", label: "Valor de Compra Min" },
    { key: "sellValue", label: "Valor de Venda" },
    { key: "maxSellValue", label: "Valor de Venda Max" },
    { key: "unlockValue", label: "Nível de Desbloqueio" },
  ];

  // Only show Economy Link addons from the same section as this Data Schema
  // group is on the SectionAddon wrapper, not the draft - find it via section lookup
  const myAddonWrapper = section?.addons?.find((a: any) => a.id === addon.id);
  const myGroup = (myAddonWrapper as any)?.group || "A";

  const economyLinkRefOptions = useMemo(() => {
    const out: Array<{ refId: string; addonId: string; label: string; data: EconomyLinkAddonDraft }> = [];
    for (const project of projects) {
      for (const section of project.sections || []) {
        const hasThisAddon = (section.addons || []).some((a) => a.id === addon.id);
        if (!hasThisAddon) continue;
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "economyLink") continue;
          if (((sectionAddon as any).group || "A") !== myGroup) continue;
          const addonName = sectionAddon.name?.trim() || "Economy Link";
          out.push({
            refId: sectionAddon.id,
            addonId: sectionAddon.id,
            label: addonName,
            data: sectionAddon.data as EconomyLinkAddonDraft,
          });
        }
        return out;
      }
    }
    return out;
  }, [projects, addon.id, myGroup]);

  const getEconomyLinkValue = (refId: string, field: EconomyLinkFieldKey): number | undefined => {
    const found = economyLinkRefOptions.find((opt) => opt.refId === refId);
    if (!found) return undefined;
    return found.data[field] as number | undefined;
  };

  const PRODUCTION_FIELDS_BASE: Array<{ key: ProductionFieldKey; label: string; requiresOutput?: "buy" | "sell" | "unlock" }> = [
    { key: "minOutput", label: "Qtd Minima" },
    { key: "maxOutput", label: "Qtd Maxima" },
    { key: "intervalSeconds", label: "Tempo (passivo)" },
    { key: "craftTimeSeconds", label: "Tempo (receita)" },
    { key: "capacity", label: "Capacidade maxima" },
    { key: "outputBuyEffective", label: "Compra do item (efetivo)", requiresOutput: "buy" },
    { key: "outputMinBuyValue", label: "Compra min do item", requiresOutput: "buy" },
    { key: "outputSellEffective", label: "Venda do item (efetivo)", requiresOutput: "sell" },
    { key: "outputMaxSellValue", label: "Venda max do item", requiresOutput: "sell" },
    { key: "outputUnlockValue", label: "Lv desbloqueio do item", requiresOutput: "unlock" },
  ];

  // Only show Production addons from the same section and group
  const productionRefOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string; data: ProductionAddonDraft }> = [];
    for (const project of projects) {
      for (const section of project.sections || []) {
        const hasThisAddon = (section.addons || []).some((a) => a.id === addon.id);
        if (!hasThisAddon) continue;
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "production") continue;
          if (((sectionAddon as any).group || "A") !== myGroup) continue;
          const addonName = sectionAddon.name?.trim() || "Production";
          out.push({
            refId: sectionAddon.id,
            label: addonName,
            data: sectionAddon.data as ProductionAddonDraft,
          });
        }
        return out;
      }
    }
    return out;
  }, [projects, addon.id, myGroup]);

  // Build global variable map for computing effective values (same as EconomyLinkAddonPanel)
  const globalVariableByRefId = useMemo(() => {
    const map = new Map<string, { valueType: string; defaultValue: number | boolean }>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "globalVariable") continue;
          if (map.has(section.id)) continue;
          const data = sectionAddon.data as GlobalVariableAddonDraft;
          map.set(section.id, { valueType: data.valueType, defaultValue: data.defaultValue });
        }
      }
    }
    return map;
  }, [projects]);

  /** Applies modifiers (global variables) to a base value - same logic as EconomyLinkAddonPanel */
  const computeEffective = (base: number | undefined, modifiers: Array<{ refId: string }>, bounds?: { min?: number; max?: number }): number | undefined => {
    if (base == null || !Number.isFinite(base)) return undefined;
    if (!modifiers.length) {
      if (bounds?.min != null || bounds?.max != null) {
        let v = base;
        if (bounds.min != null) v = Math.max(bounds.min, v);
        if (bounds.max != null) v = Math.min(bounds.max, v);
        return Math.round(v);
      }
      return undefined;
    }
    let next = base;
    let applied = 0;
    for (const mod of modifiers) {
      const meta = globalVariableByRefId.get(mod.refId);
      if (!meta || typeof meta.defaultValue !== "number" || !Number.isFinite(meta.defaultValue)) continue;
      if (meta.valueType === "percent") { next += (next * meta.defaultValue) / 100; applied++; }
      else if (meta.valueType === "multiplier") { next *= meta.defaultValue; applied++; }
      else if (meta.valueType === "flat") { next += meta.defaultValue; applied++; }
    }
    if (applied === 0 && !bounds?.min && !bounds?.max) return undefined;
    let v = Math.max(0, next);
    if (bounds?.min != null) v = Math.max(bounds.min, v);
    if (bounds?.max != null) v = Math.min(bounds.max, v);
    return Math.round(v);
  };

  /** Find the Economy Link data of the item produced by a Production addon */
  const findOutputEconomyLink = (productionRefId: string): EconomyLinkAddonDraft | undefined => {
    const found = productionRefOptions.find((opt) => opt.refId === productionRefId);
    const outputRef = found?.data.outputRef;
    if (!outputRef) return undefined;
    for (const project of projects) {
      const targetSection = (project.sections || []).find((s) => s.id === outputRef);
      if (!targetSection) continue;
      for (const sAddon of targetSection.addons || []) {
        if (sAddon.type === "economyLink") return sAddon.data as EconomyLinkAddonDraft;
      }
    }
    return undefined;
  };

  const getProductionValue = (refId: string, field: ProductionFieldKey): number | undefined => {
    const found = productionRefOptions.find((opt) => opt.refId === refId);
    if (!found) return undefined;

    // Direct production fields
    const directFields: Record<string, keyof ProductionAddonDraft> = {
      minOutput: "minOutput", maxOutput: "maxOutput",
      intervalSeconds: "intervalSeconds", craftTimeSeconds: "craftTimeSeconds", capacity: "capacity",
    };
    if (field in directFields) return found.data[directFields[field]] as number | undefined;

    // Output item economy fields (with effective values)
    const el = findOutputEconomyLink(refId);
    if (!el) return undefined;

    switch (field) {
      case "outputBuyEffective":
        return computeEffective(el.buyValue, el.buyModifiers || [], { min: el.minBuyValue }) ?? el.buyValue;
      case "outputMinBuyValue":
        return el.minBuyValue;
      case "outputSellEffective":
        return computeEffective(el.sellValue, el.sellModifiers || [], { max: el.maxSellValue }) ?? el.sellValue;
      case "outputMaxSellValue":
        return el.maxSellValue;
      case "outputUnlockValue":
        return el.unlockValue;
      default:
        return undefined;
    }
  };

  // Filter production fields: only show output options if the production item has the config active
  const getAvailableProductionFields = (productionRefId: string): Array<{ key: ProductionFieldKey; label: string }> => {
    const el = findOutputEconomyLink(productionRefId);
    const hasBuy = el?.hasBuyConfig ?? false;
    const hasSell = el?.hasSellConfig ?? false;
    const hasUnlock = el?.hasUnlockConfig ?? false;
    return PRODUCTION_FIELDS_BASE.filter((f) => {
      if (!f.requiresOutput) return true;
      if (f.requiresOutput === "buy") return hasBuy;
      if (f.requiresOutput === "sell") return hasSell;
      if (f.requiresOutput === "unlock") return hasUnlock;
      return true;
    });
  };

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

  const linkEntryToLibrary = (entryId: string, option: LibraryFieldOption) => {
    updateEntry(entryId, {
      libraryRef: { libraryAddonId: option.libraryAddonId, entryId: option.entryId },
      key: option.key,
      label: option.label,
    });
    setLibraryPickerOpenEntryId(null);
  };

  const unlinkEntryFromLibrary = (entryId: string) => {
    updateEntry(entryId, { libraryRef: undefined });
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
                const isLinkedToEconomy = Boolean(entry.economyLinkRef && entry.economyLinkField);
                const isLinkedToProduction = Boolean(entry.productionRef && entry.productionField);
                const isLinkedToPageDataId = Boolean(entry.usePageDataId);
                const isReadOnlyValue = isLinkedToEconomy || isLinkedToProduction || isLinkedToPageDataId;
                const linkedValueType: DataSchemaValueType | null = linkedXpMeta
                  ? linkedXpMeta.decimals > 0
                    ? "float"
                    : "int"
                  : null;
                const effectiveValueType = isLinkedToPageDataId ? "string" : isReadOnlyValue ? "int" : (linkedValueType || entry.valueType);
                const supportsBoundsByType = effectiveValueType !== "boolean" && effectiveValueType !== "string";
                const useBounds = supportsBoundsByType && (entry.min != null || entry.max != null);
                const effectiveLabel = resolveEntryLabel(entry, availableLibraryFields);
                const effectiveKey = resolveEntryKey(entry, availableLibraryFields);
                const title =
                  effectiveLabel?.trim() ||
                  effectiveKey?.trim() ||
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
                          {entry.libraryRef && <span className="ml-1 text-[10px] text-sky-400/80" aria-hidden>📎</span>}
                        </span>
                        <span className="text-[10px] text-gray-400">{effectiveKey || "key"}</span>
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
                            {entry.libraryRef ? (
                              (() => {
                                const libraryEntryFound = availableLibraryFields.some(
                                  (opt) =>
                                    opt.libraryAddonId === entry.libraryRef!.libraryAddonId &&
                                    opt.entryId === entry.libraryRef!.entryId
                                );
                                return (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 rounded-lg border border-sky-600/40 bg-sky-900/20 px-2.5 py-1.5 text-xs text-sky-200">
                                      <span aria-hidden className="text-[10px]">📎</span>
                                      <span className="flex-1 truncate">
                                        {resolveEntryLabel(entry, availableLibraryFields)}
                                        <span className="ml-1 text-[10px] text-sky-400/80">
                                          ({resolveEntryKey(entry, availableLibraryFields)})
                                        </span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => unlinkEntryFromLibrary(entry.id)}
                                        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-sky-300 hover:bg-sky-800/50 hover:text-sky-100"
                                        aria-label={t("dataSchemaAddon.unlinkLibraryAriaLabel", "Desvincular da Biblioteca")}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    {!libraryEntryFound && (
                                      <p className="text-[11px] text-amber-300">
                                        ⚠️{" "}
                                        {t(
                                          "dataSchemaAddon.warnings.brokenLibraryRef",
                                          "O campo vinculado à Biblioteca não foi encontrado. Usando o último nome salvo como fallback."
                                        )}
                                      </p>
                                    )}
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="block">
                                  <span className="mb-1 block text-xs text-gray-400">{t("dataSchemaAddon.labelLabel", "Nome")}</span>
                                  <CommitTextInput
                                    value={entry.label}
                                    onCommit={(next) => updateEntry(entry.id, { label: next })}
                                    className={INPUT_CLASS}
                                    placeholder={t("dataSchemaAddon.labelPlaceholder", "XP de colheita")}
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 flex items-center justify-between text-xs text-gray-400">
                                    <span>{t("dataSchemaAddon.keyLabel", "Chave")}</span>
                                    {availableLibraryFields.length > 0 && (
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setLibraryPickerOpenEntryId((prev) => (prev === entry.id ? null : entry.id))
                                          }
                                          aria-label={t(
                                            "dataSchemaAddon.linkLibraryAriaLabel",
                                            "Vincular a Biblioteca de Campos"
                                          )}
                                          aria-expanded={libraryPickerOpenEntryId === entry.id}
                                          title={t("dataSchemaAddon.linkLibraryButton", "Vincular à Biblioteca de Campos")}
                                          className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-gray-600 bg-gray-800 text-[11px] text-gray-300 hover:bg-gray-700 hover:text-gray-100"
                                        >
                                          📚
                                        </button>
                                        {libraryPickerOpenEntryId === entry.id && (
                                          <div
                                            ref={libraryPickerRef}
                                            role="listbox"
                                            aria-label={t(
                                              "dataSchemaAddon.libraryPickerTitle",
                                              "Selecionar campo da Biblioteca"
                                            )}
                                            className="absolute right-0 top-full z-20 mt-1 w-72 max-h-64 overflow-y-auto rounded-md border border-gray-700 bg-gray-950/95 p-1 text-xs text-gray-200 shadow-xl normal-case"
                                          >
                                            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                              {t("dataSchemaAddon.libraryPickerTitle", "Selecionar campo da Biblioteca")}
                                            </p>
                                            {(() => {
                                              const byLibrary = new Map<
                                                string,
                                                { libraryName: string; sectionTitle: string; entries: LibraryFieldOption[] }
                                              >();
                                              for (const opt of availableLibraryFields) {
                                                const bucket = byLibrary.get(opt.libraryAddonId);
                                                if (bucket) bucket.entries.push(opt);
                                                else
                                                  byLibrary.set(opt.libraryAddonId, {
                                                    libraryName: opt.libraryName,
                                                    sectionTitle: opt.sectionTitle,
                                                    entries: [opt],
                                                  });
                                              }
                                              return Array.from(byLibrary.entries()).map(([libId, group]) => (
                                                <div key={libId} className="mb-1">
                                                  <p className="px-2 py-1 text-[10px] font-semibold text-sky-300/80">
                                                    <span className="text-gray-400">{group.sectionTitle}</span>
                                                    <span className="mx-1 text-gray-500">→</span>
                                                    <span>{group.libraryName}</span>
                                                  </p>
                                                  {group.entries.map((opt) => (
                                                    <button
                                                      key={`${opt.libraryAddonId}:${opt.entryId}`}
                                                      type="button"
                                                      role="option"
                                                      onClick={() => linkEntryToLibrary(entry.id, opt)}
                                                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-800"
                                                      title={opt.description || undefined}
                                                    >
                                                      <span className="flex-1 truncate">{opt.label}</span>
                                                      <span className="shrink-0 text-[10px] text-gray-500">{opt.key}</span>
                                                    </button>
                                                  ))}
                                                </div>
                                              ));
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </span>
                                  <CommitTextInput
                                    value={entry.key}
                                    onCommit={(next) => updateEntry(entry.id, { key: next })}
                                    transform={normalizeKey}
                                    className={INPUT_CLASS}
                                    placeholder={t("dataSchemaAddon.keyPlaceholder", "harvest_xp")}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                          {/* Binding type selector */}
                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                              Vinculo (opcional)
                            </p>
                            <div className="flex flex-wrap items-start gap-2">
                              <label className="min-w-[130px]">
                                <span className="mb-1 block text-xs text-gray-400">Tipo</span>
                                <select
                                  value={entry.usePageDataId ? "pageDataId" : entry.productionRef ? "production" : entry.economyLinkRef ? "economy" : entry.unitXpRef ? "xp" : "none"}
                                  onChange={(event) => {
                                    const next = event.target.value;
                                    const clearAll = { unitXpRef: undefined, economyLinkRef: undefined, economyLinkField: undefined, productionRef: undefined, productionField: undefined, usePageDataId: undefined };
                                    if (next === "none") {
                                      updateEntry(entry.id, clearAll);
                                    } else if (next === "pageDataId") {
                                      updateEntry(entry.id, {
                                        ...clearAll,
                                        usePageDataId: true,
                                        valueType: "string",
                                        value: section?.dataId ?? "",
                                      });
                                    } else if (next === "xp") {
                                      const first = xpRefOptions[0];
                                      const forcedType: DataSchemaValueType | undefined = first ? (first.decimals > 0 ? "float" : "int") : undefined;
                                      updateEntry(entry.id, {
                                        ...clearAll,
                                        unitXpRef: first?.refId,
                                        ...(forcedType ? { valueType: forcedType } : {}),
                                      });
                                    } else if (next === "economy") {
                                      const first = economyLinkRefOptions[0];
                                      const defaultField: EconomyLinkFieldKey = "buyValue";
                                      const linkedValue = first ? getEconomyLinkValue(first.refId, defaultField) : 0;
                                      updateEntry(entry.id, {
                                        ...clearAll,
                                        economyLinkRef: first?.refId,
                                        economyLinkField: defaultField,
                                        valueType: "int",
                                        value: linkedValue ?? 0,
                                      });
                                    } else if (next === "production") {
                                      const first = productionRefOptions[0];
                                      const defaultField: ProductionFieldKey = "minOutput";
                                      const linkedValue = first ? getProductionValue(first.refId, defaultField) : 0;
                                      updateEntry(entry.id, {
                                        ...clearAll,
                                        productionRef: first?.refId,
                                        productionField: defaultField,
                                        valueType: "int",
                                        value: linkedValue ?? 0,
                                      });
                                    }
                                  }}
                                  className={INPUT_CLASS}
                                >
                                  <option value="none">Sem vinculo</option>
                                  <option value="pageDataId">DataID da pagina</option>
                                  <option value="xp">Pagina de XP</option>
                                  {economyLinkRefOptions.length > 0 && <option value="economy">Economia vinculada</option>}
                                  {productionRefOptions.length > 0 && <option value="production">Producao</option>}
                                </select>
                              </label>

                              {/* XP ref selector */}
                              {entry.unitXpRef !== undefined && !entry.economyLinkRef && !entry.productionRef && (
                                <label className="min-w-[200px]">
                                  <span className="mb-1 block text-xs text-gray-400">Pagina</span>
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
                                        {t("dataSchemaAddon.invalidUnitXpRef", "Vínculo inválido")}
                                      </option>
                                    )}
                                    {xpRefOptions.map((option) => (
                                      <option key={option.refId} value={option.refId}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}

                              {/* Economy Link ref + field selectors */}
                              {entry.economyLinkRef && (
                                <>
                                  <label className="min-w-[200px]">
                                    <span className="mb-1 block text-xs text-gray-400">Addon</span>
                                    <select
                                      value={entry.economyLinkRef}
                                      onChange={(event) => {
                                        const nextRef = event.target.value;
                                        const field = entry.economyLinkField ?? "buyValue";
                                        const linkedValue = getEconomyLinkValue(nextRef, field);
                                        updateEntry(entry.id, {
                                          economyLinkRef: nextRef,
                                          value: linkedValue ?? 0,
                                        });
                                      }}
                                      className={INPUT_CLASS}
                                    >
                                      {economyLinkRefOptions.map((option) => (
                                        <option key={option.refId} value={option.refId}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="min-w-[160px]">
                                    <span className="mb-1 block text-xs text-gray-400">Campo</span>
                                    <select
                                      value={entry.economyLinkField ?? "buyValue"}
                                      onChange={(event) => {
                                        const field = event.target.value as EconomyLinkFieldKey;
                                        const linkedValue = getEconomyLinkValue(entry.economyLinkRef!, field);
                                        updateEntry(entry.id, {
                                          economyLinkField: field,
                                          value: linkedValue ?? 0,
                                        });
                                      }}
                                      className={INPUT_CLASS}
                                    >
                                      {ECONOMY_LINK_FIELDS.map((f) => (
                                        <option key={f.key} value={f.key}>{f.label}</option>
                                      ))}
                                    </select>
                                  </label>
                                </>
                              )}

                              {/* Production ref + field selectors */}
                              {entry.productionRef && (
                                <>
                                  <label className="min-w-[200px]">
                                    <span className="mb-1 block text-xs text-gray-400">Addon</span>
                                    <select
                                      value={entry.productionRef}
                                      onChange={(event) => {
                                        const nextRef = event.target.value;
                                        const field = entry.productionField ?? "minOutput";
                                        const linkedValue = getProductionValue(nextRef, field);
                                        updateEntry(entry.id, {
                                          productionRef: nextRef,
                                          value: linkedValue ?? 0,
                                        });
                                      }}
                                      className={INPUT_CLASS}
                                    >
                                      {productionRefOptions.map((option) => (
                                        <option key={option.refId} value={option.refId}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="min-w-[160px]">
                                    <span className="mb-1 block text-xs text-gray-400">Campo</span>
                                    <select
                                      value={entry.productionField ?? "minOutput"}
                                      onChange={(event) => {
                                        const field = event.target.value as ProductionFieldKey;
                                        const linkedValue = getProductionValue(entry.productionRef!, field);
                                        updateEntry(entry.id, {
                                          productionField: field,
                                          value: linkedValue ?? 0,
                                        });
                                      }}
                                      className={INPUT_CLASS}
                                    >
                                      {getAvailableProductionFields(entry.productionRef!).map((f) => (
                                        <option key={f.key} value={f.key}>{f.label}</option>
                                      ))}
                                    </select>
                                  </label>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-2.5">
                            <p className="mb-2 text-[10px] uppercase tracking-wide text-gray-400">
                              {t("dataSchemaAddon.valueLabel", "Valor")}
                            </p>
                            {isReadOnlyValue ? (
                              <div className="flex items-center gap-3 py-1">
                                <span className="text-xs text-gray-400">Tipo:</span>
                                <span className="text-xs font-mono text-gray-300">{isLinkedToPageDataId ? "string" : "int"}</span>
                                <span className="text-xs text-gray-400">Valor:</span>
                                <span className="text-sm font-mono font-medium text-indigo-300">
                                  {isLinkedToPageDataId
                                    ? (section?.dataId || "N/A")
                                    : isLinkedToEconomy
                                      ? (getEconomyLinkValue(entry.economyLinkRef!, entry.economyLinkField!) ?? "N/A")
                                      : (getProductionValue(entry.productionRef!, entry.productionField!) ?? "N/A")}
                                </span>
                                <span className="text-[10px] text-gray-500 italic">
                                  (vinculado - somente leitura)
                                </span>
                              </div>
                            ) : (
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
                                  {effectiveValueType === "string" ? (
                                    <CommitTextInput
                                      value={String(entry.value ?? "")}
                                      onCommit={(next) => updateEntry(entry.id, { value: next })}
                                      className={INPUT_CLASS}
                                    />
                                  ) : (() => {
                                    const numericDisplayValue =
                                      typeof entry.value === "number"
                                        ? entry.value
                                        : Number(String(entry.value ?? "").replace(",", "."));
                                    const safeNumeric = Number.isFinite(numericDisplayValue) ? numericDisplayValue : 0;
                                    return (
                                      <CommitNumberInput
                                        value={safeNumeric}
                                        onCommit={(next) => {
                                          if (isLinkedToXp && linkedXpMeta) {
                                            updateEntry(entry.id, {
                                              valueType: linkedXpMeta.decimals > 0 ? "float" : "int",
                                              value: roundToDecimals(next, linkedXpMeta.decimals),
                                            });
                                            return;
                                          }
                                          const coerced = coerceValueByType(effectiveValueType, next);
                                          updateEntry(entry.id, { value: coerced });
                                        }}
                                        step={isLinkedToXp && linkedXpMeta ? stepFromDecimals(linkedXpMeta.decimals) : undefined}
                                        className={INPUT_CLASS}
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
                                  <CommitTextInput
                                    value={entry.unit ?? ""}
                                    onCommit={(next) => updateEntry(entry.id, { unit: next || undefined })}
                                    className={INPUT_CLASS}
                                    placeholder={t("dataSchemaAddon.unitPlaceholder", "s, kg, pts")}
                                  />
                                </label>
                              )}
                            </div>
                            )}
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
                                  <CommitOptionalNumberInput
                                    value={entry.min}
                                    onCommit={(next) => updateEntry(entry.id, { min: next })}
                                    className={INPUT_CLASS}
                                  />
                                </label>
                                <label className="min-w-[120px]">
                                  <span className="mb-1 block text-xs text-gray-400">{t("dataSchemaAddon.maxLabel", "Máximo")}</span>
                                  <CommitOptionalNumberInput
                                    value={entry.max}
                                    onCommit={(next) => updateEntry(entry.id, { max: next })}
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

