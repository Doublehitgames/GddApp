import { NextRequest } from "next/server";
import {
  requireAuth,
  selectProjects,
  apiJson,
  apiError,
  projectAccessMap,
  projectToApi,
  sectionToApi,
} from "@/lib/api/v1/helpers";
import { searchSchema } from "@/lib/api/v1/schemas";

const SECTION_COLS_FULL =
  "id, project_id, parent_id, title, content, sort_order, color, thumb_image_url, domain_tags, data_id, status, status_at, content_updated_at, flowchart_state, created_at, updated_at, created_by, created_by_name, updated_by, updated_by_name, deck_layout";
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

  // Every project the caller can reach, owned or shared, with their role in it.
  const access = await projectAccessMap(auth.supabase, auth.userId);

  if (access.size === 0) {
    return apiJson({ projects: [], sections: [] });
  }

  const ids = [...access.keys()];
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

    results.projects = (projects ?? []).map((p) => projectToApi(p, access.get(p.id)));
  }

  if (type === "all" || type === "sections") {
    // Try full columns, fallback to safe set (colunas novas podem não existir
    // num banco antigo).
    let { data: sections, error } = await auth.supabase
      .from("sections")
      .select(SECTION_COLS_FULL)
      .in("project_id", ids)
      .or(`title.ilike.${pattern},content.ilike.${pattern}`)
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
        data_id: null,
        status: null,
        status_at: null,
        deck_layout: null,
        content_updated_at: null,
        flowchart_state: null,
        created_by: null,
        created_by_name: null,
        updated_by: null,
        updated_by_name: null,
      })) as typeof sections;
    }

    results.sections = (sections ?? []).map((s) => sectionToApi(s));
  }

  return apiJson(results);
}
