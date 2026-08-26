/**
 * Limites estruturais do plano Free (cloud sync).
 *
 * ATENÇÃO: estes números são só referência histórica. O valor que vale em runtime
 * vem de app_config (ver lib/remoteConfig.ts), que ainda aceita override por
 * usuário na chave `<CHAVE>:<user_id>`. Servidor usa getRemoteConfig(ownerId);
 * cliente usa store.appLimits, alimentado por /api/config/limits.
 */

export const FREE_MAX_PROJECTS = 2;
export const FREE_MAX_SECTIONS_PER_PROJECT = 300;
export const FREE_MAX_SECTIONS_TOTAL = 400;

export type StructuralLimitReason =
  | "projects_limit"
  | "sections_per_project_limit"
  | "sections_total_limit";
