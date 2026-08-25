// utils/ai/contextBuilders.ts
//
// Context builders for AI prompts that operate on a project/section.
// Produces the "what is this section and where does it live" prompt
// block that endpoints prepend to their task-specific instructions.
//
// All builders are pure strings (no React, no store). Safe to call from
// server routes (API) or client (pre-POST). Pair with gddVocabulary.ts
// for the "what the GDD semantics are" blocks.


// ────────────────────────────────────────────────────────────────────────────
// Minimal shapes — callers don't need to pass full domain objects.
// ────────────────────────────────────────────────────────────────────────────

export interface PromptSectionLite {
  id: string;
  title: string;
  parentId?: string;
  domainTags?: string[];
}

export interface SectionContextInput {
  sectionTitle: string;
  breadcrumb?: string[];
  parentTitle?: string;
  parentContent?: string;
  subsections?: Array<{ title: string }>;
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
      lines.push(`  - "${s.title}"`);
    }
    lines.push(`⚠️ Essas subseções aparecerão automaticamente abaixo no documento — descrever elas seria redundante. Foque em aspectos GERAIS não cobertos por elas.`);
  }

  return lines.join("\n");
}

// ────────────────────────────────────────────────────────────────────────────
// buildProjectTreeBlock — tree renderer used by chat, suggest-relations,
// suggest-section-path. Annotates each section with its domain tags.
// ────────────────────────────────────────────────────────────────────────────

export interface BuildTreeOptions {
  /** Whether to include section IDs (needed for EDIT/REMOVE commands). Default: false. */
  includeIds?: boolean;
  /** Whether to show domainTags. Default: true. */
  showTags?: boolean;
}

export function buildProjectTreeBlock(
  sections: PromptSectionLite[],
  options: BuildTreeOptions = {}
): string {
  const { includeIds = false, showTags = true } = options;

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
      if (showTags && s.domainTags?.length) parts.push(`[${s.domainTags.join(", ")}]`);
      lines.push(parts.join(" "));
      lines.push(...render(s.id, indent + 1));
    }
    return lines;
  };

  const out = render(undefined, 0).join("\n");
  return out || "(nenhuma seção ainda)";
}

