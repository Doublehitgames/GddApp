// app/api/ai/suggest-relations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAIClient } from "@/utils/ai/client";
import { getAIConfigFromRequest } from "@/utils/ai/apiHelpers";

interface SectionItem {
  id: string;
  title: string;
  parentId?: string;
  domainTags?: string[];
}

interface SuggestRelationsRequest {
  projectTitle: string;
  sections: SectionItem[];
}

export interface RelationSuggestion {
  type: "relation" | "missing_link";
  /** Título da seção de origem (ou domínio se missing_link) */
  fromTitle?: string;
  /** Título da seção de destino ou domínio */
  toTitle?: string;
  /** Domínios envolvidos (ex.: combat, economy) */
  domains?: string[];
  /** Texto da sugestão para o usuário */
  suggestion: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SuggestRelationsRequest;
    const { projectTitle, sections } = body;

    const aiConfig = getAIConfigFromRequest(req);
    if (aiConfig instanceof NextResponse) return aiConfig;

    const client = createAIClient({
      ...aiConfig,
      model: aiConfig.model || "llama-3.1-8b-instant",
    });

    const sectionsWithTags = (sections || []).filter((s) => s.title?.trim());
    const hasTags = sectionsWithTags.some((s) => s.domainTags?.length);
    const sectionList = sectionsWithTags
      .map((s) => {
        const tags = s.domainTags?.length ? ` [${s.domainTags.join(", ")}]` : "";
        return `- ${s.title}${tags}`;
      })
      .join("\n");

    const systemPrompt = `Você é um especialista em Game Design Documents (GDD). Sua tarefa é sugerir RELAÇÕES entre sistemas do jogo com base nas seções e suas tags de domínio.

**DOMÍNIOS:** combat, economy, progression, crafting, items, world, narrative, audio, ui, technology

**REGRAS:**
1. Sugira conexões que façam sentido entre sistemas (ex.: Combate → Estatísticas de inimigos → Fórmula de dano; Economia → Custo de crafting → Taxa de drop).
2. Se uma seção tem tags (ex.: [combat, items]), sugira como ela pode se conectar a outras seções ou o que está faltando documentar.
3. Se há domínios sem seção (ex.: economy sem "Economia"), sugira criar ou ligar a algo existente.
4. Seja conciso: 3 a 6 sugestões no máximo.
5. Responda APENAS com um JSON válido, sem markdown, no formato:
{"suggestions": [{"type": "relation" ou "missing_link", "fromTitle": "opcional", "toTitle": "opcional", "domains": ["opcional"], "suggestion": "texto curto e acionável"}]}

- type "relation" = ligação entre duas seções/sistemas existentes ou a criar
- type "missing_link" = falta um elo entre domínios (ex.: economy e crafting sem seção de custos)
- suggestion = uma frase clara para o designer (ex.: "Adicione uma seção 'Custos de Crafting' ligando Economia ao Sistema de Crafting")`;

    const userPrompt = `Projeto: "${projectTitle || "GDD"}"

Seções atuais (entre colchetes = tags de sistema):
${sectionList || "(nenhuma seção com tags ainda)"}
${!hasTags ? "\nDica: Marque as seções com tags (Combate, Economia, Itens, etc.) na página de cada seção para sugestões mais precisas." : ""}

Sugira relações ou elos faltantes entre os sistemas. Retorne só o JSON.`;

    const response = await client.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, maxTokens: 800 }
    );

    const raw = (response.content || "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    let data: { suggestions?: RelationSuggestion[] };
    try {
      data = JSON.parse(jsonStr) as { suggestions?: RelationSuggestion[] };
    } catch {
      return NextResponse.json(
        { error: "Resposta da IA inválida", raw: raw.slice(0, 400) },
        { status: 502 }
      );
    }

    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("suggest-relations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sugerir relações" },
      { status: 500 }
    );
  }
}
