import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isMissingBalanceAddonsColumn(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const details =
    typeof error === "object" && error && "details" in error
      ? String((error as { details?: unknown }).details || "")
      : "";
  const combined = `${message} ${details}`.toLowerCase();
  return combined.includes("balance_addons") && combined.includes("column");
}

/**
 * GET: lista versões (histórico) de uma seção. Qualquer membro do projeto pode ver.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const { id: projectId, sectionId } = await params;
    if (!projectId || !sectionId) {
      return NextResponse.json({ error: "project_id_and_section_id_required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectErr || !project) {
      return NextResponse.json({ error: "project_not_found" }, { status: 404 });
    }

    const ownerId = (project as { owner_id: string }).owner_id;
    const isMember = ownerId === user.id;
    if (!isMember) {
      const { data: memberRow } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!memberRow) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    let { data: versions, error: versionsErr } = await supabase
      .from("section_versions")
      .select("id, section_id, project_id, title, content, sort_order, color, balance_addons, created_at, updated_by, updated_by_name")
      .eq("section_id", sectionId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (versionsErr && isMissingBalanceAddonsColumn(versionsErr)) {
      const retry = await supabase
        .from("section_versions")
        .select("id, section_id, project_id, title, content, sort_order, color, created_at, updated_by, updated_by_name")
        .eq("section_id", sectionId)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      versions = (retry.data || []).map((version: any) => ({ ...version, balance_addons: [] }));
      versionsErr = retry.error;
    }

    if (versionsErr) {
      return NextResponse.json(
        { error: "versions_fetch_failed", message: versionsErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ versions: versions ?? [] });
  } catch (error) {
    console.error("[api/projects/.../versions] GET error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
