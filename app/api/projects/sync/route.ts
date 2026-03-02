import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { project } = await request.json();
    if (!project?.id) {
      return NextResponse.json({ error: "project is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { error: pErr } = await supabase.from("projects").upsert(
      {
        id: project.id,
        owner_id: user.id,
        title: project.title,
        description: project.description || "",
        mindmap_settings: project.mindMapSettings || {},
        created_at: project.createdAt,
        updated_at: project.updatedAt,
      },
      { onConflict: "id" }
    );

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const incomingSections = project.sections || [];

    const { data: existingSections, error: existingErr } = await supabase
      .from("sections")
      .select("id,parent_id,title,content,order,color")
      .eq("project_id", project.id);

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    const existingById = new Map((existingSections || []).map((section: any) => [section.id, section]));
    const incomingIds = new Set(incomingSections.map((section: any) => section.id));

    const sectionsToUpsert = incomingSections.filter((section: any) => {
      const existing = existingById.get(section.id);
      if (!existing) return true;

      return (
        (existing.parent_id || null) !== (section.parentId || null) ||
        (existing.title || "") !== (section.title || "") ||
        (existing.content || "") !== (section.content || "") ||
        Number(existing.order || 0) !== Number(section.order || 0) ||
        (existing.color || null) !== (section.color || null)
      );
    });

    if (sectionsToUpsert.length > 0) {
      const { error: sErr } = await supabase.from("sections").upsert(
        sectionsToUpsert.map((s: any) => ({
          id: s.id,
          project_id: project.id,
          parent_id: s.parentId || null,
          title: s.title,
          content: s.content || "",
          order: s.order,
          color: s.color || null,
          created_at: s.created_at,
        })),
        { onConflict: "id" }
      );

      if (sErr) {
        return NextResponse.json({ error: sErr.message }, { status: 500 });
      }
    }

    const removedSectionIds = (existingSections || [])
      .map((section: any) => section.id)
      .filter((id: string) => !incomingIds.has(id));

    if (removedSectionIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from("sections")
        .delete()
        .eq("project_id", project.id)
        .in("id", removedSectionIds);

      if (deleteErr) {
        return NextResponse.json({ error: deleteErr.message }, { status: 500 });
      }
    }

    const sectionsTotal = incomingSections.length;
    const sectionsUpserted = sectionsToUpsert.length;
    const sectionsDeleted = removedSectionIds.length;
    const sectionsUnchanged = Math.max(0, sectionsTotal - sectionsUpserted);

    return NextResponse.json({
      ok: true,
      stats: {
        sectionsTotal,
        sectionsUpserted,
        sectionsDeleted,
        sectionsUnchanged,
      },
    });
  } catch (error) {
    console.error("[api/projects/sync] POST error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/projects/sync] DELETE error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
