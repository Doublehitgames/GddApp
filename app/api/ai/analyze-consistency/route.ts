// app/api/ai/analyze-consistency/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAIClient } from "@/utils/ai/client";
import { getAIConfigFromRequest } from "@/utils/ai/apiHelpers";

interface SectionItem {
  id: string;
  title: string;
  content?: string;
  parentId?: string;
  domainTags?: string[];
}

interface AnalyzeConsistencyRequest {
  projectTitle: string;
  /** User UI locale: pt-BR, en, es. Responses will be in this language. */
  locale?: string;
  sections: SectionItem[];
}

const LOCALE_TO_LANGUAGE: Record<string, string> = {
  "pt-BR": "Portuguese (Brazil) - português do Brasil",
  en: "English",
  es: "Spanish - español",
};

export interface ConsistencyAlert {
  severity: "warning" | "info";
  title: string;
  message: string;
  /** Section titles or IDs that are relevant to this alert */
  relatedSections?: string[];
}

/** Extrai números de combate do texto (HP jogador, dano inimigo, cura poção). */
function extractCombatNumbers(text: string): { playerHP?: number; enemyDamage?: number; healPerPotion?: number } {
  const lower = text.replace(/\s+/g, " ").toLowerCase();
  const num = (r: RegExp): number | undefined => {
    const m = lower.match(r);
    if (m) return parseInt(m[1], 10);
    return undefined;
  };
  const playerHP =
    num(/(?:player|jogador|personagem)\s*(?:hp|vida|health)?\s*[=:]\s*(\d+)/i) ??
    num(/(?:hp|vida|health)\s*[=:]\s*(\d+)/i) ??
    num(/(?:vida|hp)\s*(?:do\s*jogador|player)?\s*[=:]\s*(\d+)/i) ??
    num(/\b(\d+)\s*(?:hp|vida|health)\s*(?:do\s*jogador|player|base)?/i);
  const enemyDamage =
    num(/(?:enemy|inimigo)\s*(?:damage|dano)?\s*[=:]\s*(\d+)/i) ??
    num(/(?:enemy\s*damage|dano\s*do\s*inimigo)\s*[=:]\s*(\d+)/i) ??
    num(/(?:damage|dano)\s*[=:]\s*(\d+)/i) ??
    num(/\b(?:dano|damage)\s+(\d+)/i);
  const healPerPotion =
    num(/(?:potion|poção)\s*(?:heal|restaura|cura)?\s*[=:]\s*(\d+)/i) ??
    num(/(?:heal|cura|restaura)\s*[=:]\s*(\d+)/i) ??
    num(/(?:cura|heal)\s*(?:da\s*poção|potion)?\s*[=:]\s*(\d+)/i) ??
    num(/\b(?:cura|heal)\s+(\d+)/i);
  return {
    playerHP: playerHP != null && playerHP > 0 && playerHP <= 100000 ? playerHP : undefined,
    enemyDamage: enemyDamage != null && enemyDamage > 0 && enemyDamage <= 100000 ? enemyDamage : undefined,
    healPerPotion: healPerPotion != null && healPerPotion >= 0 && healPerPotion <= 100000 ? healPerPotion : undefined,
  };
}

export interface CombatSimulation {
  playerHP: number;
  enemyDamage: number;
  healPerPotion?: number;
  /** Número de hits até o jogador morrer (sem cura). */
  hitsToDie: number;
  /** Número de poções para compensar 1 hit (se tiver cura). */
  healsToOffsetOneHit?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeConsistencyRequest;
    const { projectTitle, locale: localeCode, sections } = body;
    const responseLanguage = LOCALE_TO_LANGUAGE[localeCode || "en"] || "English";

    const aiConfig = getAIConfigFromRequest(req);
    if (aiConfig instanceof NextResponse) return aiConfig;

    const client = createAIClient({
      ...aiConfig,
      model: aiConfig.model || "llama-3.1-8b-instant",
    });

    const sectionsWithContent = (sections || [])
      .filter((s) => s.title?.trim())
      .map((s) => {
        const tags = s.domainTags?.length ? ` [${s.domainTags.join(", ")}]` : "";
        const contentSnippet = (s.content || "").trim().slice(0, 800);
        return `### ${s.title}${tags}\n${contentSnippet || "(sem conteúdo)"}`;
      })
      .join("\n\n");

    const fullText = (sections || [])
      .map((s) => (s.content || "").trim())
      .join("\n");
    const combat = extractCombatNumbers(fullText);
    let simulation: { combat?: CombatSimulation } | undefined;
    if (combat.playerHP != null && combat.enemyDamage != null && combat.enemyDamage > 0) {
      const hitsToDie = Math.ceil(combat.playerHP / combat.enemyDamage);
      const healsToOffsetOneHit =
        combat.healPerPotion != null && combat.healPerPotion > 0
          ? Math.ceil(combat.enemyDamage / combat.healPerPotion)
          : undefined;
      simulation = {
        combat: {
          playerHP: combat.playerHP,
          enemyDamage: combat.enemyDamage,
          healPerPotion: combat.healPerPotion,
          hitsToDie,
          healsToOffsetOneHit,
        },
      };
    }

    const systemPrompt = `You are a game design expert focused on CONSISTENCY, BALANCE and SIMULATION in Game Design Documents (GDD).

**LANGUAGE:** Respond ONLY in ${responseLanguage}. All alert titles and messages MUST be written in this language. Do not use English if the user's language is not English.

**COVERAGE (CRITICAL):** You MUST consider ALL major systems that appear in the document. Do not focus only on one or two. For each system that has sections or is mentioned (XP/experience, progression, loot/items, economy, combat, crafting, meta progression, farm, etc.), include at least one alert or suggestion if relevant. If the document has "Sistema de XP", "Sistema de Loot", "Progressão Meta", etc., your analysis must address EACH of these systems where it makes sense. Be balanced and comprehensive.

**CONCEPTS YOU UNDERSTAND:**
- **Combat:** player HP, enemy damage, armor, DPS, survival time, potions/healing. When you see numbers, do explicit SIMULATION REASONING (survival time, hits to kill, potions to offset one hit).
- **Economy:** currency, prices, costs, income, drop rates, inflation.
- **Progression / XP:** experience points, levels, XP curves, how the player gains XP, time to level up, farm XP systems.
- **Loot / Items:** drop rates, rarity, item systems, how loot works.
- **Crafting:** recipe costs, material drop rates. **Meta progression:** unlocks, requirements.

**YOUR TASK:** Analyze the project sections. For EVERY system that has a section or is clearly mentioned (XP, loot, economy, combat, crafting, meta, etc.):
1. **Simulate in text:** When numbers appear, state what they imply.
2. **Consistency / clarity:** Missing formulas, unclear progression, missing drop rates, etc.
3. **Missing links:** economy without costs; combat without healing; XP without clear gain rules.
4. **Simulation hints:** suggest concrete simulations per system (e.g. XP curve, loot table, economy loop).

**RULES:** 4 to 8 alerts so that multiple systems are covered. severity: "warning" = balance/consistency problem; "info" = suggestion. Write title and message in ${responseLanguage}. Respond ONLY with valid JSON, no markdown:
{"alerts": [{"severity": "warning"|"info", "title": "...", "message": "...", "relatedSections": ["optional"]}]}`;

    const userPrompt = `Project: "${projectTitle || "GDD"}"

Sections and content (tags in brackets):
${sectionsWithContent || "(no sections with content)"}

Analyze consistency and balance. You MUST cover ALL major systems present (XP/experience, loot/items, economy, combat, crafting, progression, meta, etc.). Include at least one alert or suggestion per relevant system. Return only the JSON.`;

    const response = await client.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.2, maxTokens: 1200 }
    );

    const raw = (response.content || "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    let data: { alerts?: ConsistencyAlert[] };
    try {
      data = JSON.parse(jsonStr) as { alerts?: ConsistencyAlert[] };
    } catch {
      return NextResponse.json(
        { error: "Resposta da IA inválida", raw: raw.slice(0, 400) },
        { status: 502 }
      );
    }

    const alerts = Array.isArray(data.alerts) ? data.alerts : [];
    return NextResponse.json({ alerts, simulation });
  } catch (error) {
    console.error("analyze-consistency error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao analisar consistência" },
      { status: 500 }
    );
  }
}
