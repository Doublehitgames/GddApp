/**
 * Minimal markdown → BlockNote blocks converter (server-safe, no DOM).
 *
 * Handles the subset of markdown found in real section descriptions:
 * blocks: paragraph, heading (h1-h3), bulletListItem, numberedListItem,
 *         quote, codeBlock
 * inline: **bold**, *italic*, `code`, everything else (incl. $[ref], @[token])
 *         stays as plain text — transformRichDocRefs / resolveTokens handle
 *         those at render time.
 */

interface TextNode {
  type: "text";
  text: string;
  styles?: { bold?: boolean; italic?: boolean; code?: boolean };
}

export interface BNBlock {
  type: string;
  props?: Record<string, unknown>;
  content: TextNode[];
  children: BNBlock[];
}

function parseInline(text: string): TextNode[] {
  const nodes: TextNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|([^*`]+|[*`])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined) nodes.push({ type: "text", text: m[1], styles: { bold: true } });
    else if (m[2] !== undefined) nodes.push({ type: "text", text: m[2], styles: { italic: true } });
    else if (m[3] !== undefined) nodes.push({ type: "text", text: m[3], styles: { code: true } });
    else if (m[4]) nodes.push({ type: "text", text: m[4] });
  }
  return nodes.filter((n) => n.text !== "");
}

export function markdownToBlocks(markdown: string): BNBlock[] {
  if (!markdown?.trim()) return [];
  const lines = markdown.split("\n");
  const blocks: BNBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push({
        type: "codeBlock",
        props: { language: lang || "plain" },
        content: [{ type: "text", text: code.join("\n") }],
        children: [],
      });
      continue;
    }

    // Heading h1/h2/h3
    const hm = line.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      blocks.push({
        type: "heading",
        props: { level: hm[1].length },
        content: parseInline(hm[2].trim()),
        children: [],
      });
      i++;
      continue;
    }

    // Bullet list
    const bm = line.match(/^[-*+]\s+(.+)$/);
    if (bm) {
      blocks.push({ type: "bulletListItem", content: parseInline(bm[1]), children: [] });
      i++;
      continue;
    }

    // Numbered list
    const nm = line.match(/^\d+\.\s+(.+)$/);
    if (nm) {
      blocks.push({ type: "numberedListItem", content: parseInline(nm[1]), children: [] });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      blocks.push({ type: "quote", content: parseInline(line.slice(2)), children: [] });
      i++;
      continue;
    }

    // Horizontal rule → skip
    if (/^[-*_]{3,}$/.test(line.trim())) { i++; continue; }

    // Paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].match(/^(#{1,6}\s|[-*+]\s|\d+\.\s|> |```)/) &&
      !lines[i].match(/^[-*_]{3,}$/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        content: parseInline(paraLines.join(" ")),
        children: [],
      });
    }
  }

  return blocks;
}
