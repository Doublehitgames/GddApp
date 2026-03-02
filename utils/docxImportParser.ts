import type { ImportedProject, ImportedSection } from "@/utils/markdownImportParser";

type HeadingNode = {
  level: number;
  title: string;
  contentParts: string[];
  children: HeadingNode[];
};

const BLOCK_RE = /<(h[1-6]|table|p|ul|ol|pre|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi;
const MAX_IMAGE_SRC_LENGTH = 2048;

function sanitizeFileNameTitle(fileName?: string): string {
  if (!fileName) return "Projeto Importado";
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[\-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
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
  return normalizeForMatch(tryDecodeURIComponent(decodeHtmlEntities(withoutHash)));
}

function anchorKeyFromTitle(title: string): string {
  return normalizeForMatch(title).replace(/\s+/g, "-");
}

function stripHtmlTags(text: string): string {
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function isTableOfContentsHeading(title: string): boolean {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return (
    normalized === "sumario" ||
    normalized === "sumário" ||
    normalized === "table of contents" ||
    normalized.startsWith("sumario ") ||
    normalized.startsWith("sumário ")
  );
}

function isAnchorOnlyParagraph(block: string): boolean {
  return /^<p\b[^>]*>\s*(<a\b[^>]*><\/a>\s*)+<\/p>$/i.test(block.trim());
}

function extractAnchorIds(block: string): string[] {
  const ids: string[] = [];
  const matches = block.matchAll(/<a\b[^>]*(?:id|name)=(["'])(.*?)\1[^>]*>/gi);
  for (const match of matches) {
    const id = match[2]?.trim();
    if (id) ids.push(id);
  }
  return ids;
}

function extractHeadingAnchorIds(block: string): string[] {
  const ids: string[] = [];
  const headingIdMatch = block.match(/^<h[1-6]\b[^>]*\sid=(["'])(.*?)\1/i);
  if (headingIdMatch?.[2]) ids.push(headingIdMatch[2].trim());

  const innerAnchorMatches = block.matchAll(/<a\b[^>]*(?:id|name)=(["'])(.*?)\1[^>]*>/gi);
  for (const match of innerAnchorMatches) {
    const value = match[2]?.trim();
    if (value) ids.push(value);
  }

  return ids;
}

function shouldDropImageSrc(src: string): boolean {
  const normalized = src.trim();
  if (!normalized) return true;
  if (normalized.toLowerCase().startsWith("data:image/")) return true;
  if (normalized.length > MAX_IMAGE_SRC_LENGTH) return true;
  return false;
}

function sanitizeHtmlMedia(block: string): string {
  const withoutHeavyImages = block.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const srcMatch = imgTag.match(/\bsrc\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/i);
    const src = (srcMatch?.[2] || srcMatch?.[3] || "").trim();
    return shouldDropImageSrc(src) ? "" : imgTag;
  });

  return withoutHeavyImages.replace(/<a\b[^>]*>\s*<\/a>/gi, "").trim();
}

function convertInternalAnchorsToReferences(
  content: string,
  anchorToSectionTitle: Map<string, string>,
  normalizedTitleMap: Map<string, string>
): string {
  if (!content) return content;

  return content.replace(
    /<a\b([^>]*?)href=(["'])#(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (fullMatch, _before, _quote, anchorTarget: string, _after, innerHtml: string) => {
      const linkText = stripHtmlTags(innerHtml);
      const normalizedLinkText = normalizeForMatch(linkText);

      let fuzzyResolvedTitle: string | undefined;
      if (!normalizedTitleMap.has(normalizedLinkText) && normalizedLinkText) {
        for (const [normalizedTitle, title] of normalizedTitleMap.entries()) {
          if (
            normalizedLinkText.includes(normalizedTitle) ||
            normalizedTitle.includes(normalizedLinkText)
          ) {
            fuzzyResolvedTitle = title;
            break;
          }
        }
      }

      const normalizedAnchor = normalizeAnchorKey(anchorTarget);
      const resolvedTitle =
        anchorToSectionTitle.get(normalizedAnchor) ||
        normalizedTitleMap.get(normalizedLinkText) ||
        fuzzyResolvedTitle;

      if (resolvedTitle) return `$[${resolvedTitle}]`;

      if (linkText.length >= 2 && linkText.length <= 120) {
        return `$[${linkText}]`;
      }

      return fullMatch;
    }
  );
}

function isLikelyTocParagraph(block: string): boolean {
  const trimmed = block.trim();
  if (!/^<p\b[^>]*>[\s\S]*<\/p>$/i.test(trimmed)) return false;

  const hasInternalAnchorLink = /<a\b[^>]*href="#[_a-zA-Z0-9:-]+"/i.test(trimmed);
  if (!hasInternalAnchorLink) return false;

  const plain = stripHtmlTags(trimmed);
  const endsWithPageNumber = /\s\d+$/.test(plain);
  const isAnchorOnly = /^<p\b[^>]*>\s*(<a\b[^>]*>[\s\S]*?<\/a>\s*)+<\/p>$/i.test(trimmed);

  return endsWithPageNumber || isAnchorOnly;
}

function toImportedSection(node: HeadingNode): ImportedSection {
  const subsections = node.children.map(toImportedSection);
  const content = node.contentParts.join("\n\n").trim();

  return {
    title: node.title,
    content,
    ...(subsections.length > 0 ? { subsections } : {}),
  };
}

export function parseDocxHtmlToImportedProject(html: string, fileName?: string): ImportedProject {
  const root: HeadingNode = { level: 0, title: "__root__", contentParts: [], children: [] };
  const stack: HeadingNode[] = [root];
  const anchorToSectionTitle = new Map<string, string>();
  const normalizedTitleMap = new Map<string, string>();

  let projectTitle = "";
  let descriptionParts: string[] = [];
  let hasStartedSections = false;
  let skipCurrentSection = false;
  let pendingAnchorIds: string[] = [];

  const blocks = html.match(BLOCK_RE) || [];

  for (const rawBlock of blocks) {
    const block = sanitizeHtmlMedia(rawBlock);
    if (!block) {
      continue;
    }

    if (isAnchorOnlyParagraph(block)) {
      pendingAnchorIds.push(...extractAnchorIds(block));
      continue;
    }

    const headingMatch = block.match(/^<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>$/i);

    if (headingMatch) {
      const level = Number(headingMatch[1]);
      const title = stripHtmlTags(headingMatch[2]);

      if (!title) continue;

      if (!projectTitle && level === 1 && !isTableOfContentsHeading(title)) {
        projectTitle = title;
        skipCurrentSection = false;
        continue;
      }

      if (isTableOfContentsHeading(title)) {
        skipCurrentSection = true;
        pendingAnchorIds = [];
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
        contentParts: [],
        children: [],
      };

      const headingAnchorIds = extractHeadingAnchorIds(block);
      const allAnchorIds = [...pendingAnchorIds, ...headingAnchorIds, anchorKeyFromTitle(title)];
      for (const id of allAnchorIds) {
        anchorToSectionTitle.set(normalizeAnchorKey(id), title);
      }
      normalizedTitleMap.set(normalizeForMatch(title), title);
      pendingAnchorIds = [];

      parent.children.push(node);
      stack.push(node);
      hasStartedSections = true;
      continue;
    }

    if (skipCurrentSection) continue;

    if (isLikelyTocParagraph(block)) {
      continue;
    }

    if (!hasStartedSections) {
      descriptionParts.push(block);
      continue;
    }

    stack[stack.length - 1].contentParts.push(block);
  }

  const sections = root.children.map(toImportedSection);
  const title = projectTitle || sanitizeFileNameTitle(fileName);
  const description = convertInternalAnchorsToReferences(
    descriptionParts.join("\n\n").trim(),
    anchorToSectionTitle,
    normalizedTitleMap
  );

  const applyCrossReferences = (nodes: ImportedSection[]): ImportedSection[] => {
    return nodes.map((node) => ({
      ...node,
      content: convertInternalAnchorsToReferences(node.content || "", anchorToSectionTitle, normalizedTitleMap),
      ...(node.subsections ? { subsections: applyCrossReferences(node.subsections) } : {}),
    }));
  };

  const sectionsWithReferences = applyCrossReferences(sections);

  if (sectionsWithReferences.length === 0) {
    return {
      title,
      description,
      sections: [
        {
          title: "Conteúdo Importado",
          content: html.trim(),
        },
      ],
    };
  }

  return {
    title,
    description,
    sections: sectionsWithReferences,
  };
}
