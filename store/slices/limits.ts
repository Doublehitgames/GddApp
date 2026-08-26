import type { AppLimits, Project, ProjectStore } from "./types";

/**
 * O plano dá N projetos e M páginas POR PROJETO — não há cota somada entre
 * projetos. Cada projeto é medido contra o limite do seu DONO, igual ao
 * servidor (getRemoteConfig(ownerId)), então um membro convidado trabalha sob
 * o limite de quem o convidou e nada do que ele cria afeta os outros projetos
 * daquele dono.
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

/** Projetos que contam contra a cota de projetos de um dono. */
export function projectsOwnedBy(
  projects: Project[],
  ownerId: string,
  userId: string | null
): Project[] {
  return projects.filter((p) => ownerKeyOf(p, userId) === ownerId);
}
