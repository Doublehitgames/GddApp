// app/api/ai/chat-with-tools/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAIClient } from '@/utils/ai/client';
import { AI_TOOLS, TOOLS_SYSTEM_PROMPT } from '@/utils/ai/tools';
import { AIMessage } from '@/types/ai';
import { getAIConfigFromRequest } from '@/utils/ai/apiHelpers';
import { assessThematicRelevance } from '@/utils/ai/thematicGuardrails';

interface ProjectContext {
  projectId: string;
  projectTitle: string;
  projectDescription?: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    parentId?: string;
    domainTags?: string[];
    addonTypes?: string[];
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
Descrição: ${projectContext.projectDescription?.trim() || "Sem descrição informada."}
Seções atuais: ${projectContext.sections.length}

📋 SEÇÕES EXISTENTES (use os IDs para EDITAR/REMOVER). Entre colchetes: tags de sistema (economy, progression, crafting, items, world, narrative, etc.):
${projectContext.sections.map(s => {
  const isRoot = !s.parentId;
  const prefix = isRoot ? '📁' : '  └─';
  const tags = s.domainTags?.length ? ` [${s.domainTags.join(', ')}]` : '';
  const addons = s.addonTypes?.length ? ` {addons: ${s.addonTypes.join(', ')}}` : '';
  return `${prefix} ${s.title} (ID: ${s.id})${tags}${addons}`;
}).join('\n')}

💡 DICAS:
- Use $[Nome da Seção] para criar referências clicáveis
- Para SUBSECAO, use o nome exato da seção pai
- Para EDITAR/REMOVER, use o ID mostrado acima
- Exemplo de referência: "Este sistema se relaciona com $[Economia da Fazenda]"
- Só proponha sistemas aderentes ao tema descrito no projeto
- Se sugerir algo fora do núcleo, explique claramente a conexão com a descrição do jogo
- Quando criar entidades de gameplay, avalie addons por domínio (inventory, economyLink, production, xpBalance/progressionTable, currency, globalVariable)
- Não crie item/moeda/pet na raiz se já existir contêiner adequado (Itens, Economia, Moedas, Produção etc.)
- Se faltar dado para configurar addon com segurança, faça perguntas curtas antes de emitir [EXECUTAR]
- Pré-requisitos comuns:
  - economyLink compra/venda -> referência de moeda (seção com addon currency)
  - production recipe/passive -> referências para itens com addon inventory
  - unlock por nível -> referência para seção com addon xpBalance
` : '';

    const enhancedMessages: AIMessage[] = [
      { role: 'system', content: TOOLS_SYSTEM_PROMPT + '\n\n' + contextInfo },
      ...messages.filter(m => m.role !== 'system')
    ];

    // Desabilitado function calling - usando formato JSON na resposta
    const response = await client.chat(enhancedMessages);
    let finalContent = response.content || 'Desculpe, não consegui processar sua mensagem.';

    const relevance = assessThematicRelevance(finalContent, {
      projectTitle: projectContext?.projectTitle,
      projectDescription: projectContext?.projectDescription,
      sections: projectContext?.sections,
    });

    if (projectContext && relevance.needsReview) {
      const rewriteMessages: AIMessage[] = [
        ...enhancedMessages,
        { role: 'assistant', content: finalContent },
        {
          role: 'user',
          content:
            'Reescreva sua resposta para ficar mais aderente ao tema do projeto. Evite sistemas fora de contexto; se citar algo fora do núcleo, justifique explicitamente o vínculo com a descrição do jogo. Preserve o formato de comandos [EXECUTAR] quando necessário.',
        },
      ];

      const rewriteResponse = await client.chat(rewriteMessages, { temperature: 0.2, maxTokens: 1800 });
      finalContent = rewriteResponse.content || finalContent;
    }

    const finalRelevance = assessThematicRelevance(finalContent, {
      projectTitle: projectContext?.projectTitle,
      projectDescription: projectContext?.projectDescription,
      sections: projectContext?.sections,
    });

    // Resposta sempre como mensagem (sem function calling)
    return NextResponse.json({
      type: 'message',
      message: finalContent,
      meta: {
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
        thematicRelevance: finalRelevance,
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
