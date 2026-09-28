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

/** O segmento de URL mais bonito que ainda abre o MESMO item: o slug quando ele
 *  leva de volta a esse item, o UUID quando não leva (dois títulos com o mesmo
 *  slug — trocar o UUID pelo slug abriria a página errada). */
export function stableProjectSegment<T extends Pick<Project, "id" | "title">>(
  projects: T[] | undefined,
  project: T
): string {
  const slug = toSlug(project.title);
  return findProjectByRef(projects, slug)?.id === project.id ? slug : project.id;
}

export function stableSectionSegment<T extends Pick<Section, "id" | "title">>(
  sections: T[] | undefined,
  section: T
): string {
  const slug = toSlug(section.title);
  return findSectionByRef(sections, slug)?.id === section.id ? slug : section.id;
}

/** Para onde trocar a URL atual de um projeto (`/projects/<ref>/...`) quando ela
 *  chegou por UUID e existe uma forma em slug que abre a mesma coisa. Devolve
 *  null quando a URL já está na forma canônica ou não é de projeto. O link por
 *  UUID continua valendo sempre — isto só deixa a barra de endereço legível. */
export function canonicalProjectPathname(
  pathname: string,
  projects: Pick<Project, "id" | "title">[] | undefined,
  project: Pick<Project, "id" | "title"> & { sections?: Pick<Section, "id" | "title">[] }
): string | null {
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/sections\/([^/]+))?(.*)$/);
  if (!match) return null;
  const [, projectRef, sectionRef, rest] = match;
  const projectSeg = stableProjectSegment(projects, project);
  let sectionSeg: string | undefined;
  if (sectionRef !== undefined) {
    const section = findSectionByRef(project.sections, sectionRef);
    // Página que não existe: deixa a URL como veio, a tela mostra "não encontrada".
    sectionSeg = section ? stableSectionSegment(project.sections, section) : sectionRef;
  }
  const same =
    safeDecode(projectRef) === projectSeg &&
    (sectionRef === undefined || safeDecode(sectionRef) === sectionSeg);
  if (same) return null;
  return `/projects/${projectSeg}${sectionSeg !== undefined ? `/sections/${sectionSeg}` : ""}${rest}`;
}
