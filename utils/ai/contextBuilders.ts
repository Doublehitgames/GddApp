// utils/ai/contextBuilders.ts
//
// Context builders for AI prompts that operate on a project/section.
// Produces the "what is this section and where does it live" prompt
// block that endpoints prepend to their task-specific instructions.
//
// All builders are pure strings (no React, no store). Safe to call from
// server routes (API) or client (pre-POST). Pair with gddVocabulary.ts
// for the "what the GDD semantics are" blocks.

import { getPageType, type PageTypeId } from "@/lib/pageTypes/registry";
import type { SectionAddonType } from "@/lib/addons/types";
import { describeAddonType } from "@/utils/ai/gddVocabulary";

// ────────────────────────────────────────────────────────────────────────────
// Minimal shapes — callers don't need to pass full domain objects.
// ────────────────────────────────────────────────────────────────────────────

export interface PromptSectionLite {
  id: string;
  title: string;
  parentId?: string;
  domainTags?: string[];
  pageTypeId?: string;
  addonTypes?: string[];
}

export interface PromptAddonSummary {
  type: SectionAddonType | string;
  name?: string;
}

export interface SectionContextInput {
  sectionTitle: string;
  pageTypeId?: string;
  addons?: PromptAddonSummary[];
  breadcrumb?: string[];
  parentTitle?: string;
  parentContent?: string;
  subsections?: Array<{ title: string; pageTypeId?: string }>;
  projectTitle?: string;
  projectDescription?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// buildSectionContextBlock — the canonical "this is the section you're
// working on" block. Used by improve-content, suggest-domain-tags, etc.
// ────────────────────────────────────────────────────────────────────────────

export function buildSectionContextBlock(input: SectionContextInput): string {
  const lines: string[] = [];
  lines.push("**CONTEXTO DA SEÇÃO:**");

  if (input.projectTitle) {
    lines.push(`- Projeto: "${input.projectTitle}"${input.projectTitle ? ` (NÃO é uma seção — nunca use $[${input.projectTitle}])` : ""}`);
  }
  if (input.projectDescription?.trim()) {
    const snippet = input.projectDescription.trim().slice(0, 400);
    lines.push(`- Descrição do projeto: "${snippet}${input.projectDescription.length > 400 ? "…" : ""}"`);
  }

  lines.push(`- Seção atual: "${input.sectionTitle}"`);

  if (input.breadcrumb?.length) {
    lines.push(`- Caminho (hierarquia): ${input.breadcrumb.join(" > ")}`);
  } else if (input.parentTitle) {
    lines.push(`- Seção pai: "${input.parentTitle}"`);
  }

  // Page type — the critical piece that tells the AI what KIND of page this is
  if (input.pageTypeId) {
    const pt = getPageType(input.pageTypeId as PageTypeId);
    if (pt) {
      lines.push(`- Tipo de página: \`${pt.id}\` ${pt.emoji} ${pt.label} — ${pt.description}`);
    } else {
      lines.push(`- Tipo de página: \`${input.pageTypeId}\``);
    }
  }

  // Addons summary — tell the AI what structured data already lives on this section,
  // so it does NOT duplicate that data in narrative text.
  if (input.addons?.length) {
    lines.push(`- Addons já configurados nesta seção:`);
    for (const a of input.addons) {
      const label = a.name ? `"${a.name}"` : "(sem nome)";
      lines.push(`  - \`${a.type}\` ${label} — ${describeAddonType(a.type as SectionAddonType)}`);
    }
    lines.push(`  ⚠️ Esses addons JÁ CONTÊM os dados estruturados (números, listas, tabelas). NÃO duplique esse conteúdo no texto narrativo — foque em contexto, decisão e rationale.`);
  }

  if (input.parentContent?.trim()) {
    const snippet = input.parentContent.trim().slice(0, 800);
    lines.push("");
    lines.push(`**CONTEÚDO DA SEÇÃO PAI (para alinhar o tema):**`);
    lines.push(`${snippet}${input.parentContent.length > 800 ? "…" : ""}`);
    lines.push(`- Use este contexto para manter coerência com o ramo (ex.: se o pai fala de música, a seção atual deve tratar do subtema no mesmo ângulo).`);
  }

  if (input.subsections?.length) {
    lines.push("");
    lines.push(`🔴 **SUBSEÇÕES DESTA SEÇÃO (NÃO mencione esses tópicos no texto!):**`);
    for (const s of input.subsections) {
      const ptHint = s.pageTypeId ? ` [${s.pageTypeId}]` : "";
      lines.push(`  - "${s.title}"${ptHint}`);
    }
    lines.push(`⚠️ Essas subseções aparecerão automaticamente abaixo no documento — descrever elas seria redundante. Foque em aspectos GERAIS não cobertos por elas.`);
  }

  return lines.join("\n");
}

// ────────────────────────────────────────────────────────────────────────────
// buildProjectTreeBlock — tree renderer used by chat, suggest-relations,
// suggest-section-path. Annotates each section with tags, pageType, addons.
// ────────────────────────────────────────────────────────────────────────────

export interface BuildTreeOptions {
  /** Whether to include section IDs (needed for EDIT/REMOVE commands). Default: false. */
  includeIds?: boolean;
  /** Whether to show domainTags. Default: true. */
  showTags?: boolean;
  /** Whether to show pageType. Default: true. */
  showPageType?: boolean;
  /** Whether to show addon types. Default: true. */
  showAddons?: boolean;
}

export function buildProjectTreeBlock(
  sections: PromptSectionLite[],
  options: BuildTreeOptions = {}
): string {
  const {
    includeIds = false,
    showTags = true,
    showPageType = true,
    showAddons = true,
  } = options;

  const byParent = new Map<string | undefined, PromptSectionLite[]>();
  for (const s of sections) {
    const pid = s.parentId ?? undefined;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(s);
  }

  const render = (parentId: string | undefined, indent: number): string[] => {
    const children = byParent.get(parentId) ?? [];
    const lines: string[] = [];
    for (const s of children) {
      const parts: string[] = [];
      const prefix = parentId ? "  ".repeat(indent) + "└─ " : "📁 ";
      parts.push(`${prefix}${s.title}`);
      if (includeIds) parts.push(`(ID: ${s.id})`);
      if (showPageType && s.pageTypeId) parts.push(`{pageType: ${s.pageTypeId}}`);
      if (showTags && s.domainTags?.length) parts.push(`[${s.domainTags.join(", ")}]`);
      if (showAddons && s.addonTypes?.length) parts.push(`{addons: ${s.addonTypes.join(", ")}}`);
      lines.push(parts.join(" "));
      lines.push(...render(s.id, indent + 1));
    }
    return lines;
  };

  const out = render(undefined, 0).join("\n");
  return out || "(nenhuma seção ainda)";
}

// ────────────────────────────────────────────────────────────────────────────
// pageType-specific guidance — used by improve-content and chat-with-tools
// to give the AI hints that reflect the KIND of page being edited.
// ────────────────────────────────────────────────────────────────────────────

const PAGE_TYPE_WRITING_GUIDANCE: Record<string, string> = {
  narrative:
    "Texto corrido é o foco. Use callouts intencionalmente (3-5 por página): `> [!note]` para contexto, `> [!warning]` para jargão/lembretes, `> [!design-decision]` para tradeoffs, `> [!balance-note]` para concerns de balanceamento.",
  attributeDefinitions:
    "Os atributos (HP, ATK, DEF…) vivem no addon `attributeDefinitions` — NÃO liste valores no texto. Foque no rationale: por que esses atributos, como se combinam, qual a filosofia (ex.: 'priorizamos 3 atributos core pra reduzir decision fatigue').",
  economy:
    "A moeda vive no addon `currency` — NÃO redefina o nome/código da moeda no texto. Foque no loop econômico: onde o jogador ganha, onde gasta, que tensão sustenta a escassez, como inflação é combatida.",
  progression:
    "A curva de XP e tabela de níveis vivem nos addons — NÃO liste valores de XP no texto. Foque no design da curva: quantas horas até nível N, o que desbloqueia onde, como o pacing se relaciona com o core loop.",
  characters:
    "Atributos e progressão vivem em addons — NÃO liste stats no texto. Foque em: papel no combate/narrativa, arquétipo, contraste com outros personagens, como brilha no loop.",
  items:
    "Categoria, stack e preço vivem em addons — NÃO liste esses números no texto. Foque em: pra que serve, onde o jogador encontra, como interage com outros sistemas (receitas, economia, combate).",
  equipmentItem:
    "Bônus de atributos e preço vivem em addons — NÃO liste números no texto. Foque em: quando usar, tradeoff em relação a outros equipamentos, fantasia associada.",
  recipe:
    "Ingredientes e outputs vivem no addon `production` — NÃO repita a fórmula no texto. Foque em: por que essa receita existe, quando o jogador a descobre, qual necessidade ela atende.",
  craftTable:
    "Lista de receitas vive no addon — NÃO enumere receitas no texto. Foque em: papel da estação, progressão de unlocks, fantasia (forja, laboratório).",
  blank:
    "Sem addons pré-configurados. Texto livre em markdown.",
};

/** Returns writing guidance tailored to the section's page type, or empty string. */
export function getPageTypeWritingGuidance(pageTypeId: string | undefined): string {
  if (!pageTypeId) return "";
  const guidance = PAGE_TYPE_WRITING_GUIDANCE[pageTypeId];
  if (!guidance) return "";
  return `**ESCRITA PARA PAGETYPE \`${pageTypeId}\`:** ${guidance}`;
}
