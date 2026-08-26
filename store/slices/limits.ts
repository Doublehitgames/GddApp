import type { AppLimits, Project, ProjectStore } from "./types";

/**
 * Limites estruturais são avaliados no DONO do projeto — tanto no servidor
 * (getRemoteConfig(ownerId)) quanto aqui. Um membro editando o projeto de
 * outra pessoa fica sujeito aos limites de quem o convidou, não aos seus.
 *
 * Projeto sem ownerId é local-only: conta como do próprio usuário.
 */
export function ownerKeyOf(project: Project, userId: string | null): string {
  return project.ownerId ?? userId ?? "local";
}

/** Limites de um dono; cai nos do próprio usuário quando não conhecemos os dele. */
export function limitsForOwner(
  state: Pick<ProjectStore, "appLimits" | "limitsByOwner">,
  ownerId: string
): AppLimits {
  return state.limitsByOwner[ownerId] ?? state.appLimits;
}

export function limitsForProject(
  state: Pick<ProjectStore, "appLimits" | "limitsByOwner" | "userId">,
  project: Project
): AppLimits {
  return limitsForOwner(state, ownerKeyOf(project, state.userId));
}

/**
 * Páginas que contam contra a cota de um dono: só os projetos dele.
 * Projetos compartilhados com o usuário consomem a cota de quem os possui.
 */
export function sectionsUsedByOwner(
  projects: Project[],
  ownerId: string,
  userId: string | null
): number {
  return projects.reduce(
    (sum, p) => (ownerKeyOf(p, userId) === ownerId ? sum + (p.sections || []).length : sum),
    0
  );
}

/** Projetos que contam contra a cota de projetos de um dono. */
export function projectsOwnedBy(
  projects: Project[],
  ownerId: string,
  userId: string | null
): Project[] {
  return projects.filter((p) => ownerKeyOf(p, userId) === ownerId);
}
