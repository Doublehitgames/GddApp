"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useEffect, useMemo, useRef } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  filterSuggestionItems,
  type PartialBlock,
} from "@blocknote/core";
import { EmbedBlock } from "@/lib/richDoc/embedBlock";
import type { RichDocBlock } from "@/lib/addons/types";

interface RichDocEditorProps {
  blocks: RichDocBlock[];
  editable: boolean;
  theme?: "dark" | "light";
  onChange?: (next: RichDocBlock[]) => void;
  /** Debounce window for onChange, ms. */
  debounceMs?: number;
}

function toInitialContent(blocks: RichDocBlock[]): PartialBlock[] | undefined {
  if (!Array.isArray(blocks) || blocks.length === 0) return undefined;
  return blocks as unknown as PartialBlock[];
}

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    embed: EmbedBlock(),
  },
});

export default function RichDocEditor({
  blocks,
  editable,
  theme = "dark",
  onChange,
  debounceMs = 300,
}: RichDocEditorProps) {
  const editor = useCreateBlockNote({
    schema,
    initialContent: toInitialContent(blocks),
    tables: {
      splitCells: true,
      cellBackgroundColor: true,
      cellTextColor: true,
      headers: true,
    },
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editable) return;
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [editable]);

  const getSlashMenuItems = useMemo(() => {
    return async (query: string) => {
      const defaults = getDefaultReactSlashMenuItems(editor);
      const embedItem = {
        key: "embed",
        title: "Embed",
        subtext: "YouTube, Vimeo, Loom, Streamable",
        aliases: ["video", "youtube", "vimeo", "iframe", "embed"],
        group: "Media",
        icon: <span style={{ fontSize: 18 }}>🎬</span>,
        onItemClick: () => {
          const cursor = editor.getTextCursorPosition().block;
          editor.insertBlocks(
            [{ type: "embed", props: { url: "" } }],
            cursor,
            "after",
          );
        },
      };
      // Append right after the LAST item in the Media group, otherwise we
      // split the group in half and BlockNote pushes two separate "Media"
      // labels with the same React key.
      let lastMediaIdx = -1;
      for (let i = defaults.length - 1; i >= 0; i--) {
        if ((defaults[i] as { group?: string }).group === "Media") {
          lastMediaIdx = i;
          break;
        }
      }
      const combined = lastMediaIdx >= 0
        ? [...defaults.slice(0, lastMediaIdx + 1), embedItem, ...defaults.slice(lastMediaIdx + 1)]
        : [...defaults, embedItem];
      return filterSuggestionItems(combined, query);
    };
  }, [editor]);

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      theme={theme}
      slashMenu={false}
      onChange={() => {
        if (!onChangeRef.current) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          const next = editor.document as unknown as RichDocBlock[];
          onChangeRef.current?.(next);
        }, debounceMs);
      }}
    >
      <SuggestionMenuController triggerCharacter="/" getItems={getSlashMenuItems} />
    </BlockNoteView>
  );
}
