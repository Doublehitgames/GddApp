import type { RichDocBlock } from "@/lib/addons/types";

/**
 * Extract plain text from a richDoc block tree, recursively.
 * Used by search indexing and AI content extraction. Unknown block types
 * round-trip — we only walk `content` and `children`, never bail out.
 */
export function richDocToPlainText(blocks: RichDocBlock[] | unknown): string {
  if (!Array.isArray(blocks)) return "";
  const out: string[] = [];
  for (const block of blocks) {
    walkBlock(block, out);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function walkBlock(block: unknown, out: string[]): void {
  if (!block || typeof block !== "object") return;
  const b = block as RichDocBlock;
  const inline = inlineToText(b.content);
  if (inline) out.push(inline);
  if (Array.isArray(b.children)) {
    for (const child of b.children) walkBlock(child, out);
  }
}

/**
 * Flatten BlockNote inline content (text runs, links, table cells, etc.)
 * to a single line of text. Tolerant of unknown shapes.
 */
function inlineToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) {
    // Tables wrap content as `{ type: "tableContent", rows: [...] }`.
    if (content && typeof content === "object") {
      const rows = (content as { rows?: unknown[] }).rows;
      if (Array.isArray(rows)) return tableRowsToText(rows);
    }
    return "";
  }
  const parts: string[] = [];
  for (const node of content) {
    if (!node || typeof node !== "object") continue;
    const n = node as { type?: string; text?: string; content?: unknown };
    if (typeof n.text === "string") {
      parts.push(n.text);
      continue;
    }
    // Link inline content nests its own content array.
    if (n.content !== undefined) {
      const nested = inlineToText(n.content);
      if (nested) parts.push(nested);
    }
  }
  return parts.join("");
}

function tableRowsToText(rows: unknown[]): string {
  const lines: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const cells = (row as { cells?: unknown[] }).cells;
    if (!Array.isArray(cells)) continue;
    const cellTexts: string[] = [];
    for (const cell of cells) {
      // Cells can be either an inline-content array directly, or
      // `{ type: "tableCell", content: [...] }`.
      if (Array.isArray(cell)) {
        cellTexts.push(inlineToText(cell));
      } else if (cell && typeof cell === "object") {
        cellTexts.push(inlineToText((cell as { content?: unknown }).content));
      }
    }
    lines.push(cellTexts.join(" | "));
  }
  return lines.join("\n");
}

/**
 * Convert a richDoc block tree to Markdown for export pipelines
 * (Word/PDF/JSON). Best-effort — covers the standard BlockNote block
 * types; unknown types fall back to their plain-text content so nothing
 * is silently dropped.
 */
export function richDocToMarkdown(blocks: RichDocBlock[] | unknown): string {
  if (!Array.isArray(blocks)) return "";
  const out: string[] = [];
  renderBlocks(blocks, out, 0, null);
  return out.join("").replace(/\n{3,}/g, "\n\n").trim();
}

type ListContext = "bullet" | "number" | "check" | null;

function renderBlocks(
  blocks: unknown[],
  out: string[],
  indent: number,
  parentList: ListContext,
): void {
  let numberedIndex = 0;
  for (const raw of blocks) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as RichDocBlock;
    const type = block.type || "paragraph";
    const props = (block.props || {}) as Record<string, unknown>;
    const text = inlineToText(block.content);
    const pad = "  ".repeat(indent);

    if (type === "heading") {
      const level = Math.min(6, Math.max(1, Number(props.level) || 1));
      out.push(`${"#".repeat(level)} ${text}\n\n`);
    } else if (type === "bulletListItem") {
      out.push(`${pad}- ${text}\n`);
      if (Array.isArray(block.children) && block.children.length) {
        renderBlocks(block.children, out, indent + 1, "bullet");
      }
    } else if (type === "numberedListItem") {
      numberedIndex += 1;
      out.push(`${pad}${numberedIndex}. ${text}\n`);
      if (Array.isArray(block.children) && block.children.length) {
        renderBlocks(block.children, out, indent + 1, "number");
      }
    } else if (type === "checkListItem") {
      const checked = props.checked === true || props.checked === "true";
      out.push(`${pad}- [${checked ? "x" : " "}] ${text}\n`);
      if (Array.isArray(block.children) && block.children.length) {
        renderBlocks(block.children, out, indent + 1, "check");
      }
    } else if (type === "quote") {
      const quoted = text.split("\n").map((l) => `> ${l}`).join("\n");
      out.push(`${quoted}\n\n`);
    } else if (type === "codeBlock") {
      const lang = typeof props.language === "string" ? props.language : "";
      out.push(`\`\`\`${lang}\n${text}\n\`\`\`\n\n`);
    } else if (type === "divider" || type === "pageBreak") {
      out.push(`---\n\n`);
    } else if (type === "image") {
      const url = typeof props.url === "string" ? props.url : "";
      const caption = typeof props.caption === "string" ? props.caption : "";
      if (url) out.push(`![${caption}](${url})\n\n`);
    } else if (type === "video" || type === "audio" || type === "file") {
      const url = typeof props.url === "string" ? props.url : "";
      const name = typeof props.name === "string" ? props.name : type;
      if (url) out.push(`[${name}](${url})\n\n`);
    } else if (type === "embed") {
      const url = typeof props.url === "string" ? props.url : "";
      if (url) out.push(`[Embed: ${url}](${url})\n\n`);
    } else if (type === "table") {
      out.push(renderTable(block.content));
    } else {
      // paragraph + unknown types — emit as plain text. Reset list ctx
      // so we don't accidentally inherit indentation.
      void parentList;
      if (text) out.push(`${text}\n\n`);
      if (Array.isArray(block.children) && block.children.length) {
        renderBlocks(block.children, out, indent, null);
      }
    }
  }
}

function renderTable(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const rows = (content as { rows?: unknown[] }).rows;
  if (!Array.isArray(rows) || rows.length === 0) return "";
  const lines: string[] = [];
  let columnCount = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] as { cells?: unknown[] } | undefined;
    if (!row || !Array.isArray(row.cells)) continue;
    const cells = row.cells.map((c) => {
      const text = Array.isArray(c)
        ? inlineToText(c)
        : c && typeof c === "object"
          ? inlineToText((c as { content?: unknown }).content)
          : "";
      return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
    });
    if (i === 0) columnCount = cells.length;
    lines.push(`| ${cells.join(" | ")} |`);
    if (i === 0) {
      lines.push(`| ${Array(columnCount).fill("---").join(" | ")} |`);
    }
  }
  return lines.join("\n") + "\n\n";
}
