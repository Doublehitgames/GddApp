// app/api/ai/suggest-domain-tags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAIClient } from "@/utils/ai/client";
import { getAIConfigFromRequest } from "@/utils/ai/apiHelpers";
import { GAME_DESIGN_DOMAIN_IDS, normalizeDomainTags } from "@/lib/gameDesignDomains";

interface SuggestDomainTagsRequest {
  sectionTitle: string;
  sectionContent?: string;
  existingTags?: string[];
}

const DOMAIN_LIST = GAME_DESIGN_DOMAIN_IDS.join(", ");

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SuggestDomainTagsRequest;
    const { sectionTitle, sectionContent = "", existingTags } = body;

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

    const systemPrompt = `Você é um assistente para Game Design Documents (GDD). Sua tarefa é classificar seções em DOMÍNIOS de game design.

**DOMÍNIOS VÁLIDOS (use apenas estes IDs, em minúsculo):**
${DOMAIN_LIST}

**Significado de cada domínio:**
- combat: combate, dano, inimigos, armas, habilidades de luta
- economy: moeda, preços, inflação, compra/venda, recursos
- progression: XP, níveis, unlocks, progressão do jogador, metas
- crafting: fabricação, receitas, materiais, crafting system
- items: itens, inventário, equipamentos, consumíveis, loot
- world: mundo, mapas, ambientes, level design, exploração
- narrative: história, personagens, diálogos, quests narrativas
- audio: música, SFX, voz, ambiência
- ui: interface, HUD, menus, feedback visual
- technology: engine, plataforma, performance, rede
- other: quando não se encaixa nos acima

**REGRA:** Responda APENAS com um JSON válido, sem markdown, sem explicação:
{"tags": ["id1", "id2"]}

- "tags" = array de 1 a 4 domínios mais relevantes para a seção
- Use apenas os IDs listados acima
- Ordem por relevância (mais importante primeiro)`;

    const userPrompt = `Classifique esta seção do GDD nos domínios de game design.

**Título da seção:** ${sectionTitle.trim()}
${contentSnippet ? `**Trecho do conteúdo:**\n${contentSnippet}` : "(conteúdo vazio)"}
${existingHint}

Responda só com o JSON: {"tags": ["...", "..."]}`;

    const response = await client.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 150 }
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
