import { NextRequest } from "next/server";
import {
  requireAuth,
  requireProject,
  requireSection,
  selectSections,
  apiJson,
  apiError,
  sectionToApi,
} from "@/lib/api/v1/helpers";
import { updateSectionSchema } from "@/lib/api/v1/schemas";

type Ctx = { params: Promise<{ id: string; sectionId: string }> };

/**
 * GET /api/v1/projects/:id/sections/:sectionId
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id, sectionId } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId);
  if ("response" in pResult) return pResult.response;

  const sResult = await requireSection(auth.supabase, id, sectionId);
  if ("response" in sResult) return sResult.response;

  return apiJson(sectionToApi(sResult.section));
}

/**
 * PATCH /api/v1/projects/:id/sections/:sectionId
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id, sectionId } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId, {
    write: true,
  });
  if ("response" in pResult) return pResult.response;

  const sResult = await requireSection(auth.supabase, id, sectionId);
  if ("response" in sResult) return sResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "invalid_json");
  }

  const parsed = updateSectionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }

  if (Object.keys(parsed.data).length === 0) {
    return apiError("No fields to update", 400, "empty_update");
  }

  // Validate parentId if changing
  if (parsed.data.parentId !== undefined && parsed.data.parentId !== null) {
    if (parsed.data.parentId === sectionId) {
      return apiError("Section cannot be its own parent", 400, "invalid_parent");
    }
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
  const updates: Record<string, unknown> = {
    updated_at: now,
    updated_by: auth.userId,
  };

  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.content !== undefined) updates.content = parsed.data.content;
  if (parsed.data.parentId !== undefined) updates.parent_id = parsed.data.parentId;
  if (parsed.data.order !== undefined) updates.sort_order = parsed.data.order;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  if (parsed.data.domainTags !== undefined) updates.domain_tags = parsed.data.domainTags;
  if (parsed.data.dataId !== undefined) updates.data_id = parsed.data.dataId;
  if (parsed.data.thumbImageUrl !== undefined) updates.thumb_image_url = parsed.data.thumbImageUrl;
  if (parsed.data.addonGroupNotes !== undefined) updates.addon_group_notes = parsed.data.addonGroupNotes;

  const { error } = await auth.supabase
    .from("sections")
    .update(updates)
    .eq("id", sectionId)
    .eq("project_id", id);

  if (error) return apiError("Failed to update section", 500, "db_error");

  // Re-read to get the full row with fallback columns
  const { data: rows } = await selectSections(auth.supabase, { projectId: id, sectionId });
  if (!rows || rows.length === 0) {
    return apiError("Section not found after update", 500, "db_error");
  }

  // Touch project updated_at
  await auth.supabase
    .from("projects")
    .update({ updated_at: now })
    .eq("id", id);

  return apiJson(sectionToApi(rows[0]));
}

/**
 * DELETE /api/v1/projects/:id/sections/:sectionId
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, sectionId } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId, {
    write: true,
  });
  if ("response" in pResult) return pResult.response;

  const sResult = await requireSection(auth.supabase, id, sectionId);
  if ("response" in sResult) return sResult.response;

  // Children are cascade-deleted by FK (parent_id)
  const { error } = await auth.supabase
    .from("sections")
    .delete()
    .eq("id", sectionId)
    .eq("project_id", id);

  if (error) return apiError("Failed to delete section", 500, "db_error");

  // Touch project updated_at
  await auth.supabase
    .from("projects")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return apiJson({ deleted: true });
}
