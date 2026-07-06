/**
 * Server-side resolution of Remote Config (exportSchema) addons.
 *
 * Pure helpers, kept out of the route handler so they can be unit-tested
 * without HTTP/auth. The route wires these together and maps errors to
 * responses.
 */

import type { SectionRow } from "@/lib/api/v1/helpers";
import {
  resolveExportSchema,
  type SectionLookup,
} from "@/lib/addons/exportSchemaResolver";
import type { SectionAddon, ExportSchemaAddonDraft } from "@/lib/addons/types";

export type AddonRecord = Record<string, unknown> & {
  id: string;
  type: string;
  name: string;
  data?: unknown;
};

export type ResolvedConfig = {
  sectionId: string;
  sectionTitle: string;
  dataId: string | null;
  addonId: string;
  addonName: string;
  arrayFormat: string;
  resolved: Record<string, unknown>;
};

/** Build the SectionLookup the resolver needs, straight from raw DB rows. */
export function buildSectionLookupFromRows(sections: SectionRow[]): SectionLookup {
  const map: SectionLookup = new Map();
  for (const s of sections) {
    map.set(s.id, {
      dataId: s.data_id ?? null,
      addons: (s.balance_addons ?? []) as unknown as SectionAddon[],
      parentId: s.parent_id ?? null,
      order: s.sort_order,
      title: s.title,
    });
  }
  return map;
}

/** Collect a section id + all of its descendants (by parentId). */
export function collectSubtree(rootId: string, sections: SectionRow[]): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const s of sections) {
    const parent = s.parent_id ?? "";
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent)!.push(s.id);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const child of childrenByParent.get(cur) ?? []) stack.push(child);
  }
  return out;
}

/** The exportSchema addons within a single section. */
export function exportSchemaAddonsOf(section: SectionRow): AddonRecord[] {
  return ((section.balance_addons ?? []) as AddonRecord[]).filter(
    (a) => a?.type === "exportSchema"
  );
}

/** Resolve a single exportSchema addon against the section it lives in. */
export function resolveConfig(
  section: SectionRow,
  addon: AddonRecord,
  lookup: SectionLookup
): ResolvedConfig {
  const draft = (addon.data ?? {}) as ExportSchemaAddonDraft;
  const arrayFormat = draft.arrayFormat ?? "rowMajor";
  const resolved = resolveExportSchema(
    draft.nodes ?? [],
    (section.balance_addons ?? []) as unknown as SectionAddon[],
    section.data_id ?? undefined,
    arrayFormat,
    lookup
  );
  return {
    sectionId: section.id,
    sectionTitle: section.title,
    dataId: section.data_id ?? null,
    addonId: addon.id,
    addonName: addon.name,
    arrayFormat,
    resolved,
  };
}

/** Resolve every exportSchema addon found in the given sections. */
export function resolveConfigsForSections(
  sections: SectionRow[],
  lookup: SectionLookup
): ResolvedConfig[] {
  const configs: ResolvedConfig[] = [];
  for (const section of sections) {
    for (const addon of exportSchemaAddonsOf(section)) {
      configs.push(resolveConfig(section, addon, lookup));
    }
  }
  return configs;
}
