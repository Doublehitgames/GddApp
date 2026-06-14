import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markdownToBlocks } from "@/lib/richDoc/markdownToBlocks";

const ADMIN_EMAILS = ["julio.pereira@7teengames.com", "jcpereira.seventeen@gmail.com"];

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
