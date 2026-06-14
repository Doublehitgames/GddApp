import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["julio.pereira@7teengames.com", "jcpereira.seventeen@gmail.com"];

// ─── Minimal markdown → BlockNote blocks converter (server-safe, no DOM) ─────
//
// Handles the subset of markdown found in real section descriptions:
// blocks: paragraph, heading (h1-h3), bulletListItem, numberedListItem,
//         quote, codeBlock
// inline: **bold**, *italic*, `code`, everything else (incl. $[ref], @[token])
//         stays as plain text — transformRichDocRefs / resolveTokens handle
//         those at render time.

interface TextNode {
  type: "text";
  text: string;
  styles?: { bold?: boolean; italic?: boolean; code?: boolean };
}

interface BNBlock {
  type: string;
  props?: Record<string, unknown>;
  content: TextNode[];
  children: BNBlock[];
}

function parseInline(text: string): TextNode[] {
  const nodes: TextNode[] = [];
  // Order matters: **bold** before *italic* to avoid greedy mismatch
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

function markdownToBlocks(markdown: string): BNBlock[] {
  if (!markdown?.trim()) return [];
  const lines = markdown.split("\n");
  const blocks: BNBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line → paragraph separator
    if (!line.trim()) { i++; continue; }

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++; // closing ```
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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (!ADMIN_EMAILS.includes(user.email ?? "")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    // Fetch all sections that have content but no content_blocks
    const admin = createAdminClient();
    const { data: sections, error: fetchErr } = await admin
      .from("sections")
      .select("id, project_id, title, content, content_blocks")
      .not("content", "is", null)
      .neq("content", "")
      .is("content_blocks", null);

    if (fetchErr) {
      return NextResponse.json({ error: "fetch_failed", detail: fetchErr.message }, { status: 500 });
    }

    const rows = sections ?? [];

    type DetailRow = {
      project_id: string;
      section_id: string;
      title: string;
      status: "migrated" | "skipped" | "error";
      blocks?: number;
      error?: string;
    };

    const details: DetailRow[] = [];
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
      const content = typeof row.content === "string" ? row.content.trim() : "";
      if (!content) {
        details.push({ project_id: row.project_id, section_id: row.id, title: row.title ?? "", status: "skipped" });
        skipped++;
        continue;
      }

      const blocks = markdownToBlocks(content);

      if (blocks.length === 0) {
        details.push({ project_id: row.project_id, section_id: row.id, title: row.title ?? "", status: "skipped" });
        skipped++;
        continue;
      }

      if (!dryRun) {
        const { error: updateErr } = await admin
          .from("sections")
          .update({ content_blocks: blocks })
          .eq("id", row.id);

        if (updateErr) {
          details.push({ project_id: row.project_id, section_id: row.id, title: row.title ?? "", status: "error", error: updateErr.message });
          errors++;
          continue;
        }
      }

      details.push({ project_id: row.project_id, section_id: row.id, title: row.title ?? "", status: "migrated", blocks: blocks.length });
      migrated++;
    }

    return NextResponse.json({
      dryRun,
      total: rows.length,
      migrated,
      skipped,
      errors,
      details,
    });
  } catch (err) {
    return NextResponse.json({ error: "unexpected", detail: String(err) }, { status: 500 });
  }
}
