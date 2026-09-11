import type { Project, Section } from "@/store/slices/types";

export function toSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function projectPath(project: Pick<Project, "title">): string {
  return `/projects/${toSlug(project.title)}`;
}

export function sectionPath(
  project: Pick<Project, "title">,
  section: Pick<Section, "title">
): string {
  return `/projects/${toSlug(project.title)}/sections/${toSlug(section.title)}`;
}

/** Builds a section URL from a section UUID. Falls back to project root if section not found. */
export function sectionPathById(
  project: Pick<Project, "title"> & { sections?: Pick<Section, "id" | "title">[] },
  sectionId: string
): string {
  const section = project.sections?.find((s) => s.id === sectionId);
  if (!section) return projectPath(project);
  return sectionPath(project, section);
}

/** O que vem de uma rota pode ser o UUID ou o slug do título — as URLs do app
 *  são slug desde a migração de rotas, mas links antigos e o modo público ainda
 *  carregam o id. Resolver os dois aqui evita que uma tela receba um "id" que
 *  não casa com nada da store e conclua que a página está vazia. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function findProjectByRef<T extends Pick<Project, "id" | "title">>(
  projects: T[] | undefined,
  ref: string | undefined
): T | undefined {
  if (!projects || !ref) return undefined;
  const value = safeDecode(ref);
  return (
    projects.find((p) => p.id === value) ??
    projects.find((p) => toSlug(p.title) === value)
  );
}

export function findSectionByRef<T extends Pick<Section, "id" | "title">>(
  sections: T[] | undefined,
  ref: string | undefined
): T | undefined {
  if (!sections || !ref) return undefined;
  const value = safeDecode(ref);
  return (
    sections.find((s) => s.id === value) ??
    sections.find((s) => toSlug(s.title) === value)
  );
}
