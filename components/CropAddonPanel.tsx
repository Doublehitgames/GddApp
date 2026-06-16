"use client";

import { useMemo, useCallback } from "react";
import type {
  CropAddonDraft,
  CropStage,
  CropOutput,
  CropItemInput,
  CropXpEvent,
  CropSeason,
} from "@/lib/addons/types";
import { CROP_SEED_SELF } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import {
  CommitTextInput,
  CommitOptionalNumberInput,
  CommitTextarea,
} from "@/components/common/CommitInput";
import { BoundedNumericField } from "@/components/common/BoundedNumericField";
import { FieldBindingPicker } from "@/components/common/FieldBindingPicker";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import {
  MANUAL_BINDING,
  type FieldBinding,
  type FieldBindingPickerContext,
} from "@/lib/addons/fieldBinding";
import { SectionLinkedSpreadsheetBar } from "@/components/common/SectionLinkedSpreadsheetBar";
import { SearchablePageSelect } from "@/components/common/SearchablePageSelect";

interface CropAddonPanelProps {
  addon: CropAddonDraft;
  onChange: (next: CropAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const PANEL_BLOCK_CLASS = "rounded-xl border border-gray-700/80 bg-gray-800/70 p-3";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_DANGER_CLASS =
  "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";
const BUTTON_ADD_CLASS =
  "rounded-lg border border-dashed border-gray-600 bg-gray-800/50 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-300";

const SEASONS: Array<{ key: CropSeason; label: string }> = [
  { key: "spring", label: "🌸 Primavera" },
  { key: "summer", label: "☀️ Verão" },
  { key: "fall", label: "🍂 Outono" },
  { key: "winter", label: "❄️ Inverno" },
  { key: "greenhouse", label: "🏠 Estufa" },
];

export function CropAddonPanel({ addon, onChange, onRemove }: CropAddonPanelProps) {
  const { t } = useI18n();
  const allProjects = useProjectStore((state) => state.projects);
  const setSectionLinkedSpreadsheet = useProjectStore((state) => state.setSectionLinkedSpreadsheet);
  const currentProjectId = useCurrentProjectId();

  const projects = useMemo(
    () => (currentProjectId ? allProjects.filter((p) => p.id === currentProjectId) : allProjects),
    [allProjects, currentProjectId]
  );

  const currentSection = useMemo(() => {
    for (const project of projects) {
      for (const section of project.sections || []) {
        if (
          (section.addons || []).some(
            (a) => a.type === "crop" && (a.id === addon.id || (a as { data?: { id?: string } }).data?.id === addon.id)
          )
        ) {
          return section;
        }
      }
    }
    return undefined;
  }, [projects, addon.id]);

  const sectionLinkedSpreadsheetId = (currentSection as { linkedSpreadsheetId?: string } | undefined)
    ?.linkedSpreadsheetId;

  const linkedSpreadsheets = useMemo(() => {
    if (!currentProjectId) return [];
    const project = allProjects.find((p) => p.id === currentProjectId);
    return project?.linkedSpreadsheets ?? [];
  }, [allProjects, currentProjectId]);

  const xpOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string }> = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        if ((section.addons || []).some((a) => a.type === "xpBalance")) {
          if (!seen.has(section.id)) {
            seen.add(section.id);
            out.push({ refId: section.id, label: section.title || section.id });
          }
        }
      }
    }
    return out;
  }, [projects]);

  const itemOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string }> = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        if ((section.addons || []).some((a) => a.type === "inventory")) {
          if (!seen.has(section.id)) {
            seen.add(section.id);
            out.push({ refId: section.id, label: section.title || section.id });
          }
        }
      }
    }
    return out;
  }, [projects]);

  const sectionOptions = useMemo(() => {
    const out: Array<{ refId: string; label: string }> = [];
    for (const project of projects) {
      for (const section of project.sections || []) {
        if (section.id !== currentSection?.id) {
          out.push({ refId: section.id, label: section.title || section.id });
        }
      }
    }
    return out;
  }, [projects, currentSection?.id]);

  const progressionColumnOptions = useMemo(() => {
    if (!currentSection) return [];
    const out: Array<{
      progressionAddonId: string;
      progressionAddonName: string;
      columnId: string;
      columnName: string;
    }> = [];
    for (const a of currentSection.addons || []) {
      if (a.type !== "progressionTable") continue;
      const addonName =
        (a as { name?: string }).name || (a as { data?: { name?: string } }).data?.name || "Progression";
      for (const col of (a as { data?: { columns?: Array<{ id: string; name?: string }> } }).data?.columns || []) {
        out.push({
          progressionAddonId: a.id,
          progressionAddonName: addonName,
          columnId: col.id,
          columnName: col.name || col.id,
        });
      }
    }
    return out;
  }, [currentSection]);

  const handleLinkedSpreadsheetChange = useCallback(
    (id: string | undefined) => {
      if (currentProjectId && currentSection) {
        setSectionLinkedSpreadsheet(currentProjectId, currentSection.id, id);
      }
    },
    [currentProjectId, currentSection, setSectionLinkedSpreadsheet]
  );

  const bindingContext: FieldBindingPickerContext = useMemo(
    () => ({
      progressionColumns: progressionColumnOptions,
      spreadsheetRegistry: linkedSpreadsheets,
      linkedSpreadsheetId: sectionLinkedSpreadsheetId,
      pageDataId: (currentSection as { dataId?: string } | undefined)?.dataId,
      onLinkedSpreadsheetChange: handleLinkedSpreadsheetChange,
    }),
    [
      progressionColumnOptions,
      linkedSpreadsheets,
      sectionLinkedSpreadsheetId,
      currentSection,
      handleLinkedSpreadsheetChange,
    ]
  );

  const xpBindingContext: FieldBindingPickerContext = useMemo(
    () => ({
      spreadsheetRegistry: linkedSpreadsheets,
      linkedSpreadsheetId: sectionLinkedSpreadsheetId,
      pageDataId: (currentSection as { dataId?: string } | undefined)?.dataId,
      onLinkedSpreadsheetChange: handleLinkedSpreadsheetChange,
    }),
    [linkedSpreadsheets, sectionLinkedSpreadsheetId, currentSection, handleLinkedSpreadsheetChange]
  );

  const update = useCallback(
    (patch: Partial<CropAddonDraft>) => onChange({ ...addon, ...patch }),
    [addon, onChange]
  );

  const updateXpEvent = useCallback(
    (field: "plantXp" | "harvestXp", patch: Partial<CropXpEvent>) =>
      update({ [field]: { ...addon[field], ...patch } }),
    [addon, update]
  );

  // When a sheet binding is applied, mirror its cached value into the numeric
  // field so the input shows it (read-only) AND the export/DataSchema resolver
  // (which reads the scalar, not the binding) sees the value. Same pattern as
  // ProductionAddonPanel.
  const cachedFromBinding = (b: FieldBinding): number | undefined =>
    b.source === "sheets" && typeof b.ref.cachedValue === "number"
      ? Math.floor(Math.max(0, b.ref.cachedValue))
      : undefined;

  /** Set a bounded numeric field's binding, mirroring the cached sheet value into its scalar. */
  const bindNumeric = (
    valueKey: keyof CropAddonDraft,
    bindingKey: keyof CropAddonDraft,
    b: FieldBinding
  ) => {
    const v = cachedFromBinding(b);
    update({ [bindingKey]: b, ...(v !== undefined ? { [valueKey]: v } : {}) } as Partial<CropAddonDraft>);
  };

  /** Same as bindNumeric, but for a per-output quantity field. */
  const bindOutput = (
    outputId: string,
    valueKey: keyof CropOutput,
    bindingKey: keyof CropOutput,
    b: FieldBinding
  ) => {
    const v = cachedFromBinding(b);
    updateOutput(outputId, { [bindingKey]: b, ...(v !== undefined ? { [valueKey]: v } : {}) } as Partial<CropOutput>);
  };

  const addStage = () => {
    const id = `stage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    update({ stages: [...(addon.stages || []), { id, label: "Estágio", secondsFromPlanting: 0 }] });
  };

  const updateStage = (id: string, patch: Partial<CropStage>) =>
    update({ stages: (addon.stages || []).map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const removeStage = (id: string) =>
    update({ stages: (addon.stages || []).filter((s) => s.id !== id) });

  const addOutput = () => {
    const id = `output-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    update({ outputs: [...(addon.outputs || []), { id, quantity: 1 }] });
  };

  const updateOutput = (id: string, patch: Partial<CropOutput>) =>
    update({ outputs: (addon.outputs || []).map((o) => (o.id === id ? { ...o, ...patch } : o)) });

  const removeOutput = (id: string) =>
    update({ outputs: (addon.outputs || []).filter((o) => o.id !== id) });

  const addFertilizer = () => {
    const id = `fert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    update({ fertilizers: [...(addon.fertilizers || []), { id }] });
  };

  const updateFertilizer = (id: string, patch: Partial<CropItemInput>) =>
    update({ fertilizers: (addon.fertilizers || []).map((f) => (f.id === id ? { ...f, ...patch } : f)) });

  const removeFertilizer = (id: string) =>
    update({ fertilizers: (addon.fertilizers || []).filter((f) => f.id !== id) });

  const addAmendment = () => {
    const id = `amend-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    update({ amendments: [...(addon.amendments || []), { id }] });
  };

  const updateAmendment = (id: string, patch: Partial<CropItemInput>) =>
    update({ amendments: (addon.amendments || []).map((a) => (a.id === id ? { ...a, ...patch } : a)) });

  const removeAmendment = (id: string) =>
    update({ amendments: (addon.amendments || []).filter((a) => a.id !== id) });

  const toggleSeason = (season: CropSeason) => {
    const current = addon.seasons ?? [];
    const next = current.includes(season)
      ? current.filter((s) => s !== season)
      : [...current, season];
    update({ seasons: next.length > 0 ? next : undefined });
  };

  const harvestInterval =
    addon.harvestMode === "progressive" &&
    addon.growthSeconds &&
    addon.totalHarvest &&
    addon.totalHarvest > 0
      ? Math.round(addon.growthSeconds / addon.totalHarvest)
      : null;

  const renderXpBlock = (
    field: "plantXp" | "harvestXp",
    labelKey: string,
    labelFallback: string,
    hint?: string
  ) => {
    const event = addon[field];
    const isSheetBound = event.xpBinding?.source === "sheets";
    return (
      <div className="space-y-2">
        <div>
          <p className="mb-1 text-[10px] text-gray-400">
            {t(labelKey, labelFallback)}
            {hint && <span className="ml-1 text-gray-600">{hint}</span>}
          </p>
          <select
            value={event.xpAddonRef || ""}
            onChange={(e) => updateXpEvent(field, { xpAddonRef: e.target.value || undefined })}
            className={INPUT_CLASS}
          >
            <option value="">{t("cropAddon.selectXpPage", "Página de XP")}</option>
            {xpOptions.map((o) => (
              <option key={o.refId} value={o.refId}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <FieldBindingPicker
          config={{
            valueType: "number",
            acceptedSources: ["sheets"],
            label: t("cropAddon.xpValue", "Valor XP"),
          }}
          value={event.xpBinding ?? MANUAL_BINDING}
          onChange={(b: FieldBinding) => {
            const cached = cachedFromBinding(b);
            updateXpEvent(field, { xpBinding: b, ...(cached !== undefined ? { xp: cached } : {}) });
          }}
          context={xpBindingContext}
        >
          <CommitOptionalNumberInput
            value={event.xp}
            onCommit={(v) => updateXpEvent(field, { xp: v })}
            min={0}
            integer
            className={INPUT_CLASS}
            placeholder="0"
            readOnly={isSheetBound}
          />
        </FieldBindingPicker>
      </div>
    );
  };

  const itemSelectOptions = useMemo(
    () => itemOptions.map((o) => ({ id: o.refId, label: o.label })),
    [itemOptions]
  );
  const sectionSelectOptions = useMemo(
    () => sectionOptions.map((o) => ({ id: o.refId, label: o.label })),
    [sectionOptions]
  );

  return (
    <div className={PANEL_SHELL_CLASS}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-400">
            {t("cropAddon.addonName", "Nome do addon")}
          </label>
          <CommitTextInput
            value={addon.name}
            onCommit={(v) => update({ name: v })}
            className={INPUT_CLASS}
            placeholder="ex: Semente de Nabo"
          />
        </div>
        <button onClick={onRemove} className={`${BUTTON_DANGER_CLASS} mt-5 shrink-0`}>
          {t("common.remove", "Remover")}
        </button>
      </div>

      {/* Sheets bar */}
      {linkedSpreadsheets.length > 0 && (
        <div className="mb-4">
          <SectionLinkedSpreadsheetBar
            linkedSpreadsheetId={sectionLinkedSpreadsheetId}
            spreadsheetRegistry={linkedSpreadsheets}
            onChange={handleLinkedSpreadsheetChange}
            readOnly
          />
        </div>
      )}

      {/* Harvest mode */}
      <div className={`${PANEL_BLOCK_CLASS} mb-3`}>
        <p className="mb-2 text-xs font-medium text-gray-300">
          {t("cropAddon.harvestMode", "Modo de colheita")}
        </p>
        <div className="flex gap-2">
          {(["instant", "progressive"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => update({ harvestMode: mode })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                addon.harvestMode === mode
                  ? "bg-green-700 text-white"
                  : "border border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {mode === "instant"
                ? t("cropAddon.modeInstant", "Instantânea")
                : t("cropAddon.modeProgressive", "Progressiva")}
            </button>
          ))}
        </div>
        {addon.harvestMode === "progressive" && (
          <p className="mt-1.5 text-[10px] text-gray-500">
            {t(
              "cropAddon.progressiveHint",
              "O jogador colhe de 1 em 1 ao longo do tempo ou deixa acumular. XP por colheita × total colhido."
            )}
          </p>
        )}
      </div>

      {/* Growth cycle */}
      <div className={`${PANEL_BLOCK_CLASS} mb-3 space-y-3`}>
        <p className="text-xs font-medium text-gray-300">
          {t("cropAddon.growthCycle", "Ciclo de crescimento")}
        </p>

        <BoundedNumericField
          label={t("cropAddon.growthSeconds", "Tempo de crescimento (s)")}
          value={addon.growthSeconds}
          onValueChange={(v) => update({ growthSeconds: v })}
          limitMin={addon.growthSecondsMin}
          onLimitMinChange={(v) => update({ growthSecondsMin: v })}
          limitMinBinding={addon.growthSecondsMinBinding}
          onLimitMinBindingChange={(b) => bindNumeric("growthSecondsMin", "growthSecondsMinBinding", b)}
          limitMax={addon.growthSecondsMax}
          onLimitMaxChange={(v) => update({ growthSecondsMax: v })}
          limitMaxBinding={addon.growthSecondsMaxBinding}
          onLimitMaxBindingChange={(b) => bindNumeric("growthSecondsMax", "growthSecondsMaxBinding", b)}
          onLimitsClear={() =>
            update({
              growthSecondsMin: undefined,
              growthSecondsMinBinding: undefined,
              growthSecondsMax: undefined,
              growthSecondsMaxBinding: undefined,
            })
          }
          binding={addon.growthSecondsBinding ?? MANUAL_BINDING}
          onBindingChange={(b) => bindNumeric("growthSeconds", "growthSecondsBinding", b)}
          acceptedSources={["sheets", "progressionColumn"]}
          bindingContext={bindingContext}
          integer
        />

        {addon.harvestMode === "progressive" && (
          <div className="space-y-2">
            <BoundedNumericField
              label={t("cropAddon.totalHarvest", "Total de colheitas no ciclo")}
              value={addon.totalHarvest}
              onValueChange={(v) => update({ totalHarvest: v })}
              limitMin={addon.totalHarvestMin}
              onLimitMinChange={(v) => update({ totalHarvestMin: v })}
              limitMinBinding={addon.totalHarvestMinBinding}
              onLimitMinBindingChange={(b) => bindNumeric("totalHarvestMin", "totalHarvestMinBinding", b)}
              limitMax={addon.totalHarvestMax}
              onLimitMaxChange={(v) => update({ totalHarvestMax: v })}
              limitMaxBinding={addon.totalHarvestMaxBinding}
              onLimitMaxBindingChange={(b) => bindNumeric("totalHarvestMax", "totalHarvestMaxBinding", b)}
              onLimitsClear={() =>
                update({
                  totalHarvestMin: undefined,
                  totalHarvestMinBinding: undefined,
                  totalHarvestMax: undefined,
                  totalHarvestMaxBinding: undefined,
                })
              }
              binding={addon.totalHarvestBinding ?? MANUAL_BINDING}
              onBindingChange={(b) => bindNumeric("totalHarvest", "totalHarvestBinding", b)}
              acceptedSources={["sheets", "progressionColumn"]}
              bindingContext={bindingContext}
              integer
            />
            {harvestInterval !== null && (
              <div className="flex items-baseline gap-2 rounded-lg border border-green-900/40 bg-green-950/20 px-3 py-2">
                <span className="text-[10px] text-gray-500">
                  {t("cropAddon.harvestInterval", "Intervalo calculado")}
                </span>
                <span className="font-mono text-base text-green-400">~{harvestInterval}s</span>
                <span className="text-[10px] text-gray-600">
                  {t("cropAddon.harvestIntervalFormula", "= tempo ÷ total colheitas")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Visual stages */}
        <div>
          <p className="mb-1.5 text-xs text-gray-400">
            {t("cropAddon.stages", "Estágios visuais")}
          </p>
          <div className="space-y-1.5">
            {(addon.stages || []).map((stage, idx) => (
              <div key={stage.id} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-[10px] text-gray-500">
                  {idx + 1}
                </span>
                <CommitTextInput
                  value={stage.label}
                  onCommit={(v) => updateStage(stage.id, { label: v })}
                  className="flex-1 rounded-lg border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-white outline-none focus:border-gray-500"
                  placeholder={t("cropAddon.stageLabel", "ex: Broto 1")}
                />
                <CommitOptionalNumberInput
                  value={stage.secondsFromPlanting}
                  onCommit={(v) => updateStage(stage.id, { secondsFromPlanting: v ?? 0 })}
                  min={0}
                  integer
                  className="w-24 rounded-lg border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-white outline-none focus:border-gray-500"
                  placeholder="0"
                />
                <span className="shrink-0 text-[10px] text-gray-500">s</span>
                <button onClick={() => removeStage(stage.id)} className={BUTTON_DANGER_CLASS}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <button onClick={addStage} className={`${BUTTON_ADD_CLASS} mt-2`}>
            + {t("cropAddon.addStage", "Adicionar estágio")}
          </button>
        </div>
      </div>

      {/* Harvest outputs */}
      <div className={`${PANEL_BLOCK_CLASS} mb-3`}>
        <p className="mb-2 text-xs font-medium text-gray-300">
          {t("cropAddon.outputs", "Saídas da colheita")}
        </p>
        {addon.harvestMode === "progressive" && (
          <p className="mb-2 text-[10px] text-gray-500">
            {t("cropAddon.progressiveOutputHint", "Quantidade por intervalo de colheita.")}
          </p>
        )}
        <div className="space-y-2">
          {(addon.outputs || []).map((output) => (
            <div
              key={output.id}
              className="space-y-2 rounded-lg border border-gray-700/60 bg-gray-900/40 p-2.5"
            >
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-[10px] text-gray-500">
                    {t("cropAddon.item", "Item")}
                  </label>
                  <SearchablePageSelect
                    value={output.itemRef}
                    onChange={(ref) => updateOutput(output.id, { itemRef: ref })}
                    options={itemSelectOptions}
                    placeholder={t("cropAddon.selectItem", "Selecione item...")}
                  />
                </div>
                <button onClick={() => removeOutput(output.id)} className={BUTTON_DANGER_CLASS}>
                  ×
                </button>
              </div>
              <BoundedNumericField
                label={t("cropAddon.quantity", "Quantidade")}
                value={output.quantity}
                onValueChange={(v) => updateOutput(output.id, { quantity: v })}
                limitMin={output.quantityMin}
                onLimitMinChange={(v) => updateOutput(output.id, { quantityMin: v })}
                limitMinBinding={output.quantityMinBinding}
                onLimitMinBindingChange={(b) => bindOutput(output.id, "quantityMin", "quantityMinBinding", b)}
                limitMax={output.quantityMax}
                onLimitMaxChange={(v) => updateOutput(output.id, { quantityMax: v })}
                limitMaxBinding={output.quantityMaxBinding}
                onLimitMaxBindingChange={(b) => bindOutput(output.id, "quantityMax", "quantityMaxBinding", b)}
                onLimitsClear={() =>
                  updateOutput(output.id, {
                    quantityMin: undefined,
                    quantityMinBinding: undefined,
                    quantityMax: undefined,
                    quantityMaxBinding: undefined,
                  })
                }
                binding={output.quantityBinding ?? MANUAL_BINDING}
                onBindingChange={(b) => bindOutput(output.id, "quantity", "quantityBinding", b)}
                acceptedSources={["sheets", "progressionColumn"]}
                bindingContext={bindingContext}
                integer
              />
            </div>
          ))}
        </div>
        <button onClick={addOutput} className={`${BUTTON_ADD_CLASS} mt-2`}>
          + {t("cropAddon.addOutput", "Adicionar saída")}
        </button>
      </div>

      {/* XP */}
      <div className={`${PANEL_BLOCK_CLASS} mb-3 space-y-3`}>
        <p className="text-xs font-medium text-gray-300">{t("cropAddon.xp", "XP")}</p>
        {renderXpBlock("plantXp", "cropAddon.plantXp", "Ao plantar")}
        {renderXpBlock(
          "harvestXp",
          "cropAddon.harvestXp",
          "Ao colher",
          addon.harvestMode === "progressive"
            ? t("cropAddon.harvestXpProgressiveHint", "(por unidade colhida)")
            : undefined
        )}
      </div>

      {/* Post-harvest */}
      <div className={`${PANEL_BLOCK_CLASS} mb-3`}>
        <p className="mb-2 text-xs font-medium text-gray-300">
          {t("cropAddon.postHarvest", "Pós-colheita")}
        </p>
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={addon.spawnWitheredPlant}
            onChange={(v) => update({ spawnWitheredPlant: v })}
          />
          <span className="text-sm text-gray-300">
            {t("cropAddon.spawnWithered", "Spawn pós-colheita")}
          </span>
        </div>
        {addon.spawnWitheredPlant && (
          <div className="mt-2">
            <label className="mb-1 block text-xs text-gray-400">
              {t("cropAddon.witheredPlantRef", "Página a spawnar")}
            </label>
            <SearchablePageSelect
              value={addon.witheredPlantRef}
              onChange={(id) => update({ witheredPlantRef: id })}
              options={sectionSelectOptions}
              placeholder={t("cropAddon.selectSection", "Selecione página...")}
            />
          </div>
        )}
      </div>

      {/* Planting */}
      <div className={`${PANEL_BLOCK_CLASS} mb-3 space-y-3`}>
        <p className="text-xs font-medium text-gray-300">
          {t("cropAddon.planting", "Plantio")}
        </p>
        <div>
          <label className="mb-1 block text-xs text-gray-400">
            {t("cropAddon.seed", "Semente")}
          </label>
          <SearchablePageSelect
            value={addon.seedRef}
            onChange={(id) => update({ seedRef: id ?? CROP_SEED_SELF })}
            prefixOptions={[
              { id: CROP_SEED_SELF, label: `🪴 ${t("cropAddon.seedSelf", "Esta página (semente própria)")}` },
            ]}
            options={itemSelectOptions}
            placeholder={t("cropAddon.seedOther", "Outra página de item...")}
          />
        </div>

        <BoundedNumericField
          label={t("cropAddon.seedQty", "Quantidade de sementes")}
          value={addon.seedQuantity}
          onValueChange={(v) => update({ seedQuantity: v })}
          limitMin={addon.seedQuantityMin}
          onLimitMinChange={(v) => update({ seedQuantityMin: v })}
          limitMinBinding={addon.seedQuantityMinBinding}
          onLimitMinBindingChange={(b) => bindNumeric("seedQuantityMin", "seedQuantityMinBinding", b)}
          limitMax={addon.seedQuantityMax}
          onLimitMaxChange={(v) => update({ seedQuantityMax: v })}
          limitMaxBinding={addon.seedQuantityMaxBinding}
          onLimitMaxBindingChange={(b) => bindNumeric("seedQuantityMax", "seedQuantityMaxBinding", b)}
          onLimitsClear={() =>
            update({
              seedQuantityMin: undefined,
              seedQuantityMinBinding: undefined,
              seedQuantityMax: undefined,
              seedQuantityMaxBinding: undefined,
            })
          }
          binding={addon.seedQuantityBinding ?? MANUAL_BINDING}
          onBindingChange={(b) => bindNumeric("seedQuantity", "seedQuantityBinding", b)}
          acceptedSources={["sheets", "progressionColumn"]}
          bindingContext={bindingContext}
          integer
        />

        <BoundedNumericField
          label={t("cropAddon.plantEnergy", "Energia ao plantar")}
          value={addon.plantEnergy}
          onValueChange={(v) => update({ plantEnergy: v })}
          limitMin={addon.plantEnergyMin}
          onLimitMinChange={(v) => update({ plantEnergyMin: v })}
          limitMinBinding={addon.plantEnergyMinBinding}
          onLimitMinBindingChange={(b) => bindNumeric("plantEnergyMin", "plantEnergyMinBinding", b)}
          limitMax={addon.plantEnergyMax}
          onLimitMaxChange={(v) => update({ plantEnergyMax: v })}
          limitMaxBinding={addon.plantEnergyMaxBinding}
          onLimitMaxBindingChange={(b) => bindNumeric("plantEnergyMax", "plantEnergyMaxBinding", b)}
          onLimitsClear={() =>
            update({
              plantEnergyMin: undefined,
              plantEnergyMinBinding: undefined,
              plantEnergyMax: undefined,
              plantEnergyMaxBinding: undefined,
            })
          }
          binding={addon.plantEnergyBinding ?? MANUAL_BINDING}
          onBindingChange={(b) => bindNumeric("plantEnergy", "plantEnergyBinding", b)}
          acceptedSources={["sheets", "progressionColumn"]}
          bindingContext={bindingContext}
          integer
        />
      </div>

      {/* Accepted inputs */}
      <div className={`${PANEL_BLOCK_CLASS} mb-3 space-y-4`}>
        <p className="text-xs font-medium text-gray-300">
          {t("cropAddon.inputs", "Insumos aceitos")}
        </p>

        {/* Fertilizers */}
        <div>
          <p className="mb-1.5 text-xs text-gray-400">
            {t("cropAddon.fertilizers", "Fertilizantes")}
          </p>
          <div className="space-y-1.5">
            {(addon.fertilizers || []).map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <SearchablePageSelect
                    value={f.itemRef}
                    onChange={(ref) => updateFertilizer(f.id, { itemRef: ref })}
                    options={itemSelectOptions}
                    placeholder={t("cropAddon.selectItem", "Selecione item...")}
                  />
                </div>
                <button onClick={() => removeFertilizer(f.id)} className={BUTTON_DANGER_CLASS}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <button onClick={addFertilizer} className={`${BUTTON_ADD_CLASS} mt-2`}>
            + {t("cropAddon.addFertilizer", "Adicionar fertilizante")}
          </button>
        </div>

        {/* Amendments */}
        <div>
          <p className="mb-1.5 text-xs text-gray-400">{t("cropAddon.amendments", "Adubos")}</p>
          <div className="space-y-1.5">
            {(addon.amendments || []).map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <SearchablePageSelect
                    value={a.itemRef}
                    onChange={(ref) => updateAmendment(a.id, { itemRef: ref })}
                    options={itemSelectOptions}
                    placeholder={t("cropAddon.selectItem", "Selecione item...")}
                  />
                </div>
                <button onClick={() => removeAmendment(a.id)} className={BUTTON_DANGER_CLASS}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <button onClick={addAmendment} className={`${BUTTON_ADD_CLASS} mt-2`}>
            + {t("cropAddon.addAmendment", "Adicionar adubo")}
          </button>
        </div>
      </div>

      {/* Seasons */}
      <div className={`${PANEL_BLOCK_CLASS} mb-3`}>
        <p className="mb-2 text-xs font-medium text-gray-300">
          {t("cropAddon.seasons", "Estações")}
        </p>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map(({ key, label }) => {
            const active = (addon.seasons ?? []).includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleSeason(key)}
                className={`rounded-lg px-3 py-1 text-xs transition-colors ${
                  active
                    ? "bg-green-800 text-green-100"
                    : "border border-gray-600 bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {(!addon.seasons || addon.seasons.length === 0) && (
          <p className="mt-1.5 text-[10px] text-gray-600">
            {t("cropAddon.allSeasons", "Nenhuma selecionada → cresce em qualquer época")}
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1 block text-xs text-gray-400">
          {t("cropAddon.notes", "Notas")}
        </label>
        <CommitTextarea
          value={addon.notes || ""}
          onCommit={(v) => update({ notes: v || undefined })}
          rows={3}
          className={INPUT_CLASS}
          placeholder={t(
            "cropAddon.notesPlaceholder",
            "Observações, comportamentos especiais, etc."
          )}
        />
      </div>
    </div>
  );
}
