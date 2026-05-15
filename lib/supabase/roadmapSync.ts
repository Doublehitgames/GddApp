/**
 * Camada de sincronização do Roadmap entre o store (localStorage) e o Supabase.
 * Offline-first: localStorage permanece como fonte primária.
 * Supabase é best-effort — timeouts e erros são silenciosos (apenas warn no console).
 */

import { createClient } from "@/lib/supabase/client";
import type { Roadmap, RoadmapPhase, RoadmapTheme, RoadmapItem } from "@/lib/roadmap/types";

const TIMEOUT_MS = 10000;

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

// ─── Roadmaps ─────────────────────────────────────────────────────────────────

export async function fetchRoadmaps(userId: string, projectId: string): Promise<Roadmap[] | null> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("roadmap_roadmaps_data").select("data").eq("user_id", userId).eq("project_id", projectId).maybeSingle(),
      TIMEOUT_MS
    );
    if (result.timedOut) { console.warn("[roadmapSync] fetchRoadmaps timed out"); return null; }
    const { data, error } = result.value;
    if (error && (error as { code?: string }).code !== "PGRST116") { console.warn("[roadmapSync] fetchRoadmaps error", error); return null; }
    if (!data) return null;
    const rows = data.data as Roadmap[];
    return Array.isArray(rows) ? rows : null;
  } catch (e) { console.warn("[roadmapSync] fetchRoadmaps unexpected error", e); return null; }
}

export async function upsertRoadmaps(userId: string, projectId: string, roadmaps: Roadmap[]): Promise<boolean> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("roadmap_roadmaps_data").upsert(
        { user_id: userId, project_id: projectId, data: roadmaps, updated_at: new Date().toISOString() },
        { onConflict: "user_id,project_id" }
      ),
      TIMEOUT_MS
    );
    if (result.timedOut) { console.warn("[roadmapSync] upsertRoadmaps timed out"); return false; }
    if (result.value.error) { console.warn("[roadmapSync] upsertRoadmaps error", result.value.error); return false; }
    return true;
  } catch (e) { console.warn("[roadmapSync] upsertRoadmaps unexpected error", e); return false; }
}

// ─── Phases ───────────────────────────────────────────────────────────────────

export async function fetchRoadmapPhases(userId: string, projectId: string): Promise<RoadmapPhase[] | null> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("roadmap_phases_data").select("data").eq("user_id", userId).eq("project_id", projectId).maybeSingle(),
      TIMEOUT_MS
    );
    if (result.timedOut) { console.warn("[roadmapSync] fetchRoadmapPhases timed out"); return null; }
    const { data, error } = result.value;
    if (error && (error as { code?: string }).code !== "PGRST116") { console.warn("[roadmapSync] fetchRoadmapPhases error", error); return null; }
    if (!data) return null;
    const rows = data.data as RoadmapPhase[];
    return Array.isArray(rows) ? rows : null;
  } catch (e) { console.warn("[roadmapSync] fetchRoadmapPhases unexpected error", e); return null; }
}

export async function upsertRoadmapPhases(userId: string, projectId: string, phases: RoadmapPhase[]): Promise<boolean> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("roadmap_phases_data").upsert(
        { user_id: userId, project_id: projectId, data: phases, updated_at: new Date().toISOString() },
        { onConflict: "user_id,project_id" }
      ),
      TIMEOUT_MS
    );
    if (result.timedOut) { console.warn("[roadmapSync] upsertRoadmapPhases timed out"); return false; }
    if (result.value.error) { console.warn("[roadmapSync] upsertRoadmapPhases error", result.value.error); return false; }
    return true;
  } catch (e) { console.warn("[roadmapSync] upsertRoadmapPhases unexpected error", e); return false; }
}

// ─── Themes ───────────────────────────────────────────────────────────────────

export async function fetchRoadmapThemes(userId: string, projectId: string): Promise<RoadmapTheme[] | null> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("roadmap_themes_data").select("data").eq("user_id", userId).eq("project_id", projectId).maybeSingle(),
      TIMEOUT_MS
    );
    if (result.timedOut) { console.warn("[roadmapSync] fetchRoadmapThemes timed out"); return null; }
    const { data, error } = result.value;
    if (error && (error as { code?: string }).code !== "PGRST116") { console.warn("[roadmapSync] fetchRoadmapThemes error", error); return null; }
    if (!data) return null;
    const rows = data.data as RoadmapTheme[];
    return Array.isArray(rows) ? rows : null;
  } catch (e) { console.warn("[roadmapSync] fetchRoadmapThemes unexpected error", e); return null; }
}

export async function upsertRoadmapThemes(userId: string, projectId: string, themes: RoadmapTheme[]): Promise<boolean> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("roadmap_themes_data").upsert(
        { user_id: userId, project_id: projectId, data: themes, updated_at: new Date().toISOString() },
        { onConflict: "user_id,project_id" }
      ),
      TIMEOUT_MS
    );
    if (result.timedOut) { console.warn("[roadmapSync] upsertRoadmapThemes timed out"); return false; }
    if (result.value.error) { console.warn("[roadmapSync] upsertRoadmapThemes error", result.value.error); return false; }
    return true;
  } catch (e) { console.warn("[roadmapSync] upsertRoadmapThemes unexpected error", e); return false; }
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function fetchRoadmapItems(userId: string, projectId: string): Promise<RoadmapItem[] | null> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("roadmap_items_data").select("data").eq("user_id", userId).eq("project_id", projectId).maybeSingle(),
      TIMEOUT_MS
    );
    if (result.timedOut) { console.warn("[roadmapSync] fetchRoadmapItems timed out"); return null; }
    const { data, error } = result.value;
    if (error && (error as { code?: string }).code !== "PGRST116") { console.warn("[roadmapSync] fetchRoadmapItems error", error); return null; }
    if (!data) return null;
    const rows = data.data as RoadmapItem[];
    return Array.isArray(rows) ? rows : null;
  } catch (e) { console.warn("[roadmapSync] fetchRoadmapItems unexpected error", e); return null; }
}

export async function upsertRoadmapItems(userId: string, projectId: string, items: RoadmapItem[]): Promise<boolean> {
  try {
    const supabase = createClient();
    const result = await withTimeout(
      supabase.from("roadmap_items_data").upsert(
        { user_id: userId, project_id: projectId, data: items, updated_at: new Date().toISOString() },
        { onConflict: "user_id,project_id" }
      ),
      TIMEOUT_MS
    );
    if (result.timedOut) { console.warn("[roadmapSync] upsertRoadmapItems timed out"); return false; }
    if (result.value.error) { console.warn("[roadmapSync] upsertRoadmapItems error", result.value.error); return false; }
    return true;
  } catch (e) { console.warn("[roadmapSync] upsertRoadmapItems unexpected error", e); return false; }
}
