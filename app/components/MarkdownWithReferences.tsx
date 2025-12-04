"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

  // If no references, just render normal markdown
  if (refs.length === 0) {
    return (
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  // Build segments
  const segments: Array<{ type: 'text' | 'link'; content: string; sectionId?: string | null; sectionName?: string }> = [];
  let lastIndex = 0;

  refs.forEach((ref) => {
    // Add text before this reference
    if (ref.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: content.substring(lastIndex, ref.startIndex),
      });
    }

    // Add the reference
    const target = findSec(sections, ref);
    segments.push({
      type: 'link',
      content: target?.title || ref.refValue,
      sectionId: target?.id || null,
      sectionName: target?.title,
    });

    lastIndex = ref.endIndex;
  });

  // Add remaining text
  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      content: content.substring(lastIndex),
    });
  }

  // Render with proper inline handling
  return (
    <div className="prose prose-invert max-w-none markdown-with-refs">
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return (
            <ReactMarkdown 
              key={idx} 
              remarkPlugins={[remarkGfm]}
              components={{
                // Force inline rendering for text segments
                p: ({ children }) => <span className="inline-block">{children}</span>,
              }}
            >
              {seg.content}
            </ReactMarkdown>
          );
        } else {
          // Render link inline
          if (seg.sectionId) {
            return (
              <button
                key={idx}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(`/projects/${projectId}/sections/${seg.sectionId}`);
                }}
                className="text-blue-400 hover:text-blue-300 underline cursor-pointer font-medium inline mx-0.5"
                title={`Ir para: ${seg.sectionName || seg.content}`}
              >
                {seg.content}
              </button>
            );
          } else {
            return (
              <span
                key={idx}
                className="text-red-500 underline decoration-wavy cursor-help inline mx-0.5"
                title={`Seção não encontrada: "${seg.content}"`}
              >
                {seg.content}
              </span>
            );
          }
        }
      })}
    </div>
  );
}
