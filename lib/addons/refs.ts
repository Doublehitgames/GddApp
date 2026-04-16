import type { SectionAddon, SectionAddonType } from "@/lib/addons/types";

/**
 * ── Intra-section refs ─────────────────────────────────────────────────
 *
 * Some addon fields hold IDs of other addons *within the same section*
 * (productionRef, progression links, exportSchema addonId). When an addon
 * is moved or copied to a different section, those refs point to addons
 * that are no longer siblings and must be cleared.
 */

type ExportSchemaNodeLike = {
  arraySource?: { addonId?: string } | null;
  binding?: { source?: string; addonId?: string } | null;
  children?: ExportSchemaNodeLike[];
  itemTemplate?: ExportSchemaNodeLike[];
};

function shouldPreserve(addonId: string | undefined, preserve: Set<string> | undefined): boolean {
  return !!addonId && !!preserve && preserve.has(addonId);
}

function clearExportSchemaRefs(
  nodes: ExportSchemaNodeLike[] | undefined,
  preserve?: Set<string>
): void {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (node.arraySource && typeof node.arraySource === "object") {
      if ("addonId" in node.arraySource && !shouldPreserve(node.arraySource.addonId, preserve)) {
        node.arraySource.addonId = undefined;
      }
    }
    if (
      node.binding &&
      typeof node.binding === "object" &&
      node.binding.source === "dataSchema" &&
      "addonId" in node.binding &&
      !shouldPreserve(node.binding.addonId, preserve)
    ) {
      node.binding.addonId = undefined;
    }
    if (Array.isArray(node.children)) clearExportSchemaRefs(node.children, preserve);
    if (Array.isArray(node.itemTemplate)) clearExportSchemaRefs(node.itemTemplate, preserve);
  }
}

/**
 * Mutates the given `data` object in place, clearing refs that point to
 * addons inside the same section (productionRef, progression links, export
 * schema addonId). Cross-section refs (section IDs) are left untouched.
 *
 * If `preserveIds` is provided, refs whose target is in the set are kept
 * intact — used by cascade moves where the referenced addons are travelling
 * together to the destination.
 */
export function clearIntraSectionRefs(
  data: Record<string, unknown>,
  type: SectionAddonType,
  preserveIds?: Set<string>
): void {
  if (type === "dataSchema" || type === "genericStats") {
    const entries = (data as { entries?: Array<Record<string, unknown>> }).entries;
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if ("productionRef" in entry && !shouldPreserve(entry.productionRef as string | undefined, preserveIds)) {
          entry.productionRef = undefined;
        }
      }
    }
    return;
  }

  if (type === "production") {
    const production = data as Record<string, unknown>;
    for (const key of [
      "minOutputProgressionLink",
      "maxOutputProgressionLink",
      "intervalSecondsProgressionLink",
      "craftTimeSecondsProgressionLink",
    ] as const) {
      const link = production[key] as { progressionAddonId?: string } | undefined;
      if (link && !shouldPreserve(link.progressionAddonId, preserveIds)) {
        production[key] = undefined;
      }
    }
    return;
  }

  if (type === "exportSchema") {
    clearExportSchemaRefs((data as { nodes?: ExportSchemaNodeLike[] }).nodes, preserveIds);
    return;
  }
}

/**
 * Collects IDs of sibling addons that this addon references via intra-section
 * refs. Used to detect cascade-move candidates before a move.
 */
export function collectIntraSectionDeps(addon: SectionAddon): string[] {
  const ids = new Set<string>();
  if (addon.type === "dataSchema" || addon.type === "genericStats") {
    const entries = (addon.data as { entries?: Array<{ productionRef?: string }> }).entries;
    if (Array.isArray(entries)) {
      for (const e of entries) {
        if (typeof e.productionRef === "string" && e.productionRef) ids.add(e.productionRef);
      }
    }
  } else if (addon.type === "production") {
    const d = addon.data;
    for (const key of [
      "minOutputProgressionLink",
      "maxOutputProgressionLink",
      "intervalSecondsProgressionLink",
      "craftTimeSecondsProgressionLink",
    ] as const) {
      const link = d[key];
      if (link?.progressionAddonId) ids.add(link.progressionAddonId);
    }
  } else if (addon.type === "exportSchema") {
    const visit = (nodes: ExportSchemaNodeLike[] | undefined) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node.arraySource?.addonId) ids.add(node.arraySource.addonId);
        if (node.binding?.source === "dataSchema" && node.binding.addonId) {
          ids.add(node.binding.addonId);
        }
        if (Array.isArray(node.children)) visit(node.children);
        if (Array.isArray(node.itemTemplate)) visit(node.itemTemplate);
      }
    };
    visit(addon.data.nodes as ExportSchemaNodeLike[] | undefined);
  }
  return [...ids];
}

/**
 * ── Reverse refs ───────────────────────────────────────────────────────
 *
 * When a user moves addon X of type T from section A to section B, other
 * addons in the project may hold a section-ID ref that was pointing to A
 * because that's where X lived. After the move, those refs should repoint
 * to B — unless A still has another addon of type T, in which case we
 * can't tell which one the ref was meaning (leave it alone).
 */

type SectionWithAddons = { id: string; addons?: SectionAddon[] };

type ReverseRefPatch = (
  addon: SectionAddon,
  fromSectionId: string,
  toSectionId: string,
  bump: () => void
) => SectionAddon;

/**
 * Patch functions per *moved* addon type. Each patch scans an addon and
 * rewrites any section-ID ref that pointed at `fromSectionId` so it now
 * points at `toSectionId`. Returns a new addon when changed, original
 * otherwise.
 */
const REVERSE_REF_PATCHES: Partial<Record<SectionAddonType, ReverseRefPatch>> = {
  xpBalance: (addon, from, to, bump) => {
    // DataSchemaEntry.unitXpRef + EconomyLinkAddonDraft.unlockRef
    if (addon.type === "dataSchema" || addon.type === "genericStats") {
      const entries = (addon.data as { entries?: Array<{ unitXpRef?: string }> }).entries;
      if (!Array.isArray(entries)) return addon;
      let changed = false;
      const nextEntries = entries.map((e) => {
        if (e.unitXpRef === from) {
          changed = true;
          bump();
          return { ...e, unitXpRef: to };
        }
        return e;
      });
      if (!changed) return addon;
      return { ...addon, data: { ...addon.data, entries: nextEntries } } as SectionAddon;
    }
    if (addon.type === "economyLink") {
      const data = addon.data as { unlockRef?: string };
      if (data.unlockRef === from) {
        bump();
        return { ...addon, data: { ...addon.data, unlockRef: to } };
      }
    }
    return addon;
  },

  currency: (addon, from, to, bump) => {
    if (addon.type !== "economyLink") return addon;
    const data = addon.data;
    let changed = false;
    const nextData = { ...data };
    if (data.buyCurrencyRef === from) {
      nextData.buyCurrencyRef = to;
      changed = true;
      bump();
    }
    if (data.sellCurrencyRef === from) {
      nextData.sellCurrencyRef = to;
      changed = true;
      bump();
    }
    if (!changed) return addon;
    return { ...addon, data: nextData };
  },

  inventory: (addon, from, to, bump) => {
    if (addon.type === "economyLink") {
      const data = addon.data;
      if (data.producedItemRef === from) {
        bump();
        return { ...addon, data: { ...data, producedItemRef: to } };
      }
      return addon;
    }
    if (addon.type === "production") {
      const data = addon.data;
      let changed = false;
      const nextData = { ...data };
      if (data.outputRef === from) {
        nextData.outputRef = to;
        changed = true;
        bump();
      }
      const remapItems = <T extends { itemRef: string }>(arr: T[] | undefined): T[] | undefined => {
        if (!Array.isArray(arr)) return arr;
        let innerChanged = false;
        const next = arr.map((item) => {
          if (item.itemRef === from) {
            innerChanged = true;
            bump();
            return { ...item, itemRef: to };
          }
          return item;
        });
        if (innerChanged) {
          changed = true;
          return next;
        }
        return arr;
      };
      const nextIngredients = remapItems(data.ingredients);
      if (nextIngredients !== data.ingredients) nextData.ingredients = nextIngredients ?? [];
      const nextOutputs = remapItems(data.outputs);
      if (nextOutputs !== data.outputs) nextData.outputs = nextOutputs ?? [];
      if (!changed) return addon;
      return { ...addon, data: nextData };
    }
    return addon;
  },

  economyLink: (addon, from, to, bump) => {
    if (addon.type !== "dataSchema" && addon.type !== "genericStats") return addon;
    const entries = addon.data.entries;
    if (!Array.isArray(entries)) return addon;
    let changed = false;
    const nextEntries = entries.map((e) => {
      if (e.economyLinkRef === from) {
        changed = true;
        bump();
        return { ...e, economyLinkRef: to };
      }
      return e;
    });
    if (!changed) return addon;
    return { ...addon, data: { ...addon.data, entries: nextEntries } } as SectionAddon;
  },

  attributeDefinitions: (addon, from, to, bump) => {
    if (addon.type === "attributeProfile") {
      const data = addon.data;
      if (data.definitionsRef === from) {
        bump();
        return { ...addon, data: { ...data, definitionsRef: to } };
      }
      return addon;
    }
    if (addon.type === "attributeModifiers") {
      const data = addon.data;
      if (data.definitionsRef === from) {
        bump();
        return { ...addon, data: { ...data, definitionsRef: to } };
      }
      return addon;
    }
    if (addon.type === "progressionTable") {
      const columns = addon.data.columns;
      if (!Array.isArray(columns)) return addon;
      let changed = false;
      const nextColumns = columns.map((col) => {
        if (col.attributeRef?.definitionsRef === from) {
          changed = true;
          bump();
          return {
            ...col,
            attributeRef: { ...col.attributeRef, definitionsRef: to },
          };
        }
        return col;
      });
      if (!changed) return addon;
      return { ...addon, data: { ...addon.data, columns: nextColumns } };
    }
    return addon;
  },
};

/**
 * Given the project's sections *after* the addon has already been removed
 * from `fromSectionId`, returns a new array with any reverse-ref updated
 * to point at `toSectionId` and the total count of updated fields.
 *
 * If the source section still contains another addon of the same type as
 * the moved one, returns the input unchanged with count 0 — the ref might
 * be meaning the sibling that stayed behind, so we don't guess.
 */
export function collectReverseRefUpdates<T extends SectionWithAddons>(
  sections: T[],
  movedType: SectionAddonType,
  fromSectionId: string,
  toSectionId: string
): { updatedSections: T[]; count: number } {
  const origin = sections.find((s) => s.id === fromSectionId);
  const originStillHasType = (origin?.addons || []).some((a) => a.type === movedType);
  if (originStillHasType) return { updatedSections: sections, count: 0 };

  const patch = REVERSE_REF_PATCHES[movedType];
  if (!patch) return { updatedSections: sections, count: 0 };

  let count = 0;
  const bump = () => {
    count += 1;
  };

  let anyChanged = false;
  const next = sections.map((section) => {
    const addons = section.addons || [];
    let changed = false;
    const nextAddons = addons.map((a) => {
      const result = patch(a, fromSectionId, toSectionId, bump);
      if (result !== a) changed = true;
      return result;
    });
    if (!changed) return section;
    anyChanged = true;
    return { ...section, addons: nextAddons };
  });

  return { updatedSections: anyChanged ? next : sections, count };
}
