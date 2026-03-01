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

async function upsertProjectViaServerRoute(project: Project): Promise<{ error: string | null }> {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${base}/api/projects/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { error: body?.error || `sync_route_failed_${response.status}` };
    }

    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "sync_route_exception" };
  }
}

async function deleteProjectViaServerRoute(projectId: string): Promise<{ error: string | null }> {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const response = await fetch(`${base}/api/projects/sync`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { error: body?.error || `delete_route_failed_${response.status}` };
    }

    return { error: null };
  } catch (error) {
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

  const { data: projects, error: pErr } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true });

  if (pErr || !projects) {
    logWarn("[supabaseSync] Erro ao carregar projetos:", pErr?.message);
    return null;
  }

  const projectIds = projects.map((p) => p.id);
  if (projectIds.length === 0) return [];

  const { data: sections, error: sErr } = await supabase
    .from("sections")
    .select("*")
    .in("project_id", projectIds)
    .order("order", { ascending: true });

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
): Promise<{ error: string | null; skippedReason?: "unauthenticated" }> {
  // Caminho principal: sempre tenta rota server-side (sessão por cookie)
  // para evitar inconsistências de hidratação de auth no client.
  const routeResult = await upsertProjectViaServerRoute(project);
  if (!routeResult.error) return { error: null };

  // Fallback: escrita direta pelo client Supabase
  const supabase = createClient();

  const userId = userIdHint ?? await getAuthenticatedUserId();
  if (!userId) {
    logWarn("[supabaseSync] Upsert ignorado: usuário não autenticado");
    return { error: null, skippedReason: "unauthenticated" };
  }

  logInfo(`[supabaseSync] Salvando projeto "${project.title}" (userId=${userId})`);

  // Upsert do projeto
  const { error: pErr } = await supabase.from("projects").upsert(
    {
      id: project.id,
      owner_id: userId,
      title: project.title,
      description: project.description || "",
      mindmap_settings: project.mindMapSettings || {},
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    },
    { onConflict: "id" }
  );

  if (pErr) {
    console.error("[supabaseSync] ERRO ao salvar projeto:", pErr.message, pErr);
    return { error: pErr.message };
  }

  logInfo(`[supabaseSync] Projeto salvo. Salvando ${project.sections?.length || 0} seções...`);

  // Upsert das seções
  const sections = project.sections || [];
  if (sections.length > 0) {
    const { error: sErr } = await supabase.from("sections").upsert(
      sections.map((s) => ({
        id: s.id,
        project_id: project.id,
        parent_id: s.parentId || null,
        title: s.title,
        content: s.content || "",
        order: s.order,
        color: s.color || null,
        created_at: s.created_at,
      })),
      { onConflict: "id" }
    );

    if (sErr) {
      console.error("[supabaseSync] ERRO ao salvar seções:", sErr.message, sErr);
      return { error: sErr.message };
    }
  }

  // Deletar seções que não existem mais
  const sectionIds = sections.map((s) => s.id);
  if (sectionIds.length > 0) {
    await supabase
      .from("sections")
      .delete()
      .eq("project_id", project.id)
      .not("id", "in", `(${sectionIds.join(",")})`);
  } else {
    // Se não tem seções, deleta todas as do projeto
    await supabase.from("sections").delete().eq("project_id", project.id);
  }

  return { error: null };
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
    console.error("[supabaseSync] ERRO ao deletar projeto:", error.message, error);
    return { error: error.message };
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
