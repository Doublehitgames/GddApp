import type { SectionAddon, SectionAddonType } from "@/lib/addons/types";
import type { FieldBinding } from "@/lib/addons/fieldBinding";

/**
 * ── Intra-section refs ─────────────────────────────────────────────────
 *
 * Some addon fields hold IDs of other addons *within the same section*
 * (productionRef, progression links, exportSchema addonId). When an addon
 * is moved or copied to a different section, those refs point to addons
 * that are no longer siblings and must be cleared.
 */

type ExportSchemaNodeLike = {
  arraySource?: { type?: string; addonId?: string } | null;
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

/** Tipos de addon que um exportSchema referencia por `addonId` (todos singleton por página). */
type ExportSchemaRefType = "progressionTable" | "craftTable" | "skills";

/** Resolve o id do addon do destino para um tipo (tratando dataSchema≈genericStats). */
function targetAddonIdOfType(
  targetAddons: ReadonlyArray<{ id: string; type: SectionAddonType }>,
  type: SectionAddonType
): string | undefined {
  if (type === "dataSchema" || type === "genericStats") {
    return targetAddons.find((a) => a.type === "dataSchema" || a.type === "genericStats")?.id;
  }
  return targetAddons.find((a) => a.type === type)?.id;
}

/**
 * Re-aponta as refs intra-seção de um exportSchema (RemoteConfig) para os addons
 * da seção de *destino*. Como os tipos referenciados (progressionTable, craftTable,
 * skills, dataSchema) são singleton por página, o match por tipo é inequívoco.
 *
 * Sempre re-aponta (não só preenche vazios): no copy/move via store as refs
 * carregam o id da origem, então precisam ser remapeadas para o equivalente do
 * destino. Em cascade-move o irmão migra com o id original, então o destino tem
 * um addon daquele tipo com aquele id → o remap resolve para ele mesmo. Se o
 * destino não tem o tipo, a ref fica vazia. Muta `data` in place.
 */
export function relinkExportSchemaRefsToSection(
  data: Record<string, unknown>,
  targetAddons: ReadonlyArray<{ id: string; type: SectionAddonType }>
): void {
  const visit = (nodes: ExportSchemaNodeLike[] | undefined): void => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      const src = node.arraySource;
      if (
        src &&
        typeof src === "object" &&
        (src.type === "progressionTable" || src.type === "craftTable" || src.type === "skills")
      ) {
        src.addonId = targetAddonIdOfType(targetAddons, src.type as ExportSchemaRefType);
      }
      if (node.binding && node.binding.source === "dataSchema") {
        node.binding.addonId = targetAddonIdOfType(targetAddons, "dataSchema");
      }
      if (Array.isArray(node.children)) visit(node.children);
      if (Array.isArray(node.itemTemplate)) visit(node.itemTemplate);
    }
  };
  visit((data as { nodes?: ExportSchemaNodeLike[] }).nodes);
}

/**
 * Re-aponta um FieldBinding intra-página para o addon equivalente da seção de
 * destino. Retorna o binding remapeado, ou `undefined` quando o destino não tem
 * o addon necessário (a ref não tem como ser resolvida → fica sem vínculo).
 *
 * - `production`: por addonId → production do destino.
 * - `progressionColumn`: por progressionAddonId → progressionTable do destino.
 * - `economyLink`: o campo `sectionId` guarda na verdade o ID do ADDON economyLink
 *   (ver DataSchemaAddonPanel — só lista economyLinks da mesma página) → re-aponta
 *   para o economyLink do destino, igual production.
 * - `unitXp`: `sectionId` é id de SEÇÃO de verdade (o xpBalance pode estar em outra
 *   página) → só re-aponta se apontava para a página de ORIGEM; refs a outras ficam.
 * - demais sources (manual, sheets, library, pageDataId): inalterados.
 */
function relinkBindingToSection(
  binding: FieldBinding | undefined,
  fromSectionId: string,
  toSectionId: string,
  targetAddons: ReadonlyArray<{ id: string; type: SectionAddonType }>
): FieldBinding | undefined {
  if (!binding) return binding;
  switch (binding.source) {
    case "production": {
      const id = targetAddonIdOfType(targetAddons, "production");
      return id ? { ...binding, addonId: id } : undefined;
    }
    case "progressionColumn": {
      const id = targetAddonIdOfType(targetAddons, "progressionTable");
      return id ? { ...binding, progressionAddonId: id } : undefined;
    }
    case "economyLink": {
      // `sectionId` aqui guarda o id do ADDON economyLink (ref intra-página), não a seção.
      const id = targetAddonIdOfType(targetAddons, "economyLink");
      return id ? { ...binding, sectionId: id } : undefined;
    }
    case "unitXp": {
      if (binding.sectionId !== fromSectionId) return binding;
      return targetAddons.some((a) => a.type === "xpBalance")
        ? { ...binding, sectionId: toSectionId }
        : undefined;
    }
    default:
      return binding;
  }
}

/**
 * Religa TODAS as refs intra-página de um addon aos addons equivalentes da seção
 * de destino, em vez de simplesmente limpá-las (como faz `clearIntraSectionRefs`).
 * Usado no copy/move via store, onde o destino é conhecido — assim os vínculos de
 * valor "continuam funcionando" quando a página de destino já tem os addons certos.
 * Muta `data` in place.
 */
export function relinkIntraSectionRefsToSection(
  data: Record<string, unknown>,
  type: SectionAddonType,
  fromSectionId: string,
  toSectionId: string,
  targetAddons: ReadonlyArray<{ id: string; type: SectionAddonType }>
): void {
  const relink = (b: FieldBinding | undefined) =>
    relinkBindingToSection(b, fromSectionId, toSectionId, targetAddons);

  if (type === "dataSchema" || type === "genericStats") {
    const entries = (data as { entries?: Array<Record<string, unknown>> }).entries;
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        entry.binding = relink(entry.binding as FieldBinding | undefined);
      }
    }
    return;
  }

  if (type === "production") {
    const d = data as Record<string, unknown>;
    for (const key of [
      "minOutputBinding",
      "outputMinBinding",
      "maxOutputBinding",
      "intervalSecondsBinding",
      "intervalSecondsMinBinding",
      "intervalSecondsMaxBinding",
      "capacityBinding",
      "capacityMinBinding",
      "capacityMaxBinding",
      "craftTimeSecondsBinding",
      "craftTimeSecondsMinBinding",
      "craftTimeSecondsMaxBinding",
    ] as const) {
      d[key] = relink(d[key] as FieldBinding | undefined);
    }
    return;
  }

  if (type === "economyLink") {
    const d = data as Record<string, unknown>;
    for (const key of [
      "buyValueBinding",
      "minBuyValueBinding",
      "maxBuyValueBinding",
      "sellValueBinding",
      "minSellValueBinding",
      "maxSellValueBinding",
      "unlockValueBinding",
    ] as const) {
      d[key] = relink(d[key] as FieldBinding | undefined);
    }
    return;
  }

  if (type === "exportSchema") {
    relinkExportSchemaRefsToSection(data, targetAddons);
    return;
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
        const binding = entry.binding as FieldBinding | undefined;
        if (binding?.source === "production" && !shouldPreserve(binding.addonId, preserveIds)) {
          entry.binding = undefined;
        }
      }
    }
    return;
  }

  if (type === "production") {
    const production = data as Record<string, unknown>;
    for (const key of [
      "minOutputBinding",
      "outputMinBinding",
      "maxOutputBinding",
      "intervalSecondsBinding",
      "intervalSecondsMinBinding",
      "intervalSecondsMaxBinding",
      "capacityBinding",
      "capacityMinBinding",
      "capacityMaxBinding",
      "craftTimeSecondsBinding",
      "craftTimeSecondsMinBinding",
      "craftTimeSecondsMaxBinding",
    ] as const) {
      const binding = production[key] as FieldBinding | undefined;
      if (binding?.source === "progressionColumn" && !shouldPreserve(binding.progressionAddonId, preserveIds)) {
        production[key] = undefined;
      }
    }
    return;
  }

  if (type === "economyLink") {
    for (const key of [
      "buyValueBinding",
      "minBuyValueBinding",
      "maxBuyValueBinding",
      "sellValueBinding",
      "minSellValueBinding",
      "maxSellValueBinding",
      "unlockValueBinding",
    ] as const) {
      const binding = data[key] as FieldBinding | undefined;
      if (binding?.source === "progressionColumn" && !shouldPreserve(binding.progressionAddonId, preserveIds)) {
        data[key] = undefined;
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
    const entries = (addon.data as { entries?: Array<{ binding?: FieldBinding }> }).entries;
    if (Array.isArray(entries)) {
      for (const e of entries) {
        if (e.binding?.source === "production") ids.add(e.binding.addonId);
      }
    }
  } else if (addon.type === "production") {
    const d = addon.data;
    for (const key of [
      "minOutputBinding",
      "outputMinBinding",
      "maxOutputBinding",
      "intervalSecondsBinding",
      "intervalSecondsMinBinding",
      "intervalSecondsMaxBinding",
      "capacityBinding",
      "capacityMinBinding",
      "capacityMaxBinding",
      "craftTimeSecondsBinding",
      "craftTimeSecondsMinBinding",
      "craftTimeSecondsMaxBinding",
    ] as const) {
      const binding = d[key] as FieldBinding | undefined;
      if (binding?.source === "progressionColumn") ids.add(binding.progressionAddonId);
    }
  } else if (addon.type === "economyLink") {
    const d = addon.data;
    for (const key of [
      "buyValueBinding",
      "minBuyValueBinding",
      "maxBuyValueBinding",
      "sellValueBinding",
      "minSellValueBinding",
      "maxSellValueBinding",
      "unlockValueBinding",
    ] as const) {
      const binding = d[key] as FieldBinding | undefined;
      if (binding?.source === "progressionColumn") ids.add(binding.progressionAddonId);
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
type CraftUnlockSlot = "level" | "currency" | "item";
const CRAFT_UNLOCK_REF_KEYS: Record<CraftUnlockSlot, "xpAddonRef" | "currencyAddonRef" | "itemRef"> = {
  level: "xpAddonRef",
  currency: "currencyAddonRef",
  item: "itemRef",
};

function remapCraftTableUnlockRef(
  addon: SectionAddon,
  slot: CraftUnlockSlot,
  from: string,
  to: string,
  bump: () => void
): SectionAddon {
  if (addon.type !== "craftTable") return addon;
  const refKey = CRAFT_UNLOCK_REF_KEYS[slot];
  const entries = addon.data.entries;
  if (!Array.isArray(entries)) return addon;
  let changed = false;
  const nextEntries = entries.map((entry) => {
    const slotValue = entry.unlock?.[slot] as Record<string, unknown> | undefined;
    if (!slotValue) return entry;
    if (slotValue[refKey] !== from) return entry;
    changed = true;
    bump();
    return {
      ...entry,
      unlock: {
        ...entry.unlock,
        [slot]: { ...slotValue, [refKey]: to },
      },
    };
  });
  if (!changed) return addon;
  return { ...addon, data: { ...addon.data, entries: nextEntries } };
}

function remapCraftTableProductionRef(
  addon: SectionAddon,
  from: string,
  to: string,
  bump: () => void
): SectionAddon {
  if (addon.type !== "craftTable") return addon;
  const entries = addon.data.entries;
  if (!Array.isArray(entries)) return addon;
  let changed = false;
  const nextEntries = entries.map((entry) => {
    if (entry.productionRef !== from) return entry;
    changed = true;
    bump();
    return { ...entry, productionRef: to };
  });
  if (!changed) return addon;
  return { ...addon, data: { ...addon.data, entries: nextEntries } };
}

const REVERSE_REF_PATCHES: Partial<Record<SectionAddonType, ReverseRefPatch>> = {
  xpBalance: (addon, from, to, bump) => {
    // DataSchemaEntry.binding (unitXp source) + EconomyLinkAddonDraft.unlockRef
    if (addon.type === "dataSchema" || addon.type === "genericStats") {
      const entries = (addon.data as { entries?: Array<{ binding?: FieldBinding }> }).entries;
      if (!Array.isArray(entries)) return addon;
      let changed = false;
      const nextEntries = entries.map((e) => {
        if (e.binding?.source === "unitXp" && e.binding.sectionId === from) {
          changed = true;
          bump();
          return { ...e, binding: { source: "unitXp" as const, sectionId: to } };
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
    if (addon.type === "craftTable") return remapCraftTableUnlockRef(addon, "level", from, to, bump);
    return addon;
  },

  currency: (addon, from, to, bump) => {
    if (addon.type === "craftTable") return remapCraftTableUnlockRef(addon, "currency", from, to, bump);
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

  production: (addon, from, to, bump) => {
    if (addon.type === "craftTable") return remapCraftTableProductionRef(addon, from, to, bump);
    return addon;
  },

  inventory: (addon, from, to, bump) => {
    if (addon.type === "craftTable") return remapCraftTableUnlockRef(addon, "item", from, to, bump);
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
    const entries = (addon.data as { entries?: Array<{ binding?: FieldBinding }> }).entries;
    if (!Array.isArray(entries)) return addon;
    let changed = false;
    const nextEntries = entries.map((e) => {
      if (e.binding?.source === "economyLink" && e.binding.sectionId === from) {
        changed = true;
        bump();
        return { ...e, binding: { ...e.binding, sectionId: to } };
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
