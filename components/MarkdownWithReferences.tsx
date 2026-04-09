"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { resolveProjectSpecialTokens, type ProjectTokenSource } from "@/lib/addons/projectSpecialTokens";
import { convertYouTubeEditorPlaceholdersToEmbeds } from "@/utils/youtubeEmbeds";

interface MarkdownWithReferencesProps {
  content: string;
  projectId: string;
  sections: any[];
  projectTokenSource?: ProjectTokenSource;
  referenceLinkMode?: "manager" | "document";
  documentAnchorOffset?: number;
  resolveDocumentAnchorPreview?: (
    sectionId: string
  ) => {
    title: string;
    shortDescription: string;
  } | null;
}

interface SectionRef {
  raw: string;
  refType: 'name' | 'id';
  refValue: string;
  startIndex: number;
  endIndex: number;
}

interface PendingAnchorNavigation {
  href: string;
  targetId: string;
  rawSectionId: string;
  title: string;
  shortDescription: string;
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

function normalizeEscapedBlockquotes(content: string): string {
  if (!content || (!content.includes("&gt;") && !content.includes("&#62;"))) return content;

  let normalized = content
    .replace(/(^|\n)([ \t]*)&gt;[ \t]?/g, "$1$2> ")
    .replace(/(^|\n)([ \t]*)&#62;[ \t]?/g, "$1$2> ");

  normalized = normalized.replace(
    /((?:<p\b[^>]*>\s*(?:&gt;|&#62;)\s*[\s\S]*?<\/p>\s*)+)/gi,
    (group) => {
      const matches = Array.from(
        group.matchAll(/<p\b([^>]*)>\s*(?:&gt;|&#62;)\s*([\s\S]*?)<\/p>/gi)
      );

      if (matches.length === 0) return group;

      const paragraphs = matches
        .map((match) => {
          const attrs = match[1] || "";
          const inner = match[2] || "";
          return `<p${attrs}>${inner}</p>`;
        })
        .join("");

      return `<blockquote>${paragraphs}</blockquote>`;
    }
  );

  return normalized;
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
  projectTokenSource,
  referenceLinkMode = "manager",
  documentAnchorOffset = 180,
  resolveDocumentAnchorPreview,
}: MarkdownWithReferencesProps) {
  const router = useRouter();
  const { t } = useI18n();
  const isDocumentMode = referenceLinkMode === "document";
  const [pendingAnchorNavigation, setPendingAnchorNavigation] = useState<PendingAnchorNavigation | null>(null);
  const anchorPreviewCardRef = useRef<HTMLDivElement>(null);
  const markdownRootRef = useRef<HTMLDivElement>(null);

  const navigateToDocumentAnchor = (href: string, targetId: string, rawSectionId: string) => {
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
  };

  useEffect(() => {
    if (!pendingAnchorNavigation) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (anchorPreviewCardRef.current?.contains(event.target as Node)) return;
      setPendingAnchorNavigation(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingAnchorNavigation(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pendingAnchorNavigation]);

  const buildMarkdownWithReferenceLinks = () => {
    const contentWithResolvedTokens = resolveProjectSpecialTokens(content, {
      updatedAt: projectTokenSource?.updatedAt,
      sections: projectTokenSource?.sections ?? sections,
    });
    const normalizedContent = normalizeEscapedBlockquotes(
      convertYouTubeEditorPlaceholdersToEmbeds(
        convertMarkdownLinksInsideHtmlBlocks(contentWithResolvedTokens)
      )
    );
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

  useEffect(() => {
    const root = markdownRootRef.current;
    if (!root) return;

    const tables = root.querySelectorAll("table");

    tables.forEach((table) => {
      const headerCells = table.querySelectorAll("thead th");
      const headersFromThead = Array.from(headerCells).map((cell) => cell.textContent?.trim() || "");

      const fallbackHeaderCells = headersFromThead.length
        ? []
        : Array.from(table.querySelectorAll("tr:first-child th")).map((cell) => cell.textContent?.trim() || "");

      const headers = (headersFromThead.length ? headersFromThead : fallbackHeaderCells).map((label, index) => {
        const text = label.trim();
        return text || `${t("common.column", "Coluna")} ${index + 1}`;
      });

      const bodyRows = table.querySelectorAll("tbody tr");
      const rows = bodyRows.length ? bodyRows : table.querySelectorAll("tr");

      rows.forEach((row, rowIndex) => {
        if (!bodyRows.length && rowIndex === 0 && row.querySelectorAll("th").length > 0) {
          return;
        }

        const cells = row.querySelectorAll("td");
        cells.forEach((cell, cellIndex) => {
          const label = headers[cellIndex] || `${t("common.column", "Coluna")} ${cellIndex + 1}`;
          cell.setAttribute("data-label", label);
        });
      });
    });
  }, [renderedContent, t]);

  return (
    <div ref={markdownRootRef} className="prose max-w-none markdown-with-refs overflow-x-auto">
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
          p: ({ children }) => (
            <p className={`${isDocumentMode ? "text-gray-700" : "text-gray-200"} leading-7 my-2`}>{children}</p>
          ),
          ul: ({ children }) => <ul className="list-disc pl-6 my-3 text-gray-200">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-3 text-gray-200">{children}</ol>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote
              className="my-4"
              style={{
                padding: "0.65rem 0.9rem",
                borderLeft: isDocumentMode ? "4px solid #94a3b8" : "4px solid #60a5fa",
                borderRadius: "0 0.5rem 0.5rem 0",
                background: isDocumentMode ? "rgba(241, 245, 249, 0.9)" : "rgba(59, 130, 246, 0.1)",
                color: isDocumentMode ? "#334155" : "#e5e7eb",
              }}
            >
              {children}
            </blockquote>
          ),
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

            // Detect section reference links in both formats:
            // Document mode: #section-{id}
            // Manager mode: /projects/{projectId}/sections/{id}
            const sectionHashMatch = href.startsWith("#section-") ? href.slice("#section-".length) : null;
            const sectionPathMatch = href.match(/\/projects\/[^/]+\/sections\/([^/]+)$/)?.[1] ?? null;
            const refSectionId = sectionHashMatch || sectionPathMatch;

            if (refSectionId) {
              return (
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    const anchorPreview = resolveDocumentAnchorPreview?.(refSectionId) || null;

                    if (anchorPreview) {
                      setPendingAnchorNavigation({
                        href,
                        targetId: `section-${refSectionId}`,
                        rawSectionId: refSectionId,
                        title: anchorPreview.title,
                        shortDescription: anchorPreview.shortDescription,
                      });
                      return;
                    }

                    // Fallback: direct navigation
                    if (referenceLinkMode === "manager") {
                      router.push(`/projects/${projectId}/sections/${refSectionId}`);
                    } else {
                      navigateToDocumentAnchor(href, `section-${refSectionId}`, refSectionId);
                    }
                  }}
                  className="gdd-inline-anchor text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  title={t("view.anchorPreview.goToSection")}
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
      {pendingAnchorNavigation && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4 flex items-center justify-center">
          <div
            ref={anchorPreviewCardRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("view.anchorPreview.title")}
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("view.anchorPreview.title")}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">
                {pendingAnchorNavigation.title}
              </h3>
            </div>
            <div className="px-5 py-4">
              {pendingAnchorNavigation.shortDescription ? (
                <div className="prose prose-sm max-w-none markdown-with-refs text-gray-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw as any]}>
                    {normalizeEscapedBlockquotes(
                      convertMarkdownLinksInsideHtmlBlocks(pendingAnchorNavigation.shortDescription)
                    )}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm leading-6 text-gray-700">
                  {t("view.anchorPreview.noDescription")}
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAnchorNavigation(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  if (referenceLinkMode === "manager") {
                    router.push(`/projects/${projectId}/sections/${pendingAnchorNavigation.rawSectionId}`);
                  } else {
                    navigateToDocumentAnchor(
                      pendingAnchorNavigation.href,
                      pendingAnchorNavigation.targetId,
                      pendingAnchorNavigation.rawSectionId
                    );
                  }
                  setPendingAnchorNavigation(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("view.anchorPreview.goButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
