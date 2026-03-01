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

    const sections = project.sections || [];
    if (sections.length > 0) {
      const { error: sErr } = await supabase.from("sections").upsert(
        sections.map((s: any) => ({
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

      const sectionIds = sections.map((s: any) => `'${s.id}'`).join(",");
      if (sectionIds.length > 0) {
        await supabase
          .from("sections")
          .delete()
          .eq("project_id", project.id)
          .not("id", "in", `(${sectionIds})`);
      }
    } else {
      await supabase.from("sections").delete().eq("project_id", project.id);
    }

    return NextResponse.json({ ok: true });
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
