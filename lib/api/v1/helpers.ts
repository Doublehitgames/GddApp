/**
 * Shared helpers for /api/v1/* routes.
 *
 * - `requireAuth`: resolves auth or returns 401/403 response
 * - `requireProject`: loads project + ownership/membership check
 * - `requireSection`: loads section + validates it belongs to project
 * - `apiJson` / `apiError`: consistent response helpers
 * - `checkV1RateLimit`: in-memory per-user rate limiter
 */

import { NextRequest, NextResponse } from "next/server";
import { getApiUser, AuthResult } from "@/lib/auth/getApiUser";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Response helpers ──────────────────────────────────────────────────

export function apiJson(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiError(
  message: string,
  status: number,
  code?: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { error: message, code: code ?? message, ...extra },
    { status }
  );
}

// ── Auth wrapper ──────────────────────────────────────────────────────

export type AuthOk = Extract<AuthResult, { authenticated: true }>;

export async function requireAuth(
  request: NextRequest
): Promise<{ auth: AuthOk } | { response: NextResponse }> {
  const rl = checkV1RateLimit(request);
  if (rl) return { response: rl };

  const auth = await getApiUser(request);
  if (!auth.authenticated) {
    return { response: apiError(auth.error, auth.status) };
  }
  return { auth };
}

// ── Project access ────────────────────────────────────────────────────

export type ProjectRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  mindmap_settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

/**
 * Load a project and verify the caller has access.
 * `write` = true requires owner or editor membership.
 * `ownerOnly` = true requires the caller to be the project owner.
 */
export async function requireProject(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  opts: { write?: boolean; ownerOnly?: boolean } = {}
): Promise<
  | { project: ProjectRow; isOwner: boolean }
  | { response: NextResponse }
> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id, title, description, cover_image_url, mindmap_settings, created_at, updated_at")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project) {
    return { response: apiError("Project not found", 404, "not_found") };
  }

  const isOwner = project.owner_id === userId;

  if (opts.ownerOnly && !isOwner) {
    return { response: apiError("Only the project owner can do this", 403, "forbidden") };
  }

  if (!isOwner) {
    const { data: member } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) {
      return { response: apiError("Project not found", 404, "not_found") };
    }

    if (opts.write && member.role !== "editor") {
      return { response: apiError("Editor role required", 403, "forbidden") };
    }
  }

  return { project: project as ProjectRow, isOwner };
}

// ── Section access ────────────────────────────────────────────────────

export type SectionRow = {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  content: string;
  sort_order: number;
  color: string | null;
  thumb_image_url: string | null;
  domain_tags: string[];
  balance_addons: unknown[] | null;
  addon_group_notes: Record<string, string> | null;
  data_id: string | null;
  flowchart_state: unknown | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
};

// Full column set — optional columns that may not exist in older DBs are at the end.
const SECTION_COLUMNS_FULL =
  "id, project_id, parent_id, title, content, sort_order, color, thumb_image_url, domain_tags, balance_addons, addon_group_notes, data_id, flowchart_state, created_at, updated_at, created_by, created_by_name, updated_by, updated_by_name";

// Progressive fallback: drop the newest/most optional columns first.
// Level 1: drop flowchart_state, data_id, addon_group_notes, audit columns
const SECTION_COLUMNS_MID =
  "id, project_id, parent_id, title, content, sort_order, color, thumb_image_url, domain_tags, balance_addons, created_at, updated_at";

// Level 2: bare minimum
const SECTION_COLUMNS_SAFE =
  "id, project_id, parent_id, title, content, sort_order, color, created_at, updated_at";

export { SECTION_COLUMNS_FULL as SECTION_COLUMNS };

function buildQuery(
  supabase: SupabaseClient,
  columns: string,
  filter: { projectId?: string; sectionId?: string },
) {
  let q = supabase.from("sections").select(columns);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  if (filter.sectionId) q = q.eq("id", filter.sectionId);
  if (!filter.sectionId) q = q.order("sort_order", { ascending: true });
  return q;
}

/**
 * Select sections with automatic fallback if optional columns are missing.
 */
export async function selectSections(
  supabase: SupabaseClient,
  filter: { projectId?: string; sectionId?: string },
): Promise<{ data: SectionRow[] | null; error: unknown }> {
  const result = await buildQuery(supabase, SECTION_COLUMNS_FULL, filter);

  if (result.error) {
    // Progressive fallback: try mid-level columns (includes balance_addons)
    const midResult = await buildQuery(supabase, SECTION_COLUMNS_MID, filter);
    if (!midResult.error) {
      const rows = ((midResult.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        ...r,
        addon_group_notes: null,
        data_id: null,
        flowchart_state: null,
        created_by: null,
        created_by_name: null,
        updated_by: null,
        updated_by_name: null,
      })) as unknown as SectionRow[];
      return { data: rows, error: null };
    }

    // Final fallback: bare minimum
    const safeResult = await buildQuery(supabase, SECTION_COLUMNS_SAFE, filter);
    if (safeResult.error) return { data: null, error: safeResult.error };

    const rows = ((safeResult.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      thumb_image_url: null,
      domain_tags: [] as string[],
      balance_addons: null,
      addon_group_notes: null,
      data_id: null,
      flowchart_state: null,
      created_by: null,
      created_by_name: null,
      updated_by: null,
      updated_by_name: null,
    })) as unknown as SectionRow[];
    return { data: rows, error: null };
  }

  return { data: result.data as unknown as SectionRow[], error: null };
}

export async function requireSection(
  supabase: SupabaseClient,
  projectId: string,
  sectionId: string
): Promise<{ section: SectionRow } | { response: NextResponse }> {
  const { data, error } = await selectSections(supabase, { projectId, sectionId });

  if (error || !data || data.length === 0) {
    return { response: apiError("Section not found", 404, "not_found") };
  }
  return { section: data[0] as SectionRow };
}

// ── DB ↔ API field mapping ────────────────────────────────────────────

export function projectToApi(p: ProjectRow) {
  return {
    id: p.id,
    ownerId: p.owner_id,
    title: p.title,
    description: p.description,
    coverImageUrl: p.cover_image_url,
    mindmapSettings: p.mindmap_settings,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function sectionToApi(s: SectionRow) {
  return {
    id: s.id,
    projectId: s.project_id,
    parentId: s.parent_id,
    title: s.title,
    content: s.content,
    order: s.sort_order,
    color: s.color,
    thumbImageUrl: s.thumb_image_url,
    domainTags: s.domain_tags ?? [],
    addons: s.balance_addons ?? [],
    addonGroupNotes: s.addon_group_notes ?? {},
    dataId: s.data_id,
    flowchartState: s.flowchart_state,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    createdBy: s.created_by,
    createdByName: s.created_by_name,
    updatedBy: s.updated_by,
    updatedByName: s.updated_by_name,
  };
}

// ── Rate limiter ──────────────────────────────────────────────────────

const V1_REQUESTS_PER_MINUTE = 60;
const V1_WINDOW_MS = 60_000;

type RateLimitEntry = { count: number; windowStartMs: number };
const v1RequestCounts = new Map<string, RateLimitEntry>();

function gcEntries(now: number) {
  for (const [key, entry] of v1RequestCounts) {
    if (now - entry.windowStartMs >= V1_WINDOW_MS * 2) {
      v1RequestCounts.delete(key);
    }
  }
}

function checkV1RateLimit(request: NextRequest): NextResponse | null {
  // Extract user identifier from auth header for rate limiting pre-auth.
  // If no auth header, rate-limit by IP (best-effort).
  const authHeader = request.headers.get("authorization") ?? "";
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const key = authHeader ? authHeader.slice(0, 30) : ip;

  const now = Date.now();
  gcEntries(now);

  const entry = v1RequestCounts.get(key);
  if (!entry || now - entry.windowStartMs >= V1_WINDOW_MS) {
    v1RequestCounts.set(key, { count: 1, windowStartMs: now });
    return null;
  }

  if (entry.count >= V1_REQUESTS_PER_MINUTE) {
    return apiError("Rate limit exceeded. Try again in a minute.", 429, "rate_limit");
  }

  entry.count += 1;
  return null;
}
