// app/api/ai/generate-template/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAIClient } from '@/utils/ai/client';
import { generateTemplatePrompt, SYSTEM_PROMPT } from '@/utils/ai/prompts';
import { GDDTemplateRequest, GDDTemplate } from '@/types/ai';
import { getAIConfigFromRequest } from '@/utils/ai/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const body: GDDTemplateRequest = await request.json();

    if (!body.gameType || !body.description) {
      return NextResponse.json(
        { error: 'gameType and description are required' },
        { status: 400 }
      );
    }

    // Obter configuração de IA do usuário via headers
    const aiConfig = getAIConfigFromRequest(request);
    if (aiConfig instanceof NextResponse) {
      return aiConfig; // Retornar erro se não houver configuração
    }

    const aiClient = createAIClient({
      ...aiConfig,
      model: body.model || aiConfig.model,
    });
    
    const response = await aiClient.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: generateTemplatePrompt(body) }
    ], {
      temperature: 0.7,
      maxTokens: 4000,
    });

    // Parse JSON response
    let template: GDDTemplate;
    try {
      // Remove markdown code blocks if present
      const cleanContent = response.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      template = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', response.content);
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: response.content },
        { status: 500 }
      );
    }

    return NextResponse.json({
      template,
      meta: {
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
      }
    });

  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
