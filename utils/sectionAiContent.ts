import { extractSectionRichDocMarkdown } from "@/lib/richDoc/exportSection";

/**
 * Build the full text payload sent to AI prompts for a section: the
 * section's markdown body PLUS every richDoc addon flattened to
 * markdown. Used by improve-content, suggest-tags, analyze-consistency,
 * chat-with-tools and friends so the LLM sees the same content the
 * reader would in the document view, not just `section.content`.
 *
 * Pure / synchronous so it can be called either client-side (before
 * POSTing to the API route) or server-side.
 */
export function getSectionAiContent(section: unknown): string {
  if (!section || typeof section !== "object") return "";
  const s = section as { content?: unknown };
  const baseContent = typeof s.content === "string" ? s.content.trim() : "";
  const richDocMarkdown = extractSectionRichDocMarkdown(section as never).trim();
  if (!baseContent) return richDocMarkdown;
  if (!richDocMarkdown) return baseContent;
  return `${baseContent}\n\n${richDocMarkdown}`;
}
