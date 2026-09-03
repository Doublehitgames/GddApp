/**
 * Server-side writer for `section_versions` on /api/v1 writes.
 *
 * The app's own sync route has always snapshotted a version on every save, but
 * /api/v1 — the door the MCP agent writes through — did not. The page history
 * and the project changelog were therefore blind to exactly the edits an agent
 * made: the activity log said "modified", and there was no text to compare.
 *
 * Best-effort like the activity log: a failure here never fails the write.
 */

import type { AuthOk } from "./helpers";
import { activityOrigin, resolveActorName } from "./activityLog";

type VersionRow = {
  section_id: string;
  project_id: string;
  title: string;
  content: string;
  sort_order: number;
  color: string | null;
  created_at: string;
  updated_by: string | null;
  updated_by_name: string | null;
};

/**
 * Snapshot the CURRENT state of the given pages — call it after the update has
 * landed, the way the sync route does, so a version row is always "what the
 * page became".
 *
 * Pages rewritten as collateral by a rename sweep are deliberately left out: a
 * rename that touches 40 descriptions would otherwise bury the real change
 * under 40 snapshots.
 */
export async function snapshotSectionVersions(
  auth: AuthOk,
  projectId: string,
  sectionIds: string[],
  now: string
): Promise<void> {
  if (sectionIds.length === 0) return;

  try {
    const { data: rows, error } = await auth.supabase
      .from("sections")
      .select("id, title, content, sort_order, color")
      .eq("project_id", projectId)
      .in("id", sectionIds);

    if (error || !rows || rows.length === 0) return;

    const updatedByName = await resolveActorName(auth.supabase, auth.userId);

    const versionRows: VersionRow[] = rows.map((row) => ({
      section_id: row.id as string,
      project_id: projectId,
      title: (row.title as string) ?? "",
      content: (row.content as string) ?? "",
      sort_order: (row.sort_order as number) ?? 0,
      color: (row.color as string | null) ?? null,
      created_at: now,
      updated_by: auth.userId,
      updated_by_name: updatedByName,
    }));

    const origin = activityOrigin(auth.source);
    const { error: insertError } = await auth.supabase
      .from("section_versions")
      .insert(versionRows.map((row) => ({ ...row, origin })));

    if (insertError) {
      // `origin` ships with a migration the deployment may not have run yet.
      // Losing the origin tag beats losing the snapshot.
      const retry = await auth.supabase.from("section_versions").insert(versionRows);
      if (retry.error) {
        console.warn("[sectionVersions] insert failed", retry.error.message);
      }
    }
  } catch (err) {
    console.warn("[sectionVersions] unexpected failure", err);
  }
}
