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
}

export interface GDDTemplateRequest {
  gameType: string;
  description: string;
  additionalInfo?: string;
}

export interface GDDTemplate {
  projectTitle: string;
  projectDescription: string;
  sections: {
    title: string;
    content: string;
    subsections?: {
      title: string;
      content: string;
    }[];
  }[];
}

export interface ChatRequest {
  messages: AIMessage[];
  projectContext?: {
    projectId: string;
    projectTitle: string;
    sections: Array<{
      id: string;
      title: string;
      content?: string;
    }>;
  };
}
