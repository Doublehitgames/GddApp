"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProductionAddonDraft, CraftTableSectionAddon, CraftTableEntry, SectionAddon } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { CommitNumberInput, CommitOptionalNumberInput } from "@/components/common/CommitInput";
import { LinkedFieldRow, type LinkedFieldOption } from "@/components/common/LinkedFieldRow";
import { openQuickNewPage } from "@/components/QuickNewPageModal";

interface ProductionAddonPanelProps {
  addon: ProductionAddonDraft;
  onChange: (next: ProductionAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";
const BUTTON_TINY_CLASS = "rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-gray-100 hover:bg-gray-700";

type ProgressionColumnOption = {
  key: string;
  progressionAddonId: string;
  columnId: string;
  columnName: string;
  isPercentage: boolean;
  label: string;
  startLevel: number;
  endLevel: number;
  rowsByLevel: Map<number, number | string>;
};

function toSecondsLabel(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "n/a";
  return `${Math.max(0, Math.floor(parsed))}s`;
}

function toQuantityLabel(value: unknown): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "n/a";
  return String(Math.max(0, Math.floor(parsed)));
}

function computeLinkedValue(
  baseValue: number | undefined,
  columnValue: unknown,
  isPercentage: boolean
): number | undefined {
  if (baseValue == null || !Number.isFinite(baseValue)) return undefined;
  const modifier = Number(columnValue);
  if (!Number.isFinite(modifier)) return undefined;
  const next = isPercentage
    ? baseValue + (baseValue * modifier) / 100
    : baseValue + modifier;
  return Math.max(0, Math.floor(next));
}

export function ProductionAddonPanel({ addon, onChange, onRemove }: ProductionAddonPanelProps) {
  const { t } = useI18n();
  const allProjects = useProjectStore((state) => state.projects);
  const updateSectionAddon = useProjectStore((state) => state.updateSectionAddon);
  const currentProjectId = useCurrentProjectId();
  const projects = useMemo(
    () => (currentProjectId ? allProjects.filter((p) => p.id === currentProjectId) : allProjects),
    [allProjects, currentProjectId]
  );
  const { user, profile } = useAuthStore();
  const sectionAuditBy = user
    ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null }
    : undefined;

  const ownerLocation = useMemo(() => {
    for (const p of projects) {
      for (const s of p.sections || []) {
        for (const a of s.addons || []) {
          if (a.id === addon.id && a.type === "production") {
            return { projectId: p.id, sectionId: s.id };
          }
        }
      }
    }
    return null;
  }, [projects, addon.id]);

  const craftTables = useMemo(() => {
    if (!ownerLocation) return [] as Array<{
      sectionId: string;
      sectionTitle: string;
      addonId: string;
      addonName: string;
      addon: CraftTableSectionAddon;
    }>;
    const project = projects.find((p) => p.id === ownerLocation.projectId);
    if (!project) return [];
    const out: Array<{
      sectionId: string;
      sectionTitle: string;
      addonId: string;
      addonName: string;
      addon: CraftTableSectionAddon;
    }> = [];
    for (const s of project.sections || []) {
      for (const a of s.addons || []) {
        if (a.type !== "craftTable") continue;
        out.push({
          sectionId: s.id,
          sectionTitle: s.title || s.id,
          addonId: a.id,
          addonName: a.name || a.data.name || "Mesa",
          addon: a,
        });
      }
    }
    return out;
  }, [ownerLocation, projects]);

  const linkedTableKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!ownerLocation) return keys;
    for (const ct of craftTables) {
      const hasRef = (ct.addon.data.entries || []).some(
        (entry) => entry.productionRef === ownerLocation.sectionId
      );
      if (hasRef) keys.add(`${ct.sectionId}:${ct.addonId}`);
    }
    return keys;
  }, [craftTables, ownerLocation]);

  const toggleCraftTableLink = (tableSectionId: string, tableAddonId: string, link: boolean) => {
    if (!ownerLocation) return;
    const target = craftTables.find((ct) => ct.sectionId === tableSectionId && ct.addonId === tableAddonId);
    if (!target) return;
    const currentEntries = target.addon.data.entries || [];
    const newEntryId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextEntries: CraftTableEntry[] = link
      ? (() => {
          if (currentEntries.some((e) => e.productionRef === ownerLocation.sectionId)) return currentEntries;
          const appended: CraftTableEntry = {
            id: newEntryId,
            productionRef: ownerLocation.sectionId,
            order: currentEntries.length,
          };
          return [...currentEntries, appended];
        })()
      : currentEntries
          .filter((e) => e.productionRef !== ownerLocation.sectionId)
          .map((e, index) => ({ ...e, order: index }));
    if (nextEntries === currentEntries) return;
    const nextAddon: SectionAddon = {
      ...target.addon,
      data: { ...target.addon.data, entries: nextEntries },
    };
    updateSectionAddon(ownerLocation.projectId, target.sectionId, target.addonId, nextAddon, sectionAuditBy);
  };

  const [pendingAnchorNavigation, setPendingAnchorNavigation] = useState<
    { sectionId: string; title: string; shortDescription: string } | null
  >(null);
  const anchorPreviewCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingAnchorNavigation) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (anchorPreviewCardRef.current?.contains(event.target as Node)) return;
      setPendingAnchorNavigation(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingAnchorNavigation(null);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingAnchorNavigation]);

  const navigateToDocumentAnchor = (sectionId: string) => {
    const targetId = `section-${sectionId}`;
    const targetElement =
      (document.getElementById(targetId) as HTMLElement | null) ||
      (document.querySelector(`[data-section-anchor="${sectionId}"]`) as HTMLElement | null);
    if (!targetElement) {
      const match = window.location.pathname.match(/\/projects\/([^/]+)/);
      if (match) window.location.href = `/projects/${match[1]}/sections/${sectionId}`;
      return;
    }
    const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - 180;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    window.history.replaceState(null, "", `#${targetId}`);
    targetElement.classList.add("gdd-anchor-highlight");
    window.setTimeout(() => targetElement.classList.remove("gdd-anchor-highlight"), 1800);
  };

  const toShortDescription = (raw: string): string => {
    const plain = (raw || "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[#>*`~_-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain) return "";
    return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
  };

  const inventoryOptions = useMemo(() => {
    const out: Array<{ projectId: string; sectionId: string; label: string }> = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        const hasInventory = (section.addons || []).some((item) => item.type === "inventory");
        if (!hasInventory) continue;
        if (seen.has(section.id)) continue;
        seen.add(section.id);
        out.push({
          projectId: project.id,
          sectionId: section.id,
          label: section.title || section.id,
        });
      }
    }
    return out;
  }, [projects]);

  const selectedOutputOption = useMemo(
    () => inventoryOptions.find((option) => option.sectionId === addon.outputRef),
    [addon.outputRef, inventoryOptions]
  );
  const inventoryBySectionId = useMemo(() => {
    const map = new Map<string, { projectId: string; sectionId: string; label: string }>();
    for (const option of inventoryOptions) {
      if (!map.has(option.sectionId)) map.set(option.sectionId, option);
    }
    return map;
  }, [inventoryOptions]);

  const currentSection = useMemo(() => {
    for (const project of projects) {
      for (const section of project.sections || []) {
        const found = (section.addons || []).some(
          (item) =>
            item.type === "production" && (item.id === addon.id || item.data?.id === addon.id)
        );
        if (found) return section;
      }
    }
    return undefined;
  }, [addon.id, projects]);

  const craftTableReferences = useMemo(() => {
    if (!currentSection) return [] as Array<{ projectId: string; sectionId: string; label: string }>;
    const refs: Array<{ projectId: string; sectionId: string; label: string }> = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "craftTable") continue;
          const uses = (sectionAddon.data.entries || []).some(
            (entry) => entry.productionRef === currentSection.id
          );
          if (!uses) continue;
          if (seen.has(section.id)) continue;
          seen.add(section.id);
          refs.push({
            projectId: project.id,
            sectionId: section.id,
            label: sectionAddon.name?.trim() || section.title?.trim() || section.id,
          });
        }
      }
    }
    return refs;
  }, [currentSection, projects]);

  const progressionColumnOptions = useMemo(() => {
    const out: ProgressionColumnOption[] = [];
    if (!currentSection) return out;
    for (const sectionAddon of currentSection.addons || []) {
      if (sectionAddon.type !== "progressionTable") continue;
      const progressionAddonName = sectionAddon.name?.trim() || sectionAddon.data.name?.trim() || "Progression";
      const startLevel = Math.max(1, Math.floor(sectionAddon.data.startLevel || 1));
      const endLevel = Math.max(startLevel, Math.floor(sectionAddon.data.endLevel || startLevel));
      for (const column of sectionAddon.data.columns || []) {
        out.push({
          key: `${sectionAddon.id}::${column.id}`,
          progressionAddonId: sectionAddon.id,
          columnId: column.id,
          columnName: column.name || column.id,
          isPercentage: Boolean(column.isPercentage),
          label: `${progressionAddonName} - ${column.name || column.id}`,
          startLevel,
          endLevel,
          rowsByLevel: new Map(
            (sectionAddon.data.rows || []).map((row) => [row.level, row.values?.[column.id] ?? 0])
          ),
        });
      }
    }
    return out;
  }, [currentSection]);

  const progressionColumnOptionByKey = useMemo(() => {
    const map = new Map<string, ProgressionColumnOption>();
    for (const option of progressionColumnOptions) map.set(option.key, option);
    return map;
  }, [progressionColumnOptions]);

  const minOutputSelectedKey = addon.minOutputProgressionLink
    ? `${addon.minOutputProgressionLink.progressionAddonId}::${addon.minOutputProgressionLink.columnId}`
    : "";
  const maxOutputSelectedKey = addon.maxOutputProgressionLink
    ? `${addon.maxOutputProgressionLink.progressionAddonId}::${addon.maxOutputProgressionLink.columnId}`
    : "";
  const intervalSelectedKey = addon.intervalSecondsProgressionLink
    ? `${addon.intervalSecondsProgressionLink.progressionAddonId}::${addon.intervalSecondsProgressionLink.columnId}`
    : "";
  const craftSelectedKey = addon.craftTimeSecondsProgressionLink
    ? `${addon.craftTimeSecondsProgressionLink.progressionAddonId}::${addon.craftTimeSecondsProgressionLink.columnId}`
    : "";
  const capacitySelectedKey = addon.capacityProgressionLink
    ? `${addon.capacityProgressionLink.progressionAddonId}::${addon.capacityProgressionLink.columnId}`
    : "";
  const minOutputSelectedOption = minOutputSelectedKey ? progressionColumnOptionByKey.get(minOutputSelectedKey) : undefined;
  const maxOutputSelectedOption = maxOutputSelectedKey ? progressionColumnOptionByKey.get(maxOutputSelectedKey) : undefined;
  const intervalSelectedOption = intervalSelectedKey ? progressionColumnOptionByKey.get(intervalSelectedKey) : undefined;
  const craftSelectedOption = craftSelectedKey ? progressionColumnOptionByKey.get(craftSelectedKey) : undefined;
  const capacitySelectedOption = capacitySelectedKey ? progressionColumnOptionByKey.get(capacitySelectedKey) : undefined;

  const buildLevelBadges = (
    option: ProgressionColumnOption | undefined,
    baseValue: number | undefined,
    formatter: (value: unknown) => string
  ) => {
    if (!option) return null;
    const minLevel = option.startLevel;
    const maxLevel = option.endLevel;
    const midLevel = Math.floor((minLevel + maxLevel) / 2);
    return [
      {
        value: formatter(computeLinkedValue(baseValue, option.rowsByLevel.get(minLevel), option.isPercentage)),
        level: minLevel,
      },
      {
        value: formatter(computeLinkedValue(baseValue, option.rowsByLevel.get(midLevel), option.isPercentage)),
        level: midLevel,
      },
      {
        value: formatter(computeLinkedValue(baseValue, option.rowsByLevel.get(maxLevel), option.isPercentage)),
        level: maxLevel,
      },
    ];
  };

  const minOutputLevelBadges = buildLevelBadges(minOutputSelectedOption, addon.minOutput, toQuantityLabel);
  const maxOutputLevelBadges = buildLevelBadges(maxOutputSelectedOption, addon.maxOutput, toQuantityLabel);
  const intervalLevelBadges = buildLevelBadges(intervalSelectedOption, addon.intervalSeconds, toSecondsLabel);
  const craftLevelBadges = buildLevelBadges(craftSelectedOption, addon.craftTimeSeconds, toSecondsLabel);
  const capacityLevelBadges = buildLevelBadges(capacitySelectedOption, addon.capacity, toQuantityLabel);

  const linkedFieldOptions = useMemo<LinkedFieldOption[]>(
    () =>
      progressionColumnOptions.map((option) => ({
        key: option.key,
        label: option.label,
      })),
    [progressionColumnOptions]
  );

  const renderLevelBadges = (
    badges: ReturnType<typeof buildLevelBadges>,
    keyPrefix: string
  ): ReactNode => {
    if (!badges) return null;
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {badges.map((badge) => (
          <span
            key={`${keyPrefix}-lv-${badge.level}`}
            className="rounded-full border border-gray-500 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-100"
          >
            Lv{badge.level}: {badge.value}
          </span>
        ))}
      </div>
    );
  };

  const handleLinkChange = (
    field:
      | "minOutputProgressionLink"
      | "maxOutputProgressionLink"
      | "intervalSecondsProgressionLink"
      | "craftTimeSecondsProgressionLink"
      | "capacityProgressionLink",
    option: LinkedFieldOption | undefined
  ) => {
    if (!option) {
      commit({ [field]: undefined } as Partial<ProductionAddonDraft>);
      return;
    }
    const found = progressionColumnOptions.find((o) => o.key === option.key);
    if (!found) return;
    commit({
      [field]: {
        progressionAddonId: found.progressionAddonId,
        columnId: found.columnId,
        columnName: found.columnName,
      },
    } as Partial<ProductionAddonDraft>);
  };

  const renderEmptyOptionsCta = (): ReactNode => (
    <button
      type="button"
      onClick={openQuickNewPage}
      className="inline-flex items-center gap-1 rounded-md border border-indigo-400/50 bg-indigo-600/20 px-2 py-1 text-[11px] font-medium text-indigo-100 hover:bg-indigo-600/30"
    >
      <span aria-hidden="true">+</span>
      <span>{t("productionAddon.createProgressionPageCta", "Criar página com progressão")}</span>
    </button>
  );

  const renderInventoryEmptyHint = (): ReactNode => (
    <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
      <span>
        {t(
          "productionAddon.inventoryEmptyHint",
          "Nenhuma página com Inventário neste projeto. Crie uma página de Itens primeiro."
        )}
      </span>
      <button
        type="button"
        onClick={openQuickNewPage}
        className="inline-flex items-center gap-1 rounded-md border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-50 hover:bg-amber-500/30"
      >
        <span aria-hidden="true">+</span>
        <span>{t("productionAddon.createItemsPageCta", "Criar página de Itens")}</span>
      </button>
    </div>
  );

  const commit = (patch: Partial<ProductionAddonDraft>) => {
    const next: ProductionAddonDraft = {
      ...addon,
      ...patch,
    };
    next.ingredients = Array.isArray(next.ingredients) ? next.ingredients : [];
    next.outputs = Array.isArray(next.outputs) ? next.outputs : [];
    onChange(next);
  };

  const updateIngredient = (index: number, patch: Partial<{ itemRef: string; quantity: number }>) => {
    const next = [...(addon.ingredients || [])];
    const current = next[index] || { itemRef: "", quantity: 1 };
    next[index] = {
      itemRef: patch.itemRef ?? current.itemRef,
      quantity: patch.quantity ?? current.quantity,
    };
    commit({ ingredients: next });
  };

  const updateOutput = (index: number, patch: Partial<{ itemRef: string; quantity: number }>) => {
    const next = [...(addon.outputs || [])];
    const current = next[index] || { itemRef: "", quantity: 1 };
    next[index] = {
      itemRef: patch.itemRef ?? current.itemRef,
      quantity: patch.quantity ?? current.quantity,
    };
    commit({ outputs: next });
  };

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
            {t("productionAddon.modeLabel", "Modo de producao")}
          </span>
          <select
            value={addon.mode}
            onChange={(event) => commit({ mode: event.target.value as ProductionAddonDraft["mode"] })}
            className={INPUT_CLASS}
          >
            <option value="passive">{t("productionAddon.mode.passive", "Passiva")}</option>
            <option value="recipe">{t("productionAddon.mode.recipe", "Receita")}</option>
          </select>
        </label>

        {ownerLocation && (
          <div className={PANEL_BLOCK_CLASS}>
            <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">
              {t("productionAddon.craftTablesBlockLabel", "Mesas de produção associadas")}
            </p>
            {craftTables.length === 0 ? (
              <p className="text-xs text-gray-400">
                {t(
                  "productionAddon.craftTablesEmpty",
                  "Nenhuma Mesa de Produção criada neste projeto ainda. Crie uma para registrar esta receita nela."
                )}
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-gray-400">
                  {t(
                    "productionAddon.craftTablesHint",
                    "Marque as mesas onde esta receita deve aparecer. A mesa passa a listar esta receita automaticamente."
                  )}
                </p>
                <ul className="space-y-1.5">
                  {craftTables.map((ct) => {
                    const key = `${ct.sectionId}:${ct.addonId}`;
                    const checked = linkedTableKeys.has(key);
                    return (
                      <li key={key}>
                        <label className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 px-2.5 py-1.5 hover:border-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleCraftTableLink(ct.sectionId, ct.addonId, e.target.checked)}
                            className="h-4 w-4 accent-indigo-500"
                          />
                          <span className="flex-1 text-sm text-gray-200">
                            {ct.sectionTitle}
                            {ct.addonName && ct.addonName !== ct.sectionTitle ? (
                              <span className="ml-1 text-xs text-gray-500">— {ct.addonName}</span>
                            ) : null}
                          </span>
                          <a
                            href={`/projects/${ownerLocation.projectId}/sections/${ct.sectionId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-indigo-300 hover:text-indigo-200"
                            title={t("productionAddon.openCraftTable", "Abrir mesa de produção")}
                          >
                            ↗
                          </a>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {addon.mode === "passive" && (
          <div className={PANEL_BLOCK_CLASS}>
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 flex items-center justify-between text-xs text-gray-400">
                  <span>{t("productionAddon.outputRefLabel", "Item produzido")}</span>
                  {selectedOutputOption ? (
                    <a
                      href={`/projects/${selectedOutputOption.projectId}/sections/${selectedOutputOption.sectionId}`}
                      className="text-blue-300 hover:text-blue-200 underline"
                      title={t("productionAddon.openItemLinkTitle", "Abrir pagina do item")}
                      aria-label={t("productionAddon.openItemLinkLabel", "Abrir item")}
                    >
                      ↗
                    </a>
                  ) : null}
                </span>
                <select
                  value={addon.outputRef || ""}
                  onChange={(event) => commit({ outputRef: event.target.value || undefined })}
                  className={INPUT_CLASS}
                  disabled={inventoryOptions.length === 0}
                >
                  <option value="">{t("productionAddon.selectNone", "Sem referencia")}</option>
                  {inventoryOptions.map((option) => (
                    <option key={option.sectionId} value={option.sectionId}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {inventoryOptions.length === 0 ? renderInventoryEmptyHint() : null}
              </label>

              <div className="space-y-2">
                <LinkedFieldRow
                  label={t("productionAddon.minOutputLabel", "Qtd minima")}
                  selectedKey={minOutputSelectedKey}
                  options={linkedFieldOptions}
                  invalidLabelFallback={addon.minOutputProgressionLink?.columnName}
                  onChange={(option) => handleLinkChange("minOutputProgressionLink", option)}
                  emptyStateCta={renderEmptyOptionsCta()}
                  badges={renderLevelBadges(minOutputLevelBadges, "min-output")}
                >
                  <CommitOptionalNumberInput
                    value={addon.minOutput}
                    onCommit={(next) => commit({ minOutput: next })}
                    min={0}
                    step={1}
                    integer
                    className={INPUT_CLASS}
                  />
                </LinkedFieldRow>
                <LinkedFieldRow
                  label={t("productionAddon.maxOutputLabel", "Qtd maxima")}
                  selectedKey={maxOutputSelectedKey}
                  options={linkedFieldOptions}
                  invalidLabelFallback={addon.maxOutputProgressionLink?.columnName}
                  onChange={(option) => handleLinkChange("maxOutputProgressionLink", option)}
                  emptyStateCta={renderEmptyOptionsCta()}
                  badges={renderLevelBadges(maxOutputLevelBadges, "max-output")}
                >
                  <CommitOptionalNumberInput
                    value={addon.maxOutput}
                    onCommit={(next) => commit({ maxOutput: next })}
                    min={0}
                    step={1}
                    integer
                    className={INPUT_CLASS}
                  />
                </LinkedFieldRow>
              </div>
              <LinkedFieldRow
                label={t("productionAddon.intervalSecondsLabel", "Tempo (segundos)")}
                selectedKey={intervalSelectedKey}
                options={linkedFieldOptions}
                invalidLabelFallback={addon.intervalSecondsProgressionLink?.columnName}
                onChange={(option) => handleLinkChange("intervalSecondsProgressionLink", option)}
                emptyStateCta={renderEmptyOptionsCta()}
                badges={renderLevelBadges(intervalLevelBadges, "interval")}
              >
                <CommitOptionalNumberInput
                  value={addon.intervalSeconds}
                  onCommit={(next) => commit({ intervalSeconds: next })}
                  min={0}
                  step={1}
                  integer
                  className={INPUT_CLASS}
                />
              </LinkedFieldRow>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
                  <span className="mb-1 block text-xs text-gray-400">{t("productionAddon.requiresCollectionLabel", "Requer coleta manual")}</span>
                  <ToggleSwitch
                    checked={Boolean(addon.requiresCollection)}
                    onChange={(next) => commit({ requiresCollection: next })}
                    ariaLabel={t("productionAddon.requiresCollectionLabel", "Requer coleta manual")}
                  />
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
                  <LinkedFieldRow
                    label={t("productionAddon.capacityLabel", "Capacidade maxima")}
                    selectedKey={capacitySelectedKey}
                    options={linkedFieldOptions}
                    invalidLabelFallback={addon.capacityProgressionLink?.columnName}
                    onChange={(option) => handleLinkChange("capacityProgressionLink", option)}
                    emptyStateCta={renderEmptyOptionsCta()}
                    badges={renderLevelBadges(capacityLevelBadges, "capacity")}
                  >
                    <CommitOptionalNumberInput
                      value={addon.capacity}
                      onCommit={(next) => commit({ capacity: next })}
                      min={0}
                      step={1}
                      integer
                      className={INPUT_CLASS}
                    />
                  </LinkedFieldRow>
                </div>
              </div>
            </div>
          </div>
        )}

        {addon.mode === "recipe" && craftTableReferences.length > 0 && (
          <div className={`${PANEL_BLOCK_CLASS} text-xs text-gray-300`}>
            {t("productionAddon.producedOn", "Produzida na mesa")}:{" "}
            {craftTableReferences.map((ref, index) => (
              <span key={ref.sectionId}>
                {index > 0 ? ", " : ""}
                <a
                  href={`#section-${ref.sectionId}`}
                  onClick={(event) => {
                    event.preventDefault();
                    const project = projects.find((p) => p.id === ref.projectId);
                    const section = project?.sections?.find((s) => s.id === ref.sectionId);
                    setPendingAnchorNavigation({
                      sectionId: ref.sectionId,
                      title: section?.title || ref.label,
                      shortDescription: toShortDescription(section?.content || ""),
                    });
                  }}
                  className="gdd-inline-anchor underline cursor-pointer text-sky-300 hover:text-sky-200"
                  title={t("view.anchorPreview.goToSection", "Ir para a seção")}
                >
                  {ref.label}
                </a>
              </span>
            ))}
          </div>
        )}

        {addon.mode === "recipe" && (
          <div className={PANEL_BLOCK_CLASS}>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-gray-400">{t("productionAddon.ingredientsLabel", "Ingredientes")}</span>
                  <button
                    type="button"
                    onClick={() => commit({ ingredients: [...(addon.ingredients || []), { itemRef: "", quantity: 1 }] })}
                    className={BUTTON_TINY_CLASS}
                    disabled={inventoryOptions.length === 0}
                  >
                    {t("productionAddon.addIngredientButton", "+ Ingrediente")}
                  </button>
                </div>
                {inventoryOptions.length === 0 ? renderInventoryEmptyHint() : null}
                <div className="space-y-2">
                  {(addon.ingredients || []).map((ingredient, index) => (
                    <div key={`ingredient-${index}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                      <div className="flex items-center gap-2">
                        <select
                          value={ingredient.itemRef}
                          onChange={(event) => updateIngredient(index, { itemRef: event.target.value })}
                          className={INPUT_CLASS}
                        >
                          <option value="">{t("productionAddon.selectNone", "Sem referencia")}</option>
                          {inventoryOptions.map((option) => (
                            <option key={option.sectionId} value={option.sectionId}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {ingredient.itemRef && inventoryBySectionId.get(ingredient.itemRef) ? (
                          <a
                            href={`/projects/${inventoryBySectionId.get(ingredient.itemRef)?.projectId}/sections/${inventoryBySectionId.get(ingredient.itemRef)?.sectionId}`}
                            className="text-blue-300 hover:text-blue-200 underline text-xs whitespace-nowrap"
                            title={t("productionAddon.openItemLinkTitle", "Abrir pagina do item")}
                            aria-label={t("productionAddon.openItemLinkLabel", "Abrir item")}
                          >
                            ↗
                          </a>
                        ) : null}
                      </div>
                      <CommitNumberInput
                        value={ingredient.quantity}
                        onCommit={(next) => updateIngredient(index, { quantity: next })}
                        min={1}
                        step={1}
                        integer
                        className={INPUT_CLASS}
                      />
                      <button
                        type="button"
                        onClick={() => commit({ ingredients: (addon.ingredients || []).filter((_, itemIndex) => itemIndex !== index) })}
                        className={BUTTON_DANGER_CLASS}
                      >
                        {t("common.remove", "Remover")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-gray-400">{t("productionAddon.outputsLabel", "Saidas")}</span>
                  <button
                    type="button"
                    onClick={() => commit({ outputs: [...(addon.outputs || []), { itemRef: "", quantity: 1 }] })}
                    className={BUTTON_TINY_CLASS}
                    disabled={inventoryOptions.length === 0}
                  >
                    {t("productionAddon.addOutputButton", "+ Saida")}
                  </button>
                </div>
                {inventoryOptions.length === 0 ? renderInventoryEmptyHint() : null}
                <div className="space-y-2">
                  {(addon.outputs || []).map((output, index) => (
                    <div key={`output-${index}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                      <div className="flex items-center gap-2">
                        <select
                          value={output.itemRef}
                          onChange={(event) => updateOutput(index, { itemRef: event.target.value })}
                          className={INPUT_CLASS}
                        >
                          <option value="">{t("productionAddon.selectNone", "Sem referencia")}</option>
                          {inventoryOptions.map((option) => (
                            <option key={option.sectionId} value={option.sectionId}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {output.itemRef && inventoryBySectionId.get(output.itemRef) ? (
                          <a
                            href={`/projects/${inventoryBySectionId.get(output.itemRef)?.projectId}/sections/${inventoryBySectionId.get(output.itemRef)?.sectionId}`}
                            className="text-blue-300 hover:text-blue-200 underline text-xs whitespace-nowrap"
                            title={t("productionAddon.openItemLinkTitle", "Abrir pagina do item")}
                            aria-label={t("productionAddon.openItemLinkLabel", "Abrir item")}
                          >
                            ↗
                          </a>
                        ) : null}
                      </div>
                      <CommitNumberInput
                        value={output.quantity}
                        onCommit={(next) => updateOutput(index, { quantity: next })}
                        min={1}
                        step={1}
                        integer
                        className={INPUT_CLASS}
                      />
                      <button
                        type="button"
                        onClick={() => commit({ outputs: (addon.outputs || []).filter((_, itemIndex) => itemIndex !== index) })}
                        className={BUTTON_DANGER_CLASS}
                      >
                        {t("common.remove", "Remover")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <LinkedFieldRow
                label={t("productionAddon.craftTimeSecondsLabel", "Tempo de receita (segundos)")}
                selectedKey={craftSelectedKey}
                options={linkedFieldOptions}
                invalidLabelFallback={addon.craftTimeSecondsProgressionLink?.columnName}
                onChange={(option) => handleLinkChange("craftTimeSecondsProgressionLink", option)}
                emptyStateCta={renderEmptyOptionsCta()}
                badges={renderLevelBadges(craftLevelBadges, "craft")}
              >
                <CommitOptionalNumberInput
                  value={addon.craftTimeSeconds}
                  onCommit={(next) => commit({ craftTimeSeconds: next })}
                  min={0}
                  step={1}
                  integer
                  className={INPUT_CLASS}
                />
              </LinkedFieldRow>
            </div>
          </div>
        )}
      </div>

      {pendingAnchorNavigation && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4 flex items-center justify-center">
          <div
            ref={anchorPreviewCardRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("view.anchorPreview.title", "Pré-visualização")}
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("view.anchorPreview.title", "Pré-visualização")}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">
                {pendingAnchorNavigation.title}
              </h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-6 text-gray-700">
                {pendingAnchorNavigation.shortDescription ||
                  t("view.anchorPreview.noDescription", "Sem descrição.")}
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAnchorNavigation(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t("common.cancel", "Cancelar")}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  navigateToDocumentAnchor(pendingAnchorNavigation.sectionId);
                  setPendingAnchorNavigation(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("view.anchorPreview.goButton", "Ir")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
