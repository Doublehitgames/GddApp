// types/ai.ts
import type { BuildPageTypeAddonsOptions, PageTypeId } from "@/lib/pageTypes/registry";

export type AIProvider = 'groq' | 'openai' | 'claude';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokensUsed?: number;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface GDDTemplateRequest {
  gameType: string;
  description: string;
  additionalInfo?: string;
  model?: string;
}

/**
 * Section produced by the AI generator. Mirrors the shape of
 * `TemplateSection` in `lib/templates/manualTemplates.ts` (minus the
 * `id` — IDs are generated when adapting to the manual-template format
 * for `createProjectFromTemplate`).
 *
 * When `pageType` is present, the section is created with the page
 * type's seeded addons (+ any richDocBlocks/attribute overrides passed
 * via options) — exactly like the manual template flow.
 */
export interface GDDTemplateSection {
  title: string;
  content: string;
  /** Domínios de game design: combat, economy, progression, crafting, items, world, narrative, audio, ui, technology, other */
  domainTags?: string[];
  /** When present, the section is created with this page type's addons seeded. */
  pageType?: {
    id: PageTypeId;
    options?: BuildPageTypeAddonsOptions;
  };
  subsections?: GDDTemplateSection[];
}

export interface GDDTemplate {
  projectTitle: string;
  projectDescription: string;
  /**
   * Name of the fictional game the AI invented for this template. Used
   * purely as metadata for the preview screen so the user knows the
   * content is an example to edit, not a verbatim GDD.
   */
  fictionalGameName?: string;
  sections: GDDTemplateSection[];
}

export interface ChatRequest {
  messages: AIMessage[];
  projectContext?: {
    projectId: string;
    projectTitle: string;
    projectDescription?: string;
    sections: Array<{
      id: string;
      title: string;
      content?: string;
      parentId?: string;
      domainTags?: string[];
    }>;
  };
  model?: string;
}
