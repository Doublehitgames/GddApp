import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Apagar a conta (direito ao esquecimento, LGPD art. 18, VI).
 *
 * Roda com o cliente admin (service role): várias tabelas têm RLS fechado
 * (oauth_*, app_config) e a última etapa — apagar o usuário do Auth — só
 * existe na API admin. Por isso TODA consulta aqui filtra pelo userId à mão.
 *
 * A maior parte já cairia sozinha no `auth.admin.deleteUser` (quase tudo
 * aponta para auth.users com ON DELETE CASCADE), mas a ordem explícita existe
 * por quatro motivos:
 *  1. lápide em `deleted_projects` antes de apagar o projeto, para que a cópia
 *     offline de um membro não ressuscite o projeto no próximo sync;
 *  2. `project_members.invited_by` aponta para auth.users SEM cascade — se a
 *     pessoa convidou alguém para o projeto de outro dono, o deleteUser falha;
 *  3. o nome da pessoa fica gravado como texto (`user_name`,
 *     `updated_by_name`) no histórico dos projetos dos OUTROS; o SET NULL do FK
 *     só desliga o id, o nome continuaria lá;
 *  4. chaves de API e conexões OAuth caem primeiro: se algo falhar no meio,
 *     ninguém continua entrando com elas.
 */

export type AccountSummary = {
  /** Projetos que a pessoa é dona — todos serão apagados. */
  ownedProjects: number;
  /** Dos projetos dela, quantos têm outras pessoas como membro. */
  sharedOwnedProjects: number;
  /** Quantas pessoas (distintas) perdem acesso a algum projeto dela. */
  membersAffected: number;
  /** Projetos de outros donos em que ela é membro — sai deles, o projeto fica. */
  memberships: number;
  /** Chaves de API ativas. */
  apiKeys: number;
  /** Apps conectados por OAuth (ex.: conector do Claude) ainda ativos. */
  connections: number;
};

type Row = Record<string, unknown>;

async function rows(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? (data as Row[]) : [];
}

export async function summarizeAccount(admin: SupabaseClient, userId: string): Promise<AccountSummary> {
  const owned = await rows(admin.from("projects").select("id").eq("owner_id", userId));
  const ownedIds = owned.map((p) => String(p.id));

  let sharedOwnedProjects = 0;
  let membersAffected = 0;
  if (ownedIds.length > 0) {
    const members = await rows(admin.from("project_members").select("project_id, user_id").in("project_id", ownedIds));
    const others = members.filter((m) => m.user_id !== userId);
    sharedOwnedProjects = new Set(others.map((m) => String(m.project_id))).size;
    membersAffected = new Set(others.map((m) => String(m.user_id))).size;
  }

  const memberships = await rows(admin.from("project_members").select("project_id").eq("user_id", userId));
  const keys = await rows(admin.from("user_api_keys").select("id").eq("user_id", userId).is("revoked_at", null));
  const tokens = await rows(admin.from("oauth_tokens").select("client_id").eq("user_id", userId).is("revoked_at", null));

  return {
    ownedProjects: ownedIds.length,
    sharedOwnedProjects,
    membersAffected,
    memberships: new Set(memberships.map((m) => String(m.project_id)).filter((id) => !ownedIds.includes(id))).size,
    apiKeys: keys.length,
    connections: new Set(tokens.map((t) => String(t.client_id))).size,
  };
}

/** O que a pessoa digitou bate com o e-mail da conta? Sem diferenciar maiúsculas e espaços nas pontas. */
export function confirmationMatches(typed: unknown, email: string | null | undefined): boolean {
  if (typeof typed !== "string" || !email) return false;
  const a = typed.trim().toLowerCase();
  return a.length > 0 && a === email.trim().toLowerCase();
}

export type DeleteStep =
  | "list_projects"
  | "tombstones"
  | "owned_projects"
  | "memberships"
  | "invited_by"
  | "activity_names"
  | "version_names"
  | "api_keys"
  | "oauth_tokens"
  | "oauth_codes"
  | "app_config"
  | "profile"
  | "auth_user";

export type DeleteAccountResult =
  | { ok: true; deletedProjects: number; warnings: DeleteStep[] }
  | { ok: false; step: DeleteStep; message: string };

function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

/**
 * Apaga tudo da pessoa, na ordem. Etapa obrigatória que falha interrompe ANTES
 * de apagar o usuário do Auth — a conta continua existindo e dá para tentar de
 * novo (todas as etapas são idempotentes). Etapa opcional que falha (tabela
 * que ainda não foi criada num ambiente antigo, por exemplo) vira aviso.
 */
export async function deleteAccountData(admin: SupabaseClient, userId: string): Promise<DeleteAccountResult> {
  const warnings: DeleteStep[] = [];

  const run = async (step: DeleteStep, optional: boolean, fn: () => PromiseLike<{ error: unknown }>) => {
    let error: unknown = null;
    try {
      ({ error } = await fn());
    } catch (e) {
      error = e;
    }
    if (!error) return null;
    if (optional) {
      warnings.push(step);
      return null;
    }
    return { ok: false as const, step, message: errMessage(error) };
  };

  // 1. Projetos que ela é dona.
  let ownedIds: string[];
  try {
    ownedIds = (await rows(admin.from("projects").select("id").eq("owner_id", userId))).map((p) => String(p.id));
  } catch (e) {
    return { ok: false, step: "list_projects", message: errMessage(e) };
  }

  if (ownedIds.length > 0) {
    // 2. Lápide primeiro: um membro com cópia offline recebe 410 e não recria o projeto.
    const tomb = await run("tombstones", true, () =>
      admin.from("deleted_projects").upsert(ownedIds.map((id) => ({ project_id: id })), { onConflict: "project_id" }),
    );
    if (tomb) return tomb;

    // 3. Os projetos. Cascade leva: sections, section_versions, section_activity_log,
    //    project_members desses projetos, roadmap_*_data e cloud_sync_usage_hourly_by_project.
    const projects = await run("owned_projects", false, () => admin.from("projects").delete().eq("owner_id", userId));
    if (projects) return projects;
  }

  // 4. Sai dos projetos dos outros (o projeto fica com o dono).
  const memberships = await run("memberships", false, () => admin.from("project_members").delete().eq("user_id", userId));
  if (memberships) return memberships;

  // 5. FK sem cascade: quem ela convidou continua membro, só perde o "convidado por".
  const invited = await run("invited_by", false, () =>
    admin.from("project_members").update({ invited_by: null }).eq("invited_by", userId),
  );
  if (invited) return invited;

  // 6. O nome dela no histórico dos projetos dos outros. O texto que ela escreveu
  //    nesses projetos fica — é do projeto —, mas sem dizer quem foi.
  const names = await run("activity_names", true, () =>
    admin.from("section_activity_log").update({ user_name: null }).eq("user_id", userId),
  );
  if (names) return names;
  const versions = await run("version_names", true, () =>
    admin.from("section_versions").update({ updated_by_name: null }).eq("updated_by", userId),
  );
  if (versions) return versions;

  // 7. Acesso programático e conexões (MCP, conector do Claude).
  for (const [step, table] of [
    ["api_keys", "user_api_keys"],
    ["oauth_tokens", "oauth_tokens"],
    ["oauth_codes", "oauth_codes"],
  ] as const) {
    const res = await run(step, false, () => admin.from(table).delete().eq("user_id", userId));
    if (res) return res;
  }

  // 8. Override de limite por pessoa (`<CHAVE>:<user_id>`).
  const config = await run("app_config", true, () => admin.from("app_config").delete().like("key", `%:${userId}`));
  if (config) return config;

  // 9. Perfil (nome, e-mail, avatar, config de IA).
  const profile = await run("profile", false, () => admin.from("profiles").delete().eq("id", userId));
  if (profile) return profile;

  // 10. O usuário do Auth. Cascade leva o que sobrou (cloud_sync_usage_hourly,
  //     roadmap_*_data em projetos alheios) e as sessões.
  const auth = await run("auth_user", false, () => admin.auth.admin.deleteUser(userId));
  if (auth) return auth;

  return { ok: true, deletedProjects: ownedIds.length, warnings };
}

/**
 * Freio simples por pessoa: poucas tentativas por janela. Em memória — numa
 * função serverless vale por instância, o que basta: a confirmação por e-mail
 * já é a trava de verdade; isto só corta repetição em loop.
 */
const attempts = new Map<string, number[]>();
export const DELETE_ATTEMPTS_PER_WINDOW = 5;
export const DELETE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export function takeDeleteAttempt(userId: string, now = Date.now()): boolean {
  const recent = (attempts.get(userId) ?? []).filter((t) => now - t < DELETE_ATTEMPT_WINDOW_MS);
  if (recent.length >= DELETE_ATTEMPTS_PER_WINDOW) {
    attempts.set(userId, recent);
    return false;
  }
  recent.push(now);
  attempts.set(userId, recent);
  return true;
}

/** Só para testes. */
export function resetDeleteAttempts(): void {
  attempts.clear();
}
