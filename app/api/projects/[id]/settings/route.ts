import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Atualiza apenas mindmap_settings do projeto (ex.: configurações do mapa mental, compartilhamento público).
 * Não consome créditos de sync e não envia seções. Usado ao salvar Configurações do Mapa Mental.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    if (!projectId) {
      return NextResponse.json({ error: "project id required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const mindmap_settings = body.mindmap_settings;
    const linked_spreadsheets = body.linked_spreadsheets;

    // At least one recognised field must be present
    if (mindmap_settings === undefined && linked_spreadsheets === undefined) {
      return NextResponse.json(
        { error: "mindmap_settings or linked_spreadsheets required" },
        { status: 400 }
      );
    }
    if (mindmap_settings !== undefined && typeof mindmap_settings !== "object") {
      return NextResponse.json({ error: "mindmap_settings must be an object" }, { status: 400 });
    }
    if (linked_spreadsheets !== undefined && !Array.isArray(linked_spreadsheets)) {
      return NextResponse.json({ error: "linked_spreadsheets must be an array" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { data: project, error: fetchErr } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (fetchErr || !project) {
      return NextResponse.json({ error: "forbidden or not found" }, { status: 403 });
    }

    const updated_at = new Date().toISOString();
    const updateFields: Record<string, unknown> = { updated_at };
    if (mindmap_settings !== undefined) updateFields.mindmap_settings = mindmap_settings;
    if (linked_spreadsheets !== undefined) updateFields.linked_spreadsheets = linked_spreadsheets;

    const { error: updateErr } = await supabase
      .from("projects")
      .update(updateFields)
      .eq("id", projectId)
      .eq("owner_id", user.id);

    if (updateErr) {
      return NextResponse.json(
        { error: "update_failed", message: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
