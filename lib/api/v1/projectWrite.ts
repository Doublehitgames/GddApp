/**
 * Write logic for the project PATCH.
 *
 * Mirrors `sectionWrite.ts`: the rule that bites is content_blocks — markdown is
 * only auto-converted when the caller did NOT send blocks. Keeping it here (and
 * not inline in the route) is what makes the rule testable.
 */

import { markdownToBlocks } from "@/lib/richDoc/markdownToBlocks";

export type ProjectUpdate = {
  title?: string;
  description?: string;
  contentBlocks?: Record<string, unknown>[];
  coverImageUrl?: string | null;
  mindmapSettings?: Record<string, unknown>;
  aiInstructions?: string | null;
};

/** Map the API's camelCase fields onto `projects` column names. */
export function buildProjectUpdates(
  fields: ProjectUpdate,
  ctx: { now: string },
): Record<string, unknown> {
  const updates: Record<string, unknown> = { updated_at: ctx.now };

  if (fields.title !== undefined) updates.title = fields.title;

  if (fields.contentBlocks !== undefined) {
    // Caller supplied explicit blocks — use them directly.
    updates.content_blocks = fields.contentBlocks.length > 0 ? fields.contentBlocks : null;
  } else if (fields.description !== undefined) {
    // No explicit blocks — derive from the markdown so the two cannot disagree.
    const blocks = markdownToBlocks(fields.description);
    updates.content_blocks = blocks.length > 0 ? blocks : null;
  }

  if (fields.description !== undefined) updates.description = fields.description;
  if (fields.coverImageUrl !== undefined) updates.cover_image_url = fields.coverImageUrl;
  if (fields.mindmapSettings !== undefined) updates.mindmap_settings = fields.mindmapSettings;
  if (fields.aiInstructions !== undefined) updates.ai_instructions = fields.aiInstructions;

  return updates;
}
