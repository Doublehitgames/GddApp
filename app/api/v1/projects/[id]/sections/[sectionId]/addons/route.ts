import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  requireAuth,
  requireProject,
  requireSection,
  apiJson,
  apiError,
  SECTION_COLUMNS,
} from "@/lib/api/v1/helpers";
import { createAddonSchema } from "@/lib/api/v1/schemas";

type Ctx = { params: Promise<{ id: string; sectionId: string }> };

/**
 * GET /api/v1/projects/:id/sections/:sectionId/addons — list addons.
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

  const addons = (sResult.section.balance_addons ?? []) as Record<string, unknown>[];
  return apiJson(addons);
}

/**
 * POST /api/v1/projects/:id/sections/:sectionId/addons — add an addon.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
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

  const parsed = createAddonSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }

  const addonId = randomUUID();
  const newAddon = {
    id: addonId,
    type: parsed.data.type,
    name: parsed.data.name,
    ...(parsed.data.group ? { group: parsed.data.group } : {}),
    data: {
      id: addonId,
      name: parsed.data.name,
      ...(parsed.data.data ?? {}),
    },
  };

  const currentAddons = (sResult.section.balance_addons ?? []) as Record<string, unknown>[];
  const updatedAddons = [...currentAddons, newAddon];

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

  if (error) return apiError("Failed to add addon", 500, "db_error");

  // Touch project updated_at
  await auth.supabase
    .from("projects")
    .update({ updated_at: now })
    .eq("id", id);

  return apiJson(newAddon, 201);
}
