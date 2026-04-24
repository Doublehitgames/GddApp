import type { GDDTemplate, GDDTemplateSection } from "@/types/ai";
import type {
  ResolvedTemplate,
  TemplateSection,
} from "@/lib/templates/manualTemplates";

/**
 * Deterministic-ish slug with a random suffix so sibling titles don't collide.
 * We can't rely on LLM output for stable IDs, so we mint them here.
 */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function idFor(prefix: string, title: string, index: number): string {
  return `${prefix}-${index}-${slug(title) || "section"}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function adaptSection(
  ai: GDDTemplateSection,
  prefix: string,
  index: number
): TemplateSection {
  return {
    id: idFor(prefix, ai.title, index),
    title: ai.title,
    content: ai.content,
    pageType: ai.pageType,
    subsections: ai.subsections?.map((sub, i) =>
      adaptSection(sub, `${prefix}-${index}`, i)
    ),
  };
}

/**
 * Converts the AI generator's shape into the same `ResolvedTemplate` that
 * the manual wizard produces, so both entry points can reuse
 * `createProjectFromTemplate`. The AI output is just "manual template
 * without stable IDs" — we mint IDs here.
 */
export function adaptAIGeneratedTemplate(ai: GDDTemplate): ResolvedTemplate {
  return {
    projectTitle: ai.projectTitle,
    projectDescription: ai.projectDescription,
    sections: ai.sections.map((section, i) => adaptSection(section, "ai", i)),
  };
}
