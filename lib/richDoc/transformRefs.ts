import type { RichDocBlock } from "@/lib/addons/types";
import { extractSectionReferences, findSection } from "@/utils/sectionReferences";

/**
 * Sentinel URL used to mark in-doc section references inside the
 * BlockNote-rendered output. We use https:// + a fake hostname so the
 * editor's URL-protocol allowlist (http/https/mailto/...) accepts it;
 * the read-only host intercepts clicks on anchors with this prefix and
 * does popup-aware navigation instead of an actual page load.
 */
export const SECTION_REF_HREF_PREFIX = "https://gddapp.local/section/";

export type SectionLike = { id: string; title: string };

/**
 * Walk a richDoc block tree and rewrite text nodes containing
 * `$[Section Name]` (or `$[#id]`) into BlockNote `link` inline content
 * pointing at our internal scheme. Used at READ-ONLY render time only;
 * the persisted blocks keep the literal `$[...]` text so the editor
 * round-trips cleanly.
 */
export function transformRichDocRefs(
  blocks: unknown,
  sections: SectionLike[],
): RichDocBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => transformBlock(b, sections)).filter(Boolean) as RichDocBlock[];
}

function transformBlock(block: unknown, sections: SectionLike[]): RichDocBlock | null {
  if (!block || typeof block !== "object") return null;
  const original = block as RichDocBlock;
  const next: RichDocBlock = { ...original };
  if (original.content !== undefined) {
    next.content = transformContent(original.content, sections);
  }
  if (Array.isArray(original.children)) {
    next.children = original.children
      .map((c) => transformBlock(c, sections))
      .filter(Boolean) as RichDocBlock[];
  }
  return next;
}

function transformContent(content: unknown, sections: SectionLike[]): unknown {
  // Tables: { type: "tableContent", rows: [...] } — recurse into cells.
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const obj = content as { type?: string; rows?: unknown[] };
    if (Array.isArray(obj.rows)) {
      return {
        ...obj,
        rows: obj.rows.map((row) => transformTableRow(row, sections)),
      };
    }
    return content;
  }
  if (!Array.isArray(content)) return content;

  const out: unknown[] = [];
  for (const node of content) {
    if (!node || typeof node !== "object") {
      out.push(node);
      continue;
    }
    const n = node as { type?: string; text?: string; styles?: unknown; content?: unknown; href?: string };
    // Recurse into nested content (e.g. existing user-set links).
    if (n.type === "link" && n.content !== undefined) {
      out.push({ ...n, content: transformContent(n.content, sections) });
      continue;
    }
    if (typeof n.text === "string" && n.text.includes("$[")) {
      out.push(...splitTextWithRefs(n.text, n.styles, sections));
      continue;
    }
    out.push(n);
  }
  return out;
}

function transformTableRow(row: unknown, sections: SectionLike[]): unknown {
  if (!row || typeof row !== "object") return row;
  const r = row as { cells?: unknown[] };
  if (!Array.isArray(r.cells)) return row;
  return {
    ...r,
    cells: r.cells.map((cell) => {
      if (Array.isArray(cell)) return transformContent(cell, sections);
      if (cell && typeof cell === "object") {
        const c = cell as { content?: unknown };
        return { ...c, content: transformContent(c.content, sections) };
      }
      return cell;
    }),
  };
}

function splitTextWithRefs(
  text: string,
  styles: unknown,
  sections: SectionLike[],
): unknown[] {
  const refs = extractSectionReferences(text);
  if (refs.length === 0) return [{ type: "text", text, styles }];

  const out: unknown[] = [];
  let cursor = 0;
  for (const ref of refs) {
    if (ref.startIndex > cursor) {
      out.push({ type: "text", text: text.slice(cursor, ref.startIndex), styles });
    }
    const resolved = findSection(sections as never[], ref);
    if (resolved) {
      out.push({
        type: "link",
        href: `${SECTION_REF_HREF_PREFIX}${resolved.id}`,
        content: [{ type: "text", text: resolved.title, styles }],
      });
    } else {
      // Unresolved ref — keep literal text so the user notices the
      // broken reference instead of silently dropping it.
      out.push({ type: "text", text: ref.raw, styles });
    }
    cursor = ref.endIndex;
  }
  if (cursor < text.length) {
    out.push({ type: "text", text: text.slice(cursor), styles });
  }
  return out;
}
