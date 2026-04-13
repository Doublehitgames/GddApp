import { NextRequest } from "next/server";
import {
  requireAuth,
  requireProject,
  selectSections,
  apiJson,
  apiError,
  projectToApi,
  sectionToApi,
} from "@/lib/api/v1/helpers";
import { updateProjectSchema } from "@/lib/api/v1/schemas";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/projects/:id — get project with all sections & addons.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId);
  if ("response" in pResult) return pResult.response;

  // Load sections
  const { data: sections } = await selectSections(auth.supabase, { projectId: id });

  return apiJson({
    ...projectToApi(pResult.project),
    sections: (sections ?? []).map(sectionToApi),
  });
}

/**
 * PATCH /api/v1/projects/:id — update project metadata.
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
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

  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }

  if (Object.keys(parsed.data).length === 0) {
    return apiError("No fields to update", 400, "empty_update");
  }

  // Map camelCase → snake_case for DB
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.coverImageUrl !== undefined) updates.cover_image_url = parsed.data.coverImageUrl;
  if (parsed.data.mindmapSettings !== undefined) updates.mindmap_settings = parsed.data.mindmapSettings;

  const { data: updated, error } = await auth.supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select("id, owner_id, title, description, cover_image_url, mindmap_settings, created_at, updated_at")
    .single();

  if (error || !updated) {
    return apiError("Failed to update project", 500, "db_error");
  }

  return apiJson(projectToApi(updated));
}

/**
 * DELETE /api/v1/projects/:id — delete project (owner only).
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId, {
    ownerOnly: true,
  });
  if ("response" in pResult) return pResult.response;

  // Sections are cascade-deleted by FK
  const { error } = await auth.supabase.from("projects").delete().eq("id", id);
  if (error) return apiError("Failed to delete project", 500, "db_error");

  // Record tombstone so local clients know it was deleted
  await auth.supabase
    .from("deleted_projects")
    .upsert({ project_id: id }, { onConflict: "project_id" });

  return apiJson({ deleted: true });
}
