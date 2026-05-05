/**
 * Camada de sincronização das tasks de agenda entre o store (localStorage) e o Supabase.
 * Offline-first: localStorage permanece como fonte primária.
 * Supabase é best-effort — timeouts e erros são silenciosos (apenas warn no console).
 */

import { createClient } from "@/lib/supabase/client";
import type { AgendaTask } from "@/lib/agenda/types";

const SUPABASE_QUERY_TIMEOUT_MS = 10000;

type TimeoutResult<T> =
  | { timedOut: true; value: null; error?: unknown }
  | { timedOut: false; value: T };

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<TimeoutResult<T>> {
  try {
    const timeoutPromise = new Promise<TimeoutResult<T>>((resolve) => {
      setTimeout(() => resolve({ timedOut: true, value: null }), timeoutMs);
    });

    const wrappedPromise = Promise.resolve(promise)
      .then((value) => ({ timedOut: false as const, value }))
      .catch((err) => ({ timedOut: true as const, value: null, error: err }));

    return await Promise.race([wrappedPromise, timeoutPromise]);
  } catch (err) {
    return { timedOut: true, value: null, error: err };
  }
}

/**
 * Busca as tasks de agenda de um projeto no Supabase.
 * Retorna null em timeout/erro, AgendaTask[] em sucesso.
 */
export async function fetchAgendaTasks(userId: string, projectId: string): Promise<AgendaTask[] | null> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase
        .from("agenda_data")
        .select("tasks")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .single(),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (result.timedOut) {
      console.warn("[agendaSync] fetchAgendaTasks timed out", { userId, projectId });
      return null;
    }

    const { data, error } = result.value;

    // PGRST116 = no rows found; não é erro real
    if (error && (error as { code?: string }).code !== "PGRST116") {
      console.warn("[agendaSync] fetchAgendaTasks error", error);
      return null;
    }

    if (!data) return null;

    const tasks = data.tasks as AgendaTask[];
    if (!Array.isArray(tasks)) return null;

    return tasks;
  } catch (e) {
    console.warn("[agendaSync] fetchAgendaTasks unexpected error", e);
    return null;
  }
}

/**
 * Faz upsert das tasks de agenda de um projeto no Supabase.
 * Retorna true em sucesso, false em erro/timeout.
 */
export async function upsertAgendaTasks(userId: string, projectId: string, tasks: AgendaTask[]): Promise<boolean> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("agenda_data").upsert(
        {
          user_id: userId,
          project_id: projectId,
          tasks,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,project_id" }
      ),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (result.timedOut) {
      console.warn("[agendaSync] upsertAgendaTasks timed out", { userId, projectId });
      return false;
    }

    const { error } = result.value;
    if (error) {
      console.warn("[agendaSync] upsertAgendaTasks error", error);
      return false;
    }

    return true;
  } catch (e) {
    console.warn("[agendaSync] upsertAgendaTasks unexpected error", e);
    return false;
  }
}
