// app/api/ai/improve-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAIClient } from '@/utils/ai/client';
import { AIMessage } from '@/types/ai';
import { getAIConfigFromRequest } from '@/utils/ai/apiHelpers';
import {
  buildSectionContextBlock,
  getPageTypeWritingGuidance,
  type PromptAddonSummary,
} from '@/utils/ai/contextBuilders';

interface ImproveContentRequest {
  currentContent: string;
  sectionTitle: string;
  sectionContext: {
    parentTitle?: string;
    /** Caminho completo da seção (ex.: ["Áudio", "Música", "Composição", "Mitologia Nórdica"]) */
    breadcrumb?: string[];
    /** Conteúdo/resumo da seção pai para a IA entender o tema do ramo */
    parentContent?: string;
    subsections?: Array<{ title: string; content?: string; pageTypeId?: string }>;
    otherSections?: Array<{ title: string; isEmpty?: boolean; isSubsection?: boolean }>;
    /** Page type da seção atual (se tipada). Permite ao prompt respeitar a estrutura. */
    pageTypeId?: string;
    /** Resumo dos addons já configurados na seção (tipo + nome). Evita que a IA duplique dados estruturados. */
    addons?: PromptAddonSummary[];
    /** Descrição curta do projeto (para contexto temático). */
    projectDescription?: string;
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

    const contextInfo = buildContextInfo(sectionContext, preservedElements);

    const sectionContextBlock = buildSectionContextBlock({
      sectionTitle,
      pageTypeId: sectionContext.pageTypeId,
      addons: sectionContext.addons,
      breadcrumb: sectionContext.breadcrumb,
      parentTitle: sectionContext.parentTitle,
      parentContent: sectionContext.parentContent,
      subsections: sectionContext.subsections?.map(s => ({ title: s.title, pageTypeId: s.pageTypeId })),
      projectTitle,
      projectDescription: sectionContext.projectDescription,
    });

    const pageTypeGuidance = getPageTypeWritingGuidance(sectionContext.pageTypeId);

    const systemPrompt = `Você é um assistente especializado em Game Design Documents (GDD).

**TAREFA:** Melhorar o conteúdo narrativo de uma seção de GDD, respeitando os dados estruturados (addons) e elementos existentes.

${sectionContextBlock}

${pageTypeGuidance ? `\n${pageTypeGuidance}\n` : ""}
**🔴 MENTALIDADE GDD – ESTRUTURA E USABILIDADE:** Ao escrever ou melhorar o conteúdo, avalie sempre como um GDD de verdade: será que o que estou citando faria sentido ter uma página própria? O usuário precisa encontrar e gerenciar esse tópico no documento? Se um conceito, sistema, item, inimigo, local ou mecânica for relevante o suficiente para alguém querer abrir, editar ou navegar até uma seção dedicada, use $[Nome] — assim a estrutura do documento fica clara e o conteúdo fica fácil de localizar e gerenciar. Pense na usabilidade: referências bem usadas tornam o GDD navegável e organizado.

**REGRAS CRÍTICAS:**
1. **PRESERVAR IMAGENS:** Se houver imagens ![alt](url), mantenha-as EXATAMENTE como estão
2. **PRESERVAR LINKS:** Mantenha todos os links [texto](url) existentes
3. **PRESERVAR REFERÊNCIAS:** Mantenha referências $[Seção] existentes
4. **PRESERVAR UPLOADS:** Links começando com /uploads/ devem ser mantidos intactos
5. **🔴 REFERÊNCIAS OBRIGATÓRIAS:** Use $[Nome] para (1) seções que já existem na lista e (2) para QUALQUER conceito que mereça página própria no GDD — pensando na estrutura do documento e na usabilidade (encontrar e gerenciar conteúdo). O app mostra "referências inexistentes" e o usuário pode criar a seção com um clique.
   
   **Critério:** Antes de citar algo, pergunte: "Faz sentido esse tópico ter uma seção própria para o usuário encontrar e gerenciar?" Se sim → $[Nome].
   
   **Regra 1 – Temas/sistemas:** Combate, dungeons, exploração, loot, áudio, etc. → sempre $[Nome da Seção] (da lista ou novo).
   
   **Regra 2 – Itens, armas, poções, habilidades, inimigos, locais:** Ao citar ou listar algo com nome próprio, use $[Nome]. Isso mantém o GDD estruturado e cada tópico gerenciável em sua própria página.
   
   **Exemplos obrigatórios:**
   - "durante a exploração dos dungeons procedurais" → "durante a exploração dos $[Dungeons Procedurais]"
   - "útil em combate" → "útil no $[Combate Estratégico]"
   - Lista de itens: ❌ "Espada de Fogo: uma espada..." → ✅ "$[Espada de Fogo]: uma espada..."
   - ❌ "Armadura de Escudo" e "Potions de Saúde" em texto → ✅ "$[Armadura de Escudo]" e "$[Poção de Saúde]" (ou $[Potions de Saúde])
   - Qualquer item, arma, poção, habilidade, inimigo ou local com nome próprio → $[Nome]
   
   ⚠️ Única exceção: O NOME DO PROJETO não é seção — NUNCA use $[Nome do Projeto]. Para falar do "jogo" ou "projeto" em geral, use texto normal.
6. **NÃO MENCIONAR PRÓPRIAS SUBSEÇÕES:** 🔴 REGRA MAIS CRÍTICA! 
   
   Se a seção tem subseções (veja seção "SUBSEÇÕES DESTA SEÇÃO" no contexto), você está ABSOLUTAMENTE PROIBIDO de mencionar esses tópicos!
   
   Por quê? Porque elas já aparecerão automaticamente logo abaixo no documento!
   
   Exemplo real: Se você está melhorando "Overview" que tem subseções "Gênero e Inspiração" e "Plataformas":
   
   ❌ ERRADO (NÃO FAÇA ISSO):
   "O jogo é um roguelike inspirado na mitologia nórdica. Será lançado em PC e consoles."
   
   ✅ CORRETO:
   "Jogo roguelike que oferece experiência única através do $[Combate Estratégico] e $[Dungeons Procedurais]."
   
   Viu a diferença? Não falou de gênero/inspiração (subseção própria), nem de plataformas (subseção própria). Falou de outras seções usando $[referências]!
7. **MELHORAR ESTRUTURA:** Organize melhor com títulos, listas, e formatação Markdown
8. **EXPANDIR CONTEÚDO:** Adicione detalhes relevantes baseado no contexto
9. **SER CONCISO:** Não seja prolixo, mantenha foco no essencial
10. **🔴 HIERARQUIA E ESCOPO:** O conteúdo deve ser escrito **no escopo do ramo** em que a seção está.
   - Use o "CAMINHO DA SEÇÃO" (breadcrumb) no contexto: ele mostra onde a seção está no documento (ex.: Áudio > Música > Composição > Mitologia Nórdica).
   - A seção atual é uma **subseção** do último nível anterior. O conteúdo deve tratar do **tema do título da seção aplicado ao contexto do pai**, não um texto genérico sobre o tema.
   - Exemplo: se o caminho é "Áudio > Música > Composição > Mitologia Nórdica", escreva sobre **como a mitologia nórdica é usada na composição musical do jogo** (inspiração, instrumentos, atmosfera), NÃO um texto geral sobre mitologia nórdica.
   - Outro exemplo: se o caminho é "Gameplay > Combate > Armas > Espadas", escreva sobre **espadas no combate do jogo**, não uma enciclopédia sobre espadas em geral.

**FORMATO DE SAÍDA:**
- Use Markdown completo (##, ###, listas, **negrito**, etc)
- Adicione exemplos práticos quando relevante
- Use emojis para organização visual (📋, ⚔️, 🎮, etc)
- Mantenha tom profissional mas acessível
- **OBRIGATÓRIO:** (1) Sistemas/temas (combate, loot, áudio…) → $[Nome]. (2) Itens, armas, poções, habilidades, inimigos e locais com nome próprio → $[Nome]. Não deixe listas de itens ou conceitos nomeados em texto solto.

🔴 PROIBIDO:
- NÃO adicione títulos como "Melhoria da Seção", "MODIFICAÇÃO", "Edição" etc
- NÃO copie a lista de seções disponíveis para o conteúdo
- NÃO cite "Espada de Fogo", "Armadura de X", "Poção de Y" etc. em texto simples — use $[Espada de Fogo], $[Armadura de X], $[Poção de Y]

✅ REFERÊNCIAS (obrigatório):
- Sistemas: "no $[Sistema de Loot]", "exploração dos $[Dungeons Procedurais]"
- Itens/conceitos nomeados: "$[Espada de Fogo]: uma espada...", "$[Armadura de Escudo]", "$[Poção de Saúde]"
❌ Listar itens ou conceitos com nome próprio sem $[Nome]

**ANTES DE RETORNAR:** Revise o texto. Toda menção a "dungeons procedurais", "combate", "loot", e a qualquer item ou conceito com nome próprio (Espada de Fogo, Poção de Saúde, etc.) deve estar no formato $[Nome]. Se estiver em texto solto, substitua por $[Nome].

${contextInfo}`;

    const referenceReminder = `\n\n🔴 OBRIGATÓRIO – REFERÊNCIAS: Ao escrever, use $[Nome] para TODOS os conceitos que merecem página no GDD. Exemplos: "dungeons procedurais" → $[Dungeons Procedurais]; "Espada de Fogo" → $[Espada de Fogo]; "Poção de Saúde" → $[Poção de Saúde]; "combate" → $[Combate] (ou nome exato da seção). Itens em listas (Espada de Fogo, Armadura de Escudo, etc.) DEVEM ser $[Nome]. Não entregue texto com esses termos em texto solto.`;

    let userPrompt = currentContent.trim() 
      ? `**Conteúdo atual da seção "${sectionTitle}":**\n\n${currentContent}\n\n---\n\nMelhore este conteúdo seguindo as regras acima.${referenceReminder}\n\n⚠️ Retorne APENAS o conteúdo melhorado (Markdown), sem comentários.`
      : `A seção "${sectionTitle}" está vazia. Crie um conteúdo completo e profissional baseado no contexto fornecido.${referenceReminder}\n\n⚠️ Retorne APENAS o conteúdo criado (Markdown), sem comentários.`;
    
    // Adiciona solicitação específica do usuário se houver
    if (additionalRequest) {
      userPrompt += `\n\n**📝 SOLICITAÇÃO DO USUÁRIO:**\n${additionalRequest}\n\n⚠️ Aplique esta modificação mantendo todas as regras anteriores (preservar imagens, links, etc).`;
      const lower = additionalRequest.toLowerCase();
      if (/\brefer[eê]ncias?\b|\brefer[eê]nciar\b|\blinks?\b|\b\$\[|\bcriar refer|adicionar refer|colocar refer|usar refer/i.test(lower)) {
        userPrompt += `\n\n🔴 O usuário pediu referências: substitua no texto todas as menções a sistemas, mecânicas e temas (combate, dungeons, loot, exploração, áudio, etc.) pelo formato $[Nome da Seção], usando os nomes exatos da lista "TODAS AS SEÇÕES DO GDD" quando existirem, ou $[Nome do Tópico] para conceitos que mereçam seção.`;
      }
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
    const normalizedError = errorMessage.toLowerCase();

    // Detecta chave de API inválida para orientar correção no cliente
    if (
      normalizedError.includes('invalid_api_key') ||
      normalizedError.includes('invalid api key') ||
      normalizedError.includes('unauthorized') ||
      normalizedError.includes('401')
    ) {
      return NextResponse.json({
        error: '🔑 Chave de API inválida. Abra Configurações de IA e atualize sua chave.',
        errorType: 'invalid_api_key',
      }, { status: 401 });
    }
    
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

function buildContextInfo(
  context: ImproveContentRequest['sectionContext'],
  preserved: ReturnType<typeof extractPreservedElements>
) {
  let info = "";

  if (context.otherSections && context.otherSections.length > 0) {
    info += `\n[CONTEXTO INTERNO - NÃO INCLUIR NO OUTPUT]\n`;
    info += `\nSeções disponíveis para referência (use $[Nome Exato] quando citar):\n`;
    context.otherSections.forEach(s => {
      const prefix = s.isSubsection ? '  └─ ' : '- ';
      const status = s.isEmpty ? ' [VAZIA]' : '';
      info += `${prefix}$[${s.title}]${status}\n`;
    });
    info += `\n- Esta lista é APENAS para consulta — NÃO copie para o output\n`;
    info += `- Quando encontrar correspondência, use $[Nome Exato] em vez de **negrito**\n`;
    info += `- Se não encontrar, escreva normalmente sem referência\n`;
    info += `\n[FIM DO CONTEXTO INTERNO]\n`;
  }

  if (preserved.images.length > 0 || preserved.links.length > 0 || preserved.uploads.length > 0) {
    info += `\n**⚠️ ELEMENTOS A PRESERVAR:**\n`;
    if (preserved.images.length > 0) info += `- ${preserved.images.length} imagem(ns)\n`;
    if (preserved.links.length > 0) info += `- ${preserved.links.length} link(s)\n`;
    if (preserved.uploads.length > 0) info += `- ${preserved.uploads.length} arquivo(s) enviado(s)\n`;
    info += `\n**IMPORTANTE:** Mantenha TODOS esses elementos no conteúdo melhorado!\n`;
  }

  return info;
}
