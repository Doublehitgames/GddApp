"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useRouter } from "next/navigation";

interface MarkdownWithReferencesProps {
  content: string;
  projectId: string;
  sections: any[];
  referenceLinkMode?: "manager" | "document";
  documentAnchorOffset?: number;
}

interface SectionRef {
  raw: string;
  refType: 'name' | 'id';
  refValue: string;
  startIndex: number;
  endIndex: number;
}

function normalizeReferenceText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Converte URL do Google Drive para thumbnail (funciona em <img>; iframe é bloqueado por CSP do Drive). */
function toDriveThumbnailUrl(src: string): string | null {
  if (!src || !src.includes("drive.google.com")) return null;
  let id: string | null = null;
  const idMatch = src.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) id = idMatch[1];
  else {
    const fileMatch = src.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) id = fileMatch[1];
  }
  if (!id) return null;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
}

function convertMarkdownLinksInsideHtmlBlocks(content: string): string {
  if (!content || !content.includes("<")) return content;

  return content.replace(/<(p|li|td|th|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) => {
    return block.replace(
      /(?<!!)\[([^\]]+)\]\((\/[^)\s]*|#[^)\s]*|https?:\/\/[^)\s]+)\)/g,
      (_full, label: string, href: string) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
    );
  });
}

function getSectionDepth(section: any, sectionById: Map<string, any>): number {
  let depth = 0;
  let current = section;

  while (current?.parentId) {
    const parent = sectionById.get(current.parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
    if (depth > 100) break;
  }

  return depth;
}

// Extract references from content
function extractRefs(content: string): SectionRef[] {
  const references: SectionRef[] = [];
  const pattern = /\$\[([^\]]+)\]/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const rawContent = match[1].trim();
    const isId = rawContent.startsWith('#');
    
    references.push({
      raw: match[0],
      refType: isId ? 'id' : 'name',
      refValue: isId ? rawContent.substring(1) : rawContent,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return references;
}

// Find section by reference
function findSec(sections: any[], ref: SectionRef): { id: string; title: string } | null {
  if (ref.refType === 'id') {
    const found = sections.find((s: any) => s.id === ref.refValue);
    return found ? { id: found.id, title: found.title } : null;
  } else {
    const normalizedName = normalizeReferenceText(ref.refValue);
    const candidates = sections.filter(
      (s: any) => normalizeReferenceText(s.title || "") === normalizedName
    );

    if (candidates.length === 0) return null;
    if (candidates.length === 1) {
      const found = candidates[0];
      return { id: found.id, title: found.title };
    }

    const sectionById = new Map(sections.map((section: any) => [section.id, section]));
    const sortedByPriority = [...candidates].sort((a: any, b: any) => {
      const depthDiff = getSectionDepth(b, sectionById) - getSectionDepth(a, sectionById);
      if (depthDiff !== 0) return depthDiff;

      const orderA = typeof a?.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b?.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;

      return (a?.created_at || "").localeCompare(b?.created_at || "");
    });

    const best = sortedByPriority[0];
    return best ? { id: best.id, title: best.title } : null;
  }
}

/**
 * Custom markdown renderer that converts $[Section Name] or $[#id] into clickable links
 */
export function MarkdownWithReferences({
  content,
  projectId,
  sections,
  referenceLinkMode = "manager",
  documentAnchorOffset = 180,
}: MarkdownWithReferencesProps) {
  const router = useRouter();

  const buildMarkdownWithReferenceLinks = () => {
    const normalizedContent = convertMarkdownLinksInsideHtmlBlocks(content);
    const refs = extractRefs(normalizedContent);
    if (refs.length === 0) return normalizedContent;

    let result = "";
    let lastIndex = 0;

    refs.forEach((ref) => {
      if (ref.startIndex > lastIndex) {
        result += normalizedContent.substring(lastIndex, ref.startIndex);
      }

      const target = findSec(sections, ref);
      if (target) {
        const href =
          referenceLinkMode === "document"
            ? `#section-${target.id}`
            : `/projects/${projectId}/sections/${target.id}`;
        result += `<a href="${escapeHtml(href)}">${escapeHtml(target.title)}</a>`;
      } else {
        const missingRef = encodeURIComponent(ref.refValue);
        result += `<a href="/__gdd_missing__/${missingRef}">${escapeHtml(ref.refValue)}</a>`;
      }

      lastIndex = ref.endIndex;
    });

    if (lastIndex < normalizedContent.length) {
      result += normalizedContent.substring(lastIndex);
    }

    return result;
  };

  const renderedContent = buildMarkdownWithReferenceLinks();

  return (
    <div className="prose max-w-none markdown-with-refs overflow-x-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw as any]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-6 mb-3 text-white">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mt-5 mb-3 text-white">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl md:text-2xl font-semibold mt-4 mb-2 text-white">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-semibold mt-4 mb-2 text-white">{children}</h4>
          ),
          p: ({ children }) => <p className="text-gray-200 leading-7 my-2">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 my-3 text-gray-200">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-3 text-gray-200">{children}</ol>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          img: ({ src, alt }) => {
            const safeSrc = typeof src === "string" ? src.trim() : "";
            if (!safeSrc) return null;

            const driveThumb = toDriveThumbnailUrl(safeSrc);
            const imgSrc = driveThumb ?? safeSrc;

            return (
              <img
                src={imgSrc}
                alt={alt || ""}
                className="max-w-full h-auto rounded-md my-3"
                loading="lazy"
              />
            );
          },
          span: ({ node, ...props }: any) => {
            return <span {...props} />;
          },
          a: ({ href, children }) => {
            if (!href) return <a>{children}</a>;

            if (href.startsWith("/__gdd_missing__/")) {
              const missingName = decodeURIComponent(href.replace("/__gdd_missing__/", ""));
              return (
                <span
                  className="text-red-500 underline decoration-wavy cursor-help"
                  title={`Seção não encontrada: "${missingName}"`}
                >
                  {children}
                </span>
              );
            }

            if (href.startsWith("/projects/")) {
              return (
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    router.push(href);
                  }}
                  className="text-blue-400 hover:text-blue-300 underline cursor-pointer font-medium"
                  title="Ir para seção"
                >
                  {children}
                </a>
              );
            }

            if (href.startsWith("#section-")) {
              return (
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    const targetId = href.slice(1);
                    const rawSectionId = targetId.replace(/^section-/, "");
                    const targetElement =
                      document.getElementById(targetId) ||
                      (document.querySelector(`[data-section-anchor="${rawSectionId}"]`) as HTMLElement | null);
                    if (!targetElement) return;

                    const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - documentAnchorOffset;
                    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
                    window.history.replaceState(null, "", href);

                    targetElement.classList.add("gdd-anchor-highlight");
                    window.setTimeout(() => {
                      targetElement.classList.remove("gdd-anchor-highlight");
                    }, 1800);
                  }}
                  className="gdd-inline-anchor text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  title="Ir para seção no documento"
                >
                  {children}
                </a>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline cursor-pointer font-medium"
                title={typeof href === "string" ? href : undefined}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}
