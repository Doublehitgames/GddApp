/**
 * Client-side aggregation of resolved Remote Config (exportSchema) addons —
 * the "economy snapshot" a user can download to hand to an external agent.
 *
 * Mirrors the server-side resolver in `lib/api/v1/remoteConfig.ts`, but runs
 * against the Zustand store's in-memory `Project` shape so the export page can
 * produce a file with zero network round-trips. Pure functions only.
 */

import { buildSectionLookup, resolveExportSchema } from "@/lib/addons/exportSchemaResolver";
import type { SectionAddon, ExportSchemaAddonDraft } from "@/lib/addons/types";

export type EconomyConfig = {
  sectionId: string;
  sectionTitle: string;
  dataId: string | null;
  addonId: string;
  addonName: string;
  arrayFormat: string;
  resolved: Record<string, unknown>;
};

/** A section the user can scope the export to (its subtree holds ≥1 config). */
export type EconomyScope = {
  id: string;
  title: string;
  /** Nesting depth for indented rendering in a picker. */
  depth: number;
  /** How many Remote Configs live in this section's subtree. */
  count: number;
};

/** One selectable Remote Config, for an à-la-carte export picker (no resolution). */
export type EconomyConfigInfo = {
  /** The exportSchema addon id — the stable selection key. */
  addonId: string;
  sectionId: string;
  sectionTitle: string;
  addonName: string;
  /** Nesting depth of the host section, for indented rendering. */
  depth: number;
};

// Minimal structural shapes — accept the store's Project without coupling to it.
type SnapSection = {
  id: string;
  title: string;
  dataId?: string | null;
  parentId?: string | null;
  order?: number;
  addons?: SectionAddon[];
};
type SnapProject = { id: string; title?: string; sections?: SnapSection[] };

function childrenByParentOf(sections: SnapSection[]): Map<string, SnapSection[]> {
  const map = new Map<string, SnapSection[]>();
  for (const s of sections) {
    const parent = s.parentId ?? "";
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent)!.push(s);
  }
  for (const arr of map.values()) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return map;
}

function subtreeIds(rootId: string, sections: SnapSection[]): Set<string> {
  const children = childrenByParentOf(sections);
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const child of children.get(cur) ?? []) stack.push(child.id);
  }
  return out;
}

/** Collect every field-library addon across all projects (bindings may reference them). */
function collectFieldLibraries(projects: SnapProject[]): SectionAddon[] {
  const out: SectionAddon[] = [];
  const seen = new Set<string>();
  for (const p of projects) {
    for (const s of p.sections ?? []) {
      for (const a of s.addons ?? []) {
        if (a.type === "fieldLibrary" && !seen.has(a.id)) {
          seen.add(a.id);
          out.push(a);
        }
      }
    }
  }
  return out;
}

/**
 * Resolve every exportSchema addon in `projectId` (optionally scoped to a
 * section subtree) into concrete economy JSON.
 */
export function collectEconomyConfigs(
  projects: SnapProject[],
  projectId: string,
  opts: { rootSectionId?: string; addonIds?: string[] } = {}
): EconomyConfig[] {
  const addonFilter = opts.addonIds ? new Set(opts.addonIds) : null;
  // Full lookup across all projects so cross-section refs always resolve,
  // even when the export is scoped to a subtree.
  const lookup = buildSectionLookup(projects);
  const fieldLibs = collectFieldLibraries(projects);

  const project = projects.find((p) => p.id === projectId);
  const sections = project?.sections ?? [];
  const target = opts.rootSectionId ? subtreeIds(opts.rootSectionId, sections) : null;

  const configs: EconomyConfig[] = [];
  for (const section of sections) {
    if (target && !target.has(section.id)) continue;
    const sectionAddons = section.addons ?? [];
    for (const addon of sectionAddons) {
      if (addon.type !== "exportSchema") continue;
      if (addonFilter && !addonFilter.has(addon.id)) continue;
      const draft = addon.data as ExportSchemaAddonDraft;
      const arrayFormat = draft.arrayFormat ?? "rowMajor";
      // Resolve against this section's addons plus any global field libraries.
      const pool: SectionAddon[] = [
        ...sectionAddons,
        ...fieldLibs.filter((lib) => !sectionAddons.some((sa) => sa.id === lib.id)),
      ];
      // Resolve each config in isolation: a single malformed config must not
      // abort the whole export. On failure, surface the error inside the file.
      let resolved: Record<string, unknown>;
      try {
        resolved = resolveExportSchema(
          draft.nodes ?? [],
          pool,
          section.dataId ?? undefined,
          arrayFormat,
          lookup
        );
      } catch (e) {
        resolved = { __error: e instanceof Error ? e.message : String(e) };
      }
      configs.push({
        sectionId: section.id,
        sectionTitle: section.title,
        dataId: section.dataId ?? null,
        addonId: addon.id,
        addonName: addon.name,
        arrayFormat,
        resolved,
      });
    }
  }
  return configs;
}

/**
 * Sections whose subtree contains at least one Remote Config, for a scope
 * picker. Returned in tree order with a `depth` for indentation.
 */
export function economyScopeOptions(projects: SnapProject[], projectId: string): EconomyScope[] {
  const project = projects.find((p) => p.id === projectId);
  const sections = project?.sections ?? [];
  const children = childrenByParentOf(sections);

  const directCount = new Map<string, number>();
  for (const s of sections) {
    directCount.set(s.id, (s.addons ?? []).filter((a) => a.type === "exportSchema").length);
  }

  const subtreeCount = new Map<string, number>();
  function count(id: string): number {
    if (subtreeCount.has(id)) return subtreeCount.get(id)!;
    let c = directCount.get(id) ?? 0;
    for (const child of children.get(id) ?? []) c += count(child.id);
    subtreeCount.set(id, c);
    return c;
  }

  const out: EconomyScope[] = [];
  function walk(section: SnapSection, depth: number) {
    const c = count(section.id);
    if (c > 0) out.push({ id: section.id, title: section.title, depth, count: c });
    for (const child of children.get(section.id) ?? []) walk(child, depth + 1);
  }
  for (const root of children.get("") ?? []) walk(root, 0);
  return out;
}

/**
 * Flat list of every Remote Config in the project, in tree order with depth —
 * for an à-la-carte checklist. Does NOT resolve (cheap); resolution happens on
 * export via `collectEconomyConfigs({ addonIds })`.
 */
export function listEconomyConfigs(projects: SnapProject[], projectId: string): EconomyConfigInfo[] {
  const project = projects.find((p) => p.id === projectId);
  const sections = project?.sections ?? [];
  const children = childrenByParentOf(sections);

  const out: EconomyConfigInfo[] = [];
  function walk(section: SnapSection, depth: number) {
    for (const addon of section.addons ?? []) {
      if (addon.type !== "exportSchema") continue;
      out.push({
        addonId: addon.id,
        sectionId: section.id,
        sectionTitle: section.title,
        addonName: addon.name,
        depth,
      });
    }
    for (const child of children.get(section.id) ?? []) walk(child, depth + 1);
  }
  for (const root of children.get("") ?? []) walk(root, 0);
  return out;
}
