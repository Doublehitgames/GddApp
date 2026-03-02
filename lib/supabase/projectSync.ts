/**
 * Camada de sincronização entre o projectStore (localStorage) e o Supabase.
 * O localStorage continua sendo a fonte de verdade local (offline-first).
 * O Supabase é a fonte de verdade remota (cloud).
 */

import { createClient } from "@/lib/supabase/client";
import type { Project, Section } from "@/store/projectStore";

const isProduction = process.env.NODE_ENV === "production";
const logInfo = (...args: unknown[]) => {
  if (!isProduction) console.log(...args);
};
const logWarn = (...args: unknown[]) => {
  if (!isProduction) console.warn(...args);
};
const SYNC_ROUTE_TIMEOUT_MS = 12000;
const SUPABASE_QUERY_TIMEOUT_MS = 10000;

export type SyncStats = {
  sectionsTotal: number;
  sectionsUpserted: number;
  sectionsDeleted: number;
  sectionsUnchanged: number;
};

type TimeoutResult<T> =
  | { timedOut: true; value: null }
  | { timedOut: false; value: T };

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<TimeoutResult<T>> {
  try {
    const timeoutPromise = new Promise<TimeoutResult<T>>((resolve) => {
      setTimeout(() => resolve({ timedOut: true, value: null }), timeoutMs);
    });

    const wrappedPromise = Promise.resolve(promise)
      .then((value) => ({ timedOut: false as const, value }))
      .catch(() => ({ timedOut: true as const, value: null }));

    return await Promise.race([wrappedPromise, timeoutPromise]);
  } catch {
    return { timedOut: true, value: null };
  }
}

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object") {
    const maybe = error as Record<string, unknown>;
    if (typeof maybe.message === "string" && maybe.message.trim()) return maybe.message;
    if (typeof maybe.error === "string" && maybe.error.trim()) return maybe.error;
    if (typeof maybe.error_description === "string" && maybe.error_description.trim()) return maybe.error_description;

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {}
  }

  return fallback;
}

async function upsertProjectViaServerRoute(project: Project): Promise<{ error: string | null; stats?: SyncStats }> {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SYNC_ROUTE_TIMEOUT_MS);
    const response = await fetch(`${base}/api/projects/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        error:
          normalizeErrorMessage(body?.error, "") ||
          normalizeErrorMessage(body?.message, "") ||
          `sync_route_failed_${response.status}`,
      };
    }

    const body = await response.json().catch(() => ({}));
    return {
      error: null,
      stats: body?.stats,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { error: "sync_route_timeout" };
    }
    return { error: error instanceof Error ? error.message : "sync_route_exception" };
  }
}

async function deleteProjectViaServerRoute(projectId: string): Promise<{ error: string | null }> {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SYNC_ROUTE_TIMEOUT_MS);
    const response = await fetch(`${base}/api/projects/sync`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { error: body?.error || `delete_route_failed_${response.status}` };
    }

    return { error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { error: "delete_route_timeout" };
    }
    return { error: error instanceof Error ? error.message : "delete_route_exception" };
  }
}

/** Busca o userId da sessão ativa diretamente do Supabase (nunca usa estado do store).
 *  Usa getSession() (leitura local/cache) em vez de getUser() (requisição de rede)
 *  para evitar falhas intermitentes de rede durante o sync. */
async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    // Fallback: tenta getUser() se a sessão local não estiver disponível
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
    logWarn("[supabaseSync] getAuthenticatedUserId: sem sessão ativa");
    return null;
  }
  return session.user.id;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Converte o formato do banco → formato do store */
function dbProjectToStore(
  row: Record<string, unknown>,
  sections: Record<string, unknown>[]
): Project {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) || "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    mindMapSettings: (row.mindmap_settings as Project["mindMapSettings"]) || undefined,
    sections: sections
      .filter((s) => s.project_id === row.id)
      .map(dbSectionToStore),
  };
}

function dbSectionToStore(row: Record<string, unknown>): Section {
  return {
    id: row.id as string,
    title: row.title as string,
    content: (row.content as string) || "",
    created_at: row.created_at as string,
    parentId: (row.parent_id as string) || undefined,
    order: (row.order as number) ?? 0,
    color: (row.color as string) || undefined,
  };
}

// ── Leitura ───────────────────────────────────────────────────────────────────

/** Carrega todos os projetos do usuário autenticado do Supabase */
export async function fetchProjectsFromSupabase(): Promise<Project[] | null> {
  const supabase = createClient();

  const projectsQuery = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true });

  const projectsResult = await withTimeout(projectsQuery, SUPABASE_QUERY_TIMEOUT_MS);
  if (projectsResult.timedOut || !projectsResult.value) {
    logWarn("[supabaseSync] Timeout ao carregar projetos do Supabase");
    return null;
  }

  const { data: projects, error: pErr } = projectsResult.value;

  if (pErr || !projects) {
    logWarn("[supabaseSync] Erro ao carregar projetos:", pErr?.message);
    return null;
  }

  const projectIds = projects.map((p) => p.id);
  if (projectIds.length === 0) return [];

  const sectionsQuery = supabase
    .from("sections")
    .select("*")
    .in("project_id", projectIds)
    .order("order", { ascending: true });

  const sectionsResult = await withTimeout(sectionsQuery, SUPABASE_QUERY_TIMEOUT_MS);
  if (sectionsResult.timedOut || !sectionsResult.value) {
    logWarn("[supabaseSync] Timeout ao carregar seções do Supabase");
    return null;
  }

  const { data: sections, error: sErr } = sectionsResult.value;

  if (sErr) {
    logWarn("[supabaseSync] Erro ao carregar seções:", sErr?.message);
    return null;
  }

  return projects.map((p) =>
    dbProjectToStore(p as Record<string, unknown>, (sections || []) as Record<string, unknown>[])
  );
}

// ── Escrita ───────────────────────────────────────────────────────────────────

/** Salva (upsert) um projeto inteiro no Supabase incluindo suas seções */
export async function upsertProjectToSupabase(
  project: Project,
  userIdHint?: string  // opcional — buscamos internamente se não fornecido
): Promise<{ error: string | null; skippedReason?: "unauthenticated"; stats?: SyncStats }> {
  // Caminho principal: sempre tenta rota server-side (sessão por cookie)
  // para evitar inconsistências de hidratação de auth no client.
  const routeResult = await upsertProjectViaServerRoute(project);
  if (!routeResult.error) return { error: null, stats: routeResult.stats };

  if (routeResult.error === "unauthenticated" || routeResult.error.includes("failed_401")) {
    return { error: null, skippedReason: "unauthenticated" };
  }

  return { error: routeResult.error };
}

/** Deleta um projeto (RLS garante que só o dono consegue) */
export async function deleteProjectFromSupabase(
  projectId: string
): Promise<{ error: string | null }> {
  // Caminho principal: server-side com cookie de sessão
  const routeResult = await deleteProjectViaServerRoute(projectId);
  if (!routeResult.error) return { error: null };

  // Fallback: client direto
  const supabase = createClient();

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    logWarn("[supabaseSync] Delete ignorado: usuário não autenticado");
    return { error: null };
  }

  logInfo(`[supabaseSync] Deletando projeto ${projectId}...`);
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) {
    const errorMessage = normalizeErrorMessage(error, "project_delete_failed");
    console.error("[supabaseSync] ERRO ao deletar projeto:", errorMessage, error);
    return { error: errorMessage };
  }
  logInfo(`[supabaseSync] Projeto ${projectId} deletado com sucesso.`);
  return { error: null };
}

/** Migra todos os projetos do localStorage para o Supabase (uso único) */
export async function migrateLocalProjectsToSupabase(
  projects: Project[],
  userId: string
): Promise<{ migrated: number; errors: number }> {
  let migrated = 0;
  let errors = 0;

  for (const project of projects) {
    const { error } = await upsertProjectToSupabase(project, userId);
    if (error) {
      errors++;
    } else {
      migrated++;
    }
  }

  return { migrated, errors };
}
