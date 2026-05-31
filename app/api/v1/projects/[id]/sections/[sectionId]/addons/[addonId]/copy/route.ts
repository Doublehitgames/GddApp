import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  requireProject,
  requireSection,
  apiJson,
  apiError,
} from "@/lib/api/v1/helpers";
import { copyAddon, overwriteShell } from "@/lib/addons/copy";
import { SINGLETON_ADDON_TYPES } from "@/lib/addons/singletons";
import type { SectionAddon } from "@/lib/addons/types";

type Ctx = { params: Promise<{ id: string; sectionId: string; addonId: string }> };

const copyBodySchema = z.object({
  toSectionId: z.string().uuid("toSectionId must be a UUID"),
  /** Quando true, sobrescreve um addon singleton já existente no destino. */
  overwrite: z.boolean().optional(),
});

/**
 * POST /api/v1/projects/:id/sections/:sectionId/addons/:addonId/copy
 * Body: { toSectionId, overwrite? }
 *
 * Copies the given addon into `toSectionId`. Generates a new addon ID,
 * deep-clones data, and re-links intra-section refs to the destination's
 * equivalent addons (so value bindings keep working when the target page
 * already has the needed addons). For singleton addon types already present
 * in the destination, responds 409 unless `overwrite: true`, in which case it
 * replaces the existing addon in place (keeping its id/group/name). Returns
 * the inserted (or overwritten) addon.
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

  const toAddons = (toResult.section.balance_addons ?? []) as SectionAddon[];
  // Religa as refs intra-página aos addons equivalentes do destino.
  const copied = copyAddon(source, {
    fromSectionId: sectionId,
    toSectionId: parsed.data.toSectionId,
    targetAddons: toAddons,
  });

  // Addons singleton: se o destino já tem um do mesmo tipo, exige overwrite.
  const existing = SINGLETON_ADDON_TYPES.has(source.type)
    ? toAddons.find((a) => a.type === source.type)
    : undefined;
  let nextToAddons: SectionAddon[];
  let resultAddon: SectionAddon;
  if (existing) {
    if (!parsed.data.overwrite) {
      return apiError(
        "Destination already has a singleton addon of this type; pass overwrite=true to replace it",
        409,
        "singleton_conflict",
        { existingAddonId: existing.id, type: source.type }
      );
    }
    resultAddon = overwriteShell(copied, existing);
    nextToAddons = toAddons.map((a) => (a.id === existing.id ? resultAddon : a));
  } else {
    resultAddon = copied;
    nextToAddons = [...toAddons, copied];
  }

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

  return apiJson(resultAddon, existing ? 200 : 201);
}
