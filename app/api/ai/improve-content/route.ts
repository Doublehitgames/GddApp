// app/api/ai/improve-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAIClient } from '@/utils/ai/client';
import { AIMessage } from '@/types/ai';
import { getAIConfigFromRequest } from '@/utils/ai/apiHelpers';

interface ImproveContentRequest {
  currentContent: string;
  sectionTitle: string;
  sectionContext: {
    parentTitle?: string;
    subsections?: Array<{ title: string; content?: string }>;
    otherSections?: Array<{ title: string; isEmpty?: boolean; isSubsection?: boolean }>;
  };
  projectTitle: string;
  model?: string;
  additionalRequest?: string; // Feedback do usuário para modificação
}

export async function POST(req: NextRequest) {
  try {
    const { 
      currentContent, 
      sectionTitle, 
      sectionContext,
      projectTitle,
      model,
      additionalRequest
    } = await req.json() as ImproveContentRequest;

    // Obter configuração de IA do usuário via headers
    const aiConfig = getAIConfigFromRequest(req);
    if (aiConfig instanceof NextResponse) {
      return aiConfig; // Retornar erro se não houver configuração
    }

    // Extrai imagens, links e elementos especiais do conteúdo atual
    const preservedElements = extractPreservedElements(currentContent);

    // Cria client com modelo específico (padrão: 8B para economizar tokens)
    const client = createAIClient({
      ...aiConfig,
      model: model || aiConfig.model || 'llama-3.1-8b-instant',
    });

    // Monta contexto rico para a IA
    const contextInfo = buildContextInfo(sectionTitle, sectionContext, projectTitle, preservedElements);

    const systemPrompt = `Você é um assistente especializado em Game Design Documents (GDD).

**TAREFA:** Melhorar o conteúdo de uma seção de GDD, mantendo elementos existentes.

**REGRAS CRÍTICAS:**
1. **PRESERVAR IMAGENS:** Se houver imagens ![alt](url), mantenha-as EXATAMENTE como estão
2. **PRESERVAR LINKS:** Mantenha todos os links [texto](url) existentes
3. **PRESERVAR REFERÊNCIAS:** Mantenha referências $[Seção] existentes
4. **PRESERVAR UPLOADS:** Links começando com /uploads/ devem ser mantidos intactos
5. **REFERÊNCIAS INTELIGENTES:** Quando mencionar um conceito, procure seções relacionadas na lista "TODAS AS SEÇÕES DO GDD" abaixo.
   
   **Como fazer correspondências inteligentes:**
   - Quer falar de "exploração" → Procure seções como: $[Exploração], $[Sistema de Exploração], $[Mecânicas de Exploração]
   - Quer falar de "combate" → Procure: $[Combate], $[Combate Estratégico], $[Sistema de Combate]
   - Quer falar de "música" ou "som" → Procure: $[Áudio/Música], $[Trilha Sonora], $[Áudio]
   - Quer falar de "arte" ou "visual" → Procure: $[Arte e Estética], $[Direção de Arte], $[Visual]
   
   **Regra de ouro:**
   - Se encontrar seção que ABORDA o tema → Use a referência com o nome EXATO da lista
   - Se NÃO encontrar → Escreva normalmente SEM referência
   
   ⚠️ Use o nome EXATO que está na lista, não invente variações!
   ⚠️ Se o tópico não está na lista mas é importante, adicione nas "Sugestões"
   
   Exemplo: "O jogo possui $[Combate Estratégico] dinâmico" (usando nome exato da lista)
6. **NÃO MENCIONAR PRÓPRIAS SUBSEÇÕES:** 🔴 REGRA MAIS CRÍTICA! 
   
   Se a seção tem subseções (veja seção "SUBSEÇÕES DESTA SEÇÃO" no contexto), você está ABSOLUTAMENTE PROIBIDO de mencionar esses tópicos!
   
   Por quê? Porque elas já aparecerão automaticamente logo abaixo no documento!
   
   Exemplo real: Se você está melhorando "Overview" que tem subseções "Gênero e Inspiração" e "Plataformas":
   
   ❌ ERRADO (NÃO FAÇA ISSO):
   "O jogo é um roguelike inspirado na mitologia nórdica. Será lançado em PC e consoles."
   
   ✅ CORRETO:
   "Jogo roguelike que oferece experiência única através do $[Combate Estratégico] e $[Dungeons Procedurais]."
   
   Viu a diferença? Não falou de gênero/inspiração (subseção própria), nem de plataformas (subseção própria). Falou de outras seções usando $[referências]!
7. **SUGERIR NOVAS SUBSEÇÕES:** Se você mencionou tópicos importantes no texto que NÃO estão na lista de seções disponíveis e merecem ser detalhados, sugira criar subseções para eles. Use este formato EXATO (com > antes de CADA linha incluindo a lista):
   > 💡 **Sugestão:** Considere criar subseções para:
   > - Tópico 1: Breve descrição
   > - Tópico 2: Breve descrição
   
   ⚠️ A lista DEVE estar dentro do blockquote (com > antes de cada linha)!
   ⚠️ NÃO sugira criar seções que JÁ EXISTEM na lista de "SEÇÕES DISPONÍVEIS"!
8. **MELHORAR ESTRUTURA:** Organize melhor com títulos, listas, e formatação Markdown
9. **EXPANDIR CONTEÚDO:** Adicione detalhes relevantes baseado no contexto
10. **SER CONCISO:** Não seja prolixo, mantenha foco no essencial

**FORMATO DE SAÍDA:**
- Use Markdown completo (##, ###, listas, **negrito**, etc)
- Adicione exemplos práticos quando relevante
- Use emojis para organização visual (📋, ⚔️, 🎮, etc)
- Mantenha tom profissional mas acessível

🔴 PROIBIDO:
- NÃO adicione títulos como "Melhoria da Seção", "MODIFICAÇÃO", "Edição" etc
- NÃO copie a lista de seções disponíveis para o conteúdo
- NÃO mencione nomes de seções em texto simples

✅ OBRIGATÓRIO - FORMATO DE REFERÊNCIAS:
- SEMPRE que mencionar uma seção da lista, use o formato $[Nome Exato da Lista]
- Exemplos CORRETOS:
  * "influenciada pelo $[Conceito e Pilares]" ✅
  * "através do $[Combate Estratégico]" ✅
  * "inspiração da $[Mitologia Nórdica]" ✅
- Exemplos ERRADOS:
  * "influenciada pelo Conceito e Pilares" ❌
  * "o sistema de combate estratégico" ❌
  * "Gênero e Inspiração" ❌

${contextInfo}`;

    let userPrompt = currentContent.trim() 
      ? `**Conteúdo atual da seção "${sectionTitle}":**\n\n${currentContent}\n\n---\n\nMelhore este conteúdo seguindo as regras acima.\n\n⚠️ LEMBRE-SE: Retorne APENAS o conteúdo melhorado. NÃO inclua nenhuma menção à lista de seções, nenhum texto sobre "TODAS AS SEÇÕES DO GDD", nenhum comentário sobre o processo. Apenas o conteúdo final.`
      : `A seção "${sectionTitle}" está vazia. Crie um conteúdo completo e profissional baseado no contexto fornecido.\n\n⚠️ LEMBRE-SE: Retorne APENAS o conteúdo criado. NÃO inclua nenhuma menção à lista de seções, nenhum texto sobre "TODAS AS SEÇÕES DO GDD", nenhum comentário sobre o processo. Apenas o conteúdo final.`;
    
    // Adiciona solicitação específica do usuário se houver
    if (additionalRequest) {
      userPrompt += `\n\n**📝 SOLICITAÇÃO DO USUÁRIO:**\n${additionalRequest}\n\n⚠️ Aplique esta modificação mantendo todas as regras anteriores (preservar imagens, links, etc).`;
    }

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await client.chat(messages);

    // Valida que elementos preservados ainda estão no conteúdo
    const improvedContent = response.content || currentContent;
    const validation = validatePreservedElements(improvedContent, preservedElements);

    return NextResponse.json({
      improvedContent,
      validation,
      meta: {
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
        elementsPreserved: validation.allPreserved
      }
    });

  } catch (error) {
    console.error('Error improving content:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to improve content';
    
    // Detecta rate limit
    if (errorMessage.includes('rate_limit_exceeded') || errorMessage.includes('Rate limit')) {
      const timeMatch = errorMessage.match(/Please try again in ([\d\.]+[smh]|\\d+m\\d+\\.?\\d*s)/);
      const waitTime = timeMatch ? timeMatch[1] : 'alguns segundos';
      
      return NextResponse.json({
        error: `⏱️ Limite de API atingido. Aguarde ${waitTime} e tente novamente.`,
        errorType: 'rate_limit',
        waitTime: timeMatch ? timeMatch[1] : null
      }, { status: 429 });
    }
    
    return NextResponse.json({
      error: '❌ Erro ao melhorar conteúdo. Tente novamente.',
      details: errorMessage
    }, { status: 500 });
  }
}

/**
 * Extrai elementos que devem ser preservados do conteúdo
 */
function extractPreservedElements(content: string) {
  const images: string[] = [];
  const links: string[] = [];
  const uploads: string[] = [];
  const references: string[] = [];

  if (!content) return { images, links, uploads, references };

  // Extrai imagens: ![alt](url)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = imageRegex.exec(content)) !== null) {
    images.push(match[0]);
    if (match[2].startsWith('/uploads/')) {
      uploads.push(match[2]);
    }
  }

  // Extrai links: [texto](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = linkRegex.exec(content)) !== null) {
    links.push(match[0]);
    if (match[2].startsWith('/uploads/')) {
      uploads.push(match[2]);
    }
  }

  // Extrai referências: $[Section]
  const refRegex = /\$\[([^\]]+)\]/g;
  while ((match = refRegex.exec(content)) !== null) {
    references.push(match[0]);
  }

  return { 
    images: [...new Set(images)], 
    links: [...new Set(links)], 
    uploads: [...new Set(uploads)],
    references: [...new Set(references)]
  };
}

/**
 * Valida se elementos foram preservados no conteúdo melhorado
 */
function validatePreservedElements(improvedContent: string, preserved: ReturnType<typeof extractPreservedElements>) {
  const missing = {
    images: preserved.images.filter(img => !improvedContent.includes(img)),
    links: preserved.links.filter(link => !improvedContent.includes(link)),
    uploads: preserved.uploads.filter(upload => !improvedContent.includes(upload)),
    references: preserved.references.filter(ref => !improvedContent.includes(ref))
  };

  const allPreserved = 
    missing.images.length === 0 && 
    missing.links.length === 0 && 
    missing.uploads.length === 0;

  return {
    allPreserved,
    missing,
    warning: !allPreserved ? 'Alguns elementos podem ter sido removidos' : null
  };
}

/**
 * Constrói informações de contexto para a IA
 */
function buildContextInfo(
  sectionTitle: string, 
  context: ImproveContentRequest['sectionContext'],
  projectTitle: string,
  preserved: ReturnType<typeof extractPreservedElements>
) {
  let info = `\n**CONTEXTO DO GDD:**\n`;
  info += `- Projeto: "${projectTitle}"\n`;
  info += `- Seção: "${sectionTitle}"\n`;
  
  if (context.parentTitle) {
    info += `- Seção pai: "${context.parentTitle}"\n`;
  }
  
  if (context.subsections && context.subsections.length > 0) {
    info += `\n🔴 SUBSEÇÕES DESTA SEÇÃO (NÃO mencione esses tópicos!):\n`;
    context.subsections.forEach(s => {
      info += `  - "${s.title}"\n`;
    });
    info += `\n⚠️ IMPORTANTE: NÃO escreva sobre esses tópicos na descrição!\n`;
    info += `⚠️ Eles já aparecerão automaticamente como subseções no documento!\n`;
    info += `⚠️ Foque em aspectos gerais que NÃO estão cobertos pelas subseções!\n`;
  }
  
  if (context.otherSections && context.otherSections.length > 0) {
    info += `\n[CONTEXTO INTERNO - NÃO INCLUIR NO OUTPUT]\n`;
    info += `\nSeções disponíveis para referência:\n`;
    context.otherSections.forEach(s => {
      const prefix = s.isSubsection ? '  └─ ' : '- ';
      const status = s.isEmpty ? ' [VAZIA]' : '';
      info += `${prefix}$[${s.title}]${status}\n`;
    });
    info += `\nComo usar:\n`;
    info += `- Esta lista é APENAS para você consultar - NÃO copie para o output\n`;
    info += `- Quando mencionar um tópico, procure seção relacionada na lista\n`;
    info += `- Se encontrar, use $[Nome Exato] em vez de **negrito**\n`;
    info += `- Se não encontrar, escreva normalmente sem referência\n`;
    info += `- Exemplo: "através do $[Combate Estratégico]" (não "através do **Combate Estratégico**")\n`;
    info += `\n[FIM DO CONTEXTO INTERNO]\n`;
  }

  if (preserved.images.length > 0 || preserved.links.length > 0 || preserved.uploads.length > 0) {
    info += `\n**⚠️ ELEMENTOS A PRESERVAR:**\n`;
    if (preserved.images.length > 0) {
      info += `- ${preserved.images.length} imagem(ns)\n`;
    }
    if (preserved.links.length > 0) {
      info += `- ${preserved.links.length} link(s)\n`;
    }
    if (preserved.uploads.length > 0) {
      info += `- ${preserved.uploads.length} arquivo(s) enviado(s)\n`;
    }
    info += `\n**IMPORTANTE:** Mantenha TODOS esses elementos no conteúdo melhorado!\n`;
  }

  return info;
}
