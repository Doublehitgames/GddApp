"use client";

import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import type { EconomyLinkAddonDraft, ProductionProgressionLink, SheetsCellRef } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { sectionPathById } from "@/lib/utils/slug";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { CommitNumberInput, CommitOptionalNumberInput } from "@/components/common/CommitInput";
import { LinkedFieldRow, type LinkedFieldOption } from "@/components/common/LinkedFieldRow";
import { getGoogleSheetsToken, fetchSheetCellValue, parseCellNumber } from "@/lib/googleSheets";
import { getGoogleClientId } from "@/lib/googleDrivePicker";

interface EconomyLinkAddonPanelProps {
  addon: EconomyLinkAddonDraft;
  onChange: (next: EconomyLinkAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

function clampInteger(value: number, min?: number, max?: number): number {
  let next = Math.floor(value);
  if (min != null) next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  return next;
}

function uniqueRefs(items: Array<{ refId: string }>): Array<{ refId: string }> {
  const out: Array<{ refId: string }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    const refId = item.refId.trim();
    if (!refId || seen.has(refId)) continue;
    seen.add(refId);
    out.push({ refId });
  }
  return out;
}

function formatDisplayNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

type ProgressionColumnOption = {
  key: string;
  progressionAddonId: string;
  columnId: string;
  columnName: string;
  label: string;
  sectionName: string;
  startLevel: number;
  endLevel: number;
  rowsByLevel: Map<number, number>;
};

type GlobalVariableCalcMeta = {
  valueType: "percent" | "multiplier" | "flat" | "boolean";
  defaultValue: number | boolean;
};

function computeEffectiveValue(
  baseValue: number | undefined,
  modifiers: Array<{ refId: string }>,
  globalVariableByRefId: Map<string, GlobalVariableCalcMeta>,
  bounds?: { min?: number; max?: number }
): number | undefined {
  if (baseValue == null || !Number.isFinite(baseValue)) return undefined;
  if (!Array.isArray(modifiers) || modifiers.length === 0) {
    if (bounds?.min != null || bounds?.max != null) {
      return clampInteger(baseValue, bounds?.min, bounds?.max);
    }
    return undefined;
  }
  let next = baseValue;
  let appliedCount = 0;
  for (const modifier of modifiers) {
    const meta = globalVariableByRefId.get(modifier.refId);
    if (!meta) continue;
    if (typeof meta.defaultValue !== "number" || !Number.isFinite(meta.defaultValue)) continue;
    const modifierValue = meta.defaultValue;
    if (meta.valueType === "percent") {
      next += (next * modifierValue) / 100;
      appliedCount += 1;
      continue;
    }
    if (meta.valueType === "multiplier") {
      next *= modifierValue;
      appliedCount += 1;
      continue;
    }
    if (meta.valueType === "flat") {
      next += modifierValue;
      appliedCount += 1;
      continue;
    }
  }
  if (appliedCount === 0) {
    if (bounds?.min != null || bounds?.max != null) {
      return clampInteger(baseValue, bounds?.min, bounds?.max);
    }
    return undefined;
  }
  const nonNegative = Math.max(0, next);
  return clampInteger(nonNegative, bounds?.min, bounds?.max);
}

function formatModifierPreview(meta: GlobalVariableCalcMeta): string | null {
  if (typeof meta.defaultValue !== "number" || !Number.isFinite(meta.defaultValue)) {
    return null;
  }
  const valueText = formatDisplayNumber(meta.defaultValue);
  if (meta.valueType === "percent") {
    const signed = meta.defaultValue > 0 ? `+${valueText}` : valueText;
    return `${signed}%`;
  }
  if (meta.valueType === "multiplier") {
    return `x${valueText}`;
  }
  if (meta.valueType === "flat") {
    return meta.defaultValue > 0 ? `+${valueText}` : valueText;
  }
  return null;
}

function SheetsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
    </svg>
  );
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function EconomyLinkAddonPanel({ addon, onChange, onRemove }: EconomyLinkAddonPanelProps) {
  const { t } = useI18n();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const projects = useProjectStore((state) => state.projects);
  const currentProjectId = useCurrentProjectId();
  const getSectionUrl = (pId: string | undefined, sId: string | undefined): string => {
    if (!pId || !sId) return "#";
    const p = projects.find((proj) => proj.id === pId);
    if (!p) return "#";
    return sectionPathById(p, sId);
  };
  const linkedSpreadsheets = useMemo(() => {
    if (!currentProjectId) return [];
    const project = projects.find((p) => p.id === currentProjectId);
    return project?.linkedSpreadsheets ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, currentProjectId]);

  const scopedProjects = useMemo(
    () => (currentProjectId ? projects.filter((p) => p.id === currentProjectId) : projects),
    [projects, currentProjectId]
  );

  const currencyRefOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string }> = [];
    const seen = new Set<string>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "currency") continue;
          const refId = section.id;
          if (seen.has(refId)) continue;
          seen.add(refId);
          const displayName = sectionAddon.data.displayName?.trim() || sectionAddon.name || section.title;
          const code = sectionAddon.data.code?.trim();
          out.push({
            refId,
            label: code ? `${displayName} (${code})` : displayName,
          });
        }
      }
    }
    return out;
  }, [scopedProjects]);

  const globalVariableRefOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string; projectId: string; sectionId: string; meta: GlobalVariableCalcMeta }> = [];
    const seen = new Set<string>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "globalVariable") continue;
          const refId = section.id;
          if (seen.has(refId)) continue;
          seen.add(refId);
          const displayName = sectionAddon.data.displayName?.trim() || sectionAddon.name || section.title;
          out.push({
            refId,
            label: displayName,
            projectId: project.id,
            sectionId: section.id,
            meta: {
              valueType: sectionAddon.data.valueType,
              defaultValue: sectionAddon.data.defaultValue,
            },
          });
        }
      }
    }
    return out;
  }, [scopedProjects]);

  const buyModifierOptions = useMemo(
    () =>
      globalVariableRefOptions.filter(
        (o) => typeof o.meta.defaultValue === "number" && o.meta.defaultValue <= 0,
      ),
    [globalVariableRefOptions],
  );

  const sellModifierOptions = useMemo(
    () =>
      globalVariableRefOptions.filter(
        (o) => typeof o.meta.defaultValue === "number" && o.meta.defaultValue >= 0,
      ),
    [globalVariableRefOptions],
  );

  const xpRefOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string; minLevel?: number; maxLevel?: number }> = [];
    const seen = new Set<string>();
    for (const project of scopedProjects) {
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
            minLevel:
              typeof sectionAddon.data.startLevel === "number" && Number.isFinite(sectionAddon.data.startLevel)
                ? Math.max(1, Math.floor(sectionAddon.data.startLevel))
                : undefined,
            maxLevel:
              typeof sectionAddon.data.endLevel === "number" && Number.isFinite(sectionAddon.data.endLevel)
                ? Math.max(1, Math.floor(sectionAddon.data.endLevel))
                : undefined,
          });
        }
      }
    }
    return out;
  }, [scopedProjects]);

  const globalVariableByRefId = useMemo(() => {
    const map = new Map<string, GlobalVariableCalcMeta>();
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "globalVariable") continue;
          if (map.has(section.id)) continue;
          map.set(section.id, {
            valueType: sectionAddon.data.valueType,
            defaultValue: sectionAddon.data.defaultValue,
          });
        }
      }
    }
    return map;
  }, [scopedProjects]);

  const currentSection = useMemo(() => {
    for (const project of scopedProjects) {
      for (const section of project.sections || []) {
        if ((section.addons || []).some((a: any) => a.id === addon.id)) return section as any;
      }
    }
    return null;
  }, [scopedProjects, addon.id]);

  const progressionColumnOptions = useMemo<ProgressionColumnOption[]>(() => {
    const out: ProgressionColumnOption[] = [];
    if (!currentSection) return out;

    // Allow own section + direct parent only (not grandparent or siblings)
    const ownId: string = currentSection.id;
    const parentId: string | undefined = currentSection.parentId;

    for (const project of scopedProjects) {
      // Build a map of section id → name for parent label
      const sectionNameById = new Map<string, string>(
        (project.sections || []).map((s: any) => [s.id as string, (s.name as string | undefined)?.trim() || "Seção"])
      );

      for (const section of project.sections || [] as any[]) {
        const secId: string = (section as any).id;
        const isOwn = secId === ownId;
        const isParent = parentId != null && secId === parentId;
        if (!isOwn && !isParent) continue;

        const sectionName = sectionNameById.get(secId) || "Seção";
        const hint = isParent ? `↑ ${sectionName}` : undefined;

        for (const sa of (section.addons || []) as any[]) {
          if (sa.type !== "progressionTable") continue;
          const tableName = sa.name?.trim() || "Progression";
          const startLevel = Math.max(1, Math.floor(sa.data.startLevel || 1));
          const endLevel = Math.max(startLevel, Math.floor(sa.data.endLevel || startLevel));
          for (const col of sa.data.columns || []) {
            const rowsByLevel = new Map<number, number>(
              (sa.data.rows || []).map((row: any) => [
                row.level,
                typeof row.values?.[col.id] === "number" ? row.values[col.id] : 0,
              ])
            );
            out.push({
              key: `${sa.id}::${col.id}`,
              progressionAddonId: sa.id,
              columnId: col.id,
              columnName: col.name || col.id,
              label: `${tableName} → ${col.name || col.id}`,
              sectionName: hint ?? sectionName,
              startLevel,
              endLevel,
              rowsByLevel,
            });
          }
        }
      }
    }
    return out;
  }, [scopedProjects, currentSection]);

  const progressionColumnOptionByKey = useMemo(
    () => new Map(progressionColumnOptions.map((o) => [o.key, o])),
    [progressionColumnOptions]
  );

  const linkedFieldOptions = useMemo<LinkedFieldOption[]>(
    () => progressionColumnOptions.map((o) => ({ key: o.key, label: o.label, hint: o.sectionName })),
    [progressionColumnOptions]
  );

  const handleLinkChange = (
    field: "buyValueProgressionLink" | "minBuyValueProgressionLink" | "sellValueProgressionLink" | "maxSellValueProgressionLink",
    option: LinkedFieldOption | undefined
  ) => {
    if (!option) {
      commit({ [field]: undefined } as Partial<EconomyLinkAddonDraft>);
      return;
    }
    const found = progressionColumnOptionByKey.get(option.key);
    if (!found) return;
    commit({
      [field]: { progressionAddonId: found.progressionAddonId, columnId: found.columnId, columnName: found.columnName },
    } as Partial<EconomyLinkAddonDraft>);
  };

  const buildLevelBadges = (
    link: ProductionProgressionLink | undefined,
    multiplier: number
  ): Array<{ level: number; value: string }> | null => {
    if (!link) return null;
    const opt = progressionColumnOptionByKey.get(`${link.progressionAddonId}::${link.columnId}`);
    if (!opt) return null;
    const { startLevel, endLevel, rowsByLevel } = opt;
    const midLevel = Math.floor((startLevel + endLevel) / 2);
    const levels = [startLevel, midLevel, endLevel].filter((l, i, arr) => arr.indexOf(l) === i);
    return levels.map((lv) => ({
      level: lv,
      value: String(Math.floor((rowsByLevel.get(lv) ?? 0) * multiplier)),
    }));
  };

  const renderLevelBadges = (badges: ReturnType<typeof buildLevelBadges>, prefix: string): ReactNode => {
    if (!badges) return null;
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {badges.map((b) => (
          <span key={`${prefix}-lv-${b.level}`} className="rounded-full border border-gray-500 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-100">
            Lv{b.level}: {b.value}
          </span>
        ))}
      </div>
    );
  };

  const getLinkKey = (link: ProductionProgressionLink | undefined) =>
    link ? `${link.progressionAddonId}::${link.columnId}` : "";

  const validationMessages = useMemo(() => {
    const messages: string[] = [];
    const hasBuyConfig =
      addon.hasBuyConfig ?? Boolean(addon.buyCurrencyRef || addon.buyValue != null || (addon.buyModifiers || []).length > 0);
    const hasSellConfig =
      addon.hasSellConfig ?? Boolean(addon.sellCurrencyRef || addon.sellValue != null || (addon.sellModifiers || []).length > 0);
    if (hasBuyConfig && addon.buyValue != null && addon.buyValue > 0 && !addon.buyCurrencyRef) {
      messages.push(
        t("economyLinkAddon.validation.buyCurrencyRequired", "Preencha a moeda de compra quando houver valor de compra.")
      );
    }
    if (hasSellConfig && addon.sellValue != null && addon.sellValue > 0 && !addon.sellCurrencyRef) {
      messages.push(
        t("economyLinkAddon.validation.sellCurrencyRequired", "Preencha a moeda de venda quando houver valor de venda.")
      );
    }
    return messages;
  }, [addon, t]);

  const commit = (patch: Partial<EconomyLinkAddonDraft>) => {
    onChange({ ...addon, ...patch });
  };

  const handleBindSheetsRef = useCallback(
    async (field: "buyValue" | "sellValue" | "unlockValue", ref: SheetsCellRef): Promise<void> => {
      setSyncing(true);
      setSyncError(null);
      let finalRef = ref;
      try {
        const clientId = await getGoogleClientId();
        const token = clientId ? await getGoogleSheetsToken(clientId) : null;
        if (token) {
          const raw = await fetchSheetCellValue(token, ref.spreadsheetId, ref.sheetName, ref.cellRef);
          if (raw !== null) {
            const num = parseCellNumber(raw);
            if (num !== null) {
              finalRef = { ...ref, cachedValue: num, syncedAt: new Date().toISOString() };
            } else {
              throw new Error(`Valor "${raw}" em ${ref.sheetName}!${ref.cellRef} não é um número válido.`);
            }
          } else {
            throw new Error(`Não foi possível ler ${ref.sheetName}!${ref.cellRef}. Verifique o vínculo.`);
          }
        } else {
          throw new Error("Não foi possível obter autorização do Google.");
        }
      } finally {
        setSyncing(false);
      }
      const patch: Partial<EconomyLinkAddonDraft> = {
        [`${field}SheetsRef`]: finalRef,
      } as Partial<EconomyLinkAddonDraft>;
      if (finalRef.cachedValue !== null && finalRef.cachedValue !== undefined) {
        (patch as Record<string, unknown>)[field] = Math.floor(Math.max(0, finalRef.cachedValue));
      }
      commit(patch);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addon],
  );

  const handleUnbindSheetsRef = useCallback(
    (field: "buyValue" | "sellValue" | "unlockValue") => {
      commit({ [`${field}SheetsRef`]: undefined } as Partial<EconomyLinkAddonDraft>);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addon],
  );

  const handleSyncSheets = useCallback(async () => {
    const bindings: Array<{ field: "buyValue" | "sellValue"; ref: SheetsCellRef }> = [];
    if (addon.buyValueSheetsRef) bindings.push({ field: "buyValue", ref: addon.buyValueSheetsRef });
    if (addon.sellValueSheetsRef) bindings.push({ field: "sellValue", ref: addon.sellValueSheetsRef });
    if (bindings.length === 0) return;

    setSyncing(true);
    setSyncError(null);

    try {
      const clientId = await getGoogleClientId();
      if (!clientId) {
        setSyncError("Google Client ID não configurado.");
        return;
      }
      const token = await getGoogleSheetsToken(clientId);
      if (!token) {
        setSyncError("Não foi possível obter autorização do Google.");
        return;
      }

      const patch: Partial<EconomyLinkAddonDraft> = {};
      const syncedAt = new Date().toISOString();

      for (const { field, ref } of bindings) {
        const raw = await fetchSheetCellValue(token, ref.spreadsheetId, ref.sheetName, ref.cellRef);
        if (raw === null) {
          setSyncError(`Não foi possível ler ${ref.sheetName}!${ref.cellRef}. Verifique o vínculo.`);
          return;
        }
        const num = parseCellNumber(raw);
        if (num === null) {
          setSyncError(`Valor "${raw}" em ${ref.sheetName}!${ref.cellRef} não é um número válido.`);
          return;
        }
        const refKey = `${field}SheetsRef` as keyof EconomyLinkAddonDraft;
        patch[refKey] = { ...ref, cachedValue: num, syncedAt } as never;
        patch[field] = Math.floor(Math.max(0, num)) as never;
      }

      commit(patch);
    } catch {
      setSyncError("Erro inesperado ao sincronizar.");
    } finally {
      setSyncing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addon]);

  const toggleModifier = (field: "buyModifiers" | "sellModifiers", refId: string, enabled: boolean) => {
    const current = field === "buyModifiers" ? addon.buyModifiers || [] : addon.sellModifiers || [];
    const next = enabled
      ? uniqueRefs([...current, { refId }])
      : current.filter((item) => item.refId !== refId);
    commit({ [field]: next } as Partial<EconomyLinkAddonDraft>);
  };

  const hasBuyConfig =
    addon.hasBuyConfig ?? Boolean(addon.buyCurrencyRef || addon.buyValue != null || (addon.buyModifiers || []).length > 0);
  const hasSellConfig =
    addon.hasSellConfig ?? Boolean(addon.sellCurrencyRef || addon.sellValue != null || (addon.sellModifiers || []).length > 0);

  const buySelectedKnown = addon.buyCurrencyRef
    ? currencyRefOptions.some((item) => item.refId === addon.buyCurrencyRef)
    : false;
  const sellSelectedKnown = addon.sellCurrencyRef
    ? currencyRefOptions.some((item) => item.refId === addon.sellCurrencyRef)
    : false;
  const unlockSelectedKnown = addon.unlockRef ? xpRefOptions.some((item) => item.refId === addon.unlockRef) : false;
  const hasUnlockConfig = addon.hasUnlockConfig ?? Boolean(addon.unlockRef || addon.unlockValue != null);
  const unlockBounds = useMemo(() => {
    if (!addon.unlockRef) return { min: undefined as number | undefined, max: undefined as number | undefined };
    const xp = xpRefOptions.find((item) => item.refId === addon.unlockRef);
    if (!xp) return { min: undefined as number | undefined, max: undefined as number | undefined };
    const min = xp.minLevel;
    const max = xp.maxLevel;
    if (min != null && max != null && max < min) {
      return { min, max: min };
    }
    return { min, max };
  }, [addon.unlockRef, xpRefOptions]);
  const resolveLinkedValue = (
    link: ProductionProgressionLink | undefined,
    unlockValue: number | undefined,
    fallback: number | undefined,
    multiplier: number
  ): number | undefined => {
    if (link && unlockValue != null) {
      const opt = progressionColumnOptionByKey.get(`${link.progressionAddonId}::${link.columnId}`);
      if (opt) {
        const tableVal = opt.rowsByLevel.get(unlockValue);
        if (tableVal != null) return Math.floor(tableVal * multiplier);
      }
    }
    if (fallback != null) return multiplier !== 1 ? Math.floor(fallback * multiplier) : fallback;
    return undefined;
  };

  const effectiveMultiplier = addon.priceMultiplier ?? 1;
  const hasAnyProgressionLink = !!(
    addon.buyValueProgressionLink ||
    addon.minBuyValueProgressionLink ||
    addon.sellValueProgressionLink ||
    addon.maxSellValueProgressionLink
  );

  const buyEffectiveValue = useMemo(() => {
    if (addon.buyValueProgressionLink) {
      return resolveLinkedValue(addon.buyValueProgressionLink, addon.unlockValue, addon.buyValue, effectiveMultiplier);
    }
    return computeEffectiveValue(addon.buyValue, addon.buyModifiers || [], globalVariableByRefId, { min: addon.minBuyValue });
  }, [addon.buyValueProgressionLink, addon.unlockValue, addon.buyValue, addon.priceMultiplier, addon.buyModifiers, addon.minBuyValue, globalVariableByRefId, progressionColumnOptionByKey]);

  const sellEffectiveValue = useMemo(() => {
    if (addon.sellValueProgressionLink) {
      return resolveLinkedValue(addon.sellValueProgressionLink, addon.unlockValue, addon.sellValue, effectiveMultiplier);
    }
    const computed = computeEffectiveValue(addon.sellValue, addon.sellModifiers || [], globalVariableByRefId, { max: addon.maxSellValue });
    if (computed != null) return effectiveMultiplier !== 1 ? Math.floor(computed * effectiveMultiplier) : computed;
    if (addon.sellValue != null) return effectiveMultiplier !== 1 ? Math.floor(addon.sellValue * effectiveMultiplier) : addon.sellValue;
    return undefined;
  }, [addon.sellValueProgressionLink, addon.unlockValue, addon.sellValue, addon.priceMultiplier, addon.sellModifiers, addon.maxSellValue, globalVariableByRefId, progressionColumnOptionByKey]);

  useEffect(() => {
    if (addon.buyValueProgressionLink && buyEffectiveValue != null && buyEffectiveValue !== addon.buyValue) {
      commit({ buyValue: buyEffectiveValue });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyEffectiveValue, addon.buyValueProgressionLink]);

  useEffect(() => {
    if (addon.sellValueProgressionLink && sellEffectiveValue != null && sellEffectiveValue !== addon.sellValue) {
      commit({ sellValue: sellEffectiveValue });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellEffectiveValue, addon.sellValueProgressionLink]);

  const hasBuyBinding = Boolean(addon.buyValueSheetsRef);
  const hasSellBinding = Boolean(addon.sellValueSheetsRef);
  const hasAnyBinding = hasBuyBinding || hasSellBinding;

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-4">
        <div className={PANEL_BLOCK_CLASS}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wide text-gray-400">
              {t("economyLinkAddon.buyShortTitle", "Compra")}
            </h4>
            <div className="flex items-center">
              <ToggleSwitch
                checked={hasBuyConfig}
                onChange={(enabled) => {
                  commit(
                    enabled
                      ? { hasBuyConfig: true }
                      : {
                          hasBuyConfig: false,
                          buyCurrencyRef: undefined,
                          buyValue: undefined,
                          buyValueSheetsRef: undefined,
                          minBuyValue: undefined,
                          buyModifiers: [],
                        }
                  );
                }}
                ariaLabel={t("economyLinkAddon.hasBuyConfig", "Tem configuracao de compra")}
              />
            </div>
          </div>
          <div className="space-y-2">
            {hasBuyConfig && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs text-gray-400">{t("economyLinkAddon.buyCurrency", "Moeda de compra")}</span>
                  <select
                    value={
                      addon.buyCurrencyRef
                        ? buySelectedKnown
                          ? addon.buyCurrencyRef
                          : "__invalid__"
                        : ""
                    }
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === "__invalid__") return;
                      commit({ buyCurrencyRef: next || undefined });
                    }}
                    className={`${INPUT_CLASS} mb-2`}
                  >
                    <option value="">{t("economyLinkAddon.selectNone", "Sem referencia")}</option>
                    {addon.buyCurrencyRef && !buySelectedKnown && (
                      <option value="__invalid__">
                        {t("economyLinkAddon.invalidBuyCurrencyRef", "Referencia invalida (moeda nao encontrada)")}
                      </option>
                    )}
                    {currencyRefOptions.map((option) => (
                      <option key={option.refId} value={option.refId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <LinkedFieldRow
                    label={buyEffectiveValue != null ? `${t("economyLinkAddon.buyValue", "Valor de compra")}: ${formatDisplayNumber(buyEffectiveValue)}` : t("economyLinkAddon.buyValue", "Valor de compra")}
                    selectedKey={getLinkKey(addon.buyValueProgressionLink)}
                    options={linkedFieldOptions}
                    invalidLabelFallback={addon.buyValueProgressionLink?.columnName}
                    onChange={(opt) => handleLinkChange("buyValueProgressionLink", opt)}
                    badges={renderLevelBadges(buildLevelBadges(addon.buyValueProgressionLink, addon.priceMultiplier ?? 1), "buy-val")}
                    sheetsBinding={{
                      current: addon.buyValueSheetsRef,
                      onBind: (ref) => handleBindSheetsRef("buyValue", ref),
                      onUnbind: () => handleUnbindSheetsRef("buyValue"),
                    }}
                    spreadsheetRegistry={linkedSpreadsheets}
                  >
                    {hasBuyBinding ? (
                      <div className={`${INPUT_CLASS} cursor-not-allowed overflow-hidden truncate bg-gray-800/50 text-emerald-300`}>
                        {addon.buyValueSheetsRef!.cachedValue != null ? formatDisplayNumber(addon.buyValueSheetsRef!.cachedValue) : "—"}
                      </div>
                    ) : addon.buyValueProgressionLink ? (
                      <div className={`${INPUT_CLASS} cursor-not-allowed overflow-hidden truncate bg-gray-800/50 text-gray-400`}>
                        {buyEffectiveValue != null ? formatDisplayNumber(buyEffectiveValue) : "—"}
                      </div>
                    ) : (
                      <CommitOptionalNumberInput
                        value={addon.buyValue}
                        onCommit={(next) => commit({ buyValue: next })}
                        placeholder="0"
                        min={0}
                        integer
                        step={1}
                        className={INPUT_CLASS}
                      />
                    )}
                  </LinkedFieldRow>
                  <LinkedFieldRow
                    label={t("economyLinkAddon.minBuyValue", "Minimo de compra")}
                    selectedKey={getLinkKey(addon.minBuyValueProgressionLink)}
                    options={linkedFieldOptions}
                    invalidLabelFallback={addon.minBuyValueProgressionLink?.columnName}
                    onChange={(opt) => handleLinkChange("minBuyValueProgressionLink", opt)}
                    badges={renderLevelBadges(buildLevelBadges(addon.minBuyValueProgressionLink, addon.priceMultiplier ?? 1), "min-buy")}
                  >
                    {addon.minBuyValueProgressionLink ? (
                      <div className={`${INPUT_CLASS} cursor-not-allowed overflow-hidden truncate bg-gray-800/50 text-gray-400`}>
                        {resolveLinkedValue(addon.minBuyValueProgressionLink, addon.unlockValue, addon.minBuyValue, effectiveMultiplier) ?? "—"}
                      </div>
                    ) : (
                      <CommitOptionalNumberInput
                        value={addon.minBuyValue}
                        onCommit={(next) => commit({ minBuyValue: next })}
                        placeholder="0"
                        min={0}
                        integer
                        step={1}
                        className={INPUT_CLASS}
                      />
                    )}
                  </LinkedFieldRow>
                </div>
            <label className="block">
              <span className="mb-1 block text-xs text-gray-400">{t("economyLinkAddon.buyModifiers", "Variaveis de compra (refs, separadas por virgula)")}</span>
              {buyModifierOptions.length > 0 && (
                <div className="mb-2 max-h-28 space-y-1 overflow-auto rounded-lg border border-gray-700 bg-gray-900/40 p-2">
                  {buyModifierOptions.map((option) => {
                    const checked = (addon.buyModifiers || []).some((item) => item.refId === option.refId);
                    return (
                      <div key={option.refId} className="flex items-center gap-2 text-xs text-gray-300">
                        <ToggleSwitch
                          checked={checked}
                          onChange={(next) => toggleModifier("buyModifiers", option.refId, next)}
                          ariaLabel={option.label}
                        />
                        <a
                          href={getSectionUrl(option.projectId, option.sectionId)}
                          className="text-blue-300 hover:text-blue-200 underline"
                          title={t("economyLinkAddon.openVariableLinkTitle", "Abrir variavel global")}
                        >
                          {option.label}
                        </a>
                        {checked && formatModifierPreview(option.meta) && (
                          <span className="rounded border border-emerald-500/40 bg-emerald-900/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            {formatModifierPreview(option.meta)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </label>
              </>
            )}
          </div>
        </div>

        <div className={PANEL_BLOCK_CLASS}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wide text-gray-400">
              {t("economyLinkAddon.sellShortTitle", "Venda")}
            </h4>
            <div className="flex items-center">
              <ToggleSwitch
                checked={hasSellConfig}
                onChange={(enabled) => {
                  commit(
                    enabled
                      ? { hasSellConfig: true }
                      : {
                          hasSellConfig: false,
                          sellCurrencyRef: undefined,
                          sellValue: undefined,
                          sellValueSheetsRef: undefined,
                          maxSellValue: undefined,
                          sellModifiers: [],
                        }
                  );
                }}
                ariaLabel={t("economyLinkAddon.hasSellConfig", "Tem configuracao de venda")}
              />
            </div>
          </div>
          <div className="space-y-2">
            {hasSellConfig && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs text-gray-400">{t("economyLinkAddon.sellCurrency", "Moeda de venda")}</span>
                  <select
                    value={
                      addon.sellCurrencyRef
                        ? sellSelectedKnown
                          ? addon.sellCurrencyRef
                          : "__invalid__"
                        : ""
                    }
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === "__invalid__") return;
                      commit({ sellCurrencyRef: next || undefined });
                    }}
                    className={`${INPUT_CLASS} mb-2`}
                  >
                    <option value="">{t("economyLinkAddon.selectNone", "Sem referencia")}</option>
                    {addon.sellCurrencyRef && !sellSelectedKnown && (
                      <option value="__invalid__">
                        {t("economyLinkAddon.invalidSellCurrencyRef", "Referencia invalida (moeda nao encontrada)")}
                      </option>
                    )}
                    {currencyRefOptions.map((option) => (
                      <option key={option.refId} value={option.refId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <LinkedFieldRow
                    label={sellEffectiveValue != null ? `${t("economyLinkAddon.sellValue", "Valor de venda")}: ${formatDisplayNumber(sellEffectiveValue)}` : t("economyLinkAddon.sellValue", "Valor de venda")}
                    selectedKey={getLinkKey(addon.sellValueProgressionLink)}
                    options={linkedFieldOptions}
                    invalidLabelFallback={addon.sellValueProgressionLink?.columnName}
                    onChange={(opt) => handleLinkChange("sellValueProgressionLink", opt)}
                    badges={renderLevelBadges(buildLevelBadges(addon.sellValueProgressionLink, addon.priceMultiplier ?? 1), "sell-val")}
                    sheetsBinding={{
                      current: addon.sellValueSheetsRef,
                      onBind: (ref) => handleBindSheetsRef("sellValue", ref),
                      onUnbind: () => handleUnbindSheetsRef("sellValue"),
                    }}
                    spreadsheetRegistry={linkedSpreadsheets}
                  >
                    {hasSellBinding ? (
                      <div className={`${INPUT_CLASS} cursor-not-allowed overflow-hidden truncate bg-gray-800/50 text-emerald-300`}>
                        {addon.sellValueSheetsRef!.cachedValue != null ? formatDisplayNumber(addon.sellValueSheetsRef!.cachedValue) : "—"}
                      </div>
                    ) : addon.sellValueProgressionLink ? (
                      <div className={`${INPUT_CLASS} cursor-not-allowed overflow-hidden truncate bg-gray-800/50 text-gray-400`}>
                        {sellEffectiveValue != null ? formatDisplayNumber(sellEffectiveValue) : "—"}
                      </div>
                    ) : (
                      <CommitOptionalNumberInput
                        value={addon.sellValue}
                        onCommit={(next) => commit({ sellValue: next })}
                        placeholder="0"
                        min={0}
                        integer
                        step={1}
                        className={INPUT_CLASS}
                      />
                    )}
                  </LinkedFieldRow>
                  <LinkedFieldRow
                    label={t("economyLinkAddon.maxSellValue", "Maximo de venda")}
                    selectedKey={getLinkKey(addon.maxSellValueProgressionLink)}
                    options={linkedFieldOptions}
                    invalidLabelFallback={addon.maxSellValueProgressionLink?.columnName}
                    onChange={(opt) => handleLinkChange("maxSellValueProgressionLink", opt)}
                    badges={renderLevelBadges(buildLevelBadges(addon.maxSellValueProgressionLink, addon.priceMultiplier ?? 1), "max-sell")}
                  >
                    {addon.maxSellValueProgressionLink ? (
                      <div className={`${INPUT_CLASS} cursor-not-allowed overflow-hidden truncate bg-gray-800/50 text-gray-400`}>
                        {resolveLinkedValue(addon.maxSellValueProgressionLink, addon.unlockValue, addon.maxSellValue, effectiveMultiplier) ?? "—"}
                      </div>
                    ) : (
                      <CommitOptionalNumberInput
                        value={addon.maxSellValue}
                        onCommit={(next) => commit({ maxSellValue: next })}
                        placeholder="0"
                        min={0}
                        integer
                        step={1}
                        className={INPUT_CLASS}
                      />
                    )}
                  </LinkedFieldRow>
                </div>
            <label className="block">
              {sellModifierOptions.length > 0 && (
                <div className="mb-2 max-h-28 space-y-1 overflow-auto rounded-lg border border-gray-700 bg-gray-900/40 p-2">
                  {sellModifierOptions.map((option) => {
                    const checked = (addon.sellModifiers || []).some((item) => item.refId === option.refId);
                    return (
                      <div key={option.refId} className="flex items-center gap-2 text-xs text-gray-300">
                        <ToggleSwitch
                          checked={checked}
                          onChange={(next) => toggleModifier("sellModifiers", option.refId, next)}
                          ariaLabel={option.label}
                        />
                        <a
                          href={getSectionUrl(option.projectId, option.sectionId)}
                          className="text-blue-300 hover:text-blue-200 underline"
                          title={t("economyLinkAddon.openVariableLinkTitle", "Abrir variavel global")}
                        >
                          {option.label}
                        </a>
                        {checked && formatModifierPreview(option.meta) && (
                          <span className="rounded border border-emerald-500/40 bg-emerald-900/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            {formatModifierPreview(option.meta)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </label>
              </>
            )}
          </div>
        </div>
        {(addon.buyValueProgressionLink || addon.minBuyValueProgressionLink || addon.sellValueProgressionLink || addon.maxSellValueProgressionLink) && (
          <div className={PANEL_BLOCK_CLASS}>
            <h4 className="mb-2 text-xs uppercase tracking-wide text-gray-400">
              {t("economyLinkAddon.priceMultiplierTitle", "Multiplicador de Preço")}
            </h4>
            <div className="grid gap-2 sm:grid-cols-2 items-end">
              <label className="block">
                <span className="mb-1 block text-xs text-gray-400">
                  {t("economyLinkAddon.priceMultiplierLabel", "Multiplicador")}
                  {addon.priceMultiplier != null && addon.priceMultiplier !== 1
                    ? ` (×${formatDisplayNumber(addon.priceMultiplier)})`
                    : ` (${t("economyLinkAddon.priceMultiplierDefault", "padrão: ×1")})`}
                </span>
                <CommitNumberInput
                  value={addon.priceMultiplier ?? 1}
                  onCommit={(next) => commit({ priceMultiplier: next === 1 ? undefined : next })}
                  min={0.01}
                  step={0.05}
                  className={INPUT_CLASS}
                />
              </label>
              <p className="text-[11px] text-gray-500 pb-2">
                Aplica um fator a todos os valores de compra e venda (tabela ou fixo). Use para diferenciar itens na mesma curva global.
              </p>
            </div>
          </div>
        )}

        <div className={PANEL_BLOCK_CLASS}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wide text-gray-400">
              {t("economyLinkAddon.unlockTitle", "Desbloqueio")}
            </h4>
            <ToggleSwitch
              checked={hasUnlockConfig}
              onChange={(enabled) =>
                commit(
                  enabled
                    ? { hasUnlockConfig: true }
                    : {
                        hasUnlockConfig: false,
                        unlockRef: undefined,
                        unlockValue: undefined,
                      }
                )
              }
              ariaLabel={t("economyLinkAddon.hasUnlockConfig", "Tem configuracao de desbloqueio")}
            />
          </div>
          <div className="space-y-2">
            {hasUnlockConfig && (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-gray-400">{t("economyLinkAddon.unlockRef", "Pagina de XP")}</span>
                    <select
                      value={
                        addon.unlockRef
                          ? unlockSelectedKnown
                            ? addon.unlockRef
                            : "__invalid__"
                          : ""
                      }
                      onChange={(event) => {
                        const next = event.target.value;
                        if (next === "__invalid__") return;
                        const nextRef = next || undefined;
                        const xp = nextRef ? xpRefOptions.find((item) => item.refId === nextRef) : undefined;
                        const min = xp?.minLevel;
                        const max = xp?.maxLevel;
                        const clampedUnlockValue =
                          addon.unlockValue == null
                            ? addon.unlockValue
                            : clampInteger(addon.unlockValue, min, max);
                        commit({ unlockRef: nextRef, unlockValue: clampedUnlockValue });
                      }}
                      className={INPUT_CLASS}
                    >
                      <option value="">{t("economyLinkAddon.selectNone", "Sem referencia")}</option>
                      {addon.unlockRef && !unlockSelectedKnown && (
                        <option value="__invalid__">
                          {t("economyLinkAddon.invalidUnlockRef", "Referencia invalida (nao encontrada em paginas com addon de XP)")}
                        </option>
                      )}
                      {xpRefOptions.map((option) => (
                        <option key={option.refId} value={option.refId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {xpRefOptions.length === 0 && (
                      <p className="mt-1 text-[11px] text-amber-300">
                        {t("economyLinkAddon.noXpPages", "Nenhuma pagina com addon de XP encontrada.")}
                      </p>
                    )}
                  </label>
                  <LinkedFieldRow
                    label={t("economyLinkAddon.unlockValue", "LV de desbloqueio")}
                    selectedKey=""
                    options={[]}
                    onChange={() => {}}
                    hint={
                      unlockSelectedKnown && unlockBounds.min != null && unlockBounds.max != null
                        ? `${t("economyLinkAddon.unlockRangeLabel", "LV permitido")}: ${unlockBounds.min}-${unlockBounds.max}`
                        : undefined
                    }
                    sheetsBinding={{
                      current: addon.unlockValueSheetsRef,
                      onBind: (ref) => handleBindSheetsRef("unlockValue", ref),
                      onUnbind: () => handleUnbindSheetsRef("unlockValue"),
                    }}
                    spreadsheetRegistry={linkedSpreadsheets}
                  >
                    <CommitOptionalNumberInput
                      value={addon.unlockValue}
                      onCommit={(next) =>
                        commit({
                          unlockValue:
                            next == null ? undefined : clampInteger(next, unlockBounds.min, unlockBounds.max),
                        })
                      }
                      placeholder="0"
                      min={unlockBounds.min ?? 0}
                      max={unlockBounds.max}
                      integer
                      step={1}
                      className={INPUT_CLASS}
                      readOnly={!!addon.unlockValueSheetsRef}
                    />
                  </LinkedFieldRow>
                </div>
                {hasAnyProgressionLink && (
                  <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-900/20 px-3 py-2 text-xs text-blue-200">
                    <span className="mt-0.5 shrink-0">ℹ</span>
                    <span>
                      {t("economyLinkAddon.unlockProgressionHint", "Este nível está sendo usado como índice nas curvas de preço vinculadas. Altere o nível para ver os valores atualizados automaticamente.")}
                    </span>
                  </div>
                )}
              </>
            )}
            {hasAnyProgressionLink && !hasUnlockConfig && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>
                  {t("economyLinkAddon.unlockProgressionWarning", "Há curvas de preço vinculadas, mas o Desbloqueio está desativado. Ative-o e defina um nível para que os vínculos possam resolver os valores.")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {validationMessages.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-700/60 bg-amber-900/20 p-3 text-xs text-amber-200">
          {validationMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {hasAnyBinding && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex-1">
            {syncError && (
              <p className="text-xs text-rose-400">{syncError}</p>
            )}
            {!syncError && (
              <p className="text-xs text-gray-500">
                {addon.buyValueSheetsRef?.syncedAt || addon.sellValueSheetsRef?.syncedAt
                  ? `Última sync: ${formatSyncedAt(addon.buyValueSheetsRef?.syncedAt ?? addon.sellValueSheetsRef?.syncedAt ?? null)}`
                  : "Ainda não sincronizado"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSyncSheets}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-900/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
          >
            <SheetsIcon className="h-3.5 w-3.5" />
            {syncing ? "Sincronizando..." : "Sincronizar Sheets"}
          </button>
        </div>
      )}

    </section>
  );
}
