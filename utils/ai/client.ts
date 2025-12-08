// utils/ai/client.ts
import { AIProvider, AIMessage, AIResponse } from '@/types/ai';

interface AIClientConfig {
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
}

// Modelos disponíveis para fallback no Groq
export const GROQ_MODELS = {
  PREMIUM: 'llama-3.3-70b-versatile',    // ~14K tokens/min, melhor qualidade
  FAST: 'llama-3.1-8b-instant',          // ~30K tokens/min, mais barato
} as const;

export class AIClient {
  private provider: AIProvider;
  private apiKey: string;
  private model: string;

  constructor(config?: AIClientConfig) {
    // Priority: config > env variables > default (groq)
    // Use NEXT_PUBLIC_ for client-side, without prefix for server-side
    this.provider = config?.provider || 
                    (process.env.AI_PROVIDER || process.env.NEXT_PUBLIC_AI_PROVIDER) as AIProvider || 
                    'groq';
    
    this.apiKey = config?.apiKey || this.getApiKeyFromEnv();
    this.model = config?.model || this.getDefaultModel();

    if (!this.apiKey) {
      throw new Error(`API key not found for provider: ${this.provider}`);
    }
  }

  private getApiKeyFromEnv(): string {
    switch (this.provider) {
      case 'groq':
        return process.env.GROQ_API_KEY || '';
      case 'openai':
        return process.env.OPENAI_API_KEY || '';
      case 'claude':
        return process.env.ANTHROPIC_API_KEY || '';
      default:
        return '';
    }
  }

  private getDefaultModel(): string {
    switch (this.provider) {
      case 'groq':
        return 'llama-3.3-70b-versatile'; // Modelo padrão (mais robusto)
      case 'openai':
        return 'gpt-4o-mini';
      case 'claude':
        return 'claude-3-5-sonnet-20241022';
      default:
        return 'llama-3.3-70b-versatile';
    }
  }

  private getApiUrl(): string {
    switch (this.provider) {
      case 'groq':
        return 'https://api.groq.com/openai/v1/chat/completions';
      case 'openai':
        return 'https://api.openai.com/v1/chat/completions';
      case 'claude':
        return 'https://api.anthropic.com/v1/messages';
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }

  async chat(messages: AIMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
    tools?: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: any;
      };
    }>;
    tool_choice?: 'auto' | 'none';
  }): Promise<AIResponse> {
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens ?? 4000;
    const tools = options?.tools;
    const tool_choice = options?.tool_choice ?? 'auto';

    try {
      if (this.provider === 'claude') {
        return await this.chatClaude(messages, temperature, maxTokens, tools, tool_choice);
      } else {
        return await this.chatOpenAICompatible(messages, temperature, maxTokens, tools, tool_choice);
      }
    } catch (error) {
      console.error(`Error with ${this.provider}:`, error);
      throw new Error(`AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async chatOpenAICompatible(
    messages: AIMessage[], 
    temperature: number, 
    maxTokens: number,
    tools?: Array<any>,
    tool_choice?: string
  ): Promise<AIResponse> {
    const body: any = {
      model: this.model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = tool_choice || 'auto';
    }

    const response = await fetch(this.getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const message = data.choices[0]?.message;
    
    return {
      content: message?.content || '',
      provider: this.provider,
      model: this.model,
      tokensUsed: data.usage?.total_tokens,
      tool_calls: message?.tool_calls,
    };
  }

  private async chatClaude(
    messages: AIMessage[], 
    temperature: number, 
    maxTokens: number,
    tools?: Array<any>,
    tool_choice?: string
  ): Promise<AIResponse> {
    // Claude tem formato diferente
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: m.content,
      }));

    const body: any = {
      model: this.model,
      messages: conversationMessages,
      system: systemMessage,
      temperature: temperature,
      max_tokens: maxTokens,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = { type: tool_choice || 'auto' };
    }

    const response = await fetch(this.getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    return {
      content: data.content[0]?.text || '',
      provider: this.provider,
      model: this.model,
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
      tool_calls: data.content?.filter((c: any) => c.type === 'tool_use'),
    };
  }
}

export const createAIClient = (config?: AIClientConfig) => new AIClient(config);
