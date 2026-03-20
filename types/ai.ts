// types/ai.ts
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

export interface GDDTemplate {
  projectTitle: string;
  projectDescription: string;
  sections: {
    title: string;
    content: string;
    /** Domínios de game design: combat, economy, progression, crafting, items, world, narrative, audio, ui, technology, other */
    domainTags?: string[];
    subsections?: {
      title: string;
      content: string;
      domainTags?: string[];
    }[];
  }[];
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
