/**
 * Camada de acesso ao section_activity_log no Supabase.
 * Best-effort: erros e timeouts geram apenas console.warn, nunca lançam.
 */

import { createClient } from "@/lib/supabase/client";

const TIMEOUT_MS = 8_000;

export type ActivityLogAction = "created" | "deleted" | "renamed";

export type ActivityLogEvent = {
  id: string;
  project_id: string;
  section_id: string;
  section_title: string;
  action: ActivityLogAction;
  old_title?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  created_at: string;
};

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Busca até 200 eventos mais recentes do projeto (já ordenados por created_at DESC). */
export async function fetchActivityLog(
  projectId: string
): Promise<ActivityLogEvent[] | null> {
  const supabase = createClient();

  const result = await withTimeout(
    Promise.resolve(
      supabase
        .from("section_activity_log")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(200)
    ),
    TIMEOUT_MS
  );

  if (!result) {
    console.warn("[activityLogSync] fetchActivityLog timed out", { projectId });
    return null;
  }

  const { data, error } = result;

  if (error) {
    console.warn("[activityLogSync] fetchActivityLog error", error);
    return null;
  }

  return (data ?? []) as ActivityLogEvent[];
}

/** Insere um evento de atividade. O trigger no banco cuida do prune automático. */
export async function insertActivityEvent(
  event: Omit<ActivityLogEvent, "id" | "created_at">
): Promise<void> {
  const supabase = createClient();

  const result = await withTimeout(
    Promise.resolve(supabase.from("section_activity_log").insert(event)),
    TIMEOUT_MS
  );

  if (!result) {
    console.warn("[activityLogSync] insertActivityEvent timed out", event);
    return;
  }

  if (result.error) {
    console.warn("[activityLogSync] insertActivityEvent error", result.error);
  }
}
