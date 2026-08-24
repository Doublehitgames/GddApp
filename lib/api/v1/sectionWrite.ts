/**
 * Field mapping shared by the single-section PATCH and the batch PATCH.
 *
 * The two paths must agree on everything — especially the rule that deriving
 * content_blocks from markdown happens only when the caller did not send blocks
 * explicitly. Keeping it in one place is the point.
 */

import { z } from "zod";
import { markdownToBlocks } from "@/lib/richDoc/markdownToBlocks";
import { updateSectionSchema } from "./schemas";

export type SectionUpdate = z.infer<typeof updateSectionSchema>;

/** One item of a batch PATCH: which section, plus the fields to write. */
export const batchSectionItemSchema = updateSectionSchema.extend({
  sectionId: z.string().uuid(),
});

/**
 * A batch is capped so a single request cannot outrun the function timeout.
 * Callers are told when they exceed it rather than having the tail silently
 * dropped.
 */
export const BATCH_SECTION_LIMIT = 50;

export const batchSectionsSchema = z.object({
  sections: z.array(batchSectionItemSchema).min(1).max(BATCH_SECTION_LIMIT),
});

/** How many updates run against Postgres at once within one batch. */
export const BATCH_CONCURRENCY = 8;

/**
 * Translates validated API fields into a `sections` row patch.
 * Returns the column patch and the API field names that were actually written,
 * which is what a write receipt reports back.
 */
export function buildSectionUpdates(
  fields: SectionUpdate,
  ctx: { userId: string; now: string },
): { updates: Record<string, unknown>; touched: string[] } {
  const updates: Record<string, unknown> = {
    updated_at: ctx.now,
    updated_by: ctx.userId,
  };

  if (fields.title !== undefined) updates.title = fields.title;

  if (fields.contentBlocks !== undefined) {
    // Caller supplied explicit blocks — use them directly.
    updates.content_blocks = fields.contentBlocks.length > 0 ? fields.contentBlocks : null;
  } else if (fields.content !== undefined) {
    // No explicit blocks — auto-generate from markdown.
    const blocks = markdownToBlocks(fields.content);
    updates.content_blocks = blocks.length > 0 ? blocks : null;
  }

  if (fields.content !== undefined) updates.content = fields.content;
  if (fields.parentId !== undefined) updates.parent_id = fields.parentId;
  if (fields.order !== undefined) updates.sort_order = fields.order;
  if (fields.color !== undefined) updates.color = fields.color;
  if (fields.domainTags !== undefined) updates.domain_tags = fields.domainTags;
  if (fields.dataId !== undefined) updates.data_id = fields.dataId;
  if (fields.thumbImageUrl !== undefined) updates.thumb_image_url = fields.thumbImageUrl;
  if (fields.addonGroupNotes !== undefined) updates.addon_group_notes = fields.addonGroupNotes;
  if (fields.linkedSpreadsheetId !== undefined) updates.linked_spreadsheet_id = fields.linkedSpreadsheetId;

  const touched = Object.keys(fields).filter((k) => k !== "sectionId" && fields[k as keyof SectionUpdate] !== undefined);

  return { updates, touched };
}

/** Runs `task` over `items` with at most `limit` in flight, preserving order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
