// app/api/ai/suggest-section-path/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAIClient } from "@/utils/ai/client";
import { AIMessage } from "@/types/ai";
import { getAIConfigFromRequest } from "@/utils/ai/apiHelpers";

interface SectionItem {
  id: string;
  title: string;
  parentId?: string;
  domainTags?: string[];
}

interface SuggestPathRequest {
  projectTitle: string;
  sections: SectionItem[];
  newSectionTitle: string;
  /** Caminho da seção atual (onde a ref foi encontrada) para contexto */
  currentContextPath?: string[];
}

/**
 * Constrói uma árvore em texto a partir das seções (nível raiz depois filhos).
 */
function buildTreeText(sections: SectionItem[]): string {
  const byParent = new Map<string | undefined, SectionItem[]>();
  for (const s of sections) {
    const pid = s.parentId ?? undefined;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(s);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }

  function render(parentId: string | undefined, indent: number): string[] {
    const children = byParent.get(parentId) ?? [];
    const lines: string[] = [];
    for (const s of children) {
      const tags = s.domainTags?.length ? ` [${s.domainTags.join(", ")}]` : "";
      lines.push("  ".repeat(indent) + "- " + s.title + tags);
      lines.push(...render(s.id, indent + 1));
    }
    return lines;
  }

  return render(undefined, 0).join("\n") || "(nenhuma seção ainda)";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SuggestPathRequest;
    const { projectTitle, sections, newSectionTitle, currentContextPath } = body;

    if (!newSectionTitle?.trim()) {
      return NextResponse.json({ error: "newSectionTitle is required" }, { status: 400 });
    }

    const aiConfig = getAIConfigFromRequest(req);
    if (aiConfig instanceof NextResponse) return aiConfig;

    const client = createAIClient({
      ...aiConfig,
      model: aiConfig.model || "llama-3.1-8b-instant",
    });

    const treeText = buildTreeText(sections || []);
    const contextHint = currentContextPath?.length
      ? `A referência apareceu no contexto: ${currentContextPath.join(" > ")}.`
      : "";

    const systemPrompt = `Você é um assistente para Game Design Documents (GDD). Sua tarefa é sugerir ONDE criar uma nova seção na hierarquia do projeto, pensando como um game designer.

**REGRA:** Responda APENAS com um JSON válido, sem markdown, sem explicação, no formato:
{"path": ["Título Nível 1", "Título Nível 2", "Nome da Nova Seção"]}

- "path" = array da raiz até a nova seção (inclusive). Use títulos EXATOS das seções existentes quando reaproveitar.
- O último elemento do path deve ser o título da nova seção (igual ou variação coerente de newSectionTitle).
- Máximo de níveis: 4 ou 5.

**🔴 HIERARQUIA SEMÂNTICA (pense como game designer):**

1. **Itens, armas, poções, equipamentos** (ex.: Espada de Fogo, Poção de Vida, Armadura de Escudo) NÃO pertencem a "Sistema de Loot". O sistema de loot DESCREVE como o jogador obtém itens; os itens em si pertencem a um catálogo/inventário. Sugira:
   - Inventário (ou Itens / Catálogo de Itens) → subcategoria → item. Ex.: ["Inventário", "Equipamentos", "Armas", "Espada de Fogo"], ["Inventário", "Poções", "Poção de Vida"].
   - Se já existir "Inventário", "Itens", "Equipamentos", "Armas", "Poções" na árvore, use-os. Se não existir, CRIE os níveis necessários no path (ex.: Inventário, depois Equipamentos ou Poções, depois o item).

2. **Sistemas vs. conteúdo:** "Sistema de Loot", "Sistema de Combate" etc. são MECÂNICAS. Itens, inimigos, locais são CONTEÚDO que essas mecânicas referenciam. Coloque cada coisa no lugar lógico: conteúdo (itens, poções, armas) em Inventário/Itens; mecânicas em Gameplay/Sistemas.

3. **Categorias intermediárias:** Prefira estrutura com categorias (Equipamentos → Armas → Espada de Fogo; Poções → Poção de Vida) em vez de jogar tudo direto sob a seção onde a referência apareceu.

4. **Reaproveitar seções existentes:** Se já existir "Inventário", "Armas", "Poções" etc. na árvore, use esses títulos exatos no path. Se não existir, inclua no path os níveis que faltam (Inventário, Equipamentos, Armas...).

**Exemplos:**
- "Espada de Fogo" citada em Sistema de Loot → {"path": ["Inventário", "Equipamentos", "Armas", "Espada de Fogo"]} (não ["Sistema de Loot", "Espada de Fogo"]).
- "Poção de Vida" citada em Sistema de Loot → {"path": ["Inventário", "Poções", "Poção de Vida"]}.
- "Dungeons Procedurais" (mecânica/ambiente) → pode ficar sob Gameplay, Ambientes ou Sistemas, conforme a árvore.`;

    const userPrompt = `Projeto: "${projectTitle}"
${contextHint}

Estrutura atual do documento (hierarquia de seções):
\`\`\`
${treeText}
\`\`\`

Nova seção a criar: "${newSectionTitle.trim()}"

Pense como game designer: onde esse conceito realmente pertence? Itens/armas/poções → Inventário (ou Itens) com subcategorias (Equipamentos, Armas, Poções), não sob Sistema de Loot. Indique o caminho completo (raiz até a nova seção). Crie níveis intermediários se precisar. Responda só com o JSON.`;

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const response = await client.chat(messages, { temperature: 0.3, maxTokens: 300 });
    const raw = (response.content || "").trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    let data: { path?: string[] };
    try {
      data = JSON.parse(jsonStr) as { path?: string[] };
    } catch {
      return NextResponse.json(
        { error: "Resposta da IA inválida", raw: raw.slice(0, 200) },
        { status: 502 }
      );
    }

    const path = Array.isArray(data.path) ? data.path.map((p) => String(p).trim()).filter(Boolean) : [];
    if (path.length === 0) {
      return NextResponse.json({ error: "Path vazio", raw: raw.slice(0, 200) }, { status: 502 });
    }

    return NextResponse.json({ path });
  } catch (error) {
    console.error("suggest-section-path error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao sugerir caminho" },
      { status: 500 }
    );
  }
}
