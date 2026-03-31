import type { ResolvedTemplate, TemplateSection } from "@/lib/templates/manualTemplates";

type CreateProjectFromTemplateParams = {
  template: ResolvedTemplate;
  addProject: (name: string, description: string) => string;
  addSection: (projectId: string, title: string, content?: string) => string;
  addSubsection: (projectId: string, parentId: string, title: string, content?: string) => string;
  selectedRootSectionIds?: string[];
};

function createSectionTree(
  projectId: string,
  sections: TemplateSection[],
  addSection: (projectId: string, title: string, content?: string) => string,
  addSubsection: (projectId: string, parentId: string, title: string, content?: string) => string,
  parentId?: string
) {
  sections.forEach((section) => {
    const createdId = parentId
      ? addSubsection(projectId, parentId, section.title, section.content)
      : addSection(projectId, section.title, section.content);

    if (!createdId) return;
    if (!section.subsections?.length) return;
    createSectionTree(projectId, section.subsections, addSection, addSubsection, createdId);
  });
}

export function createProjectFromTemplate({
  template,
  addProject,
  addSection,
  addSubsection,
  selectedRootSectionIds,
}: CreateProjectFromTemplateParams): string {
  const projectId = addProject(template.projectTitle, template.projectDescription);
  const selectedSet =
    selectedRootSectionIds && selectedRootSectionIds.length > 0
      ? new Set(selectedRootSectionIds)
      : null;

  const rootSections = selectedSet
    ? template.sections.filter((section) => selectedSet.has(section.id))
    : template.sections;

  createSectionTree(projectId, rootSections, addSection, addSubsection);
  return projectId;
}
