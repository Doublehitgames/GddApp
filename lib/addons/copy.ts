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
  exportSchema: "export-schema",
  genericStats: "data-schema",
};

function generateAddonId(type: SectionAddonType): string {
  const prefix = ID_PREFIX[type] ?? "addon";
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
