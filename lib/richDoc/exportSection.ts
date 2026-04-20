import type { RichDocAddonDraft } from "@/lib/addons/types";
import { richDocToMarkdown } from "@/lib/richDoc/serialize";

type SectionLike = {
  addons?: Array<{ type?: string; name?: string; data?: unknown }> | null;
  content?: string | null;
};

/**
 * Walk a section's addons and collect every richDoc as one big markdown
 * blob, suitable for appending to the section's prose during export.
 * Each block is prefixed with the addon name as a level-3 heading so
 * the human-readable output preserves the addon boundary.
 */
export function extractSectionRichDocMarkdown(section: SectionLike | null | undefined): string {
  if (!section || !Array.isArray(section.addons)) return "";
  const parts: string[] = [];
  for (const addon of section.addons) {
    if (!addon || addon.type !== "richDoc") continue;
    const data = addon.data as Partial<RichDocAddonDraft> | undefined;
    if (!data || !Array.isArray(data.blocks) || data.blocks.length === 0) continue;
    const md = richDocToMarkdown(data.blocks);
    if (!md) continue;
    const heading = (addon.name && addon.name.trim()) || "Documento";
    parts.push(`### ${heading}\n\n${md}`);
  }
  return parts.join("\n\n");
}

/**
 * True when a section has neither prose content nor any richDoc blocks
 * worth exporting. Used by exporters to decide whether to skip a section
 * under the "skip empty" toggle.
 */
export function sectionHasExportableContent(section: SectionLike | null | undefined): boolean {
  if (!section) return false;
  if (typeof section.content === "string" && section.content.trim().length > 0) return true;
  return extractSectionRichDocMarkdown(section).length > 0;
}
