export interface ImportedSection {
  title: string;
  content: string;
  subsections?: ImportedSection[];
}

export interface ImportedProject {
  title: string;
  description: string;
  sections: ImportedSection[];
}

type HeadingNode = {
  level: number;
  title: string;
  contentLines: string[];
  children: HeadingNode[];
};

const EMPTY_TITLE_RE = /^[\s\-–—:|*_.!]+$/;

function decodeEscapes(text: string): string {
  return text.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1");
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function cleanupHeadingTitle(raw: string): string {
  const withoutAnchor = raw.replace(/\s*\{#.*?\}\s*$/g, "");
  const withoutImages = withoutAnchor.replace(/!\[[^\]]*\]\([^)]*\)|!\[[^\]]*\]\[[^\]]*\]/g, "");
  const normalizedEscapes = withoutImages.replace(/\\\s*-/g, "-");
  const decoded = decodeEscapes(normalizedEscapes);
  const plain = stripInlineMarkdown(decoded)
    .replace(/\s+/g, " ")
    .trim();

  if (!plain || EMPTY_TITLE_RE.test(plain)) return "";
  return plain;
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function tryDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeAnchorKey(value: string): string {
  const withoutHash = value.startsWith("#") ? value.slice(1) : value;
  const decoded = decodeEscapes(tryDecodeURIComponent(withoutHash));
  return normalizeForMatch(decoded);
}

function anchorKeyFromTitle(title: string): string {
  return normalizeForMatch(title).replace(/\s+/g, "-");
}

function extractExplicitAnchorId(rawHeadingText: string): string | undefined {
  const match = rawHeadingText.match(/\{#(.*?)\}\s*$/);
  if (!match) return undefined;
  return match[1]?.trim() || undefined;
}

function convertInternalAnchorsToReferences(
  content: string,
  anchorToSectionTitle: Map<string, string>,
  normalizedTitleMap: Map<string, string>
): string {
  if (!content) return content;

  return content.replace(/\[([^\]]+)\]\(#((?:\\.|[^)])+)\)/g, (fullMatch, linkText: string, anchorTarget: string) => {
    const normalizedAnchor = normalizeAnchorKey(anchorTarget);
    const normalizedLinkText = normalizeForMatch(stripInlineMarkdown(decodeEscapes(linkText)));

    const resolvedTitle =
      anchorToSectionTitle.get(normalizedAnchor) ||
      normalizedTitleMap.get(normalizedLinkText);

    if (resolvedTitle) return `$[${resolvedTitle}]`;

    const fallbackTitle = stripInlineMarkdown(decodeEscapes(linkText)).trim();
    if (fallbackTitle.length >= 2 && fallbackTitle.length <= 120) {
      return `$[${fallbackTitle}]`;
    }

    return fullMatch;
  });
}

function parseMarkdownTableRow(line: string): string[] {
  const raw = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return raw.split("|").map((cell) => cell.trim());
}

function isTableSeparatorLine(line: string): boolean {
  const cells = parseMarkdownTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return (trimmed.match(/\|/g) || []).length >= 2;
}

function convertComplexTableBlockToReadable(lines: string[]): string {
  const rows = lines.map(parseMarkdownTableRow);
  const header = rows[0] || [];
  const body = rows.slice(2);

  const structuredRows = body
    .map((cells, index) => {
      const cols = cells
        .map((value, colIndex) => {
          const label = header[colIndex] && header[colIndex] !== "" ? header[colIndex] : `Coluna ${colIndex + 1}`;
          return `  - ${label}: ${value || "—"}`;
        })
        .join("\n");

      return `- Linha ${index + 1}\n${cols}`;
    })
    .join("\n");

  return [
    "**Tabela complexa convertida automaticamente**",
    structuredRows || "- (sem linhas de dados)",
  ].join("\n");
}

function normalizeComplexMarkdownTables(content: string): string {
  if (!content.includes("|")) return content;

  const lines = content.split("\n");
  const output: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];

    if (!isTableRow(line) || index + 1 >= lines.length || !isTableSeparatorLine(lines[index + 1])) {
      output.push(line);
      index += 1;
      continue;
    }

    const tableLines: string[] = [line, lines[index + 1]];
    index += 2;

    while (index < lines.length && isTableRow(lines[index])) {
      tableLines.push(lines[index]);
      index += 1;
    }

    const rowCells = tableLines.map(parseMarkdownTableRow);
    const colCounts = rowCells.map((cells) => cells.length);
    const maxCols = Math.max(...colCounts);
    const minCols = Math.min(...colCounts);

    const totalCells = rowCells.reduce((acc, cells) => acc + cells.length, 0);
    const emptyCells = rowCells.reduce((acc, cells) => acc + cells.filter((cell) => !cell || cell === "-").length, 0);
    const emptyRatio = totalCells > 0 ? emptyCells / totalCells : 0;

    const isIrregular = maxCols !== minCols;
    const likelyMergedLayout = rowCells.length >= 4 && maxCols <= 3 && emptyRatio >= 0.35;

    if (isIrregular || likelyMergedLayout) {
      output.push(convertComplexTableBlockToReadable(tableLines));
    } else {
      output.push(...tableLines);
    }
  }

  return output.join("\n");
}

function applyCrossReferences(
  sections: ImportedSection[],
  anchorToSectionTitle: Map<string, string>,
  normalizedTitleMap: Map<string, string>
): ImportedSection[] {
  return sections.map((section) => ({
    ...section,
    content: normalizeComplexMarkdownTables(
      convertInternalAnchorsToReferences(section.content || "", anchorToSectionTitle, normalizedTitleMap)
    ),
    ...(section.subsections
      ? { subsections: applyCrossReferences(section.subsections, anchorToSectionTitle, normalizedTitleMap) }
      : {}),
  }));
}

function isTableOfContentsHeading(title: string): boolean {
  const normalized = normalizeForMatch(title);
  return normalized === "sumario" || normalized === "sumário" || normalized === "table of contents";
}

function cleanContentLine(line: string): string {
  return line
    .replace(/^\[image\d+\]:\s*.*$/i, "")
    .replace(/^\s*#\s*$/g, "")
    .replace(/\s+$/g, "");
}

function trimContent(lines: string[]): string {
  const cleaned = lines.map(cleanContentLine);

  while (cleaned.length > 0 && !cleaned[0].trim()) cleaned.shift();
  while (cleaned.length > 0 && !cleaned[cleaned.length - 1].trim()) cleaned.pop();

  return cleaned.join("\n").trim();
}

function toImportedSection(node: HeadingNode): ImportedSection {
  const subsections = node.children.map(toImportedSection);
  const content = trimContent(node.contentLines);

  return {
    title: node.title,
    content,
    ...(subsections.length > 0 ? { subsections } : {}),
  };
}

function sanitizeFileNameTitle(fileName?: string): string {
  if (!fileName) return "Projeto Importado";
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseMarkdownToImportedProject(markdown: string, fileName?: string): ImportedProject {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  const root: HeadingNode = { level: 0, title: "__root__", contentLines: [], children: [] };
  const stack: HeadingNode[] = [root];
  const anchorToSectionTitle = new Map<string, string>();
  const normalizedTitleMap = new Map<string, string>();

  let projectTitle = "";
  let descriptionLines: string[] = [];
  let hasStartedSections = false;
  let skipCurrentSection = false;

  for (const rawLine of lines) {
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = cleanupHeadingTitle(headingMatch[2]);

      if (!title) {
        continue;
      }

      if (!projectTitle && level === 1) {
        projectTitle = title;
        skipCurrentSection = false;
        continue;
      }

      if (isTableOfContentsHeading(title)) {
        skipCurrentSection = true;
        continue;
      }

      skipCurrentSection = false;

      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      const node: HeadingNode = {
        level,
        title,
        contentLines: [],
        children: [],
      };

      const explicitAnchorId = extractExplicitAnchorId(headingMatch[2]);
      if (explicitAnchorId) {
        anchorToSectionTitle.set(normalizeAnchorKey(explicitAnchorId), title);
      }
      anchorToSectionTitle.set(anchorKeyFromTitle(title), title);
      normalizedTitleMap.set(normalizeForMatch(title), title);

      parent.children.push(node);
      stack.push(node);
      hasStartedSections = true;
      continue;
    }

    if (skipCurrentSection) {
      continue;
    }

    if (!hasStartedSections) {
      descriptionLines.push(rawLine);
      continue;
    }

    stack[stack.length - 1].contentLines.push(rawLine);
  }

  const sections = applyCrossReferences(root.children.map(toImportedSection), anchorToSectionTitle, normalizedTitleMap);
  const fallbackTitle = sanitizeFileNameTitle(fileName);
  const description = trimContent(descriptionLines);

  if (sections.length === 0) {
    return {
      title: projectTitle || fallbackTitle,
      description,
      sections: [
        {
          title: "Conteúdo Importado",
          content: trimContent(lines),
        },
      ],
    };
  }

  return {
    title: projectTitle || fallbackTitle,
    description,
    sections,
  };
}
