import type { Project, Section } from "@/store/projectStore";

/**
 * Tokens especiais `@[...]` resolvidos dentro do texto de uma seção.
 *
 * Antes vivia em `lib/addons/projectSpecialTokens.ts` e a maioria dos tokens
 * lia dados de addon (moedas, inventário, produção, economia...). Com a
 * remoção dos addons sobraram só os tokens do próprio projeto; a sintaxe e o
 * resolvedor continuam iguais para não quebrar textos já escritos.
 */

type TokenValue = string | number;
type TokenMap = Record<string, TokenValue>;
type TokenParams = Record<string, string>;

export type ProjectTokenSource = {
  updatedAt?: string | null;
  sections?: Section[];
};

export type SpecialTokenHelpItem = {
  label: string;
  token: string;
  description: string;
};

export const SPECIAL_TOKEN_HELP_ITEMS: SpecialTokenHelpItem[] = [
  {
    label: "Total de páginas",
    token: "@[project_section_count]",
    description: "Conta as páginas do projeto.",
  },
  {
    label: "Última atualização",
    token: "@[project_last_updated_at]",
    description: "Data da última atualização do projeto (ISO).",
  },
];

function formatIsoDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toISOString();
}

function parseTokenExpression(rawExpression: string): { token: string; params: TokenParams } | null {
  const expression = String(rawExpression || "")
    .replace(/\_/g, "_")
    .trim();
  if (!expression) return null;
  const match = expression.match(/^([a-z0-9_]+)(?:\((.*)\))?$/i);
  if (!match) return null;
  const token = String(match[1] || "").trim().toLowerCase();
  const paramsBlock = String(match[2] || "").trim();
  const params: TokenParams = {};
  if (paramsBlock) {
    for (const rawEntry of paramsBlock.split(",")) {
      const entry = rawEntry.trim();
      if (!entry) continue;
      const equalsIndex = entry.indexOf("=");
      if (equalsIndex <= 0) continue;
      const key = entry.slice(0, equalsIndex).trim().toLowerCase();
      const value = entry.slice(equalsIndex + 1).trim().toLowerCase();
      if (!key || !value) continue;
      params[key] = value;
    }
  }
  return { token, params };
}

export function buildProjectSpecialTokenMap(project: ProjectTokenSource | null | undefined): TokenMap {
  const sections = Array.isArray(project?.sections) ? project.sections : [];
  return {
    project_section_count: sections.length,
    project_last_updated_at: formatIsoDate(project?.updatedAt),
  };
}

export function resolveProjectSpecialTokens(
  content: string,
  project: ProjectTokenSource | null | undefined,
  _sectionId?: string | null
): string {
  if (!content || !content.includes("@[")) return content;
  const normalizedContent = normalizeSpecialTokenSyntax(content);
  const tokenMap = buildProjectSpecialTokenMap(project);
  return normalizedContent.replace(/@\[([^\]]+)\]/gi, (fullMatch: string, rawExpression: string) => {
    const parsed = parseTokenExpression(rawExpression);
    if (!parsed) return fullMatch;
    const resolved = tokenMap[parsed.token];
    if (resolved == null) return fullMatch;
    return String(resolved);
  });
}

export function resolveProjectSpecialTokensForProject(
  content: string,
  project: Project | null | undefined,
  sectionId?: string | null
): string {
  return resolveProjectSpecialTokens(content, project ?? null, sectionId);
}

export function normalizeSpecialTokenSyntax(content: string): string {
  if (!content || !content.includes("@[")) return content;
  return content.replace(/@\[([^\]]+)\]/g, (fullMatch: string, rawExpression: string) => {
    const fixed = String(rawExpression || "").replace(/\_/g, "_");
    return `@[${fixed}]`;
  });
}
