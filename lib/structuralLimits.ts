/**
 * Limites estruturais do plano Free (cloud sync).
 * Usado na API de sync e no store para bloquear criação quando no limite.
 */

export const FREE_MAX_PROJECTS = 2;
export const FREE_MAX_SECTIONS_PER_PROJECT = 120;
export const FREE_MAX_SECTIONS_TOTAL = 200;

export type StructuralLimitReason =
  | "projects_limit"
  | "sections_per_project_limit"
  | "sections_total_limit";
