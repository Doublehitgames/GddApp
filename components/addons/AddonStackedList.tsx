"use client";

import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SectionAddon, SectionAddonType } from "@/lib/addons/types";
import { ADDON_REGISTRY, type AddonRegistryEntry } from "@/lib/addons/registry";
import { useI18n } from "@/lib/i18n/provider";
import { AddonCard } from "./AddonCard";

export interface AddonStackedListProps {
  addons: SectionAddon[];
  /** Addon with the editor drawer currently open (gets a highlighted border). */
  drawerOpenAddonId: string | null;
  selectedIds: Set<string>;
  lastClickedId: string | null;
  onReorder: (nextOrder: SectionAddon[]) => void;
  onOpenEditor: (addonId: string) => void;
  onRemove: (addonId: string) => void;
  onRename: (addonId: string, name: string) => void;
  onCopy?: (addon: SectionAddon) => void;
  onMove?: (addon: SectionAddon) => void;
  onSelectionToggle: (addonId: string, modifiers: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => void;
  /** Bulk action bar rendered by the parent; we just render the list here. */
  getAddonTypeLabel: (type: SectionAddonType) => string;
  /** Hook to render the read-only content of an addon. */
  renderReadOnly: (addon: SectionAddon, entry: AddonRegistryEntry) => React.ReactNode;
}

export function AddonStackedList({
  addons,
  drawerOpenAddonId,
  selectedIds,
  onReorder,
  onOpenEditor,
  onRemove,
  onRename,
  onCopy,
  onMove,
  onSelectionToggle,
  getAddonTypeLabel,
  renderReadOnly,
}: AddonStackedListProps) {
  const { t } = useI18n();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const entriesByType = useMemo(() => {
    const map = new Map<SectionAddonType, AddonRegistryEntry>();
    for (const entry of ADDON_REGISTRY) map.set(entry.type, entry);
    return map;
  }, []);

  type RenderUnit =
    | { kind: "single"; addon: SectionAddon }
    | { kind: "pair"; schema: SectionAddon; remote: SectionAddon };

  const renderUnits = useMemo((): RenderUnit[] => {
    const units: RenderUnit[] = [];
    let i = 0;
    while (i < addons.length) {
      const cur = addons[i];
      const nxt = addons[i + 1];
      const curIsSchema = cur.type === "dataSchema" || cur.type === "genericStats";
      const nxtIsRemote = nxt?.type === "exportSchema";
      const curIsRemote = cur.type === "exportSchema";
      const nxtIsSchema = nxt && (nxt.type === "dataSchema" || nxt.type === "genericStats");
      if (curIsSchema && nxtIsRemote) {
        units.push({ kind: "pair", schema: cur, remote: nxt });
        i += 2;
      } else if (curIsRemote && nxtIsSchema) {
        units.push({ kind: "pair", schema: nxt, remote: cur });
        i += 2;
      } else {
        units.push({ kind: "single", addon: cur });
        i++;
      }
    }
    return units;
  }, [addons]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = addons.findIndex((a) => a.id === String(active.id));
    const newIndex = addons.findIndex((a) => a.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = [...addons];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    onReorder(next);
  };

  if (addons.length === 0) {
    return (
      <p className="text-xs text-gray-500 italic py-2">
        {t("addonStackedList.empty", "Nenhum addon nesta página.")}
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={addons.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-gray-800/60">
          {renderUnits.map((unit) => {
            if (unit.kind === "pair") {
              const { schema, remote } = unit;
              const schemaEntry = entriesByType.get(schema.type) || entriesByType.get("dataSchema");
              const remoteEntry = entriesByType.get(remote.type);
              if (!schemaEntry || !remoteEntry) return null;
              const renderCard = (addon: SectionAddon, entry: AddonRegistryEntry) => (
                <AddonCard
                  key={addon.id}
                  addon={addon}
                  emoji={entry.emoji}
                  label={addon.name || getAddonTypeLabel(addon.type)}
                  typeLabel={getAddonTypeLabel(addon.type)}
                  isSelected={selectedIds.has(addon.id)}
                  isDrawerOpen={drawerOpenAddonId === addon.id}
                  onOpenEditor={() => onOpenEditor(addon.id)}
                  onSelectionClick={(mods) => onSelectionToggle(addon.id, mods)}
                  onRename={(name) => onRename(addon.id, name)}
                  onCopy={onCopy ? () => onCopy(addon) : undefined}
                  onMove={onMove ? () => onMove(addon) : undefined}
                  onRemove={() => onRemove(addon.id)}
                >
                  {renderReadOnly(addon, entry)}
                </AddonCard>
              );
              return (
                <div key={`pair-${schema.id}-${remote.id}`} className="flex gap-0 items-start">
                  <div className="flex-1 min-w-0 border-r border-gray-800/60 pr-2">
                    {renderCard(schema, schemaEntry)}
                  </div>
                  <div className="flex-1 min-w-0 pl-2">
                    {renderCard(remote, remoteEntry)}
                  </div>
                </div>
              );
            }
            const { addon } = unit;
            const entry = entriesByType.get(addon.type);
            const resolvedEntry = entry || entriesByType.get(addon.type === "genericStats" ? "dataSchema" : addon.type);
            if (!resolvedEntry) return null;
            return (
              <AddonCard
                key={addon.id}
                addon={addon}
                emoji={resolvedEntry.emoji}
                label={addon.name || getAddonTypeLabel(addon.type)}
                typeLabel={getAddonTypeLabel(addon.type)}
                isSelected={selectedIds.has(addon.id)}
                isDrawerOpen={drawerOpenAddonId === addon.id}
                onOpenEditor={() => onOpenEditor(addon.id)}
                onSelectionClick={(mods) => onSelectionToggle(addon.id, mods)}
                onRename={(name) => onRename(addon.id, name)}
                onCopy={onCopy ? () => onCopy(addon) : undefined}
                onMove={onMove ? () => onMove(addon) : undefined}
                onRemove={() => onRemove(addon.id)}
              >
                {renderReadOnly(addon, resolvedEntry)}
              </AddonCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
