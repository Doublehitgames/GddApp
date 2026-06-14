"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
} from "react";
import type { RichDocBlock } from "@/lib/addons/types";

const RichDocEditor = dynamic(() => import("@/components/RichDocEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-950/40 text-xs text-gray-500">
      …
    </div>
  ),
});

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

/**
 * True when a block document carries no real content — empty array, or only
 * empty paragraphs (the state a freshly-created BlockNote editor is in).
 */
export function isRichDocEmpty(blocks: unknown): boolean {
  if (!Array.isArray(blocks) || blocks.length === 0) return true;
  return blocks.every((b) => {
    const block = b as { type?: string; content?: unknown; children?: unknown[] };
    const content = block?.content;
    const hasText =
      Array.isArray(content) &&
      content.some((n) => {
        const node = n as { text?: string };
        return typeof node?.text === "string" && node.text.trim() !== "";
      });
    const hasChildren = Array.isArray(block?.children) && block.children.length > 0;
    const isPlainContainer = block?.type === undefined || block?.type === "paragraph";
    return !hasText && !hasChildren && isPlainContainer;
  });
}

export interface SectionDescriptionEditorApi {
  getBlocks: () => RichDocBlock[];
  getMarkdown: () => string;
  insertText: (text: string) => void;
}

interface SectionDescriptionEditorProps {
  initialBlocks?: RichDocBlock[];
  markdown: string;
  minHeight?: string;
  apiRef: MutableRefObject<SectionDescriptionEditorApi | null>;
  onChange?: (blocks: RichDocBlock[], markdown: string) => void;
  /** Section list for the $[ cross-reference autocomplete. */
  sections?: { id: string; title: string }[];
}

// ---------------------------------------------------------------------------
// Section-ref overlay helpers
// ---------------------------------------------------------------------------

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\p{Emoji_Presentation}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFilteredSections(
  sections: { id: string; title: string }[],
  query: string,
): { id: string; title: string }[] {
  if (!query) return sections.slice(0, 12);
  const q = normalizeForSearch(query);
  return sections
    .filter((s) => {
      const t = normalizeForSearch(s.title);
      return t.includes(q);
    })
    .slice(0, 12);
}

interface RefOverlayProps {
  query: string;
  sections: { id: string; title: string }[];
  selectedIdx: number;
  position: { top: number; left: number };
  onSelect: (section: { id: string; title: string }) => void;
  onClose: () => void;
}

function SectionRefOverlay({ query, sections, selectedIdx, position, onSelect, onClose }: RefOverlayProps) {
  const filtered = getFilteredSections(sections, query);
  const listRef = useRef<HTMLUListElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  // Clamp left so the popup doesn't overflow the viewport
  const left = Math.min(position.left, Math.max(0, window.innerWidth - 320));
  // If cursor is near bottom, flip above
  const top =
    position.top + 280 > window.innerHeight
      ? position.top - 280 - 8
      : position.top;

  if (filtered.length === 0) {
    return (
      <div
        style={{ position: "fixed", top, left, zIndex: 9999 }}
        className="w-72 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-400 shadow-xl"
      >
        Nenhuma seção encontrada para &ldquo;{query}&rdquo;
        <button type="button" onClick={onClose} className="ml-2 text-gray-500 hover:text-gray-300">[esc]</button>
      </div>
    );
  }

  return (
    <div
      style={{ position: "fixed", top, left, zIndex: 9999 }}
      className="w-72 rounded-lg border border-gray-700 bg-gray-900 shadow-xl"
    >
      <div className="border-b border-gray-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        Lincar seção — Enter para inserir
      </div>
      <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
        {filtered.map((section, idx) => (
          <li key={section.id}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // keep editor focused
                onSelect(section);
              }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                idx === selectedIdx
                  ? "bg-indigo-600/30 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              {section.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export default function SectionDescriptionEditor({
  initialBlocks,
  markdown,
  minHeight,
  apiRef,
  onChange,
  sections,
}: SectionDescriptionEditorProps) {
  const blocksSeedRef = useRef(initialBlocks);
  const markdownSeedRef = useRef(markdown);
  const initializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const lastBlocksJsonRef = useRef<string>("");
  const editorInstanceRef = useRef<any>(null);

  // Ref-suggestion overlay state
  const [refSuggest, setRefSuggest] = useState<{
    query: string;
    pos: { top: number; left: number };
  } | null>(null);
  const [refSelectedIdx, setRefSelectedIdx] = useState(0);
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const handleReady = (editor: any) => {
    editorInstanceRef.current = editor;
    apiRef.current = {
      getBlocks: () => {
        try {
          return (editor.document as RichDocBlock[]) || [];
        } catch (e) {
          console.error("[sectionDesc] read blocks failed:", e);
          return [];
        }
      },
      getMarkdown: () => {
        try {
          return editor.blocksToMarkdownLossy(editor.document) || "";
        } catch (e) {
          console.error("[sectionDesc] blocks→markdown failed:", e);
          return "";
        }
      },
      insertText: (text: string) => {
        try {
          editor.insertInlineContent([text]);
        } catch (e) {
          console.error("[sectionDesc] insertText failed:", e);
        }
      },
    };

    if (initializedRef.current) {
      try {
        if (isRichDocEmpty(editor.document) && lastBlocksJsonRef.current) {
          const prev = JSON.parse(lastBlocksJsonRef.current);
          if (Array.isArray(prev) && !isRichDocEmpty(prev)) {
            editor.replaceBlocks(editor.document, prev);
          }
        }
      } catch (e) {
        console.error("[sectionDesc] re-seed on remount failed:", e);
      }
      lastBlocksJsonRef.current = safeJson(editor.document);
      return;
    }
    initializedRef.current = true;

    const blocks = blocksSeedRef.current;
    try {
      if (Array.isArray(blocks) && blocks.length > 0) {
        editor.replaceBlocks(editor.document, blocks);
      } else {
        const seed = (markdownSeedRef.current || "").trim();
        if (seed) {
          const parsed = editor.tryParseMarkdownToBlocks(seed);
          if (Array.isArray(parsed) && parsed.length > 0) {
            editor.replaceBlocks(editor.document, parsed);
          }
        }
      }
    } catch (e) {
      console.error("[sectionDesc] seed failed:", e);
    }
    lastBlocksJsonRef.current = safeJson(editor.document);
  };

  const handleEditorChange = (blocks: RichDocBlock[]) => {
    const json = safeJson(blocks);
    if (json === lastBlocksJsonRef.current) return;
    lastBlocksJsonRef.current = json;
    let md = "";
    try {
      md = editorInstanceRef.current?.blocksToMarkdownLossy?.(blocks) || "";
    } catch (e) {
      console.error("[sectionDesc] blocks→markdown (onChange) failed:", e);
    }
    onChangeRef.current?.(blocks, md);
  };

  useEffect(() => {
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  // ------------------------------------------------------------------
  // $[ cross-reference autocomplete
  // ------------------------------------------------------------------

  const checkForRefTrigger = useCallback(() => {
    if (!editorInstanceRef.current || !sectionsRef.current?.length) {
      if (refSuggest) setRefSuggest(null);
      return;
    }
    try {
      const tiptap = (editorInstanceRef.current as any)._tiptapEditor;
      if (!tiptap) return;
      const { from } = tiptap.state.selection;
      if (!from) return;
      const textBefore: string = tiptap.state.doc.textBetween(Math.max(0, from - 200), from);
      const match = textBefore.match(/\$\[([^\]]*)$/);
      if (match) {
        const sel = window.getSelection();
        let pos = refSuggest?.pos ?? { top: 0, left: 0 };
        if (sel?.rangeCount) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          if (rect.width > 0 || rect.height > 0) {
            pos = { top: rect.bottom + 4, left: rect.left };
          }
        }
        setRefSuggest({ query: match[1], pos });
        if (match[1] !== refSuggest?.query) setRefSelectedIdx(0);
      } else {
        if (refSuggest) setRefSuggest(null);
      }
    } catch {
      if (refSuggest) setRefSuggest(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertSectionRef = useCallback((section: { id: string; title: string }) => {
    if (!editorInstanceRef.current) return;
    try {
      const tiptap = (editorInstanceRef.current as any)._tiptapEditor;
      if (!tiptap) return;
      const { from: pos } = tiptap.state.selection;
      const textBefore: string = tiptap.state.doc.textBetween(Math.max(0, pos - 200), pos);
      const match = textBefore.match(/\$\[([^\]]*)$/);
      if (!match) return;
      const from = pos - match[0].length;
      tiptap.chain().focus().deleteRange({ from, to: pos }).insertContent(`$[${section.title}]`).run();
    } catch (e) {
      console.error("[sectionDesc] insertRef failed:", e);
    }
    setRefSuggest(null);
  }, []);

  const handleHostKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!refSuggest) return;
      const filtered = getFilteredSections(sectionsRef.current || [], refSuggest.query);
      if (e.key === "Escape") {
        e.preventDefault();
        setRefSuggest(null);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setRefSelectedIdx((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setRefSelectedIdx((prev) => (prev - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length));
      } else if (e.key === "Enter" || e.key === "Tab") {
        const chosen = filtered[refSelectedIdx];
        if (chosen) {
          e.preventDefault();
          insertSectionRef(chosen);
        }
      }
    },
    [refSuggest, refSelectedIdx, insertSectionRef],
  );

  return (
    <div
      className="rich-doc-editor-host section-description-editor"
      style={minHeight ? { minHeight } : undefined}
      onKeyUp={checkForRefTrigger}
      onKeyDown={handleHostKeyDown}
    >
      <RichDocEditor blocks={[]} editable theme="dark" onReady={handleReady} onChange={handleEditorChange} />
      {refSuggest && (
        <SectionRefOverlay
          query={refSuggest.query}
          sections={sectionsRef.current || []}
          selectedIdx={refSelectedIdx}
          position={refSuggest.pos}
          onSelect={insertSectionRef}
          onClose={() => setRefSuggest(null)}
        />
      )}
    </div>
  );
}
