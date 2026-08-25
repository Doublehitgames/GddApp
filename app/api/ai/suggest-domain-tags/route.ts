// app/api/ai/suggest-domain-tags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAIClient } from "@/utils/ai/client";
import { getAIConfigFromRequest } from "@/utils/ai/apiHelpers";
import { normalizeDomainTags } from "@/lib/gameDesignDomains";
import { DOMAINS_PROMPT_BLOCK } from "@/utils/ai/gddVocabulary";

interface SuggestDomainTagsRequest {
  projectTitle?: string;
  projectDescription?: string;
  sectionTitle: string;
  sectionContent?: string;
  existingTags?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SuggestDomainTagsRequest;
    const { projectTitle, projectDescription, sectionTitle, sectionContent = "", existingTags } = body;

    if (!sectionTitle?.trim()) {
      return NextResponse.json({ error: "sectionTitle is required" }, { status: 400 });
    }

    const aiConfig = getAIConfigFromRequest(req);
    if (aiConfig instanceof NextResponse) return aiConfig;

    const client = createAIClient({
      ...aiConfig,
      model: aiConfig.model || "llama-3.1-8b-instant",
    });

    const contentSnippet = sectionContent.trim().slice(0, 1500);
    const existingHint = existingTags?.length
      ? `Tags atuais desta seção: ${existingTags.join(", ")}. Você pode sugerir manter, ajustar ou adicionar.`
      : "";

    const systemPrompt = `Você é um assistente para Game Design Documents (GDD). Sua tarefa é classificar uma seção em DOMÍNIOS de game design.

${DOMAINS_PROMPT_BLOCK}

**REGRA:** Responda APENAS com um JSON válido, sem markdown, sem explicação:
{"tags": ["id1", "id2"]}

- "tags" = array de 1 a 4 domínios mais relevantes (ordem por relevância)
- Priorize tags alinhadas ao tema do projeto descrito`;

    const userPrompt = `Classifique esta seção do GDD.

**Projeto:** ${projectTitle?.trim() || "GDD"}
**Descrição do projeto:** ${projectDescription?.trim() || "Sem descrição informada."}

**Título da seção:** ${sectionTitle.trim()}
${contentSnippet ? `**Trecho do conteúdo:**\n${contentSnippet}` : "(conteúdo vazio)"}
${existingHint}

Responda só com o JSON: {"tags": ["...", "..."]}`;

    const response = await client.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 200 }
    );

    const raw = (response.content || "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    let data: { tags?: string[] };
    try {
      data = JSON.parse(jsonStr) as { tags?: string[] };
    } catch {
      return NextResponse.json(
        { error: "Resposta da IA inválida", raw: raw.slice(0, 300) },
        { status: 502 }
      );
    }

    const tags = Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim().toLowerCase()) : [];
    const suggestedTags = normalizeDomainTags(tags);

    return NextResponse.json({ suggestedTags });
  } catch (error) {
    console.error("suggest-domain-tags error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sugerir domínios" },
      { status: 500 }
    );
  }
}
