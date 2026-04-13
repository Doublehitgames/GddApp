import { NextRequest } from "next/server";
import {
  requireAuth,
  requireProject,
  requireSection,
  apiJson,
  apiError,
} from "@/lib/api/v1/helpers";
import { updateAddonSchema } from "@/lib/api/v1/schemas";

type Ctx = { params: Promise<{ id: string; sectionId: string; addonId: string }> };

type AddonRecord = Record<string, unknown> & { id: string };

function findAddon(
  section: { balance_addons: unknown[] | null },
  addonId: string
): AddonRecord | undefined {
  const addons = (section.balance_addons ?? []) as AddonRecord[];
  return addons.find((a) => a.id === addonId);
}

/**
 * GET /api/v1/projects/:id/sections/:sectionId/addons/:addonId
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id, sectionId, addonId } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId);
  if ("response" in pResult) return pResult.response;

  const sResult = await requireSection(auth.supabase, id, sectionId);
  if ("response" in sResult) return sResult.response;

  const addon = findAddon(sResult.section, addonId);
  if (!addon) return apiError("Addon not found", 404, "not_found");

  return apiJson(addon);
}

/**
 * PATCH /api/v1/projects/:id/sections/:sectionId/addons/:addonId
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id, sectionId, addonId } = await ctx.params;
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

  const parsed = updateAddonSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }

  if (Object.keys(parsed.data).length === 0) {
    return apiError("No fields to update", 400, "empty_update");
  }

  const addons = (sResult.section.balance_addons ?? []) as AddonRecord[];
  const idx = addons.findIndex((a) => a.id === addonId);
  if (idx === -1) return apiError("Addon not found", 404, "not_found");

  // Merge updates into existing addon
  const existing = addons[idx];
  const updated = { ...existing };
  if (parsed.data.name !== undefined) updated.name = parsed.data.name;
  if (parsed.data.group !== undefined) updated.group = parsed.data.group;
  if (parsed.data.data !== undefined) {
    updated.data = { ...(existing.data as Record<string, unknown>), ...parsed.data.data };
  }

  const updatedAddons = [...addons];
  updatedAddons[idx] = updated;

  const now = new Date().toISOString();
  const { error } = await auth.supabase
    .from("sections")
    .update({
      balance_addons: updatedAddons,
      updated_at: now,
      updated_by: auth.userId,
    })
    .eq("id", sectionId)
    .eq("project_id", id);

  if (error) return apiError("Failed to update addon", 500, "db_error");

  await auth.supabase
    .from("projects")
    .update({ updated_at: now })
    .eq("id", id);

  return apiJson(updated);
}

/**
 * DELETE /api/v1/projects/:id/sections/:sectionId/addons/:addonId
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, sectionId, addonId } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId, {
    write: true,
  });
  if ("response" in pResult) return pResult.response;

  const sResult = await requireSection(auth.supabase, id, sectionId);
  if ("response" in sResult) return sResult.response;

  const addons = (sResult.section.balance_addons ?? []) as AddonRecord[];
  const exists = addons.some((a) => a.id === addonId);
  if (!exists) return apiError("Addon not found", 404, "not_found");

  const updatedAddons = addons.filter((a) => a.id !== addonId);

  const now = new Date().toISOString();
  const { error } = await auth.supabase
    .from("sections")
    .update({
      balance_addons: updatedAddons,
      updated_at: now,
      updated_by: auth.userId,
    })
    .eq("id", sectionId)
    .eq("project_id", id);

  if (error) return apiError("Failed to delete addon", 500, "db_error");

  await auth.supabase
    .from("projects")
    .update({ updated_at: now })
    .eq("id", id);

  return apiJson({ deleted: true });
}
