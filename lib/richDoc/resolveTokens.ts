import type { RichDocBlock } from "@/lib/richDoc/types";
import {
  resolveProjectSpecialTokens,
  type ProjectTokenSource,
} from "@/lib/sections/specialTokens";

/**
 * Walk a richDoc block tree and resolve `@[token]` special tokens inside every
 * text node, mirroring what `MarkdownWithReferences` did at the string level.
 * Used at READ-ONLY render time only — the persisted blocks keep the literal
 * `@[...]` text so editing round-trips cleanly. Returns a new tree; the input
 * is not mutated.
 */
export function resolveTokensInBlocks(
  blocks: unknown,
  tokenSource: ProjectTokenSource | null | undefined,
  sectionId?: string | null
): RichDocBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((b) => resolveBlock(b, tokenSource, sectionId))
    .filter(Boolean) as RichDocBlock[];
}

function resolveBlock(
  block: unknown,
  tokenSource: ProjectTokenSource | null | undefined,
  sectionId?: string | null
): RichDocBlock | null {
  if (!block || typeof block !== "object") return null;
  const original = block as RichDocBlock;
  const next: RichDocBlock = { ...original };
  if (original.content !== undefined) {
    next.content = resolveContent(original.content, tokenSource, sectionId);
  }
  if (Array.isArray(original.children)) {
    next.children = original.children
      .map((c) => resolveBlock(c, tokenSource, sectionId))
      .filter(Boolean) as RichDocBlock[];
  }
  return next;
}

function resolveContent(
  content: unknown,
  tokenSource: ProjectTokenSource | null | undefined,
  sectionId?: string | null
): unknown {
  // Tables: { type: "tableContent", rows: [...] } — recurse into cells.
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const obj = content as { type?: string; rows?: unknown[] };
    if (Array.isArray(obj.rows)) {
      return {
        ...obj,
        rows: obj.rows.map((row) => resolveTableRow(row, tokenSource, sectionId)),
      };
    }
    return content;
  }
  if (!Array.isArray(content)) return content;

  return content.map((node) => {
    if (!node || typeof node !== "object") return node;
    const n = node as { type?: string; text?: string; content?: unknown };
    // Recurse into nested content (e.g. links).
    if (n.content !== undefined && n.type === "link") {
      return { ...n, content: resolveContent(n.content, tokenSource, sectionId) };
    }
    if (typeof n.text === "string" && n.text.includes("@[")) {
      return { ...n, text: resolveProjectSpecialTokens(n.text, tokenSource, sectionId) };
    }
    return node;
  });
}

function resolveTableRow(
  row: unknown,
  tokenSource: ProjectTokenSource | null | undefined,
  sectionId?: string | null
): unknown {
  if (!row || typeof row !== "object") return row;
  const r = row as { cells?: unknown[] };
  if (!Array.isArray(r.cells)) return row;
  return {
    ...r,
    cells: r.cells.map((cell) => {
      if (Array.isArray(cell)) return resolveContent(cell, tokenSource, sectionId);
      if (cell && typeof cell === "object") {
        const c = cell as { content?: unknown };
        return { ...c, content: resolveContent(c.content, tokenSource, sectionId) };
      }
      return cell;
    }),
  };
}
