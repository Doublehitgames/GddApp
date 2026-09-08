import { NextRequest } from "next/server";
import { apiError, apiJson, requireAuth, requireProject } from "@/lib/api/v1/helpers";

type Ctx = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const COLS_FULL = "section_id, section_title, action, old_title, detail, user_id, user_name, origin, created_at";
// `origin` ships with add_section_activity_log_origin.sql; an older DB has the
// rest of the row and should still answer.
const COLS_SAFE = "section_id, section_title, action, old_title, detail, user_id, user_name, created_at";

/**
 * GET /api/v1/projects/:id/activity — what changed in this project, newest first.
 *
 * The point of reading it is not history for its own sake: on a document with
 * several hands in it, this is how a caller finds out that a page it was about
 * to rewrite was rewritten by someone else an hour ago. Each event says who did
 * it (`by`) and from where (`origin`: 'app' for the browser, 'mcp' for the API).
 *
 * Query: `limit` (default 20, max 100) and `since` (ISO timestamp).
 *
 * The log itself is capped by the database — 90 days and 200 events per
 * project — so this is a recent window, not a full ledger. A batch write lands
 * as ONE event carrying `detail: "batch:<n>"`.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId);
  if ("response" in pResult) return pResult.response;

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(requested) && requested > 0
    ? Math.min(requested, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const since = url.searchParams.get("since");
  if (since && Number.isNaN(Date.parse(since))) {
    return apiError("`since` must be an ISO timestamp", 400, "validation_error");
  }

  function query(columns: string) {
    let q = auth.supabase
      .from("section_activity_log")
      .select(columns)
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (since) q = q.gte("created_at", new Date(since).toISOString());
    return q;
  }

  const full = await query(COLS_FULL);
  let rows = full.data;
  if (full.error) {
    const fallback = await query(COLS_SAFE);
    if (fallback.error) return apiError("Failed to fetch activity", 500, "db_error");
    rows = fallback.data;
  }

  type LogRow = {
    section_id: string;
    section_title: string;
    action: string;
    old_title: string | null;
    detail: string | null;
    user_id: string | null;
    user_name: string | null;
    origin?: string | null;
    created_at: string;
  };

  const events = ((rows ?? []) as unknown as LogRow[]).map((r) => ({
    sectionId: r.section_id,
    sectionTitle: r.section_title,
    action: r.action,
    ...(r.old_title ? { oldTitle: r.old_title } : {}),
    ...(r.detail ? { detail: r.detail } : {}),
    by: r.user_name ?? null,
    byUserId: r.user_id ?? null,
    // Null on rows written before the column existed — those are all from the app.
    origin: r.origin ?? "app",
    at: r.created_at,
  }));

  return apiJson({ projectId: id, count: events.length, events });
}
