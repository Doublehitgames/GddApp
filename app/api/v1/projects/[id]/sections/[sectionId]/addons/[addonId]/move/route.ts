import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  requireProject,
  requireSection,
  apiJson,
  apiError,
} from "@/lib/api/v1/helpers";
import { moveAddon } from "@/lib/addons/move";
import { collectReverseRefUpdates } from "@/lib/addons/refs";
import type { SectionAddon } from "@/lib/addons/types";

type Ctx = { params: Promise<{ id: string; sectionId: string; addonId: string }> };

const moveBodySchema = z.object({
  toSectionId: z.string().uuid("toSectionId must be a UUID"),
});

/**
 * POST /api/v1/projects/:id/sections/:sectionId/addons/:addonId/move
 * Body: { toSectionId }
 *
 * Moves the addon from its section to `toSectionId`. Keeps the addon ID,
 * clears intra-section refs, and — when the source section is left without
 * another addon of the same type — rewrites reverse-refs across the project
 * to point at the destination.
 *
 * Returns { addon, reverseRefsUpdated }.
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
  const parsed = moveBodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }
  const toSectionId = parsed.data.toSectionId;

  if (toSectionId === sectionId) {
    return apiError("toSectionId must differ from the origin", 400, "same_section");
  }

  const toResult = await requireSection(auth.supabase, id, toSectionId);
  if ("response" in toResult) return toResult.response;

  const fromAddons = (fromResult.section.balance_addons ?? []) as SectionAddon[];
  const source = fromAddons.find((a) => a.id === addonId);
  if (!source) return apiError("Addon not found", 404, "not_found");

  // Load ALL sections of the project to compute reverse-ref updates.
  const { data: allSectionsData, error: listError } = await auth.supabase
    .from("sections")
    .select("id, balance_addons")
    .eq("project_id", id);
  if (listError || !allSectionsData) {
    return apiError("Failed to load project sections", 500, "db_error");
  }

  const movedAddon = moveAddon(source);
  const movedType = source.type;

  type SectionRow = { id: string; balance_addons: SectionAddon[] | null };
  const rows = allSectionsData as SectionRow[];

  // Build post-move snapshot (origin filtered, destination appended).
  const postMove = rows.map((row) => {
    if (row.id === sectionId) {
      return { id: row.id, addons: (row.balance_addons || []).filter((a) => a.id !== addonId) };
    }
    if (row.id === toSectionId) {
      return { id: row.id, addons: [...(row.balance_addons || []), movedAddon] };
    }
    return { id: row.id, addons: row.balance_addons || [] };
  });

  const { updatedSections, count } = collectReverseRefUpdates(
    postMove,
    movedType,
    sectionId,
    toSectionId
  );

  // Persist: diff against original, update only the sections whose addons
  // array changed.
  const originalById = new Map(rows.map((r) => [r.id, r.balance_addons || []] as const));
  const now = new Date().toISOString();

  for (const section of updatedSections) {
    const previous = originalById.get(section.id);
    const nextAddons = section.addons;
    const changed = previous !== nextAddons;
    if (!changed) continue;
    const { error } = await auth.supabase
      .from("sections")
      .update({
        balance_addons: nextAddons,
        updated_at: now,
        updated_by: auth.userId,
      })
      .eq("id", section.id)
      .eq("project_id", id);
    if (error) return apiError("Failed to persist move", 500, "db_error");
  }

  await auth.supabase.from("projects").update({ updated_at: now }).eq("id", id);

  return apiJson({ addon: movedAddon, reverseRefsUpdated: count });
}
