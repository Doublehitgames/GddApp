type SectionContext = {
  title?: string;
  content?: string;
};

export type ThematicContext = {
  projectTitle?: string;
  projectDescription?: string;
  sections?: SectionContext[];
};

export type ThematicRelevanceResult = {
  score: number;
  keywordOverlap: number;
  conflictHits: string[];
  hasJustificationSignals: boolean;
  needsReview: boolean;
};

const STOPWORDS = new Set([
  "a", "o", "e", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "um", "uma", "uns", "umas", "para", "por", "com", "sem", "que", "se", "ao", "aos",
  "as", "os", "the", "and", "or", "to", "of", "in", "on", "for", "is", "are",
  "game", "jogo", "gdd", "sistema", "secao", "seção", "projeto", "documento",
]);

const CONFLICT_TERMS = [
  "combate", "combat", "arma", "armas", "weapon", "weapons", "inimigo", "inimigos",
  "enemy", "enemies", "boss", "dungeon", "pvp", "tiro", "shooter",
];

const JUSTIFICATION_TERMS = [
  "opcional", "se quiser", "caso queira", "pode incluir", "se fizer sentido",
  "justific", "alinh", "conecta", "coerent", "de acordo com", "respeitando",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function topKeywords(tokens: string[], max = 20): string[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([token]) => token);
}

function extractThemeKeywords(context: ThematicContext): string[] {
  const corpus = [
    context.projectTitle || "",
    context.projectDescription || "",
    ...(context.sections || []).flatMap((section) => [section.title || "", section.content || ""]),
  ].join(" ");

  return topKeywords(tokenize(corpus));
}

export function stripExecutionCommands(text: string): string {
  return text
    .replace(/\[EXECUTAR\][\s\S]*?(?=\n\n|$)/g, " ")
    .replace(/\[EXECUTAR_ACOES\][\s\S]*?(?=\n\n|$)/g, " ")
    .trim();
}

export function assessThematicRelevance(
  candidateText: string,
  context: ThematicContext,
  options?: { strict?: boolean }
): ThematicRelevanceResult {
  const cleanText = stripExecutionCommands(candidateText || "");
  const candidateTokens = tokenize(cleanText);
  const themeKeywords = extractThemeKeywords(context);
  const candidateSet = new Set(candidateTokens);

  const overlap = themeKeywords.filter((keyword) => candidateSet.has(keyword)).length;
  const keywordOverlap = themeKeywords.length > 0 ? overlap / themeKeywords.length : 1;
  const conflictHits = CONFLICT_TERMS.filter((term) => normalize(cleanText).includes(normalize(term)));
  const hasJustificationSignals = JUSTIFICATION_TERMS.some((term) =>
    normalize(cleanText).includes(normalize(term))
  );

  let score = keywordOverlap;
  if (conflictHits.length > 0) score -= 0.25;
  if (hasJustificationSignals) score += 0.1;
  score = Math.max(0, Math.min(1, score));

  const minScore = options?.strict ? 0.45 : 0.2;
  const needsReview = score < minScore || (conflictHits.length > 0 && !hasJustificationSignals);

  return {
    score,
    keywordOverlap,
    conflictHits,
    hasJustificationSignals,
    needsReview,
  };
}

