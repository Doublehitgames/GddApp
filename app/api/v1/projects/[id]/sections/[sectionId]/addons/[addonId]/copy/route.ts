import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  requireProject,
  requireSection,
  apiJson,
  apiError,
} from "@/lib/api/v1/helpers";
import { copyAddon } from "@/lib/addons/copy";
import type { SectionAddon } from "@/lib/addons/types";

type Ctx = { params: Promise<{ id: string; sectionId: string; addonId: string }> };

const copyBodySchema = z.object({
  toSectionId: z.string().uuid("toSectionId must be a UUID"),
});

/**
 * POST /api/v1/projects/:id/sections/:sectionId/addons/:addonId/copy
 * Body: { toSectionId }
 *
 * Copies the given addon into `toSectionId`. Generates a new addon ID,
 * deep-clones data, and clears intra-section refs. Returns the newly
 * inserted addon.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id, sectionId, addonId } = await ctx.params;
  const authResult = await requireAuth(request);
  if ("response" in authResult) return authResult.response;
  const { auth } = authResult;

  const pResult = await requireProject(auth.supabase, id, auth.userId, { write: true });
  if ("response" in pResult) return pResult.response;

  const fromResult = await requireSection(auth.supabase, id, sectionId);
  if ("response" in fromResult) return fromResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "invalid_json");
  }
  const parsed = copyBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }

  const toResult = await requireSection(auth.supabase, id, parsed.data.toSectionId);
  if ("response" in toResult) return toResult.response;

  const sourceAddons = (fromResult.section.balance_addons ?? []) as SectionAddon[];
  const source = sourceAddons.find((a) => a.id === addonId);
  if (!source) return apiError("Addon not found", 404, "not_found");

  const copied = copyAddon(source);
  const toAddons = (toResult.section.balance_addons ?? []) as SectionAddon[];
  const nextToAddons = [...toAddons, copied];

  const now = new Date().toISOString();
  const { error } = await auth.supabase
    .from("sections")
    .update({
      balance_addons: nextToAddons,
      updated_at: now,
      updated_by: auth.userId,
    })
    .eq("id", parsed.data.toSectionId)
    .eq("project_id", id);

  if (error) return apiError("Failed to copy addon", 500, "db_error");

  await auth.supabase.from("projects").update({ updated_at: now }).eq("id", id);

  return apiJson(copied, 201);
}
