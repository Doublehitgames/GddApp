"use client";

import { useMemo, useState } from "react";
import type { ProductionAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { blurOnEnterKey } from "@/hooks/useBlurCommitText";
import { ToggleSwitch } from "@/components/ToggleSwitch";

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

function toPositiveInt(raw: string, fallback = 1): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function toNonNegativeIntOrUndefined(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.floor(parsed));
}

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
  const projects = useProjectStore((state) => state.projects);
  const [isMinOutputLinkMenuOpen, setIsMinOutputLinkMenuOpen] = useState(false);
  const [isMaxOutputLinkMenuOpen, setIsMaxOutputLinkMenuOpen] = useState(false);
  const [isIntervalLinkMenuOpen, setIsIntervalLinkMenuOpen] = useState(false);
  const [isCraftLinkMenuOpen, setIsCraftLinkMenuOpen] = useState(false);

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
          (item) => item.type === "production" && item.id === addon.id
        );
        if (found) return section;
      }
    }
    return undefined;
  }, [addon.id, projects]);

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
  const minOutputSelectedOption = minOutputSelectedKey ? progressionColumnOptionByKey.get(minOutputSelectedKey) : undefined;
  const maxOutputSelectedOption = maxOutputSelectedKey ? progressionColumnOptionByKey.get(maxOutputSelectedKey) : undefined;
  const intervalSelectedOption = intervalSelectedKey ? progressionColumnOptionByKey.get(intervalSelectedKey) : undefined;
  const craftSelectedOption = craftSelectedKey ? progressionColumnOptionByKey.get(craftSelectedKey) : undefined;

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
  const buildLinkLabel = (baseLabel: string, linkedColumnName: string | undefined, fallbackColumnName: string | undefined) => {
    if (!fallbackColumnName) return baseLabel;
    const linkedName =
      linkedColumnName ||
      fallbackColumnName ||
      t("productionAddon.invalidProgressionLinkOption", "Vinculo invalido (coluna removida)");
    return `${baseLabel} (${linkedName})`;
  };
  const minOutputLinkLabel = (() => {
    const base = t("productionAddon.minOutputLabel", "Qtd minima");
    const link = addon.minOutputProgressionLink;
    return buildLinkLabel(base, minOutputSelectedOption?.label, link?.columnName);
  })();
  const maxOutputLinkLabel = (() => {
    const base = t("productionAddon.maxOutputLabel", "Qtd maxima");
    const link = addon.maxOutputProgressionLink;
    return buildLinkLabel(base, maxOutputSelectedOption?.label, link?.columnName);
  })();
  const intervalLinkLabel = (() => {
    const base = t("productionAddon.intervalSecondsLabel", "Tempo (segundos)");
    const link = addon.intervalSecondsProgressionLink;
    return buildLinkLabel(base, intervalSelectedOption?.label, link?.columnName);
  })();
  const craftLinkLabel = (() => {
    const base = t("productionAddon.craftTimeSecondsLabel", "Tempo de receita (segundos)");
    const link = addon.craftTimeSecondsProgressionLink;
    return buildLinkLabel(base, craftSelectedOption?.label, link?.columnName);
  })();

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
                >
                  <option value="">{t("productionAddon.selectNone", "Sem referencia")}</option>
                  {inventoryOptions.map((option) => (
                    <option key={option.sectionId} value={option.sectionId}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <label className="block">
                  <button
                    type="button"
                    onClick={() => setIsMinOutputLinkMenuOpen((prev) => !prev)}
                    className="mb-1 block text-left text-xs text-gray-400 hover:text-gray-200 underline"
                    aria-expanded={isMinOutputLinkMenuOpen}
                    aria-label={minOutputLinkLabel}
                  >
                  {minOutputLinkLabel}
                  {addon.minOutputProgressionLink ? (
                    <span className="ml-1 inline-block text-gray-300" aria-hidden="true">
                      •
                    </span>
                  ) : null}
                  </button>
                  {isMinOutputLinkMenuOpen ? (
                    <div className="mb-2 max-h-40 overflow-auto rounded-lg border border-gray-700 bg-gray-900/80 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          commit({ minOutputProgressionLink: undefined });
                          setIsMinOutputLinkMenuOpen(false);
                        }}
                        className="block w-full rounded px-2 py-1 text-left text-xs text-gray-200 hover:bg-gray-800"
                      >
                        {t("productionAddon.noProgressionLinkOption", "Sem vinculo")}
                      </button>
                      {minOutputSelectedKey && !minOutputSelectedOption && (
                        <div className="px-2 py-1 text-xs text-amber-300">
                          {t("productionAddon.invalidProgressionLinkOption", "Vinculo invalido (coluna removida)")}
                        </div>
                      )}
                      {progressionColumnOptions.map((option) => (
                        <button
                          key={`min-${option.key}`}
                          type="button"
                          onClick={() => {
                            commit({
                              minOutputProgressionLink: {
                                progressionAddonId: option.progressionAddonId,
                                columnId: option.columnId,
                                columnName: option.columnName,
                              },
                            });
                            setIsMinOutputLinkMenuOpen(false);
                          }}
                          className={`block w-full rounded px-2 py-1 text-left text-xs hover:bg-gray-800 ${
                            minOutputSelectedKey === option.key ? "text-gray-100 bg-gray-800/70" : "text-gray-300"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={addon.minOutput ?? ""}
                    onChange={(event) => commit({ minOutput: toNonNegativeIntOrUndefined(event.target.value) })}
                    onKeyDown={blurOnEnterKey}
                    className={INPUT_CLASS}
                  />
                  {minOutputLevelBadges ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {minOutputLevelBadges.map((badge) => (
                        <span
                          key={`min-output-lv-${badge.level}`}
                          className="rounded-full border border-gray-500 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-100"
                        >
                          Lv{badge.level}: {badge.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </label>
                <label className="block">
                  <button
                    type="button"
                    onClick={() => setIsMaxOutputLinkMenuOpen((prev) => !prev)}
                    className="mb-1 block text-left text-xs text-gray-400 hover:text-gray-200 underline"
                    aria-expanded={isMaxOutputLinkMenuOpen}
                    aria-label={maxOutputLinkLabel}
                  >
                  {maxOutputLinkLabel}
                  {addon.maxOutputProgressionLink ? (
                    <span className="ml-1 inline-block text-gray-300" aria-hidden="true">
                      •
                    </span>
                  ) : null}
                  </button>
                  {isMaxOutputLinkMenuOpen ? (
                    <div className="mb-2 max-h-40 overflow-auto rounded-lg border border-gray-700 bg-gray-900/80 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          commit({ maxOutputProgressionLink: undefined });
                          setIsMaxOutputLinkMenuOpen(false);
                        }}
                        className="block w-full rounded px-2 py-1 text-left text-xs text-gray-200 hover:bg-gray-800"
                      >
                        {t("productionAddon.noProgressionLinkOption", "Sem vinculo")}
                      </button>
                      {maxOutputSelectedKey && !maxOutputSelectedOption && (
                        <div className="px-2 py-1 text-xs text-amber-300">
                          {t("productionAddon.invalidProgressionLinkOption", "Vinculo invalido (coluna removida)")}
                        </div>
                      )}
                      {progressionColumnOptions.map((option) => (
                        <button
                          key={`max-${option.key}`}
                          type="button"
                          onClick={() => {
                            commit({
                              maxOutputProgressionLink: {
                                progressionAddonId: option.progressionAddonId,
                                columnId: option.columnId,
                                columnName: option.columnName,
                              },
                            });
                            setIsMaxOutputLinkMenuOpen(false);
                          }}
                          className={`block w-full rounded px-2 py-1 text-left text-xs hover:bg-gray-800 ${
                            maxOutputSelectedKey === option.key ? "text-gray-100 bg-gray-800/70" : "text-gray-300"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={addon.maxOutput ?? ""}
                    onChange={(event) => commit({ maxOutput: toNonNegativeIntOrUndefined(event.target.value) })}
                    onKeyDown={blurOnEnterKey}
                    className={INPUT_CLASS}
                  />
                  {maxOutputLevelBadges ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {maxOutputLevelBadges.map((badge) => (
                        <span
                          key={`max-output-lv-${badge.level}`}
                          className="rounded-full border border-gray-500 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-100"
                        >
                          Lv{badge.level}: {badge.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </label>
              </div>
              <label className="block">
                <button
                  type="button"
                  onClick={() => setIsIntervalLinkMenuOpen((prev) => !prev)}
                  className="mb-1 block text-left text-xs text-gray-400 hover:text-gray-200 underline"
                  aria-expanded={isIntervalLinkMenuOpen}
                  aria-label={intervalLinkLabel}
                >
                  {intervalLinkLabel}
                  {addon.intervalSecondsProgressionLink ? (
                    <span className="ml-1 inline-block text-gray-300" aria-hidden="true">
                      •
                    </span>
                  ) : null}
                </button>
                {isIntervalLinkMenuOpen ? (
                  <div className="mb-2 max-h-40 overflow-auto rounded-lg border border-gray-700 bg-gray-900/80 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        commit({ intervalSecondsProgressionLink: undefined });
                        setIsIntervalLinkMenuOpen(false);
                      }}
                      className="block w-full rounded px-2 py-1 text-left text-xs text-gray-200 hover:bg-gray-800"
                    >
                      {t("productionAddon.noProgressionLinkOption", "Sem vinculo")}
                    </button>
                    {intervalSelectedKey && !intervalSelectedOption && (
                      <div className="px-2 py-1 text-xs text-amber-300">
                        {t("productionAddon.invalidProgressionLinkOption", "Vinculo invalido (coluna removida)")}
                      </div>
                    )}
                    {progressionColumnOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          commit({
                            intervalSecondsProgressionLink: {
                              progressionAddonId: option.progressionAddonId,
                              columnId: option.columnId,
                              columnName: option.columnName,
                            },
                          });
                          setIsIntervalLinkMenuOpen(false);
                        }}
                        className={`block w-full rounded px-2 py-1 text-left text-xs hover:bg-gray-800 ${
                          intervalSelectedKey === option.key ? "text-gray-100 bg-gray-800/70" : "text-gray-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={addon.intervalSeconds ?? ""}
                  onChange={(event) => commit({ intervalSeconds: toNonNegativeIntOrUndefined(event.target.value) })}
                  onKeyDown={blurOnEnterKey}
                  className={INPUT_CLASS}
                />
                {intervalLevelBadges ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {intervalLevelBadges.map((badge) => (
                      <span
                        key={`interval-label-${badge.level}`}
                        className="rounded-full border border-gray-500 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-100"
                      >
                        Lv{badge.level}: {badge.value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-2">
                  <span className="mb-1 block text-xs text-gray-400">{t("productionAddon.requiresCollectionLabel", "Requer coleta manual")}</span>
                  <ToggleSwitch
                    checked={Boolean(addon.requiresCollection)}
                    onChange={(next) => commit({ requiresCollection: next })}
                    ariaLabel={t("productionAddon.requiresCollectionLabel", "Requer coleta manual")}
                  />
                </div>
                <label className="block rounded-lg border border-gray-700 bg-gray-900/40 p-2">
                  <span className="mb-1 block text-xs text-gray-400">{t("productionAddon.capacityLabel", "Capacidade maxima")}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={addon.capacity ?? ""}
                    onChange={(event) => commit({ capacity: toNonNegativeIntOrUndefined(event.target.value) })}
                    onKeyDown={blurOnEnterKey}
                    className={INPUT_CLASS}
                  />
                </label>
              </div>
            </div>
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
                  >
                    {t("productionAddon.addIngredientButton", "+ Ingrediente")}
                  </button>
                </div>
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
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={ingredient.quantity}
                        onChange={(event) => updateIngredient(index, { quantity: toPositiveInt(event.target.value, 1) })}
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
                  >
                    {t("productionAddon.addOutputButton", "+ Saida")}
                  </button>
                </div>
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
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={output.quantity}
                        onChange={(event) => updateOutput(index, { quantity: toPositiveInt(event.target.value, 1) })}
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

              <label className="block">
                <button
                  type="button"
                  onClick={() => setIsCraftLinkMenuOpen((prev) => !prev)}
                  className="mb-1 block text-left text-xs text-gray-400 hover:text-gray-200 underline"
                  aria-expanded={isCraftLinkMenuOpen}
                  aria-label={craftLinkLabel}
                >
                  {craftLinkLabel}
                  {addon.craftTimeSecondsProgressionLink ? (
                    <span className="ml-1 inline-block text-gray-300" aria-hidden="true">
                      •
                    </span>
                  ) : null}
                </button>
                {isCraftLinkMenuOpen ? (
                  <div className="mb-2 max-h-40 overflow-auto rounded-lg border border-gray-700 bg-gray-900/80 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        commit({ craftTimeSecondsProgressionLink: undefined });
                        setIsCraftLinkMenuOpen(false);
                      }}
                      className="block w-full rounded px-2 py-1 text-left text-xs text-gray-200 hover:bg-gray-800"
                    >
                      {t("productionAddon.noProgressionLinkOption", "Sem vinculo")}
                    </button>
                    {craftSelectedKey && !craftSelectedOption && (
                      <div className="px-2 py-1 text-xs text-amber-300">
                        {t("productionAddon.invalidProgressionLinkOption", "Vinculo invalido (coluna removida)")}
                      </div>
                    )}
                    {progressionColumnOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          commit({
                            craftTimeSecondsProgressionLink: {
                              progressionAddonId: option.progressionAddonId,
                              columnId: option.columnId,
                              columnName: option.columnName,
                            },
                          });
                          setIsCraftLinkMenuOpen(false);
                        }}
                        className={`block w-full rounded px-2 py-1 text-left text-xs hover:bg-gray-800 ${
                          craftSelectedKey === option.key ? "text-gray-100 bg-gray-800/70" : "text-gray-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={addon.craftTimeSeconds ?? ""}
                  onChange={(event) => commit({ craftTimeSeconds: toNonNegativeIntOrUndefined(event.target.value) })}
                  onKeyDown={blurOnEnterKey}
                  className={INPUT_CLASS}
                />
                {craftLevelBadges ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {craftLevelBadges.map((badge) => (
                      <span
                        key={`craft-label-${badge.level}`}
                        className="rounded-full border border-gray-500 bg-gray-800 px-2 py-0.5 text-[10px] text-gray-100"
                      >
                        Lv{badge.level}: {badge.value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onRemove} className={BUTTON_DANGER_CLASS}>
          {t("productionAddon.removeAddonButton", "Remover addon")}
        </button>
      </div>
    </section>
  );
}
