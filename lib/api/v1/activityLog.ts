/**
 * Server-side writer for `section_activity_log`.
 *
 * The log used to be a client-only affair: the store queued events in
 * localStorage and the sync engine flushed them. Anything writing through
 * /api/v1 — which is how the MCP server writes — left no trace, so the
 * "Atividade recente" widget went quiet exactly when an agent was doing the
 * work. This closes that hole.
 *
 * Two rules keep an agent from drowning the log, which a database trigger caps
 * at 200 events per project:
 *
 *   1. A batch request produces ONE event, never one per page. Renaming 50
 *      pages in a single call must not evict the human history.
 *   2. Repeated content edits to the same page collapse into one 'modified'
 *      event per EDIT_WINDOW_MS, so a loop of update_section calls reads as
 *      one editing session instead of forty lines.
 *
 * Best-effort throughout: a failure in here never fails the caller's write.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthOk } from "./helpers";

export type ActivityAction = "created" | "deleted" | "renamed" | "modified";

/** How long repeated edits to the same page stay folded into one event. */
const EDIT_WINDOW_MS = 30 * 60_000;

/** Display names are stable; re-reading `profiles` on every write is waste. */
const NAME_TTL_MS = 5 * 60_000;
const nameCache = new Map<string, { name: string | null; at: number }>();

/**
 * Machine-readable `detail` tokens. The column is free-form text and the app is
 * translated, so the event stores a token and the widget renders the sentence —
 * writing "12 outras páginas" in here would hardcode Portuguese into the data.
 *
 * (Legacy rows hold addon keys like 'dataSchema'; the widget still shows those
 * verbatim.)
 */
export const DETAIL_DESCRIPTION = "description";
export const detailBatch = (count: number) => `batch:${count}`;

/** Which side of the app wrote this event. */
export function activityOrigin(source: AuthOk["source"]): "app" | "mcp" {
  return source === "session" ? "app" : "mcp";
}

/** Exported so the version snapshot writer reuses the same cached lookup. */
export async function resolveActorName(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const cached = nameCache.get(userId);
  if (cached && Date.now() - cached.at < NAME_TTL_MS) return cached.name;

  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  const name = (data?.display_name as string | undefined) ?? null;
  nameCache.set(userId, { name, at: Date.now() });
  return name;
}

/**
 * True when this page's history already covers the edit about to be logged:
 * either a recent 'modified' event (same editing session) or a recent 'created'
 * one — writing the first description is part of creating the page, and an agent
 * that creates then immediately fills a page should read as one event, not two.
 */
async function alreadyLoggedRecently(
  supabase: SupabaseClient,
  projectId: string,
  sectionId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("section_activity_log")
    .select("action, created_at")
    .eq("project_id", projectId)
    .eq("section_id", sectionId)
    .order("created_at", { ascending: false })
    .limit(1);

  const last = data?.[0];
  if (!last || (last.action !== "modified" && last.action !== "created")) return false;
  return Date.now() - new Date(last.created_at as string).getTime() < EDIT_WINDOW_MS;
}

export type LogInput = {
  projectId: string;
  sectionId: string;
  sectionTitle: string;
  action: ActivityAction;
  /** Only meaningful for 'renamed'. */
  oldTitle?: string | null;
  detail?: string | null;
  /**
   * Fold this event into a recent 'modified' event for the same page.
   * On by default for single-page edits; off for batches, which are already
   * one event per request and represent a deliberate operation.
   */
  coalesce?: boolean;
};

/**
 * Record one activity event for an /api/v1 write. Never throws, never blocks
 * the response on an error — the log is a convenience, not a ledger.
 */
export async function logApiSectionActivity(
  auth: AuthOk,
  input: LogInput
): Promise<void> {
  try {
    const coalesce = input.coalesce ?? input.action === "modified";
    if (
      coalesce &&
      input.action === "modified" &&
      (await alreadyLoggedRecently(auth.supabase, input.projectId, input.sectionId))
    ) {
      return;
    }

    const row = {
      project_id: input.projectId,
      section_id: input.sectionId,
      section_title: input.sectionTitle,
      action: input.action,
      old_title: input.oldTitle ?? null,
      detail: input.detail ?? null,
      user_id: auth.userId,
      user_name: await resolveActorName(auth.supabase, auth.userId),
    };

    const { error } = await auth.supabase
      .from("section_activity_log")
      .insert({ ...row, origin: activityOrigin(auth.source) });

    if (error) {
      // `origin` ships with a migration the deployment may not have run yet.
      // Losing the origin tag beats losing the event.
      const retry = await auth.supabase.from("section_activity_log").insert(row);
      if (retry.error) {
        console.warn("[activityLog] insert failed", retry.error.message);
      }
    }
  } catch (err) {
    console.warn("[activityLog] unexpected failure", err);
  }
}

/**
 * A batch write leaves exactly one line in the activity log.
 *
 * The log is capped at 200 events per project, so one event per page would let a
 * single 50-page batch evict a quarter of the project's history — the widget
 * would go blank on the days most happened. Instead the event names the first
 * page the batch touched and carries the total in `detail`.
 *
 * A rename outranks a rewrite: if the batch did both, the rename is the event,
 * since that is the change a reader is more likely to be hunting for.
 */
export async function logBatchActivity(
  auth: AuthOk,
  projectId: string,
  items: { sectionId: string; title?: string; content?: string; contentBlocks?: unknown }[],
  titles: Map<string, string>,
  results: { sectionId: string; ok: boolean }[],
): Promise<void> {
  const succeeded = new Set(results.filter((r) => r.ok).map((r) => r.sectionId));

  const renamed = items.filter(
    (i) => succeeded.has(i.sectionId) && i.title !== undefined && i.title !== titles.get(i.sectionId),
  );
  const edited = items.filter(
    (i) => succeeded.has(i.sectionId) && (i.content !== undefined || i.contentBlocks !== undefined),
  );

  if (renamed.length > 0) {
    const first = renamed[0];
    await logApiSectionActivity(auth, {
      projectId,
      sectionId: first.sectionId,
      sectionTitle: first.title as string,
      action: "renamed",
      oldTitle: titles.get(first.sectionId) ?? null,
      detail: renamed.length > 1 ? detailBatch(renamed.length) : null,
      coalesce: false,
    });
    return;
  }

  if (edited.length > 0) {
    const first = edited[0];
    await logApiSectionActivity(auth, {
      projectId,
      sectionId: first.sectionId,
      sectionTitle: titles.get(first.sectionId) ?? "",
      action: "modified",
      detail: edited.length > 1 ? detailBatch(edited.length) : DETAIL_DESCRIPTION,
      coalesce: false,
    });
  }
}
