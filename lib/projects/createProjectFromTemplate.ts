import type { ResolvedTemplate, TemplateSection } from "@/lib/templates/manualTemplates";
import type { RichDocBlock } from "@/lib/richDoc/types";
import type { SectionAuditBy } from "@/store/slices/types";

/** Assinatura de `useProjectStore.addSection`. */
type AddSectionFn = (
  projectId: string,
  title: string,
  content?: string,
  createdBy?: SectionAuditBy,
  domainTags?: string[]
) => string;

type AddSubsectionFn = (
  projectId: string,
  parentId: string,
  title: string,
  content?: string,
  createdBy?: SectionAuditBy,
  domainTags?: string[]
) => string;

/** Assinatura de `useProjectStore.updateSectionDescription`. */
type UpdateSectionDescriptionFn = (
  projectId: string,
  sectionId: string,
  contentBlocks: RichDocBlock[],
  contentMarkdown: string,
  updatedBy?: SectionAuditBy
) => void;

type CreateProjectFromTemplateParams = {
  template: ResolvedTemplate;
  addProject: (name: string, description: string) => string;
  addSection: AddSectionFn;
  addSubsection: AddSubsectionFn;
  /**
   * Quando informada, seções do template que trazem `contentBlocks` têm a
   * descrição em blocos aplicada logo após serem criadas. Sem ela, resta só
   * o markdown de `content`.
   */
  updateSectionDescription?: UpdateSectionDescriptionFn;
  selectedRootSectionIds?: string[];
};

function createSectionTree(
  projectId: string,
  sections: TemplateSection[],
  addSection: AddSectionFn,
  addSubsection: AddSubsectionFn,
  updateSectionDescription: UpdateSectionDescriptionFn | undefined,
  parentId?: string
) {
  sections.forEach((section) => {
    const createdId = parentId
      ? addSubsection(projectId, parentId, section.title, section.content)
      : addSection(projectId, section.title, section.content);

    if (!createdId) return;
    if (section.contentBlocks?.length && updateSectionDescription) {
      updateSectionDescription(projectId, createdId, section.contentBlocks, section.content);
    }
    if (!section.subsections?.length) return;
    createSectionTree(
      projectId,
      section.subsections,
      addSection,
      addSubsection,
      updateSectionDescription,
      createdId
    );
  });
}

export function createProjectFromTemplate({
  template,
  addProject,
  addSection,
  addSubsection,
  updateSectionDescription,
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

  createSectionTree(projectId, rootSections, addSection, addSubsection, updateSectionDescription);
  return projectId;
}
