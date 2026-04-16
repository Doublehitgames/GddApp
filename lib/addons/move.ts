import type { SectionAddon } from "@/lib/addons/types";
import { clearIntraSectionRefs } from "@/lib/addons/refs";

/**
 * Returns a deep copy of the given addon, preserving its ID, suitable for
 * relocating it to a different section. The moved addon:
 *
 * - keeps its wrapper ID and mirrored `data.id` (it's the same entity migrating)
 * - has `group` reset to undefined (groups are per-section)
 * - keeps all section-ID references intact (they remain valid cross-section)
 * - clears addon-ID references that targeted addons inside the original
 *   section (those siblings aren't coming along) — except for IDs in the
 *   optional `preserveIds` set, used when multiple addons move together.
 */
export function moveAddon(addon: SectionAddon, preserveIds?: Set<string>): SectionAddon {
  const clonedData = JSON.parse(JSON.stringify(addon.data)) as Record<string, unknown>;
  clearIntraSectionRefs(clonedData, addon.type, preserveIds);
  return {
    ...addon,
    group: undefined,
    data: clonedData,
  } as SectionAddon;
}
