/**
 * Keeping `$[Page Title]` cross-references alive across a rename.
 *
 * A name-based ref resolves to whatever page currently carries that title, so
 * renaming a page would orphan every ref written with the old name. Both write
 * surfaces sweep the project after a rename: the app does it in the store, and
 * every rename that comes through /api/v1 (which is what the MCP server talks
 * to) does it here. Refs already stored as `$[#id]` need nothing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildRenameRefPatches } from "@/utils/sectionReferences";
import { mapWithConcurrency, BATCH_CONCURRENCY } from "./sectionWrite";

/** Pseudo-section id so the project's own description is swept too. */
const PROJECT_DESCRIPTION_KEY = "__project_description__";

type SweepArgs = {
  projectId: string;
  /** The page that was renamed — its own refs are swept, its title is not. */
  sectionId: string;
  oldTitle: string;
  newTitle: string;
  userId: string;
  now: string;
};

/**
 * Rewrite `$[oldTitle]` to `$[newTitle]` in every description of the project.
 * Returns how many pages were touched (the project description, if it changed,
 * is not counted as a page). Never throws: a rename that already succeeded must
 * not be reported as failed because the sweep could not run.
 */
export async function sweepRenamedRefs(
  supabase: SupabaseClient,
  args: SweepArgs,
): Promise<number> {
  const { projectId, sectionId, oldTitle, newTitle, userId, now } = args;
  if (!oldTitle || oldTitle.trim().toLowerCase() === newTitle.trim().toLowerCase()) return 0;

  try {
    let hasBlocksColumn = true;
    let rows: Array<Record<string, unknown>> | null = null;

    const full = await supabase
      .from("sections")
      .select("id, title, content, content_blocks")
      .eq("project_id", projectId);

    if (full.error) {
      // Older DBs may not have content_blocks — markdown alone is still worth sweeping.
      hasBlocksColumn = false;
      const lean = await supabase
        .from("sections")
        .select("id, title, content")
        .eq("project_id", projectId);
      if (lean.error) return 0;
      rows = lean.data as Array<Record<string, unknown>>;
    } else {
      rows = full.data as Array<Record<string, unknown>>;
    }

    const { data: projectRow } = await supabase
      .from("projects")
      .select("description")
      .eq("id", projectId)
      .maybeSingle();

    const patches = buildRenameRefPatches(
      [
        { id: PROJECT_DESCRIPTION_KEY, title: "", content: (projectRow?.description as string) ?? "" },
        ...(rows ?? []).map((r) => ({
          id: r.id as string,
          title: r.title as string,
          content: (r.content as string) ?? "",
          contentBlocks: hasBlocksColumn ? r.content_blocks : undefined,
        })),
      ],
      sectionId,
      oldTitle,
      newTitle,
    );

    const descriptionPatch = patches.find((p) => p.id === PROJECT_DESCRIPTION_KEY);
    const sectionPatches = patches.filter((p) => p.id !== PROJECT_DESCRIPTION_KEY);

    if (descriptionPatch?.content !== undefined) {
      await supabase
        .from("projects")
        .update({ description: descriptionPatch.content, updated_at: now })
        .eq("id", projectId);
    }

    if (sectionPatches.length === 0) return 0;

    const outcomes = await mapWithConcurrency(sectionPatches, BATCH_CONCURRENCY, async (patch) => {
      const updates: Record<string, unknown> = { updated_at: now, updated_by: userId };
      if (patch.content !== undefined) updates.content = patch.content;
      if (patch.contentBlocks !== undefined) updates.content_blocks = patch.contentBlocks;

      const { error } = await supabase
        .from("sections")
        .update(updates)
        .eq("id", patch.id)
        .eq("project_id", projectId);
      return error ? 0 : 1;
    });

    return outcomes.reduce<number>((sum, n) => sum + n, 0);
  } catch {
    return 0;
  }
}
