import { NextRequest } from "next/server";
import {
  requireAuth,
  apiJson,
  apiError,
  projectToApi,
} from "@/lib/api/v1/helpers";
import { createProjectSchema } from "@/lib/api/v1/schemas";
import {
  FREE_MAX_PROJECTS,
} from "@/lib/structuralLimits";

/**
 * GET /api/v1/projects — list the caller's projects (owned + member).
 */
export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const { data: owned, error: e1 } = await auth.supabase
    .from("projects")
    .select("id, owner_id, title, description, cover_image_url, mindmap_settings, created_at, updated_at")
    .eq("owner_id", auth.userId)
    .order("updated_at", { ascending: false });

  if (e1) return apiError("Failed to fetch projects", 500, "db_error");

  // Also load projects where user is a member
  const { data: memberRows } = await auth.supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", auth.userId);

  let memberProjects: typeof owned = [];
  if (memberRows && memberRows.length > 0) {
    const memberIds = memberRows
      .map((r) => r.project_id)
      .filter((id) => !owned?.some((p) => p.id === id));

    if (memberIds.length > 0) {
      const { data: mp } = await auth.supabase
        .from("projects")
        .select("id, owner_id, title, description, cover_image_url, mindmap_settings, created_at, updated_at")
        .in("id", memberIds)
        .order("updated_at", { ascending: false });
      memberProjects = mp ?? [];
    }
  }

  const all = [...(owned ?? []), ...memberProjects];
  return apiJson(all.map(projectToApi));
}

/**
 * POST /api/v1/projects — create a new project.
 */
export async function POST(request: NextRequest) {
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "invalid_json");
  }

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }

  // Structural limit: max projects per owner
  const { count } = await auth.supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", auth.userId);

  if ((count ?? 0) >= FREE_MAX_PROJECTS) {
    return apiError(
      `Project limit reached (${FREE_MAX_PROJECTS})`,
      403,
      "structural_limit_exceeded",
      { reason: "projects_limit", limit: FREE_MAX_PROJECTS }
    );
  }

  const now = new Date().toISOString();
  const { data: project, error } = await auth.supabase
    .from("projects")
    .insert({
      owner_id: auth.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      created_at: now,
      updated_at: now,
    })
    .select("id, owner_id, title, description, cover_image_url, mindmap_settings, created_at, updated_at")
    .single();

  if (error || !project) {
    return apiError("Failed to create project", 500, "db_error");
  }

  return apiJson(projectToApi(project), 201);
}
