import { NextRequest } from "next/server";
import {
  requireAuth,
  requireProject,
  selectSections,
  apiJson,
  apiError,
  sectionToApi,
  addonDetailParam,
  sectionMapper,
} from "@/lib/api/v1/helpers";
import { createSectionSchema } from "@/lib/api/v1/schemas";
import {
  BATCH_CONCURRENCY,
  BATCH_SECTION_LIMIT,
  batchSectionsSchema,
  buildSectionUpdates,
  mapWithConcurrency,
} from "@/lib/api/v1/sectionWrite";
import { markdownToBlocks } from "@/lib/richDoc/markdownToBlocks";
import { getRemoteConfig } from "@/lib/remoteConfig";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/projects/:id/sections — list sections of a project.
 *
 * `?addons=types` replaces each section's addon data with its addon type names,
 * and `?addons=none` drops it altogether — on a 185-section project that is the
 * difference between 1.17 MB and ~150 KB. Defaults to `full`.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId);
  if ("response" in pResult) return pResult.response;

  const detail = addonDetailParam(request);
  const { data: sections, error } = await selectSections(
    auth.supabase,
    { projectId: id },
    { withAddons: detail !== "none" },
  );

  if (error) return apiError("Failed to fetch sections", 500, "db_error");

  return apiJson((sections ?? []).map(sectionMapper(detail)));
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
  const { FREE_MAX_SECTIONS_PER_PROJECT, FREE_MAX_SECTIONS_TOTAL } = await getRemoteConfig();
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
  // contentBlocks from caller takes priority; fall back to auto-generating from markdown.
  const resolvedBlocks = parsed.data.contentBlocks && parsed.data.contentBlocks.length > 0
    ? parsed.data.contentBlocks
    : (parsed.data.content ? markdownToBlocks(parsed.data.content) : null);
  const { data: section, error } = await auth.supabase
    .from("sections")
    .insert({
      project_id: id,
      parent_id: parsed.data.parentId,
      title: parsed.data.title,
      content: parsed.data.content,
      content_blocks: resolvedBlocks && resolvedBlocks.length > 0 ? resolvedBlocks : null,
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

/**
 * PATCH /api/v1/projects/:id/sections — update many sections in one request.
 *
 * Writing 96 pages one at a time is 96 internet round-trips, 96 auth and
 * permission checks, and 96 redundant touches of the project's updated_at.
 * This collapses all of that to one: the per-section updates still run
 * individually against Postgres, but from inside the function, where they are
 * cheap.
 *
 * Every item reports its own outcome, so one bad section id does not discard
 * the rest of the batch. The response is receipt-shaped by design.
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId, { write: true });
  if ("response" in pResult) return pResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "invalid_json");
  }

  const parsed = batchSectionsSchema.safeParse(body);
  if (!parsed.success) {
    const tooMany = Array.isArray((body as { sections?: unknown[] })?.sections)
      && ((body as { sections: unknown[] }).sections.length > BATCH_SECTION_LIMIT);
    return apiError(
      tooMany
        ? `Too many sections in one batch (max ${BATCH_SECTION_LIMIT}) — split the request`
        : parsed.error.issues[0].message,
      400,
      tooMany ? "batch_too_large" : "validation_error",
      { issues: parsed.error.issues },
    );
  }

  const items = parsed.data.sections;

  // One lookup answers "do these exist" and "what are their titles", so no
  // per-section re-read is needed to build the receipts.
  const { data: existingRows, error: lookupError } = await auth.supabase
    .from("sections")
    .select("id, title")
    .eq("project_id", id)
    .in("id", items.map((i) => i.sectionId));

  if (lookupError) return apiError("Failed to load sections", 500, "db_error");
  const titles = new Map((existingRows ?? []).map((r) => [r.id as string, r.title as string]));

  // Any parent being assigned must itself live in this project.
  const parentIds = [...new Set(
    items.map((i) => i.parentId).filter((p): p is string => typeof p === "string"),
  )];
  let validParents = new Set<string>();
  if (parentIds.length > 0) {
    const { data: parents } = await auth.supabase
      .from("sections")
      .select("id")
      .eq("project_id", id)
      .in("id", parentIds);
    validParents = new Set((parents ?? []).map((r) => r.id as string));
  }

  const now = new Date().toISOString();

  const results = await mapWithConcurrency(items, BATCH_CONCURRENCY, async (item) => {
    const { sectionId, ...fields } = item;

    if (!titles.has(sectionId)) {
      return { sectionId, ok: false as const, error: "Section not found in this project", code: "not_found" };
    }
    if (Object.keys(fields).length === 0) {
      return { sectionId, ok: false as const, error: "No fields to update", code: "empty_update" };
    }
    if (fields.parentId === sectionId) {
      return { sectionId, ok: false as const, error: "Section cannot be its own parent", code: "invalid_parent" };
    }
    if (typeof fields.parentId === "string" && !validParents.has(fields.parentId)) {
      return { sectionId, ok: false as const, error: "Parent section not found in this project", code: "invalid_parent" };
    }

    const { updates, touched } = buildSectionUpdates(fields, { userId: auth.userId, now });
    const { error } = await auth.supabase
      .from("sections")
      .update(updates)
      .eq("id", sectionId)
      .eq("project_id", id);

    if (error) return { sectionId, ok: false as const, error: "Failed to update section", code: "db_error" };

    return {
      sectionId,
      ok: true as const,
      title: fields.title ?? titles.get(sectionId),
      updated: touched,
      updatedAt: now,
    };
  });

  const updated = results.filter((r) => r.ok).length;

  // One touch for the whole batch instead of one per section.
  if (updated > 0) {
    await auth.supabase.from("projects").update({ updated_at: now }).eq("id", id);
  }

  return apiJson({ updated, failed: results.length - updated, results });
}
