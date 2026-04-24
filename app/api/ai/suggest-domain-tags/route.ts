// app/api/ai/suggest-domain-tags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAIClient } from "@/utils/ai/client";
import { getAIConfigFromRequest } from "@/utils/ai/apiHelpers";
import { normalizeDomainTags } from "@/lib/gameDesignDomains";
import {
  DOMAINS_PROMPT_BLOCK,
  PAGE_TYPES_COMPACT_BLOCK,
  VALID_PAGE_TYPE_IDS,
} from "@/utils/ai/gddVocabulary";

interface SuggestDomainTagsRequest {
  projectTitle?: string;
  projectDescription?: string;
  sectionTitle: string;
  sectionContent?: string;
  existingTags?: string[];
  currentPageTypeId?: string;
}

const VALID_PAGE_TYPE_SET = new Set<string>(VALID_PAGE_TYPE_IDS);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SuggestDomainTagsRequest;
    const { projectTitle, projectDescription, sectionTitle, sectionContent = "", existingTags, currentPageTypeId } = body;

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

    const systemPrompt = `Você é um assistente para Game Design Documents (GDD). Sua tarefa é classificar uma seção em DOMÍNIOS de game design E sugerir o PAGE TYPE mais apropriado.

${DOMAINS_PROMPT_BLOCK}

${PAGE_TYPES_COMPACT_BLOCK}

**HEURÍSTICA DE PAGE TYPE:**
- Se é texto corrido (lore, pitch, descrição, container) → \`narrative\` (DEFAULT).
- Se lista atributos do jogo (HP, ATK, DEF) → \`attributeDefinitions\`.
- Se é uma moeda específica → \`economy\`.
- Se é curva de XP/níveis → \`progression\`.
- Se é um personagem individual → \`characters\`.
- Se é um item simples (semente, poção, madeira) → \`items\`.
- Se é um item com efeito (arma, armadura, amuleto) → \`equipmentItem\`.
- Se é uma receita específica (X→Y) → \`recipe\`.
- Se é uma estação de produção que agrega receitas → \`craftTable\`.

**REGRA:** Responda APENAS com um JSON válido, sem markdown, sem explicação:
{"tags": ["id1", "id2"], "pageTypeId": "narrative"}

- "tags" = array de 1 a 4 domínios mais relevantes (ordem por relevância)
- "pageTypeId" = um dos IDs válidos acima (prefira \`narrative\` em caso de dúvida)
- Priorize tags e pageType alinhados ao tema do projeto descrito`;

    const userPrompt = `Classifique esta seção do GDD.

**Projeto:** ${projectTitle?.trim() || "GDD"}
**Descrição do projeto:** ${projectDescription?.trim() || "Sem descrição informada."}

**Título da seção:** ${sectionTitle.trim()}
${currentPageTypeId ? `**Page type atual:** \`${currentPageTypeId}\` (pode sugerir trocar se outro se encaixa melhor).` : ""}
${contentSnippet ? `**Trecho do conteúdo:**\n${contentSnippet}` : "(conteúdo vazio)"}
${existingHint}

Responda só com o JSON: {"tags": ["...", "..."], "pageTypeId": "..."}`;

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
    let data: { tags?: string[]; pageTypeId?: string };
    try {
      data = JSON.parse(jsonStr) as { tags?: string[]; pageTypeId?: string };
    } catch {
      return NextResponse.json(
        { error: "Resposta da IA inválida", raw: raw.slice(0, 300) },
        { status: 502 }
      );
    }

    const tags = Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim().toLowerCase()) : [];
    const suggestedTags = normalizeDomainTags(tags);

    // Valida pageType contra registry — se inválido ou ausente, omite do response
    const rawPageType = typeof data.pageTypeId === "string" ? data.pageTypeId.trim() : "";
    const suggestedPageTypeId = VALID_PAGE_TYPE_SET.has(rawPageType) ? rawPageType : undefined;

    return NextResponse.json({ suggestedTags, suggestedPageTypeId });
  } catch (error) {
    console.error("suggest-domain-tags error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sugerir domínios" },
      { status: 500 }
    );
  }
}
