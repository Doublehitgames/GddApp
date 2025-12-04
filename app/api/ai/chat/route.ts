// app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAIClient } from '@/utils/ai/client';
import { generateChatWithContextPrompt, SYSTEM_PROMPT } from '@/utils/ai/prompts';
import { ChatRequest } from '@/types/ai';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();

    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      );
    }

    const aiClient = createAIClient();
    
    // Get the last user message
    const lastUserMessage = body.messages.findLast(m => m.role === 'user');
    
    if (!lastUserMessage) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 }
      );
    }

    // Enhance the last message with context if available
    const enhancedMessage = body.projectContext
      ? generateChatWithContextPrompt(lastUserMessage.content, body.projectContext)
      : lastUserMessage.content;

    // Replace the last user message with the enhanced one
    const enhancedMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...body.messages.slice(0, -1),
      { role: 'user' as const, content: enhancedMessage }
    ];

    const response = await aiClient.chat(enhancedMessages, {
      temperature: 0.7,
      maxTokens: 3000,
    });

    return NextResponse.json({
      message: response.content,
      meta: {
        provider: response.provider,
        model: response.model,
        tokensUsed: response.tokensUsed,
      }
    });

  } catch (error) {
    console.error('❌ Error in chat API:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      raw: error
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to process chat',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
