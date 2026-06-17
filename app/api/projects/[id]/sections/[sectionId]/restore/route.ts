import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureUserProfile } from "@/lib/supabase/ensureUserProfile";

/**
 * POST: restaura a seção a partir de uma versão do histórico.
 * Body: { versionId: string }
 * Apenas dono ou editor do projeto.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const { id: projectId, sectionId } = await params;
    if (!projectId || !sectionId) {
      return NextResponse.json({ error: "project_id_and_section_id_required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const versionId = typeof body?.versionId === "string" ? body.versionId : null;
    if (!versionId) {
      return NextResponse.json({ error: "version_id_required" }, { status: 400 });
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
    const isOwner = ownerId === user.id;
    if (!isOwner) {
      const { data: memberRow } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      const role = (memberRow as { role?: string } | null)?.role;
      if (!memberRow || role !== "editor") {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    const { data: version, error: versionErr } = await supabase
      .from("section_versions")
      .select("id, section_id, project_id, title, content, sort_order, color")
      .eq("id", versionId)
      .eq("section_id", sectionId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (versionErr || !version) {
      return NextResponse.json({ error: "version_not_found" }, { status: 404 });
    }

    await ensureUserProfile(supabase, user);
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const displayName =
      (profileRow && typeof (profileRow as { display_name?: string }).display_name === "string")
        ? (profileRow as { display_name: string }).display_name
        : user.email ?? null;

    const nowIso = new Date().toISOString();
    // Versions only store the markdown `content`, not `content_blocks`. Restoring
    // must clear content_blocks so the read view falls back to the restored
    // markdown — otherwise the stale blocks (current description) survive in the
    // DB and reappear after a reload, making restore look like a no-op.
    const baseUpdate = {
      title: version.title,
      content: version.content ?? "",
      sort_order: version.sort_order ?? 0,
      color: version.color ?? null,
      updated_at: nowIso,
      updated_by: user.id,
      updated_by_name: displayName,
    };
    let { error: updateErr } = await supabase
      .from("sections")
      .update({ ...baseUpdate, content_blocks: null })
      .eq("id", sectionId)
      .eq("project_id", projectId);

    // Graceful fallback if the content_blocks column hasn't been migrated yet.
    if (updateErr && String(updateErr.message || "").toLowerCase().includes("content_blocks")) {
      const retry = await supabase
        .from("sections")
        .update(baseUpdate)
        .eq("id", sectionId)
        .eq("project_id", projectId);
      updateErr = retry.error;
    }

    if (updateErr) {
      return NextResponse.json(
        { error: "section_update_failed", message: updateErr.message },
        { status: 500 }
      );
    }

    // Remover a versão restaurada da lista (evita duplicar ponto de restauração e deixa a lista mais clara)
    try {
      const admin = createAdminClient();
      await admin
        .from("section_versions")
        .delete()
        .eq("id", versionId)
        .eq("section_id", sectionId)
        .eq("project_id", projectId);
    } catch {
      // Ignora falha ao remover (tabela pode não ter policy DELETE)
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/projects/.../restore] POST error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
