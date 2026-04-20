import type { SectionAddon, SectionAddonType } from "@/lib/addons/types";
import { clearIntraSectionRefs } from "@/lib/addons/refs";

/**
 * ID prefixes per addon type, matching the convention used by createDefault
 * helpers in `lib/addons/registry.ts`. Kept in sync manually — update both
 * places when adding a new addon type.
 */
const ID_PREFIX: Record<SectionAddonType, string> = {
  xpBalance: "balance",
  progressionTable: "progression",
  economyLink: "economy",
  currency: "currency",
  globalVariable: "gvar",
  inventory: "inventory",
  production: "production",
  dataSchema: "data-schema",
  attributeDefinitions: "attr-defs",
  attributeProfile: "attr-profile",
  attributeModifiers: "attr-modifiers",
  fieldLibrary: "field-library",
  exportSchema: "export-schema",
  richDoc: "rich-doc",
  genericStats: "data-schema",
};

function generateAddonId(type: SectionAddonType): string {
  const prefix = ID_PREFIX[type] ?? "addon";
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Deep-clones a whole list of addons that live together in one section,
 * preserving *intra-section* references. Used by "duplicate page": when the
 * original addons reference each other (e.g. dataSchema.productionRef pointing
 * to a sibling production addon), the clones should reference each other's new
 * IDs — not clear the refs like `copyAddon` does for cross-section copies.
 *
 * Strategy: pre-generate the new IDs, then JSON-stringify each addon's data
 * and swap every occurrence of `"oldId"` → `"newId"`. Works because addon IDs
 * are unique prefix-timestamp-rand strings stored only as JSON string values.
 *
 * Returns a parallel array plus the old→new ID map so callers can also remap
 * section-level fields (like `Section.dataId`).
 */
export function duplicateAddonsForDuplicatedSection(
  addons: readonly SectionAddon[] | undefined
): { addons: SectionAddon[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  if (!addons || addons.length === 0) return { addons: [], idMap };

  for (const a of addons) {
    idMap.set(a.id, generateAddonId(a.type));
  }

  const cloned = addons.map((a) => {
    const newId = idMap.get(a.id)!;
    let json = JSON.stringify(a.data);
    for (const [oldId, nid] of idMap) {
      json = json.split(`"${oldId}"`).join(`"${nid}"`);
    }
    const clonedData = JSON.parse(json) as Record<string, unknown>;
    clonedData.id = newId;
    return { ...a, id: newId, data: clonedData } as SectionAddon;
  });

  return { addons: cloned, idMap };
}

/**
 * Returns a deep copy of the given addon with a fresh ID, suitable for inserting
 * into another section (or the same section as a duplicate). The copy:
 *
 * - has a new wrapper ID following the registry's prefix convention
 * - has `data.id` synced to the new wrapper ID (the app relies on this equality)
 * - has `group` reset to undefined (groups are per-section)
 * - keeps all section-ID references intact (they remain valid cross-section)
 * - clears addon-ID references that targeted addons inside the original section
 */
export function copyAddon(addon: SectionAddon): SectionAddon {
  const newId = generateAddonId(addon.type);
  const clonedData = JSON.parse(JSON.stringify(addon.data)) as Record<string, unknown>;
  clonedData.id = newId;
  clearIntraSectionRefs(clonedData, addon.type);

  return {
    ...addon,
    id: newId,
    group: undefined,
    data: clonedData,
  } as SectionAddon;
}
