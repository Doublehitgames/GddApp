import type { ResolvedTemplate, TemplateSection } from "@/lib/templates/manualTemplates";
import { buildPageTypeAddons, getPageType } from "@/lib/pageTypes/registry";
import type { SectionAddon } from "@/lib/addons/types";
import type { Translator } from "@/lib/pageTypes/registry";
import type { SectionAuditBy } from "@/store/slices/types";

/**
 * Signature matches `useProjectStore.addSection` (pageTypeId + customAddons
 * are optional positional args). The template creator uses them when the
 * template marks a section with a `pageType`.
 */
type AddSectionFn = (
  projectId: string,
  title: string,
  content?: string,
  createdBy?: SectionAuditBy,
  pageTypeId?: string,
  customAddons?: SectionAddon[],
  domainTags?: string[]
) => string;

type AddSubsectionFn = (
  projectId: string,
  parentId: string,
  title: string,
  content?: string,
  createdBy?: SectionAuditBy,
  pageTypeId?: string,
  customAddons?: SectionAddon[],
  domainTags?: string[]
) => string;

type CreateProjectFromTemplateParams = {
  template: ResolvedTemplate;
  addProject: (name: string, description: string) => string;
  addSection: AddSectionFn;
  addSubsection: AddSubsectionFn;
  selectedRootSectionIds?: string[];
  /**
   * Optional i18n translator. When provided, page-type addon seeds that use
   * `nameOverrideKey` resolve to localized names (e.g. "Inventário"/"Inventory").
   * Without it, the pt-BR fallback baked into the registry is used.
   */
  t?: Translator;
};

/**
 * Derives the title prefix for a page-typed section. Mirrors what the sidebar
 * does: prepends the page type's emoji so the sidebar badge stays consistent.
 */
function resolvePageTypedTitle(section: TemplateSection): string {
  if (!section.pageType) return section.title;
  const pt = getPageType(section.pageType.id);
  if (!pt) return section.title;
  // Avoid double-prefixing if the template already embeds the emoji.
  if (section.title.startsWith(pt.emoji)) return section.title;
  return `${pt.emoji} ${section.title}`;
}

function createSectionTree(
  projectId: string,
  sections: TemplateSection[],
  addSection: AddSectionFn,
  addSubsection: AddSubsectionFn,
  t: Translator | undefined,
  parentId?: string
) {
  sections.forEach((section) => {
    const pageTypeId = section.pageType?.id;
    const customAddons = section.pageType
      ? buildPageTypeAddons(section.pageType.id, section.pageType.options ?? {}, t)
      : undefined;
    const titleWithEmoji = resolvePageTypedTitle(section);

    const createdId = parentId
      ? addSubsection(
          projectId,
          parentId,
          titleWithEmoji,
          section.content,
          undefined,
          pageTypeId,
          customAddons
        )
      : addSection(
          projectId,
          titleWithEmoji,
          section.content,
          undefined,
          pageTypeId,
          customAddons
        );

    if (!createdId) return;
    if (!section.subsections?.length) return;
    createSectionTree(projectId, section.subsections, addSection, addSubsection, t, createdId);
  });
}

export function createProjectFromTemplate({
  template,
  addProject,
  addSection,
  addSubsection,
  selectedRootSectionIds,
  t,
}: CreateProjectFromTemplateParams): string {
  const projectId = addProject(template.projectTitle, template.projectDescription);
  const selectedSet =
    selectedRootSectionIds && selectedRootSectionIds.length > 0
      ? new Set(selectedRootSectionIds)
      : null;

  const rootSections = selectedSet
    ? template.sections.filter((section) => selectedSet.has(section.id))
    : template.sections;

  createSectionTree(projectId, rootSections, addSection, addSubsection, t);
  return projectId;
}
