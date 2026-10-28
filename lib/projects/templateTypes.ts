import type { RichDocBlock } from "@/lib/richDoc/types";

/** Uma página a criar: o formato que a IA de criação devolve, já adaptado. */
export type TemplateSection = {
  id: string;
  title: string;
  content: string;
  subsections?: TemplateSection[];
  /**
   * Descrição da página em blocos nativos (BlockNote). Quando presente, vira
   * o `contentBlocks` da seção criada; `content` continua sendo o espelho
   * markdown usado em busca e prévias.
   */
  contentBlocks?: RichDocBlock[];
};

export type ResolvedTemplate = {
  projectTitle: string;
  projectDescription: string;
  sections: TemplateSection[];
};
