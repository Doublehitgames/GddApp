"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { InventoryAddonDraft, InventoryBindType } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useProjectStore } from "@/store/projectStore";
import { sectionPathById } from "@/lib/utils/slug";
import { useCurrentProjectId } from "@/hooks/useCurrentProjectId";
import { CommitNumberInput, CommitTextInput } from "@/components/common/CommitInput";
import { LibraryLabelPath } from "@/components/common/LibraryLabelPath";

type LibraryFieldOption = {
  libraryAddonId: string;
  libraryName: string;
  sectionTitle: string;
  entryId: string;
  key: string;
  label: string;
  description?: string;
};

interface InventoryAddonPanelProps {
  addon: InventoryAddonDraft;
  onChange: (next: InventoryAddonDraft) => void;
  onRemove: () => void;
}

const PANEL_SHELL_CLASS = "rounded-2xl border border-gray-700/80 bg-gray-900/70 p-4 md:p-5";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500";
const BUTTON_DANGER_CLASS = "rounded-lg border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50";

export function InventoryAddonPanel({ addon, onChange, onRemove }: InventoryAddonPanelProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const currentProjectId = useCurrentProjectId();
  const getSectionUrl = (pId: string | undefined, sId: string | undefined): string => {
    if (!pId || !sId) return "#";
    const p = projects.find((proj) => proj.id === pId);
    if (!p) return "#";
    return sectionPathById(p, sId);
  };
  const [isLibraryPickerOpen, setIsLibraryPickerOpen] = useState(false);
  const libraryPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLibraryPickerOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (libraryPickerRef.current?.contains(event.target as Node)) return;
      setIsLibraryPickerOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsLibraryPickerOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLibraryPickerOpen]);

  const availableLibraryFields = useMemo<LibraryFieldOption[]>(() => {
    const out: LibraryFieldOption[] = [];
    const seenLibraryIds = new Set<string>();
    const scope = currentProjectId ? projects.filter((p) => p.id === currentProjectId) : projects;
    for (const project of scope) {
      for (const sec of project.sections || []) {
        const sectionTitle = sec.title?.trim() || sec.id;
        for (const sectionAddon of sec.addons || []) {
          if (sectionAddon.type !== "fieldLibrary") continue;
          if (seenLibraryIds.has(sectionAddon.id)) continue;
          seenLibraryIds.add(sectionAddon.id);
          const libraryName = sectionAddon.name?.trim() || sectionAddon.data.name?.trim() || "Biblioteca";
          for (const entry of sectionAddon.data.entries || []) {
            out.push({
              libraryAddonId: sectionAddon.id,
              libraryName,
              sectionTitle,
              entryId: entry.id,
              key: entry.key,
              label: entry.label,
              description: entry.description,
            });
          }
        }
      }
    }
    return out;
  }, [projects, currentProjectId]);

  const linkedCategoryOption = useMemo(() => {
    if (!addon.categoryLibraryRef) return null;
    return (
      availableLibraryFields.find(
        (opt) =>
          opt.libraryAddonId === addon.categoryLibraryRef!.libraryAddonId &&
          opt.entryId === addon.categoryLibraryRef!.entryId
      ) || null
    );
  }, [addon.categoryLibraryRef, availableLibraryFields]);

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
        <div className="block">
          <span className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400">
            <span>{t("inventoryAddon.categoryLabel", "Categoria de inventario")}</span>
            {!addon.categoryLibraryRef && availableLibraryFields.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLibraryPickerOpen((prev) => !prev)}
                  aria-label={t("inventoryAddon.linkLibraryAriaLabel", "Vincular à Biblioteca de Campos")}
                  aria-expanded={isLibraryPickerOpen}
                  title={t("inventoryAddon.linkLibraryButton", "Vincular à Biblioteca de Campos")}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-gray-600 bg-gray-800 text-[11px] text-gray-300 hover:bg-gray-700 hover:text-gray-100"
                >
                  📚
                </button>
                {isLibraryPickerOpen && (
                  <div
                    ref={libraryPickerRef}
                    role="listbox"
                    aria-label={t("inventoryAddon.libraryPickerTitle", "Selecionar campo da Biblioteca")}
                    className="absolute right-0 top-full z-20 mt-1 w-72 max-h-64 overflow-y-auto rounded-md border border-gray-700 bg-gray-950/95 p-1 text-xs text-gray-200 shadow-xl normal-case"
                  >
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {t("inventoryAddon.libraryPickerTitle", "Selecionar campo da Biblioteca")}
                    </p>
                    {(() => {
                      const byLibrary = new Map<string, { libraryName: string; sectionTitle: string; entries: LibraryFieldOption[] }>();
                      for (const opt of availableLibraryFields) {
                        const bucket = byLibrary.get(opt.libraryAddonId);
                        if (bucket) bucket.entries.push(opt);
                        else byLibrary.set(opt.libraryAddonId, { libraryName: opt.libraryName, sectionTitle: opt.sectionTitle, entries: [opt] });
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
                              onClick={() => {
                                commit({
                                  inventoryCategory: opt.label,
                                  categoryLibraryRef: { libraryAddonId: opt.libraryAddonId, entryId: opt.entryId },
                                });
                                setIsLibraryPickerOpen(false);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-gray-800"
                              title={opt.description || undefined}
                            >
                              <LibraryLabelPath value={opt.label} className="flex-1" />
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
          {addon.categoryLibraryRef ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 rounded-lg border border-sky-600/40 bg-sky-900/20 px-2.5 py-1.5 text-xs text-sky-200">
                <span aria-hidden className="text-[10px]">📎</span>
                <span className="flex-1 flex flex-wrap items-center gap-1">
                  <LibraryLabelPath value={linkedCategoryOption?.label ?? addon.inventoryCategory} />
                  {linkedCategoryOption && (
                    <span className="text-[10px] text-sky-400/80">({linkedCategoryOption.key})</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => commit({ categoryLibraryRef: undefined })}
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-sky-300 hover:bg-sky-800/50 hover:text-sky-100"
                  aria-label={t("inventoryAddon.unlinkLibraryAriaLabel", "Desvincular da Biblioteca")}
                >
                  ✕
                </button>
              </div>
              {!linkedCategoryOption && (
                <p className="text-[11px] text-amber-300">
                  ⚠️{" "}
                  {t(
                    "inventoryAddon.brokenLibraryRef",
                    "O campo vinculado à Biblioteca não foi encontrado. Usando o último nome salvo como fallback."
                  )}
                </p>
              )}
            </div>
          ) : (
            <CommitTextInput
              value={addon.inventoryCategory}
              onCommit={(next) => commit({ inventoryCategory: next })}
              placeholder={t("inventoryAddon.categoryPlaceholder", "Ex.: Consumivel")}
              className={INPUT_CLASS}
            />
          )}
        </div>

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
              <CommitNumberInput
                value={addon.maxStack}
                onCommit={(next) => commit({ maxStack: next })}
                min={1}
                step={1}
                integer
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
                <CommitNumberInput
                  value={addon.durability}
                  onCommit={(next) => commit({ durability: next })}
                  min={0}
                  step={1}
                  className={INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                  {t("inventoryAddon.maxDurabilityLabel", "Durabilidade maxima")}
                </span>
                <CommitNumberInput
                  value={addon.maxDurability ?? 0}
                  onCommit={(next) => commit({ maxDurability: next })}
                  min={0}
                  step={1}
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
                <CommitNumberInput
                  value={addon.weight}
                  onCommit={(next) => commit({ weight: next })}
                  min={0}
                  step="0.01"
                  className={INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                  {t("inventoryAddon.slotSizeLabel", "Espaco no inventario (slots)")}
                </span>
                <CommitNumberInput
                  value={addon.slotSize}
                  onCommit={(next) => commit({ slotSize: next })}
                  min={0}
                  step="0.1"
                  className={INPUT_CLASS}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-gray-400">
                  {t("inventoryAddon.volumeLabel", "Volume ocupado")}
                </span>
                <CommitNumberInput
                  value={addon.volume ?? 0}
                  onCommit={(next) => commit({ volume: next })}
                  min={0}
                  step="0.01"
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
          value={addon.notes || ""}
          onCommit={(next) => commit({ notes: next || undefined })}
          placeholder={t("inventoryAddon.notesPlaceholder", "Informacoes adicionais de inventario")}
          className={INPUT_CLASS}
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
                    href={getSectionUrl(entry.projectId, entry.id)}
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
                    href={getSectionUrl(entry.projectId, entry.id)}
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

    </section>
  );
}
