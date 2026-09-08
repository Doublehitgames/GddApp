import { NextRequest, NextResponse } from "next/server";
import {
  projectAccessMap,
  requireAuth,
  type ProjectAccess,
} from "@/lib/api/v1/helpers";
import { getRemoteConfig } from "@/lib/remoteConfig";

/**
 * GET /api/v1/me — who this request is acting as.
 *
 * Accepts an API key (Authorization: Bearer gdd_sk_...), an MCP OAuth token
 * and session cookies alike, which makes it the answer to the first question a
 * connected agent has: which account am I, and what am I allowed to do?
 *
 * So it carries more than the profile:
 *
 *   • `projects` — how many the account owns and how many were shared with it,
 *     broken down by role. An agent that knows it has viewer access somewhere
 *     does not plan a rewrite it cannot save.
 *   • `limits` — the effective structural limits, already resolved through this
 *     user's own overrides. Without them a caller only meets the ceiling as a
 *     403 `structural_limit_exceeded` halfway through creating pages. They are
 *     this account's own: pages created in a project shared with it are
 *     measured against that project OWNER's limits instead.
 *
 * The payload is returned inside the `{ data }` envelope every other /api/v1
 * route uses, and ALSO spread at the top level: this endpoint predates the
 * envelope and is the documented "test your key" curl, so the flat shape stays
 * for whoever already scripted against it.
 */
export async function GET(request: NextRequest) {
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .eq("id", auth.userId)
    .maybeSingle();

  // A missing profile row is not a missing identity: the token resolved to a
  // user, so answer with what we know rather than a 404 the caller cannot act on.
  const access = await projectAccessMap(auth.supabase, auth.userId);
  const count = (of: ProjectAccess) =>
    [...access.values()].filter((a) => a === of).length;

  const limits = await getRemoteConfig(auth.userId);

  const me = {
    id: auth.userId,
    email: (profile?.email as string | null) ?? null,
    displayName: (profile?.display_name as string | null) ?? null,
    avatarUrl: (profile?.avatar_url as string | null) ?? null,
    authSource: auth.source,
    projects: {
      owned: count("owner"),
      // Shared with this account by someone else, split by what it may do there.
      editor: count("editor"),
      viewer: count("viewer"),
      total: access.size,
    },
    limits: {
      maxProjects: limits.FREE_MAX_PROJECTS,
      maxSectionsPerProject: limits.FREE_MAX_SECTIONS_PER_PROJECT,
    },
  };

  return NextResponse.json({ ...me, data: me });
}
