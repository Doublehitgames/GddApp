/**
 * Limites estruturais do plano Free (cloud sync).
 *
 * MODELO: o plano dá N projetos e M páginas POR PROJETO — não há cota de
 * páginas somada entre projetos. Cada projeto tem seu próprio teto, então o
 * que um membro convidado cria num projeto nunca consome o espaço dos outros
 * projetos do dono.
 *
 * ATENÇÃO: estes números são só referência histórica. O valor que vale em runtime
 * vem de app_config (ver lib/remoteConfig.ts), que ainda aceita override por
 * usuário na chave `<CHAVE>:<user_id>`. Servidor usa getRemoteConfig(ownerId);
 * cliente usa store.appLimits, alimentado por /api/config/limits.
 */

export const FREE_MAX_PROJECTS = 2;
export const FREE_MAX_SECTIONS_PER_PROJECT = 300;

export type StructuralLimitReason =
  | "projects_limit"
  | "sections_per_project_limit";
