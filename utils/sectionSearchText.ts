import { richDocToPlainText } from "@/lib/richDoc/serialize";

/**
 * Build the full searchable text for a section: title + markdown content
 * + plain-text extracted from every richDoc addon. Used by sidebar
 * filtering so search matches text the user wrote inside richDocs, not
 * just inside `section.content`.
 *
 * Tolerant of partial section objects (sync/legacy shapes) — missing
 * fields are treated as empty.
 */
export function getSectionSearchText(section: unknown): string {
  if (!section || typeof section !== "object") return "";
  const s = section as {
    title?: unknown;
    content?: unknown;
    addons?: unknown;
    balanceAddons?: unknown;
  };
  const parts: string[] = [];
  if (typeof s.title === "string") parts.push(s.title);
  if (typeof s.content === "string") parts.push(s.content);

  const addons = Array.isArray(s.addons)
    ? s.addons
    : Array.isArray(s.balanceAddons)
      ? s.balanceAddons
      : [];

  for (const addon of addons) {
    if (!addon || typeof addon !== "object") continue;
    const a = addon as { type?: unknown; name?: unknown; data?: unknown };
    if (typeof a.name === "string") parts.push(a.name);
    if (a.type === "richDoc" && a.data && typeof a.data === "object") {
      const blocks = (a.data as { blocks?: unknown }).blocks;
      const text = richDocToPlainText(blocks);
      if (text) parts.push(text);
    }
  }

  return parts.join("\n");
}
