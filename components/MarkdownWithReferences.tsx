"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { useRouter } from "next/navigation";

interface MarkdownWithReferencesProps {
  content: string;
  projectId: string;
  sections: any[];
}

interface SectionRef {
  raw: string;
  refType: 'name' | 'id';
  refValue: string;
  startIndex: number;
  endIndex: number;
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
    const normalizedName = ref.refValue.toLowerCase().trim();
    const found = sections.find(
      (s: any) => s.title.toLowerCase().trim() === normalizedName
    );
    return found ? { id: found.id, title: found.title } : null;
  }
}

/**
 * Custom markdown renderer that converts $[Section Name] or $[#id] into clickable links
 */
export function MarkdownWithReferences({
  content,
  projectId,
  sections,
}: MarkdownWithReferencesProps) {
  const router = useRouter();
  const refs = extractRefs(content);

  const buildMarkdownWithReferenceLinks = () => {
    if (refs.length === 0) return content;

    let result = "";
    let lastIndex = 0;

    refs.forEach((ref) => {
      if (ref.startIndex > lastIndex) {
        result += content.substring(lastIndex, ref.startIndex);
      }

      const target = findSec(sections, ref);
      if (target) {
        const href = `/projects/${projectId}/sections/${target.id}`;
        result += `[${target.title}](${href})`;
      } else {
        const missingRef = encodeURIComponent(ref.refValue);
        result += `[${ref.refValue}](/__gdd_missing__/${missingRef})`;
      }

      lastIndex = ref.endIndex;
    });

    if (lastIndex < content.length) {
      result += content.substring(lastIndex);
    }

    return result;
  };

  const renderedContent = buildMarkdownWithReferenceLinks();

  return (
    <div className="prose max-w-none markdown-with-refs">
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
          em: ({ children }) => <em className="italic text-gray-100">{children}</em>,
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

            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
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
