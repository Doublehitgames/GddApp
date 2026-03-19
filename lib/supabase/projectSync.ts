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
const SYNC_ROUTE_TIMEOUT_MS = 20000;
const SUPABASE_QUERY_TIMEOUT_MS = 10000;

export type SyncStats = {
  sectionsTotal: number;
  sectionsUpserted: number;
  sectionsDeleted: number;
  sectionsUnchanged: number;
};

export type CloudSyncQuotaStatus = {
  limitPerHour: number;
  usedInWindow: number;
  remainingInWindow: number;
  windowStartedAt: string;
  windowEndsAt: string;
  consumedThisSync: number;
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

const getSyncRouteBase = () => (typeof window !== "undefined" ? window.location.origin : "");

export type SyncPreviewSection = { id: string; title: string };
export type SyncPreviewItem = {
  projectId: string;
  projectTitle: string;
  sectionsNew: SyncPreviewSection[];
  sectionsUpdated: SyncPreviewSection[];
  sectionsDeleted: SyncPreviewSection[];
};

/** Chama POST /api/projects/sync?dryRun=1 para cada projeto; retorna créditos totais e lista amigável do que será sincronizado. */
export async function getSyncPreview(projects: Project[]): Promise<{ estimatedCredits: number; items: SyncPreviewItem[] } | null> {
  if (projects.length === 0) return { estimatedCredits: 0, items: [] };
  const base = getSyncRouteBase();
  let total = 0;
  const items: SyncPreviewItem[] = [];
  for (const project of projects) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SYNC_ROUTE_TIMEOUT_MS);
      const response = await fetch(`${base}/api/projects/sync?dryRun=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      const data = (await response.json().catch(() => ({}))) as {
        estimatedCredits?: number;
        details?: {
          projectId?: string;
          projectTitle?: string;
          sectionsNew?: SyncPreviewSection[];
          sectionsUpdated?: SyncPreviewSection[];
          sectionsDeleted?: SyncPreviewSection[];
        };
      };
      total += Number(data?.estimatedCredits ?? 0);
      if (data?.details) {
        items.push({
          projectId: data.details.projectId ?? project.id,
          projectTitle: data.details.projectTitle ?? project.title ?? project.id,
          sectionsNew: Array.isArray(data.details.sectionsNew) ? data.details.sectionsNew : [],
          sectionsUpdated: Array.isArray(data.details.sectionsUpdated) ? data.details.sectionsUpdated : [],
          sectionsDeleted: Array.isArray(data.details.sectionsDeleted) ? data.details.sectionsDeleted : [],
        });
      }
    } catch {
      return null;
    }
  }
  return { estimatedCredits: total, items };
}

/** Chama POST /api/projects/sync?dryRun=1 para cada projeto e soma os créditos estimados (não grava nada). */
export async function estimateCreditsForProjects(projects: Project[]): Promise<number | null> {
  const result = await getSyncPreview(projects);
  return result ? result.estimatedCredits : null;
}

/** Busca a cota do projeto (GET /api/projects/sync/quota?projectId=). Cota é por projeto; dono e membros compartilham. */
export async function fetchQuotaStatus(projectId: string): Promise<CloudSyncQuotaStatus | null> {
  try {
    const base = getSyncRouteBase();
    const url = `${base}/api/projects/sync/quota?projectId=${encodeURIComponent(projectId)}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as Record<string, unknown>;
    if (!data || typeof data.limitPerHour !== "number") return null;
    return {
      limitPerHour: data.limitPerHour as number,
      usedInWindow: Number(data.usedInWindow ?? 0),
      remainingInWindow: Number(data.remainingInWindow ?? 0),
      windowStartedAt: String(data.windowStartedAt ?? ""),
      windowEndsAt: String(data.windowEndsAt ?? ""),
      consumedThisSync: Number(data.consumedThisSync ?? 0),
    };
  } catch {
    return null;
  }
}

/** Envia apenas mindmap_settings para o Supabase (sem seções, sem consumir créditos). Usado ao salvar Configurações do Mapa Mental. */
export async function pushProjectMindMapSettings(
  projectId: string,
  mindmapSettings: Record<string, unknown>
): Promise<{ error: string | null }> {
  try {
    const base = getSyncRouteBase();
    const response = await fetch(`${base}/api/projects/${encodeURIComponent(projectId)}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mindmap_settings: mindmapSettings }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { error: (body?.error as string) || `settings_push_failed_${response.status}` };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "settings_push_exception" };
  }
}

export type SyncedBy = { userId: string; displayName: string | null };

async function upsertProjectViaServerRoute(project: Project): Promise<{
  error: string | null;
  errorCode?: string;
  structuralLimitReason?: string;
  stats?: SyncStats;
  quota?: CloudSyncQuotaStatus | null;
  partial?: boolean;
  remainingCreditsNeeded?: number;
  syncedBy?: SyncedBy;
}> {
  try {
    const base = getSyncRouteBase();
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
      const rawError = body?.error ?? body?.message;
      const errorMessage =
        normalizeErrorMessage(rawError, "") ||
        (typeof rawError === "object" && rawError !== null && "message" in rawError
          ? normalizeErrorMessage((rawError as { message?: unknown }).message, "")
          : "") ||
        `sync_route_failed_${response.status}`;
      return {
        error: errorMessage,
        errorCode: typeof body?.code === "string" ? body.code : undefined,
        structuralLimitReason: typeof body?.reason === "string" ? body.reason : undefined,
        quota: body?.quota,
      };
    }

    const body = await response.json().catch(() => ({}));
    const syncedBy =
      body?.syncedBy && typeof body.syncedBy.userId === "string"
        ? {
            userId: body.syncedBy.userId as string,
            displayName:
              typeof body.syncedBy.displayName === "string" ? body.syncedBy.displayName : null,
          }
        : undefined;
    return {
      error: null,
      stats: body?.stats,
      quota: body?.quota,
      partial: Boolean(body?.partial),
      remainingCreditsNeeded: typeof body?.remainingCreditsNeeded === "number" ? body.remainingCreditsNeeded : undefined,
      syncedBy,
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SYNC_ROUTE_TIMEOUT_MS);
    const response = await fetch(`${getSyncRouteBase()}/api/projects/sync`, {
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
    ownerId: (row.owner_id as string) || undefined,
    sections: sections
      .filter((s) => s.project_id === row.id)
      .map(dbSectionToStore),
  };
}

function dbSectionToStore(row: Record<string, unknown>): Section {
  const rawTags = row.domain_tags;
  const domainTags =
    Array.isArray(rawTags) && rawTags.length > 0
      ? (rawTags as string[])
      : undefined;
  const rawBalanceAddons = row.balance_addons;
  const balanceAddons = Array.isArray(rawBalanceAddons) && rawBalanceAddons.length > 0 ? rawBalanceAddons : undefined;
  return {
    id: row.id as string,
    title: row.title as string,
    content: (row.content as string) || "",
    created_at: row.created_at as string,
    parentId: (row.parent_id as string) || undefined,
    order: ((row.sort_order ?? (row as { order?: number }).order) as number) ?? 0,
    color: (row.color as string) || undefined,
    created_by: (row.created_by as string) || undefined,
    created_by_name: (row.created_by_name as string) || undefined,
    updated_at: (row.updated_at as string) || undefined,
    updated_by: (row.updated_by as string) || undefined,
    updated_by_name: (row.updated_by_name as string) || undefined,
    domainTags,
    balanceAddons: balanceAddons as Section["balanceAddons"],
  };
}

// ── Leitura ───────────────────────────────────────────────────────────────────

/** Retorna os IDs, entre os passados, que estão em deleted_projects (projeto excluído pelo dono). */
export async function fetchDeletedProjectIds(projectIds: string[]): Promise<string[]> {
  if (projectIds.length === 0) return [];
  try {
    const base = getSyncRouteBase();
    const idsParam = projectIds.map((id) => encodeURIComponent(id)).join(",");
    const response = await fetch(`${base}/api/projects/deleted-ids?ids=${idsParam}`, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) return [];
    const data = (await response.json().catch(() => ({}))) as { deletedIds?: string[] };
    return Array.isArray(data?.deletedIds) ? data.deletedIds : [];
  } catch {
    return [];
  }
}

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
    .order("sort_order", { ascending: true });

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
): Promise<{
  error: string | null;
  errorCode?: string;
  structuralLimitReason?: string;
  skippedReason?: "unauthenticated";
  stats?: SyncStats;
  quota?: CloudSyncQuotaStatus | null;
  partial?: boolean;
  remainingCreditsNeeded?: number;
  syncedBy?: SyncedBy;
}> {
  // Caminho principal: sempre tenta rota server-side (sessão por cookie)
  const routeResult = await upsertProjectViaServerRoute(project);
  if (!routeResult.error) {
    return {
      error: null,
      stats: routeResult.stats,
      quota: routeResult.quota,
      partial: routeResult.partial,
      remainingCreditsNeeded: routeResult.remainingCreditsNeeded,
      syncedBy: routeResult.syncedBy,
    };
  }

  if (routeResult.error === "unauthenticated" || routeResult.error.includes("failed_401")) {
    return { error: null, skippedReason: "unauthenticated" };
  }

  return {
    error: routeResult.error,
    errorCode: routeResult.errorCode,
    structuralLimitReason: routeResult.structuralLimitReason,
    quota: routeResult.quota,
  };
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
