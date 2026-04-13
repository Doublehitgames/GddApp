import { NextRequest } from "next/server";
import {
  requireAuth,
  requireProject,
  selectSections,
  apiJson,
  apiError,
  sectionToApi,
} from "@/lib/api/v1/helpers";
import { createSectionSchema } from "@/lib/api/v1/schemas";
import {
  FREE_MAX_SECTIONS_PER_PROJECT,
  FREE_MAX_SECTIONS_TOTAL,
} from "@/lib/structuralLimits";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/projects/:id/sections — list sections of a project.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId);
  if ("response" in pResult) return pResult.response;

  const { data: sections, error } = await selectSections(auth.supabase, { projectId: id });

  if (error) return apiError("Failed to fetch sections", 500, "db_error");

  return apiJson((sections ?? []).map(sectionToApi));
}

/**
 * POST /api/v1/projects/:id/sections — create a section.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId, {
    write: true,
  });
  if ("response" in pResult) return pResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "invalid_json");
  }

  const parsed = createSectionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }

  // Structural limits (applied to project owner)
  const projectOwnerId = pResult.project.owner_id;

  // Sections in this project
  const { count: projectSectionCount } = await auth.supabase
    .from("sections")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id);

  if ((projectSectionCount ?? 0) >= FREE_MAX_SECTIONS_PER_PROJECT) {
    return apiError(
      `Section limit per project reached (${FREE_MAX_SECTIONS_PER_PROJECT})`,
      403,
      "structural_limit_exceeded",
      { reason: "sections_per_project_limit", limit: FREE_MAX_SECTIONS_PER_PROJECT }
    );
  }

  // Total sections across all owner's projects
  const { data: ownerProjects } = await auth.supabase
    .from("projects")
    .select("id")
    .eq("owner_id", projectOwnerId);

  if (ownerProjects && ownerProjects.length > 0) {
    const { count: totalCount } = await auth.supabase
      .from("sections")
      .select("id", { count: "exact", head: true })
      .in("project_id", ownerProjects.map((p) => p.id));

    if ((totalCount ?? 0) >= FREE_MAX_SECTIONS_TOTAL) {
      return apiError(
        `Total sections limit reached (${FREE_MAX_SECTIONS_TOTAL})`,
        403,
        "structural_limit_exceeded",
        { reason: "sections_total_limit", limit: FREE_MAX_SECTIONS_TOTAL }
      );
    }
  }

  // Validate parentId belongs to same project (if provided)
  if (parsed.data.parentId) {
    const { data: parent } = await auth.supabase
      .from("sections")
      .select("id")
      .eq("id", parsed.data.parentId)
      .eq("project_id", id)
      .maybeSingle();

    if (!parent) {
      return apiError("Parent section not found in this project", 400, "invalid_parent");
    }
  }

  const now = new Date().toISOString();
  const { data: section, error } = await auth.supabase
    .from("sections")
    .insert({
      project_id: id,
      parent_id: parsed.data.parentId,
      title: parsed.data.title,
      content: parsed.data.content,
      sort_order: parsed.data.order,
      color: parsed.data.color,
      domain_tags: parsed.data.domainTags,
      data_id: parsed.data.dataId,
      created_at: now,
      updated_at: now,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select("id")
    .single();

  if (error || !section) {
    return apiError("Failed to create section", 500, "db_error");
  }

  // Re-read with fallback columns
  const { data: rows } = await selectSections(auth.supabase, { projectId: id, sectionId: section.id });
  const created = rows?.[0];

  // Touch project updated_at
  await auth.supabase
    .from("projects")
    .update({ updated_at: now })
    .eq("id", id);

  if (!created) return apiError("Failed to read created section", 500, "db_error");
  return apiJson(sectionToApi(created), 201);
}
