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
import * as bnLocales from "@blocknote/core/locales";
import { EmbedBlock, toEmbedUrl } from "@/lib/richDoc/embedBlock";
import { StatBlock } from "@/lib/richDoc/statBlock";
import { openGoogleDriveImagePicker, driveFileIdToImageUrl } from "@/lib/googleDrivePicker";
import type { RichDocBlock } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";

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
    stat: StatBlock(),
  },
});

/** Map the app locale to a BlockNote bundled dictionary. The package
 *  ships a generic Portuguese (`pt`) — close enough for pt-BR — and
 *  Spanish (`es`); anything else falls back to English. */
function pickBlockNoteDictionary(locale: string) {
  const head = locale.toLowerCase().split(/[-_]/)[0];
  switch (head) {
    case "pt": return bnLocales.pt;
    case "es": return bnLocales.es;
    default: return bnLocales.en;
  }
}

export default function RichDocEditor({
  blocks,
  editable,
  theme = "dark",
  onChange,
  debounceMs = 300,
}: RichDocEditorProps) {
  const { locale, t } = useI18n();
  const dictionary = useMemo(() => pickBlockNoteDictionary(locale), [locale]);
  const mediaGroupLabel = (dictionary.slash_menu?.image?.group as string | undefined) || "Media";

  const editor = useCreateBlockNote({
    schema,
    initialContent: toInitialContent(blocks),
    dictionary,
    tables: {
      splitCells: true,
      cellBackgroundColor: true,
      cellTextColor: true,
      headers: true,
    },
    // Auto-embed: when the user pastes ONLY a recognised video URL
    // (no extra text), insert an Embed block instead of a plain link.
    // Mixed pastes (paragraph with a URL inside) fall through to the
    // default markdown/plain paste behaviour so we don't surprise the
    // user mid-paragraph.
    pasteHandler: ({ event, editor: ed, defaultPasteHandler }) => {
      const text = event.clipboardData?.getData("text/plain") || "";
      const trimmed = text.trim();
      if (trimmed && !/\s/.test(trimmed) && toEmbedUrl(trimmed)) {
        const cursor = ed.getTextCursorPosition().block;
        ed.insertBlocks(
          [{ type: "embed", props: { url: trimmed } }],
          cursor,
          "after",
        );
        return true;
      }
      return defaultPasteHandler();
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
        title: t("richDocAddon.slashMenu.embed.title", "Embed"),
        subtext: t("richDocAddon.slashMenu.embed.subtext", "YouTube, Vimeo, Loom, Streamable"),
        aliases: ["video", "youtube", "vimeo", "iframe", "embed"],
        group: mediaGroupLabel,
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
      const driveImageItem = {
        key: "drive-image",
        title: t("richDocAddon.slashMenu.driveImage.title", "Drive Image"),
        subtext: t("richDocAddon.slashMenu.driveImage.subtext", "Pick an image from Google Drive"),
        aliases: ["image", "drive", "google", "upload", "picture", "img"],
        group: mediaGroupLabel,
        icon: <span style={{ fontSize: 18 }}>🖼️</span>,
        onItemClick: async () => {
          try {
            const picked = await openGoogleDriveImagePicker();
            if (!picked) return;
            const url = driveFileIdToImageUrl(picked.id);
            const cursor = editor.getTextCursorPosition().block;
            editor.insertBlocks(
              [{ type: "image", props: { url, caption: picked.name } }],
              cursor,
              "after",
            );
          } catch (e) {
            // Picker errors (no client id, oauth denial) are surfaced
            // via console; the empty state in the embed/image block
            // already gives the user a manual URL fallback.
            console.error("[richDoc] Drive picker failed:", e);
          }
        },
      };
      // Append right after the LAST item in the Media group, otherwise we
      // split the group in half and BlockNote pushes two separate
      // group labels with the same React key. Compare against the
      // *localised* group label so this still works when the editor's
      // dictionary is pt or es.
      let lastMediaIdx = -1;
      for (let i = defaults.length - 1; i >= 0; i--) {
        if ((defaults[i] as { group?: string }).group === mediaGroupLabel) {
          lastMediaIdx = i;
          break;
        }
      }
      const gameDesignGroup = t("richDocAddon.slashMenu.gameDesignGroup", "Game Design");
      const statItem = {
        key: "stat",
        title: t("richDocAddon.slashMenu.stat.title", "Stat"),
        subtext: t("richDocAddon.slashMenu.stat.subtext", "Inline attribute (STR: 18 +4) — links to Field Library"),
        aliases: ["stat", "attribute", "atributo", "atributos", "value"],
        group: gameDesignGroup,
        icon: <span style={{ fontSize: 18 }}>📊</span>,
        onItemClick: () => {
          const cursor = editor.getTextCursorPosition().block;
          editor.insertBlocks(
            [{ type: "stat", props: { labelKey: "", valueText: "", modifier: "" } }],
            cursor,
            "after",
          );
        },
      };
      const combined = lastMediaIdx >= 0
        ? [...defaults.slice(0, lastMediaIdx + 1), embedItem, driveImageItem, ...defaults.slice(lastMediaIdx + 1), statItem]
        : [...defaults, embedItem, driveImageItem, statItem];
      return filterSuggestionItems(combined, query);
    };
  }, [editor, mediaGroupLabel, t]);

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
