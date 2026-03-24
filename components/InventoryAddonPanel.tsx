"use client";

import { useMemo } from "react";
import type { InventoryAddonDraft, InventoryBindType } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { blurOnEnterKey } from "@/hooks/useBlurCommitText";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useProjectStore } from "@/store/projectStore";

interface InventoryAddonPanelProps {
  addon: InventoryAddonDraft;
  onChange: (next: InventoryAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

function toNonNegativeNumber(raw: string): number {
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function toPositiveInt(raw: string, fallback = 1): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function CommitTextInput({
  resetKey,
  value,
  onCommit,
  placeholder,
}: {
  resetKey: string;
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      key={resetKey}
      type="text"
      defaultValue={value}
      onBlur={(event) => {
        const next = event.currentTarget.value;
        if (next !== value) onCommit(next);
      }}
      onKeyDown={blurOnEnterKey}
      placeholder={placeholder}
      className={INPUT_CLASS}
    />
  );
}

export function InventoryAddonPanel({ addon, onChange, onRemove }: InventoryAddonPanelProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);

  const currentSectionId = useMemo(() => {
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "inventory") continue;
          if (sectionAddon.id === addon.id || sectionAddon.data?.id === addon.id) return section.id;
        }
      }
    }
    return null;
  }, [addon.id, projects]);

  const producedBySections = useMemo(() => {
    if (!currentSectionId) return [] as Array<{ id: string; title: string; projectId: string; sourceKind: "passive" | "recipe" }>;
    const out: Array<{ id: string; title: string; projectId: string; sourceKind: "passive" | "recipe" }> = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        const hasPassiveProducer = (section.addons || []).some((sectionAddon) => {
          if (sectionAddon.type !== "production") return false;
          return sectionAddon.data.mode === "passive" && sectionAddon.data.outputRef === currentSectionId;
        });
        const hasRecipeProducer = (section.addons || []).some((sectionAddon) => {
          if (sectionAddon.type !== "production") return false;
          if (sectionAddon.data.mode !== "recipe") return false;
          return (sectionAddon.data.outputs || []).some((output) => output.itemRef === currentSectionId);
        });
        if ((!hasPassiveProducer && !hasRecipeProducer) || seen.has(section.id)) continue;
        seen.add(section.id);
        out.push({
          id: section.id,
          title: section.title || section.id,
          projectId: project.id,
          sourceKind: hasPassiveProducer ? "passive" : "recipe",
        });
      }
    }
    return out.sort((a, b) => {
      const kindWeight = a.sourceKind === b.sourceKind ? 0 : a.sourceKind === "passive" ? -1 : 1;
      if (kindWeight !== 0) return kindWeight;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
  }, [currentSectionId, projects]);

  const ingredientForSections = useMemo(() => {
    if (!currentSectionId) return [] as Array<{ id: string; title: string; projectId: string }>;
    const out: Array<{ id: string; title: string; projectId: string }> = [];
    const seen = new Set<string>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        const usesAsIngredient = (section.addons || []).some((sectionAddon) => {
          if (sectionAddon.type !== "production") return false;
          if (sectionAddon.data.mode !== "recipe") return false;
          return (sectionAddon.data.ingredients || []).some((ingredient) => ingredient.itemRef === currentSectionId);
        });
        if (!usesAsIngredient || seen.has(section.id)) continue;
        seen.add(section.id);
        out.push({ id: section.id, title: section.title || section.id, projectId: project.id });
      }
    }
    return out.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  }, [currentSectionId, projects]);

  const commit = (patch: Partial<InventoryAddonDraft>) => {
    const next: InventoryAddonDraft = {
      ...addon,
      ...patch,
    };
    if (!next.stackable) next.maxStack = 1;
    if (!next.hasDurabilityConfig) {
      next.durability = 0;
      next.maxDurability = 0;
    }
    if (!next.hasVolumeConfig) {
      next.volume = 0;
    }
    next.weight = Math.max(0, next.weight);
    next.slotSize = Math.max(0, next.slotSize);
    next.durability = Math.max(0, next.durability);
    next.maxStack = Math.max(1, Math.floor(next.maxStack || 1));
    onChange(next);
  };

  const bindTypes: InventoryBindType[] = ["none", "onPickup", "onEquip"];

  return (
    <section className={PANEL_SHELL_CLASS}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
            {t("inventoryAddon.categoryLabel", "Categoria de inventario")}
          </span>
          <CommitTextInput
            resetKey={`${addon.id}-category-${addon.inventoryCategory}`}
            value={addon.inventoryCategory}
            onCommit={(next) => commit({ inventoryCategory: next })}
            placeholder={t("inventoryAddon.categoryPlaceholder", "Ex.: Consumivel")}
          />
        </label>

        <div className="rounded-lg border border-gray-700/80 bg-gray-900/60 p-3 space-y-2">
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("inventoryAddon.stackableLabel", "Pilha")}
            </span>
            <div className="flex items-center">
              <ToggleSwitch
                checked={addon.stackable}
                onChange={(next) => commit({ stackable: next })}
                ariaLabel={t("inventoryAddon.stackableLabel", "Pilha")}
              />
            </div>
          </div>
          {addon.stackable && (
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                {t("inventoryAddon.maxStackLabel", "Maximo por pilha")}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={addon.maxStack}
                onChange={(event) => commit({ maxStack: toPositiveInt(event.target.value, 1) })}
                className={INPUT_CLASS}
              />
            </label>
          )}
        </div>

        <div className="rounded-lg border border-gray-700/80 bg-gray-900/60 p-3 space-y-2">
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("inventoryAddon.hasDurabilityConfigLabel", "Usa durabilidade")}
            </span>
            <div className="flex items-center">
              <ToggleSwitch
                checked={addon.hasDurabilityConfig ?? false}
                onChange={(next) => commit({ hasDurabilityConfig: next })}
                ariaLabel={t("inventoryAddon.hasDurabilityConfigLabel", "Usa durabilidade")}
              />
            </div>
          </div>
          {(addon.hasDurabilityConfig ?? false) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                  {t("inventoryAddon.durabilityLabel", "Durabilidade inicial")}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={addon.durability}
                  onChange={(event) => commit({ durability: toNonNegativeNumber(event.target.value) })}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                  {t("inventoryAddon.maxDurabilityLabel", "Durabilidade maxima")}
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={addon.maxDurability ?? 0}
                  onChange={(event) => commit({ maxDurability: toNonNegativeNumber(event.target.value) })}
                  className={INPUT_CLASS}
                />
              </label>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-700/80 bg-gray-900/60 p-3 space-y-2">
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
              {t("inventoryAddon.hasVolumeConfigLabel", "Usa volume")}
            </span>
            <div className="flex items-center">
              <ToggleSwitch
                checked={addon.hasVolumeConfig ?? false}
                onChange={(next) => commit({ hasVolumeConfig: next })}
                ariaLabel={t("inventoryAddon.hasVolumeConfigLabel", "Usa volume")}
              />
            </div>
          </div>
          {(addon.hasVolumeConfig ?? false) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                  {t("inventoryAddon.weightLabel", "Peso")}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={addon.weight}
                  onChange={(event) => commit({ weight: toNonNegativeNumber(event.target.value) })}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                  {t("inventoryAddon.slotSizeLabel", "Espaco no inventario (slots)")}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={addon.slotSize}
                  onChange={(event) => commit({ slotSize: toNonNegativeNumber(event.target.value) })}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                  {t("inventoryAddon.volumeLabel", "Volume ocupado")}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={addon.volume ?? 0}
                  onChange={(event) => commit({ volume: toNonNegativeNumber(event.target.value) })}
                  className={INPUT_CLASS}
                />
              </label>
            </div>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
            {t("inventoryAddon.bindTypeLabel", "Vinculo do item")}
          </span>
          <select
            value={addon.bindType}
            onChange={(event) => commit({ bindType: event.target.value as InventoryBindType })}
            className={INPUT_CLASS}
          >
            {bindTypes.map((bindType) => (
              <option key={bindType} value={bindType}>
                {t(`inventoryAddon.bindType.${bindType}`, bindType)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block mt-3">
        <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
          {t("inventoryAddon.notesLabel", "Observacoes")}
        </span>
        <CommitTextInput
          resetKey={`${addon.id}-notes-${addon.notes || ""}`}
          value={addon.notes || ""}
          onCommit={(next) => commit({ notes: next || undefined })}
          placeholder={t("inventoryAddon.notesPlaceholder", "Informacoes adicionais de inventario")}
        />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-700/80 bg-gray-900/60 p-3">
          <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
            {t("inventoryAddon.showInShopLabel", "Pode aparecer na Loja")}
          </span>
          <div className="flex items-center">
            <ToggleSwitch
              checked={addon.showInShop}
              onChange={(next) => commit({ showInShop: next })}
              ariaLabel={t("inventoryAddon.showInShopLabel", "Pode aparecer na Loja")}
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-700/80 bg-gray-900/60 p-3">
          <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
            {t("inventoryAddon.consumableLabel", "Consumivel")}
          </span>
          <div className="flex items-center">
            <ToggleSwitch
              checked={addon.consumable}
              onChange={(next) => commit({ consumable: next })}
              ariaLabel={t("inventoryAddon.consumableLabel", "Consumivel")}
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-700/80 bg-gray-900/60 p-3">
          <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
            {t("inventoryAddon.discardableLabel", "Pode descartar")}
          </span>
          <div className="flex items-center">
            <ToggleSwitch
              checked={addon.discardable}
              onChange={(next) => commit({ discardable: next })}
              ariaLabel={t("inventoryAddon.discardableLabel", "Pode descartar")}
            />
          </div>
        </div>
      </div>

      {(producedBySections.length > 0 || ingredientForSections.length > 0) && (
        <div className="mt-3 rounded-lg border border-gray-700/80 bg-gray-900/60 p-3 space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            {t("inventoryAddon.productionConnectionsTitle", "Conexoes de producao")}
          </p>
          {producedBySections.length > 0 && (
            <p className="text-xs text-gray-200">
              <strong>{t("inventoryAddon.producedByLabel", "Produzido por")}:</strong>{" "}
              {producedBySections.map((entry, index) => (
                <span key={entry.id}>
                  {index > 0 ? ", " : ""}
                  <a
                    href={`/projects/${entry.projectId}/sections/${entry.id}`}
                    className="text-blue-300 hover:text-blue-200 underline"
                    title={t("inventoryAddon.openSectionLinkTitle", "Abrir secao")}
                  >
                    {entry.title}
                    <span aria-hidden="true" className="ml-1 align-middle opacity-80">
                      ↗
                    </span>
                  </a>
                  <span className="ml-1 rounded-full border border-gray-500/80 bg-gray-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-300">
                    {entry.sourceKind === "passive"
                      ? t("productionAddon.mode.passive", "Passiva")
                      : t("productionAddon.mode.recipe", "Receita")}
                  </span>
                </span>
              ))}
              .
            </p>
          )}
          {ingredientForSections.length > 0 && (
            <p className="text-xs text-gray-200">
              <strong>{t("inventoryAddon.ingredientForLabel", "Ingrediente para")}:</strong>{" "}
              {ingredientForSections.map((entry, index) => (
                <span key={entry.id}>
                  {index > 0 ? ", " : ""}
                  <a
                    href={`/projects/${entry.projectId}/sections/${entry.id}`}
                    className="text-blue-300 hover:text-blue-200 underline"
                    title={t("inventoryAddon.openSectionLinkTitle", "Abrir secao")}
                  >
                    {entry.title}
                    <span aria-hidden="true" className="ml-1 align-middle opacity-80">
                      ↗
                    </span>
                  </a>
                </span>
              ))}
              .
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onRemove} className={BUTTON_DANGER_CLASS}>
          {t("inventoryAddon.removeAddonButton", "Remover addon")}
        </button>
      </div>
    </section>
  );
}
