import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FREE_MAX_PROJECTS,
  FREE_MAX_SECTIONS_PER_PROJECT,
  FREE_MAX_SECTIONS_TOTAL,
  type StructuralLimitReason,
} from "@/lib/structuralLimits";

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

type ProjectRow = {
  id: string;
  title: string;
  owner_id: string;
};

type MemberEntry = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: string;
  createdAt: string | null;
};

type StructuralLimitValidationResult =
  | { ok: true }
  | { ok: false; reason: StructuralLimitReason; limit: number };

const MEMBERS_ROUTE_TAG = "[api/projects/[id]/members]";

function mapTransferRpcError(error: { code?: string; message?: string } | null) {
  const message = String(error?.message || "");
  const isMissingRpc =
    error?.code === "PGRST202" ||
    message.includes("Could not find the function public.transfer_project_ownership");

  if (isMissingRpc) {
    return NextResponse.json(
      {
        error: "transfer_migration_required",
        message:
          "A função RPC de transferência não foi encontrada. Execute lib/supabase/add_transfer_project_ownership_rpc.sql no Supabase.",
      },
      { status: 500 }
    );
  }

  if (message.includes("project_not_found")) {
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  }
  if (message.includes("forbidden_only_owner_can_transfer")) {
    return NextResponse.json({ error: "forbidden_only_owner_can_transfer" }, { status: 403 });
  }
  if (message.includes("target_must_be_editor_member")) {
    return NextResponse.json(
      { error: "validation_error", message: "A transferência só pode ser feita para membros editores." },
      { status: 400 }
    );
  }

  return NextResponse.json({ error: "transfer_failed" }, { status: 500 });
}

async function requireProjectForUserAccess(supabase: SupabaseLike, projectId: string, userId: string) {
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id,title,owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectErr || !project) {
    return { error: NextResponse.json({ error: "project_not_found" }, { status: 404 }) };
  }

  const typedProject = project as ProjectRow;
  const isOwner = typedProject.owner_id === userId;
  if (!isOwner) {
    const { data: myRow } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!myRow) {
      return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    }
  }

  return { project: typedProject, isOwner } as const;
}

async function buildMembersResponse(admin: ReturnType<typeof createAdminClient>, projectId: string, ownerId: string) {
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
    return { error: NextResponse.json({ error: "members_fetch_failed" }, { status: 500 }) };
  }

  const rawRows = (rows || []).filter((row: { user_id: string }) => row.user_id !== ownerId);
  const userIds = rawRows.map((r: { user_id: string }) => r.user_id);
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
  const ownerEntry: MemberEntry = {
    userId: ownerId,
    email: ownerRow?.email ?? null,
    displayName: ownerRow?.display_name ?? null,
    role: "owner",
    createdAt: null,
  };

  const memberEntries: MemberEntry[] = rawRows.map((r: { user_id: string; role: string; created_at: string }) => {
    const p = profileById.get(r.user_id);
    return {
      userId: r.user_id,
      email: p?.email ?? null,
      displayName: p?.display_name ?? null,
      role: r.role,
      createdAt: r.created_at,
    };
  });

  return { members: [ownerEntry, ...memberEntries] } as const;
}

async function validateTransferStructuralLimits(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  targetOwnerId: string
): Promise<StructuralLimitValidationResult> {
  const { data: targetOwnerProjects, error: ownerProjectsErr } = await admin
    .from("projects")
    .select("id")
    .eq("owner_id", targetOwnerId);

  if (ownerProjectsErr) {
    throw new Error("projects_query_failed");
  }

  const ownedProjectIds = new Set((targetOwnerProjects || []).map((row: { id: string }) => row.id));
  if (!ownedProjectIds.has(projectId) && ownedProjectIds.size >= FREE_MAX_PROJECTS) {
    return { ok: false, reason: "projects_limit", limit: FREE_MAX_PROJECTS };
  }

  const { count: projectSectionsCount, error: projectSectionsErr } = await admin
    .from("sections")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (projectSectionsErr) {
    throw new Error("project_sections_count_failed");
  }

  if ((projectSectionsCount ?? 0) > FREE_MAX_SECTIONS_PER_PROJECT) {
    return { ok: false, reason: "sections_per_project_limit", limit: FREE_MAX_SECTIONS_PER_PROJECT };
  }

  const allTargetOwnerProjectIds = Array.from(new Set([...ownedProjectIds, projectId]));
  const { count: totalSectionsCount, error: totalSectionsErr } = await admin
    .from("sections")
    .select("id", { count: "exact", head: true })
    .in("project_id", allTargetOwnerProjectIds);

  if (totalSectionsErr) {
    throw new Error("total_sections_count_failed");
  }

  if ((totalSectionsCount ?? 0) > FREE_MAX_SECTIONS_TOTAL) {
    return { ok: false, reason: "sections_total_limit", limit: FREE_MAX_SECTIONS_TOTAL };
  }

  return { ok: true };
}

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

    const projectAccess = await requireProjectForUserAccess(supabase, projectId, user.id);
    if ("error" in projectAccess) return projectAccess.error;
    const { project } = projectAccess;

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json({ error: "server_error", message: "Backend key required to list members." }, { status: 500 });
    }

    const membersData = await buildMembersResponse(admin, projectId, project.owner_id);
    if ("error" in membersData) return membersData.error;

    return NextResponse.json({ members: membersData.members });
  } catch (e) {
    console.error(`${MEMBERS_ROUTE_TAG} GET error:`, e);
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
 * PATCH: transfere ownership do projeto para um membro editor.
 * Body: { targetUserId: string, confirmProjectTitle: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "project_id_required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
    const confirmProjectTitle =
      typeof body.confirmProjectTitle === "string" ? body.confirmProjectTitle.trim() : "";

    if (!targetUserId || !confirmProjectTitle) {
      return NextResponse.json(
        { error: "validation_error", message: "targetUserId e confirmProjectTitle são obrigatórios." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const projectAccess = await requireProjectForUserAccess(supabase, projectId, user.id);
    if ("error" in projectAccess) return projectAccess.error;
    const { project, isOwner } = projectAccess;

    if (!isOwner) {
      return NextResponse.json({ error: "forbidden_only_owner_can_transfer" }, { status: 403 });
    }

    if (project.title.trim() !== confirmProjectTitle) {
      return NextResponse.json(
        { error: "validation_error", message: "Nome do projeto não confere." },
        { status: 400 }
      );
    }

    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "validation_error", message: "Selecione um membro editor diferente do dono atual." },
        { status: 400 }
      );
    }

    const { data: targetMemberRow, error: targetMemberErr } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (targetMemberErr) {
      return NextResponse.json({ error: "member_lookup_failed" }, { status: 500 });
    }
    const targetRole = (targetMemberRow as { role?: string } | null)?.role;
    if (!targetMemberRow || targetRole !== "editor") {
      return NextResponse.json(
        { error: "validation_error", message: "A transferência só pode ser feita para membros editores." },
        { status: 400 }
      );
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json({ error: "server_error", message: "Backend key required to transfer ownership." }, { status: 500 });
    }

    const limits = await validateTransferStructuralLimits(admin, projectId, targetUserId);
    if (!limits.ok) {
      return NextResponse.json(
        {
          error: "structural_limit_exceeded",
          code: "structural_limit_exceeded",
          reason: limits.reason,
          limit: limits.limit,
        },
        { status: 403 }
      );
    }

    // Etapa crítica em transação no banco: evita estado parcial se falhar no meio.
    const { error: transferErr } = await supabase.rpc("transfer_project_ownership", {
      p_project_id: projectId,
      p_new_owner_id: targetUserId,
    });
    if (transferErr) {
      return mapTransferRpcError(transferErr);
    }

    const membersData = await buildMembersResponse(admin, projectId, targetUserId);
    if ("error" in membersData) return membersData.error;

    return NextResponse.json(
      { ok: true, newOwnerId: targetUserId, previousOwnerId: user.id, members: membersData.members },
      { status: 200 }
    );
  } catch (e) {
    console.error(`${MEMBERS_ROUTE_TAG} PATCH error:`, e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
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
    console.error(`${MEMBERS_ROUTE_TAG} DELETE error:`, err.message, err.stack);
    return NextResponse.json({ error: "server_error", message: "Erro inesperado ao remover membro." }, { status: 500 });
  }
}
