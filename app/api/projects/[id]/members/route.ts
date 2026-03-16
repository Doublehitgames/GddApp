import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET: lista membros do projeto (dono + convidados). Dono e membros veem a lista completa.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "project_id_required" }, { status: 400 });
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
      const { data: myRow } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!myRow) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json({ error: "server_error", message: "Backend key required to list members." }, { status: 500 });
    }

    const { data: ownerProf } = await admin
      .from("profiles")
      .select("id, email, display_name")
      .eq("id", ownerId)
      .maybeSingle();

    const { data: rows, error: membersErr } = await admin
      .from("project_members")
      .select("user_id, role, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (membersErr) {
      return NextResponse.json({ error: "members_fetch_failed" }, { status: 500 });
    }

    const userIds = (rows || []).map((r: { user_id: string }) => r.user_id);
    let profiles: { id: string; email: string | null; display_name: string | null }[] = [];
    if (userIds.length > 0) {
      const { data: prof } = await admin
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);
      profiles = prof || [];
    }

    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const ownerRow = ownerProf as { email: string | null; display_name: string | null } | null;
    const ownerEntry = {
      userId: ownerId,
      email: ownerRow?.email ?? null,
      displayName: ownerRow?.display_name ?? null,
      role: "owner",
      createdAt: null as string | null,
    };
    const memberEntries = (rows || []).map((r: { user_id: string; role: string; created_at: string }) => {
      const p = profileById.get(r.user_id);
      return {
        userId: r.user_id,
        email: p?.email ?? null,
        displayName: p?.display_name ?? null,
        role: r.role,
        createdAt: r.created_at,
      };
    });
    const members = [ownerEntry, ...memberEntries];

    return NextResponse.json({ members });
  } catch (e) {
    console.error("[api/projects/[id]/members] GET error:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/**
 * POST: adiciona membro por e-mail. Apenas o dono do projeto pode adicionar.
 * Body: { email: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "project_id_required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
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
    if (ownerId !== user.id) {
      return NextResponse.json({ error: "forbidden_only_owner_can_invite" }, { status: 403 });
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch (adminErr) {
      console.error("[api/projects/[id]/members] createAdminClient failed:", adminErr);
      const hint =
        typeof process.env.VERCEL === "string"
          ? "No Vercel: Settings → Environment Variables → adicione SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) e faça redeploy."
          : "Local: crie ou edite .env.local na raiz do projeto e adicione SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui (ou SUPABASE_SECRET_KEY).";
      return NextResponse.json(
        {
          error: "server_error",
          message: "Chave de backend do Supabase ausente. " + hint,
          debug: process.env.NODE_ENV === "development" ? String((adminErr as Error).message) : undefined,
        },
        { status: 500 }
      );
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (profileErr) {
      console.error("[api/projects/[id]/members] profiles lookup error:", profileErr);
      return NextResponse.json(
        {
          error: "profiles_lookup_failed",
          message: "Não foi possível buscar o usuário por e-mail.",
          debug: process.env.NODE_ENV === "development" ? String(profileErr.message) : undefined,
        },
        { status: 500 }
      );
    }
    if (!profile) {
      return NextResponse.json(
        { error: "user_not_found", message: "Nenhum usuário encontrado com este e-mail." },
        { status: 404 }
      );
    }

    const invitedUserId = (profile as { id: string }).id;
    if (invitedUserId === user.id) {
      return NextResponse.json(
        { error: "cannot_invite_self", message: "Você já é o dono do projeto." },
        { status: 400 }
      );
    }

    const { error: insertErr } = await supabase.from("project_members").insert({
      project_id: projectId,
      user_id: invitedUserId,
      role: "editor",
      invited_by: user.id,
    });

    if (insertErr) {
      const err = insertErr as { code?: string; message?: string; details?: string };
      if (err.code === "23505") {
        return NextResponse.json(
          { error: "already_member", message: "Este usuário já é membro do projeto." },
          { status: 409 }
        );
      }
      console.error("[api/projects/[id]/members] POST insert error:", insertErr);
      return NextResponse.json({
        error: "insert_failed",
        message: "Não foi possível adicionar o membro.",
        debug: process.env.NODE_ENV === "development" ? (err.message || err.details || String(insertErr)) : undefined,
      }, { status: 500 });
    }

    return NextResponse.json({ ok: true, userId: invitedUserId }, { status: 201 });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[api/projects/[id]/members] POST error:", err.message, err.stack);
    return NextResponse.json(
      {
        error: "server_error",
        message: "Erro inesperado ao adicionar membro.",
        debug: process.env.NODE_ENV === "development" ? (err.message + (err.stack ? `\n${err.stack}` : "")) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: remove um membro do projeto. Apenas o dono pode remover.
 * Query: ?userId=uuid (user_id do membro a remover)
 * O membro removido perde acesso ao projeto (RLS deixa de permitir leitura/edição).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "project_id_required" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const userIdToRemove = searchParams.get("userId")?.trim();
    if (!userIdToRemove) {
      return NextResponse.json({ error: "userId_required" }, { status: 400 });
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
    if (ownerId !== user.id) {
      return NextResponse.json({ error: "forbidden_only_owner_can_remove" }, { status: 403 });
    }

    if (userIdToRemove === user.id) {
      return NextResponse.json(
        { error: "cannot_remove_self", message: "O dono não pode remover a si mesmo como membro." },
        { status: 400 }
      );
    }

    const { error: deleteErr } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userIdToRemove);

    if (deleteErr) {
      console.error("[api/projects/[id]/members] DELETE error:", deleteErr);
      return NextResponse.json(
        { error: "remove_failed", message: "Não foi possível remover o membro." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[api/projects/[id]/members] DELETE error:", err.message, err.stack);
    return NextResponse.json({ error: "server_error", message: "Erro inesperado ao remover membro." }, { status: 500 });
  }
}
