import { NextRequest } from "next/server";
import {
  requireAuth,
  requireProject,
  selectSections,
  apiJson,
  apiError,
} from "@/lib/api/v1/helpers";
import { remoteConfigQuerySchema } from "@/lib/api/v1/schemas";
import {
  buildSectionLookupFromRows,
  collectSubtree,
  resolveConfig,
  resolveConfigsForSections,
  type AddonRecord,
  type ResolvedConfig,
} from "@/lib/api/v1/remoteConfig";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/projects/:id/remote-config
 *
 * Resolves Remote Config (exportSchema) addons server-side and returns the
 * resolved economy JSON (actual values, not the blueprint). Scope via query:
 *   - (none)          → every exportSchema in the project
 *   - ?sectionId=X    → every exportSchema in section X's subtree
 *   - ?addonId=Y      → the single exportSchema addon Y
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId);
  if ("response" in pResult) return pResult.response;

  const parsed = remoteConfigQuerySchema.safeParse({
    sectionId: request.nextUrl.searchParams.get("sectionId") ?? undefined,
    addonId: request.nextUrl.searchParams.get("addonId") ?? undefined,
  });
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }
  const { sectionId, addonId } = parsed.data;

  const { data: sections, error } = await selectSections(auth.supabase, { projectId: id });
  if (error) return apiError("Failed to load sections", 500, "db_error");
  const allSections = sections ?? [];
  const lookup = buildSectionLookupFromRows(allSections);

  // Mode: single addon — search the whole project for it.
  if (addonId) {
    for (const section of allSections) {
      const addon = ((section.balance_addons ?? []) as AddonRecord[]).find((a) => a?.id === addonId);
      if (!addon) continue;
      if (addon.type !== "exportSchema") {
        return apiError("Addon is not a Remote Config (exportSchema) addon", 400, "invalid_addon_type");
      }
      return apiJson({ configs: [resolveConfig(section, addon, lookup)] });
    }
    return apiError("Addon not found", 404, "not_found");
  }

  // Mode: subtree — only sections under sectionId (inclusive).
  let targetSections = allSections;
  if (sectionId) {
    if (!lookup.has(sectionId)) {
      return apiError("Section not found", 404, "not_found");
    }
    const subtree = collectSubtree(sectionId, allSections);
    targetSections = allSections.filter((s) => subtree.has(s.id));
  }

  // Mode: all (or subtree) — resolve every exportSchema found.
  const configs: ResolvedConfig[] = resolveConfigsForSections(targetSections, lookup);
  return apiJson({ configs });
}
