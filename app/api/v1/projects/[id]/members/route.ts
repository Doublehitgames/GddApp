import { NextRequest } from "next/server";
import { apiError, apiJson, requireAuth, requireProject } from "@/lib/api/v1/helpers";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

type ProfileRow = { id: string; email: string | null; display_name: string | null };

/**
 * GET /api/v1/projects/:id/members — who works on this project.
 *
 * A shared GDD is a document with several hands in it, and a caller that can
 * only see ids cannot say whose work it is looking at or who to ask. The owner
 * is the first entry, with `access: "owner"`; invited members follow in the
 * order they were added.
 *
 * The listing itself runs on the admin client on purpose: under RLS a member
 * may read only their OWN `project_members` row, so a session-authenticated
 * teammate would otherwise see a team of one. Access to the project is
 * verified first, and nothing beyond name and role is exposed.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId);
  if ("response" in pResult) return pResult.response;

  const ownerId = pResult.project.owner_id;
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("project_members")
    .select("user_id, role, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  if (error) return apiError("Failed to fetch members", 500, "db_error");

  // A project may carry a membership row for its own owner; ownership wins, so
  // the owner is listed once, from the project itself.
  const invited = (rows ?? []).filter((r) => r.user_id !== ownerId);
  const userIds = [ownerId, ...invited.map((r) => r.user_id as string)];

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, display_name")
    .in("id", userIds);

  const byId = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  );

  const entry = (userId: string, access: string, addedAt: string | null) => ({
    userId,
    email: byId.get(userId)?.email ?? null,
    displayName: byId.get(userId)?.display_name ?? null,
    access,
    isYou: userId === auth.userId,
    ...(addedAt ? { addedAt } : {}),
  });

  return apiJson({
    projectId: id,
    ownerId,
    yourAccess: pResult.access,
    members: [
      entry(ownerId, "owner", pResult.project.created_at),
      ...invited.map((r) =>
        entry(
          r.user_id as string,
          r.role === "editor" ? "editor" : "viewer",
          (r.created_at as string) ?? null,
        ),
      ),
    ],
  });
}
