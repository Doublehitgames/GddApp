import { NextRequest } from "next/server";
import {
  requireAuth,
  selectProjects,
  apiJson,
  apiError,
  projectToApi,
  sectionToApi,
} from "@/lib/api/v1/helpers";
import { searchSchema } from "@/lib/api/v1/schemas";

const SECTION_COLS_FULL =
  "id, project_id, parent_id, title, content, sort_order, color, thumb_image_url, domain_tags, balance_addons, addon_group_notes, data_id, flowchart_state, created_at, updated_at, created_by, created_by_name, updated_by, updated_by_name";
const SECTION_COLS_SAFE =
  "id, project_id, parent_id, title, content, sort_order, color, created_at, updated_at";

/**
 * GET /api/v1/search?q=term&type=all|projects|sections&limit=20
 */
export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const url = new URL(request.url);
  const parsed = searchSchema.safeParse({
    q: url.searchParams.get("q"),
    type: url.searchParams.get("type") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }

  const { q, type, limit } = parsed.data;
  const pattern = `%${q}%`;

  // Collect all project IDs the user can access (owned + member)
  const { data: ownedProjects } = await auth.supabase
    .from("projects")
    .select("id")
    .eq("owner_id", auth.userId);

  const { data: memberRows } = await auth.supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", auth.userId);

  const projectIds = new Set<string>();
  for (const p of ownedProjects ?? []) projectIds.add(p.id);
  for (const m of memberRows ?? []) projectIds.add(m.project_id);

  if (projectIds.size === 0) {
    return apiJson({ projects: [], sections: [] });
  }

  const ids = Array.from(projectIds);
  const results: { projects: unknown[]; sections: unknown[] } = {
    projects: [],
    sections: [],
  };

  if (type === "all" || type === "projects") {
    const { data: projects } = await selectProjects(auth.supabase, {
      in: ["id", ids],
      or: `title.ilike.${pattern},description.ilike.${pattern}`,
      limit,
    });

    results.projects = (projects ?? []).map(projectToApi);
  }

  if (type === "all" || type === "sections") {
    // Try full columns, fallback to safe set.
    // The OR also matches text inside addons (richDoc blocks, addon names,
    // etc.) by casting the JSONB column to text — crude but indexed and
    // good enough for free-text search; the structural keys in the JSON
    // are unlikely to collide with real user queries. The fallback set
    // omits balance_addons since the column may not exist yet.
    let { data: sections, error } = await auth.supabase
      .from("sections")
      .select(SECTION_COLS_FULL)
      .in("project_id", ids)
      .or(`title.ilike.${pattern},content.ilike.${pattern},balance_addons::text.ilike.${pattern}`)
      .limit(limit);

    if (error) {
      const fb = await auth.supabase
        .from("sections")
        .select(SECTION_COLS_SAFE)
        .in("project_id", ids)
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .limit(limit);

      sections = (fb.data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        thumb_image_url: null,
        domain_tags: [],
        balance_addons: null,
        addon_group_notes: null,
        data_id: null,
        flowchart_state: null,
        created_by: null,
        created_by_name: null,
        updated_by: null,
        updated_by_name: null,
      })) as typeof sections;
    }

    results.sections = (sections ?? []).map(sectionToApi);
  }

  return apiJson(results);
}
