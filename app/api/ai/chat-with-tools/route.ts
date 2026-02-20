// app/api/ai/chat-with-tools/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAIClient } from '@/utils/ai/client';
import { AI_TOOLS, TOOLS_SYSTEM_PROMPT } from '@/utils/ai/tools';
import { AIMessage } from '@/types/ai';
import { getAIConfigFromRequest } from '@/utils/ai/apiHelpers';

interface ProjectContext {
  projectId: string;
  projectTitle: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    parentId?: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, projectContext, model } = await req.json() as {
      messages: AIMessage[];
      projectContext: ProjectContext;
      model?: string;
    };

    // Obter configuração de IA do usuário via headers
    const aiConfig = getAIConfigFromRequest(req);
    if (aiConfig instanceof NextResponse) {
      return aiConfig; // Retornar erro se não houver configuração
    }

    // Cria client com modelo específico se fornecido
    const client = createAIClient({
      ...aiConfig,
      model: model || aiConfig.model,
    });
    
    // Adiciona contexto do projeto na mensagem do sistema
    const contextInfo = projectContext ? `
[CONTEXTO DO PROJETO]
Projeto: ${projectContext.projectTitle} (ID: ${projectContext.projectId})
Seções atuais: ${projectContext.sections.length}

📋 SEÇÕES EXISTENTES (use os IDs para EDITAR/REMOVER):
${projectContext.sections.map(s => {
  const isRoot = !s.parentId;
  const prefix = isRoot ? '📁' : '  └─';
  return `${prefix} ${s.title} (ID: ${s.id})`;
}).join('\n')}

💡 DICAS:
- Use $[Nome da Seção] para criar referências clicáveis
- Para SUBSECAO, use o nome exato da seção pai
- Para EDITAR/REMOVER, use o ID mostrado acima
- Exemplo de referência: "Este sistema se relaciona com $[Sistema de Combate]"
` : '';

    const enhancedMessages: AIMessage[] = [
      { role: 'system', content: TOOLS_SYSTEM_PROMPT + '\n\n' + contextInfo },
      ...messages.filter(m => m.role !== 'system')
    ];

    // Desabilitado function calling - usando formato JSON na resposta
    const response = await client.chat(enhancedMessages);

    // Resposta sempre como mensagem (sem function calling)
    return NextResponse.json({
      type: 'message',
      message: response.content || 'Desculpe, não consegui processar sua mensagem.',
      meta: {
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed
      }
    });

  } catch (error) {
    console.error('Error in AI chat with tools:', error);
    
    // Extrai mensagem de erro mais detalhada
    const errorMessage = error instanceof Error ? error.message : 'Failed to process AI request';
    
    // Detecta rate limit e retorna mensagem amigável
    if (errorMessage.includes('rate_limit_exceeded') || errorMessage.includes('Rate limit')) {
      // Extrai tempo de espera se disponível
      const timeMatch = errorMessage.match(/Please try again in ([\d\.]+[smh]|\d+m\d+\.?\d*s)/);
      const waitTime = timeMatch ? timeMatch[1] : 'alguns segundos';
      
      // Extrai tipo de limite (TPM ou TPD)
      const isPerMinute = errorMessage.includes('tokens per minute');
      const isPerDay = errorMessage.includes('tokens per day');
      
      let friendlyMessage = '⏱️ Limite de uso da API atingido.';
      
      if (isPerMinute) {
        friendlyMessage += ` Aguarde ${waitTime} e tente novamente. (Limite por minuto)`;
      } else if (isPerDay) {
        friendlyMessage += ` Aguarde ${waitTime} ou troque para outro modelo. (Limite diário)`;
      } else {
        friendlyMessage += ` Aguarde ${waitTime} e tente novamente.`;
      }
      
      return NextResponse.json(
        { 
          error: friendlyMessage,
          errorType: 'rate_limit',
          waitTime: timeMatch ? timeMatch[1] : null,
          limitType: isPerMinute ? 'per_minute' : isPerDay ? 'per_day' : 'unknown'
        },
        { status: 429 }
      );
    }
    
    // Outros erros
    return NextResponse.json(
      { 
        error: '❌ Erro ao processar sua requisição. Tente novamente.',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}
