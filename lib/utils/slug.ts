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
