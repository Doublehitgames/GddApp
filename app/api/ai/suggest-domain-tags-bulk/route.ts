// app/api/ai/suggest-domain-tags-bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAIClient } from "@/utils/ai/client";
import { getAIConfigFromRequest } from "@/utils/ai/apiHelpers";
import { GAME_DESIGN_DOMAIN_IDS, normalizeDomainTags } from "@/lib/gameDesignDomains";

interface SectionInput {
  id: string;
  title: string;
  content?: string;
}

interface SuggestBulkRequest {
  projectTitle?: string;
  /** Seções a classificar (até 25 por request para caber no contexto). */
  sections: SectionInput[];
}

const DOMAIN_LIST = GAME_DESIGN_DOMAIN_IDS.join(", ");
const MAX_SECTIONS_PER_REQUEST = 25;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SuggestBulkRequest;
    const { projectTitle, sections } = body;

    if (!sections?.length || sections.length > MAX_SECTIONS_PER_REQUEST) {
      return NextResponse.json(
        { error: `sections required (max ${MAX_SECTIONS_PER_REQUEST} per request)` },
        { status: 400 }
      );
    }

    const aiConfig = getAIConfigFromRequest(req);
    if (aiConfig instanceof NextResponse) return aiConfig;

    const client = createAIClient({
      ...aiConfig,
      model: aiConfig.model || "llama-3.1-8b-instant",
    });

    const sectionList = sections
      .map((s) => {
        const contentSnippet = (s.content || "").trim().slice(0, 400);
        return `[ID: ${s.id}]
Título: ${s.title}
Conteúdo: ${contentSnippet || "(vazio)"}`;
      })
      .join("\n---\n");

    const systemPrompt = `You are an assistant for Game Design Documents (GDD). Classify EACH section into game design DOMAINS.

**VALID DOMAIN IDs (use only these, lowercase):**
${DOMAIN_LIST}

**Meanings:** combat=combat/damage, economy=currency/prices, progression=XP/levels, crafting=recipes/materials, items=inventory/loot, world=maps/level design, narrative=story/dialogue, audio=music/SFX, ui=interface/HUD, technology=engine/platform, other=doesn't fit above.

**TASK:** For each section (identified by [ID: ...]), return 1 to 3 domain tags. Respond ONLY with a valid JSON object, no markdown:
{"tagsBySectionId": {"<sectionId>": ["tag1", "tag2"], ...}}

- Keys = section IDs exactly as given
- Values = array of 1-3 domain IDs from the list above
- Every section in the input must appear in the response`;

    const userPrompt = `Project: ${projectTitle || "GDD"}

Sections to classify:
${sectionList}

Return JSON: {"tagsBySectionId": {"id1": ["economy"], "id2": ["combat", "items"], ...}}`;

    const response = await client.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 1500 }
    );

    const raw = (response.content || "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    let data: { tagsBySectionId?: Record<string, string[]> };
    try {
      data = JSON.parse(jsonStr) as { tagsBySectionId?: Record<string, string[]> };
    } catch {
      return NextResponse.json(
        { error: "Resposta da IA inválida", raw: raw.slice(0, 400) },
        { status: 502 }
      );
    }

    const tagsBySectionId = data.tagsBySectionId || {};
    const results: { sectionId: string; tags: string[] }[] = [];
    for (const s of sections) {
      const rawTags = tagsBySectionId[s.id];
      const tags = normalizeDomainTags(Array.isArray(rawTags) ? rawTags : []);
      results.push({ sectionId: s.id, tags });
    }

    return NextResponse.json({ suggestions: results });
  } catch (error) {
    console.error("suggest-domain-tags-bulk error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sugerir domínios em lote" },
      { status: 500 }
    );
  }
}
