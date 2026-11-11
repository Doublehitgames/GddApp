/**
 * Write logic for the project PATCH.
 *
 * Mirrors `sectionWrite.ts`: the rule that bites is content_blocks — markdown is
 * only auto-converted when the caller did NOT send blocks. Keeping it here (and
 * not inline in the route) is what makes the rule testable.
 */

import { markdownToBlocks } from "@/lib/richDoc/markdownToBlocks";
import { normalizeProjectDocumentSpotlight } from "@/lib/projectSpotlight";

export type ProjectUpdate = {
  title?: string;
  description?: string;
  contentBlocks?: Record<string, unknown>[];
  coverImageUrl?: string | null;
  mindmapSettings?: Record<string, unknown>;
  aiInstructions?: string | null;
  vision?: Record<string, unknown> | null;
  sheet?: Record<string, unknown> | null;
};

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * A Ficha técnica mora em `mindmap_settings.documentView.spotlight`, ao lado
 * do layout do mapa, do tema do documento e do link público. Só a ficha é
 * reescrita; o resto do objeto volta como estava. `null` tira a ficha.
 */
function withSheet(settings: unknown, sheet: Record<string, unknown> | null): Record<string, unknown> {
  const base = asObject(settings);
  const documentView = { ...asObject(base.documentView) };
  if (sheet === null) {
    delete documentView.spotlight;
  } else {
    const merged: Record<string, unknown> = { ...asObject(documentView.spotlight), ...sheet };
    if (merged.titleIconUrl === null) delete merged.titleIconUrl;
    const spotlight = normalizeProjectDocumentSpotlight(merged);
    if (spotlight) documentView.spotlight = spotlight;
    else delete documentView.spotlight;
  }
  return { ...base, documentView };
}

/**
 * Map the API's camelCase fields onto `projects` column names.
 *
 * `vision` is a patch, like the store's `updateProjectVision`: its keys merge
 * into `ctx.currentVision`, so sending only `pillars` keeps the logline. `null`
 * clears it.
 */
export function buildProjectUpdates(
  fields: ProjectUpdate,
  ctx: {
    now: string;
    currentVision?: Record<string, unknown> | null;
    currentMindmapSettings?: Record<string, unknown> | null;
    /** Só o dono mexe no link público. Ausente conta como não-dono. */
    isOwner?: boolean;
  },
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
  if (fields.vision !== undefined) {
    updates.vision = fields.vision === null ? null : { ...(ctx.currentVision || {}), ...fields.vision };
  }
  if (fields.sheet !== undefined) {
    // Sobre o mindmapSettings deste mesmo PATCH, se veio; senão, sobre o atual.
    const settings = fields.mindmapSettings !== undefined ? fields.mindmapSettings : ctx.currentMindmapSettings;
    updates.mindmap_settings = withSheet(settings, fields.sheet);
  }
  // `sharing` (o link público) é do dono, como em /api/projects/[id]/settings e
  // no sync. Sem isto, um editor que mandasse mindmapSettings pela API ligava,
  // trocava ou revogava o link de um projeto que não é dele.
  if (updates.mindmap_settings !== undefined && !ctx.isOwner) {
    const currentSharing = asObject(ctx.currentMindmapSettings).sharing;
    updates.mindmap_settings = { ...asObject(updates.mindmap_settings), sharing: currentSharing ?? {} };
  }

  return updates;
}
