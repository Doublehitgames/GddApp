// utils/ai/apiHelpers.ts
import { NextRequest, NextResponse } from 'next/server';
import { AIProvider } from '@/types/ai';

export interface AIConfigFromRequest {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

/**
 * Extrai configuração de IA dos headers do request
 * Retorna erro 401 se não houver configuração válida
 */
export function getAIConfigFromRequest(request: NextRequest): AIConfigFromRequest | NextResponse {
  const provider = (request.headers.get('x-ai-provider') as AIProvider) || 'groq';
  const apiKey = request.headers.get('x-ai-key');
  const model = request.headers.get('x-ai-model') || undefined;

  if (!apiKey) {
    return NextResponse.json(
      { 
        error: 'API key not configured', 
        message: 'Por favor, configure sua API key em Configurações de IA para usar este recurso.',
        needsConfig: true 
      },
      { status: 401 }
    );
  }

  return {
    provider,
    apiKey,
    model,
  };
}
