import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { createAIClient } from '@/utils/ai/client';
import { getAIConfigFromRequest } from '@/utils/ai/apiHelpers';

// Interface para a estrutura de seção retornada pela IA
interface ImportedSection {
  title: string;
  content: string;
  subsections?: ImportedSection[];
}

interface ImportedProject {
  title: string;
  description: string;
  sections: ImportedSection[];
}

// Função para extrair texto de diferentes formatos
async function extractText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = Buffer.from(buffer);

  // PDF - usando import dinâmico para evitar problemas de ESM
  if (file.type === 'application/pdf') {
    try {
      // @ts-ignore - pdf-parse tem problemas com tipos em ESM/Next.js
      const pdfModule: any = await import('pdf-parse');
      const pdfParse = pdfModule.default || pdfModule;
      const data = await pdfParse(bytes);
      return data.text;
    } catch (error) {
      throw new Error('Erro ao processar PDF. Tente exportar como .txt ou .docx');
    }
  }

  // Word/DOCX (formato que Google Docs exporta)
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.name.endsWith('.docx')) {
    try {
      const result = await mammoth.extractRawText({ buffer: bytes });
      if (!result.value || result.value.trim().length === 0) {
        throw new Error('O arquivo .docx está vazio ou não contém texto extraível');
      }
      return result.value;
    } catch (error) {
      console.error('Erro ao processar DOCX:', error);
      throw new Error(`Erro ao processar arquivo .docx: ${error instanceof Error ? error.message : 'erro desconhecido'}. Tente salvar o documento novamente ou exportar como .txt`);
    }
  }

  // Texto plano (TXT, Markdown)
  if (file.type === 'text/plain' || file.type === 'text/markdown' || 
      file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    return bytes.toString('utf-8');
  }

  throw new Error('Formato de arquivo não suportado. Use .docx, .txt ou .md');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('document') as File;
    const additionalRequest = formData.get('additionalRequest') as string | null;
    const creativityLevel = formData.get('creativityLevel') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo fornecido' }, { status: 400 });
    }

    // Extrair texto do documento
    let documentText: string;
    try {
      documentText = await extractText(file);
    } catch (error) {
      return NextResponse.json({ 
        error: error instanceof Error ? error.message : 'Erro ao processar documento'
      }, { status: 400 });
    }

    if (!documentText || documentText.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Documento vazio ou não foi possível extrair texto' 
      }, { status: 400 });
    }

    // Limitar tamanho do texto (para não exceder limite da API)
    const maxChars = 50000;
    if (documentText.length > maxChars) {
      documentText = documentText.substring(0, maxChars) + '\n\n[...documento truncado devido ao tamanho]';
    }

    // Prompt para a IA analisar e estruturar o documento
    const systemPrompt = `Você é um assistente especializado em TRANSCRIÇÃO E ORGANIZAÇÃO de documentos de Game Design Documents (GDD).

🔴🔴🔴 REGRA ABSOLUTA: NÃO RESUMA NADA! 🔴🔴🔴

Sua ÚNICA tarefa é:
1. Ler o documento completo
2. Identificar seções e subseções baseadas nos títulos/subtítulos do documento original
3. COPIAR TODO O CONTEÚDO de cada seção para a estrutura JSON
4. Manter TODOS os parágrafos, exemplos, nomes, números, listas - tudo mesmo!

Você NÃO é um resumidor. Você é um ORGANIZADOR que mantém 100% do conteúdo original.

INSTRUÇÕES PASSO A PASSO:

1. **Identificar títulos**: O documento tem títulos como "4. Personagens e Narrativa", "4.1 NPCs", "6. Economia", "6.1 Quitandinha", etc.

2. **Criar estrutura**: 
   - Título numerado (4, 6, 7) = seção principal
   - Subtítulo numerado (4.1, 6.1, 6.2) = subseção
   - Se não houver numeração, agrupe por contexto

3. **COPIAR conteúdo na ÍNTEGRA**:
   - TODOS os parágrafos abaixo do título vão para a seção/subseção
   - Se o documento tem 5 parágrafos sobre "Quitandinha", COPIE OS 5 PARÁGRAFOS
   - Se menciona "Estoque Limitado" em 6.2, crie subseção e COPIE TODO o texto de 6.2
   - NÃO pule seções. Se vê "7.1 Conquistas", "8. GUILDAS", "9. Eventos Globais" - TODOS entram!

4. **Título do projeto**: Use o título do documento ou crie baseado no conteúdo

5. **Descrição**: Apenas isso pode ser um resumo (2-3 frases)

6. **FORMATO JSON**: Retorne APENAS JSON seguindo esta estrutura:

\`\`\`json
{
  "title": "Nome do Projeto",
  "description": "Breve descrição do projeto",
  "sections": [
    {
      "title": "Nome da Seção",
      "content": "Conteúdo da seção em markdown (pode ser resumo se tiver subseções)",
      "subsections": [
        {
          "title": "Nome da Subseção",
          "content": "TODO o conteúdo detalhado do documento original aqui!"
        }
      ]
    }
  ]
}
\`\`\`

7. **Markdown**: Use formatação básica quando copiar o conteúdo:
   - Mantenha parágrafos separados por linha em branco
   - Use **negrito** para termos importantes
   - Use listas com - quando apropriado
   - NÃO use # pois o título já vem do campo "title"

❌ EXEMPLOS DO QUE NÃO FAZER:
- "A Quitandinha permite comércio entre jogadores" ← ERRADO! Isso é resumo!
- Pular seções como "Conquistas", "Guildas", "Eventos Globais" ← ERRADO! Inclua todas!

✅ EXEMPLO DO QUE FAZER:
- "A Quitandinha é um mercado global onde jogadores podem expor e vender suas produções para outros. Cada jogador monta sua lojinha de fazenda: produtos agrícolas ou artesanais à venda em determinada quantidade e preço..." ← CORRETO! Todo o conteúdo original!

IMPORTANTE: Retorne APENAS o JSON, sem explicações adicionais. COPIE todo o conteúdo, não invente nem resuma.`;

    // Construir user prompt baseado em se há modificação ou não
    let userPrompt: string;
    
    if (additionalRequest && creativityLevel) {
      // Há uma solicitação de modificação com nível de criatividade
      let creativityInstruction = '';
      
      switch (creativityLevel) {
        case 'faithful':
          creativityInstruction = '🔵 MODO FIEL: Mantenha o máximo do conteúdo original. Apenas faça os ajustes mínimos necessários para atender a solicitação.';
          break;
        case 'balanced':
          creativityInstruction = '🟣 MODO BALANCEADO: Você pode fazer ajustes moderados mantendo o espírito do documento original.';
          break;
        case 'creative':
          creativityInstruction = '🌟 MODO CRIATIVO: Você tem liberdade para expandir, criar novos conteúdos e reorganizar conforme necessário. Seja criativo!';
          break;
      }
      
      userPrompt = `Documento base:\n\n${documentText}\n\nSOLICITAÇÃO DO USUÁRIO: ${additionalRequest}\n\n${creativityInstruction}\n\nRetorne o JSON completo com as modificações aplicadas.`;
    } else if (additionalRequest) {
      // Há solicitação mas sem nível específico (usar balanceado)
      userPrompt = `Documento a transcrever:\n\n${documentText}\n\nRequisito do usuário: ${additionalRequest}\n\n🔴 ATENÇÃO: Você DEVE incluir TODAS as seções que encontrar. NÃO pule nenhuma! Copie TODO o texto de cada seção!\n\nRetorne o JSON completo.`;
    } else {
      // Primeira importação - máxima fidelidade
      userPrompt = `Documento a transcrever:\n\n${documentText}\n\n🔴 ATENÇÃO: Você DEVE incluir TODAS as seções que encontrar (Quitandinha, Estoque Limitado, Conquistas, Guildas, Eventos Globais, etc). NÃO pule nenhuma! Copie TODO o texto de cada seção!\n\nRetorne o JSON completo.`;
    }

    // Determinar temperatura baseada no nível de criatividade
    let temperature = 0.3; // Padrão: fiel ao documento
    
    if (creativityLevel && additionalRequest) {
      // Níveis de criatividade (apenas para modificações)
      switch (creativityLevel) {
        case 'faithful':
          temperature = 0.2; // Muito fiel, quase sem variação
          break;
        case 'balanced':
          temperature = 0.5; // Balanceado
          break;
        case 'creative':
          temperature = 0.8; // Mais criativo e livre
          break;
      }
    }

    // Obter configuração de IA do usuário via headers
    const aiConfig = getAIConfigFromRequest(req);
    if (aiConfig instanceof NextResponse) {
      return aiConfig; // Retornar erro se não houver configuração
    }

    // Chamar API da IA usando nosso AIClient
    const aiClient = createAIClient({ 
      ...aiConfig,
      model: 'llama-3.3-70b-versatile' 
    });
    const aiResponse = await aiClient.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      temperature,
      maxTokens: 8000, // Permitir respostas mais detalhadas
    });

    const responseText = aiResponse.content || '';
    
    // Extrair JSON da resposta (a IA pode envolver em ```json ... ```)
    let jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonStr = jsonMatch ? jsonMatch[1] : responseText;
    
    // Tentar parsear JSON
    let projectData: ImportedProject;
    try {
      projectData = JSON.parse(jsonStr.trim());
    } catch (e) {
      // Se falhar, tentar remover markdown ou outras formatações
      jsonStr = jsonStr.replace(/```\w*\n?/g, '').trim();
      try {
        projectData = JSON.parse(jsonStr);
      } catch (e2) {
        return NextResponse.json({ 
          error: 'A IA não retornou um JSON válido. Tente novamente.',
          aiResponse // Retorna resposta para debug
        }, { status: 500 });
      }
    }

    // Validar estrutura básica
    if (!projectData.title || !projectData.sections || !Array.isArray(projectData.sections)) {
      return NextResponse.json({ 
        error: 'Estrutura de projeto inválida retornada pela IA' 
      }, { status: 500 });
    }

    return NextResponse.json(projectData);

  } catch (error) {
    console.error('Error importing project:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Detectar erro de rate limit da Groq
    const errorMessage = error instanceof Error ? error.message : 'Erro ao importar projeto';
    
    if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      return NextResponse.json({ 
        error: '⏱️ Limite de tokens atingido! Aguarde 1 minuto e tente novamente.',
        type: 'rate_limit'
      }, { status: 429 });
    }
    
    if (errorMessage.includes('API error: 400')) {
      return NextResponse.json({ 
        error: '⚠️ Erro na API. Verifique sua chave ou tente novamente em alguns segundos.',
        type: 'api_error'
      }, { status: 400 });
    }
    
    // Erro de parsing de JSON
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      return NextResponse.json({ 
        error: '❌ Erro ao processar resposta da IA. O documento pode ser muito complexo. Tente um arquivo menor ou mais simples.',
        type: 'json_parse_error',
        details: errorMessage
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
