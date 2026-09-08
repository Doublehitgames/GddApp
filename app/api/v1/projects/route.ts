import { NextRequest } from "next/server";
import {
  requireAuth,
  selectProjects,
  apiJson,
  apiError,
  projectAccessMap,
  projectToApi,
} from "@/lib/api/v1/helpers";
import { createProjectSchema } from "@/lib/api/v1/schemas";
import { getRemoteConfig } from "@/lib/remoteConfig";

/**
 * GET /api/v1/projects — every project the caller can reach, owned or shared.
 *
 * Each row carries `access` (owner / editor / viewer), so a caller working
 * across other people's documents knows what it may write before it tries.
 */
export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const access = await projectAccessMap(auth.supabase, auth.userId);
  if (access.size === 0) return apiJson([]);

  const { data: projects, error } = await selectProjects(auth.supabase, {
    in: ["id", [...access.keys()]],
    order: "updated_at",
  });

  if (error) return apiError("Failed to fetch projects", 500, "db_error");

  return apiJson((projects ?? []).map((p) => projectToApi(p, access.get(p.id))));
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
  const { FREE_MAX_PROJECTS } = await getRemoteConfig();
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
    .select("id")
    .single();

  if (error || !project) {
    return apiError("Failed to create project", 500, "db_error");
  }

  // Re-read with fallback
  const { data: created } = await selectProjects(auth.supabase, { eq: ["id", project.id] });
  return apiJson(projectToApi(created?.[0] ?? { ...project, owner_id: auth.userId, title: parsed.data.title, description: parsed.data.description, content_blocks: null, cover_image_url: null, mindmap_settings: null, ai_instructions: null, image_library: null, created_at: now, updated_at: now }, "owner"), 201);
}
