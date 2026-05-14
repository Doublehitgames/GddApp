/**
 * Camada de sincronização de dados KPI entre o store (localStorage) e o Supabase.
 * Offline-first: localStorage permanece como fonte primária.
 * Supabase é best-effort — timeouts e erros são silenciosos (apenas warn no console).
 */

import { createClient } from "@/lib/supabase/client";
import type { KpiEntry, KpiProjectConfig } from "@/lib/kpi/types";

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

// ─── KPI Entries ─────────────────────────────────────────────────────────────

export async function fetchKpiEntries(userId: string, projectId: string): Promise<KpiEntry[] | null> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase
        .from("kpi_entries")
        .select("entries")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .single(),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (result.timedOut) {
      console.warn("[kpiSync] fetchKpiEntries timed out", { userId, projectId });
      return null;
    }

    const { data, error } = result.value;

    // PGRST116 = no rows found; não é erro real
    if (error && (error as { code?: string }).code !== "PGRST116") {
      console.warn("[kpiSync] fetchKpiEntries error", error);
      return null;
    }

    if (!data) return null;

    const entries = data.entries as KpiEntry[];
    if (!Array.isArray(entries)) return null;

    return entries;
  } catch (e) {
    console.warn("[kpiSync] fetchKpiEntries unexpected error", e);
    return null;
  }
}

export async function upsertKpiEntries(userId: string, projectId: string, entries: KpiEntry[]): Promise<boolean> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("kpi_entries").upsert(
        {
          user_id: userId,
          project_id: projectId,
          entries,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,project_id" }
      ),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (result.timedOut) {
      console.warn("[kpiSync] upsertKpiEntries timed out", { userId, projectId });
      return false;
    }

    const { error } = result.value;
    if (error) {
      console.warn("[kpiSync] upsertKpiEntries error", error);
      return false;
    }

    return true;
  } catch (e) {
    console.warn("[kpiSync] upsertKpiEntries unexpected error", e);
    return false;
  }
}

// ─── KPI Config ──────────────────────────────────────────────────────────────

export async function fetchKpiConfig(userId: string, projectId: string): Promise<KpiProjectConfig | null> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase
        .from("kpi_configs")
        .select("config")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .single(),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (result.timedOut) {
      console.warn("[kpiSync] fetchKpiConfig timed out", { userId, projectId });
      return null;
    }

    const { data, error } = result.value;

    if (error && (error as { code?: string }).code !== "PGRST116") {
      console.warn("[kpiSync] fetchKpiConfig error", error);
      return null;
    }

    if (!data) return null;

    const config = data.config as KpiProjectConfig;
    if (!config || typeof config !== "object") return null;

    return config;
  } catch (e) {
    console.warn("[kpiSync] fetchKpiConfig unexpected error", e);
    return null;
  }
}

export async function upsertKpiConfig(userId: string, projectId: string, config: KpiProjectConfig): Promise<boolean> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("kpi_configs").upsert(
        {
          user_id: userId,
          project_id: projectId,
          config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,project_id" }
      ),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (result.timedOut) {
      console.warn("[kpiSync] upsertKpiConfig timed out", { userId, projectId });
      return false;
    }

    const { error } = result.value;
    if (error) {
      console.warn("[kpiSync] upsertKpiConfig error", error);
      return false;
    }

    return true;
  } catch (e) {
    console.warn("[kpiSync] upsertKpiConfig unexpected error", e);
    return false;
  }
}
