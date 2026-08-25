import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Atualiza só as configurações leves do projeto: mindmap_settings (mapa mental,
 * compartilhamento público) e image_library.
 * Não consome créditos de sync e não envia seções.
 *
 * Acesso: dono OU membro com papel `editor` — a mesma regra do resto das
 * escritas (ver requireProject em lib/api/v1/helpers.ts). Antes era só o dono,
 * o que fazia um editor perder silenciosamente o que salvava.
 *
 * Exceção: `sharing` dentro de mindmap_settings é do dono. Um editor pode salvar
 * o resto do mapa mental, mas não cria nem revoga link público — mesma proteção
 * que o sync completo já faz em /api/projects/sync.
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
    const image_library = body.image_library;

    // At least one recognised field must be present
    if (mindmap_settings === undefined && image_library === undefined) {
      return NextResponse.json(
        { error: "mindmap_settings or image_library required" },
        { status: 400 }
      );
    }
    if (mindmap_settings !== undefined && typeof mindmap_settings !== "object") {
      return NextResponse.json({ error: "mindmap_settings must be an object" }, { status: 400 });
    }
    // null é válido: é como a UI descadastra a pasta.
    if (image_library !== undefined && image_library !== null && typeof image_library !== "object") {
      return NextResponse.json({ error: "image_library must be an object or null" }, { status: 400 });
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
      .select("id, owner_id, mindmap_settings")
      .eq("id", projectId)
      .maybeSingle();

    if (fetchErr || !project) {
      return NextResponse.json({ error: "forbidden or not found" }, { status: 403 });
    }

    const isOwner = project.owner_id === user.id;

    if (!isOwner) {
      const { data: member } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!member || member.role !== "editor") {
        return NextResponse.json({ error: "editor role required" }, { status: 403 });
      }
    }

    const updated_at = new Date().toISOString();
    const updateFields: Record<string, unknown> = { updated_at };
    if (mindmap_settings !== undefined) {
      if (isOwner) {
        updateFields.mindmap_settings = mindmap_settings;
      } else {
        const currentSharing = (project.mindmap_settings as { sharing?: unknown } | null)?.sharing;
        updateFields.mindmap_settings = {
          ...(mindmap_settings as Record<string, unknown>),
          sharing: currentSharing ?? {},
        };
      }
    }
    if (image_library !== undefined) updateFields.image_library = image_library;

    const { error: updateErr } = await supabase
      .from("projects")
      .update(updateFields)
      .eq("id", projectId);

    if (updateErr) {
      return NextResponse.json(
        { error: "update_failed", message: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
