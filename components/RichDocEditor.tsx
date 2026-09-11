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
import { CalloutBlock, CALLOUT_VARIANTS, type CalloutVariant } from "@/lib/richDoc/calloutBlock";
import { SpoilerBlock } from "@/lib/richDoc/spoilerBlock";
import {
  withMultiColumn,
  multiColumnDropCursor,
  getMultiColumnSlashMenuItems,
  locales as multiColumnLocales,
} from "@blocknote/xl-multi-column";
import { openGoogleDriveImagePicker, driveFileIdToImageUrl } from "@/lib/googleDrivePicker";
import type { RichDocBlock } from "@/lib/richDoc/types";
import { useI18n } from "@/lib/i18n/provider";

interface RichDocEditorProps {
  blocks: RichDocBlock[];
  editable: boolean;
  theme?: "dark" | "light";
  onChange?: (next: RichDocBlock[]) => void;
  /** Debounce window for onChange, ms. */
  debounceMs?: number;
  /**
   * Called once with the live BlockNote editor instance after it mounts.
   * Lets a wrapper drive imperative APIs (markdown import/export, cursor
   * insertion) without this component knowing about them. Optional — the
   * the description editor doesn't use it.
   */
  onReady?: (editor: unknown) => void;
}

function toInitialContent(blocks: RichDocBlock[]): PartialBlock[] | undefined {
  if (!Array.isArray(blocks) || blocks.length === 0) return undefined;
  return blocks as unknown as PartialBlock[];
}

// `withMultiColumn` adds the `columnList`/`column` pair on top of our own
// blocks, which is what lets content sit side by side — an image next to the
// text that explains it, three short columns in a row. Whatever renders blocks
// outside the editor has to know the pair too: `components/BlocksReadOnly.tsx`.
const schema = withMultiColumn(
  BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      embed: EmbedBlock(),
      callout: CalloutBlock(),
      spoiler: SpoilerBlock(),
    },
  }),
);

/** Map the app locale to the BlockNote bundled dictionaries. The packages
 *  ship a generic Portuguese (`pt`) — close enough for pt-BR — and
 *  Spanish (`es`); anything else falls back to English. The column strings
 *  come from their own package and ride along under `multi_column`. */
function pickDictionaries(locale: string) {
  const head = locale.toLowerCase().split(/[-_]/)[0];
  switch (head) {
    case "pt": return { base: bnLocales.pt, columns: multiColumnLocales.pt };
    case "es": return { base: bnLocales.es, columns: multiColumnLocales.es };
    default: return { base: bnLocales.en, columns: multiColumnLocales.en };
  }
}

/** Insert `items` right after the LAST item of `group`. Appending them to the
 *  end instead splits the group in two, and BlockNote then pushes the group
 *  label twice — twice with the same React key. */
function insertAfterGroup<T, U>(list: T[], group: string, items: U[]): (T | U)[] {
  for (let i = list.length - 1; i >= 0; i--) {
    if ((list[i] as { group?: string }).group === group) {
      return [...list.slice(0, i + 1), ...items, ...list.slice(i + 1)];
    }
  }
  return [...list, ...items];
}

export default function RichDocEditor({
  blocks,
  editable,
  theme = "dark",
  onChange,
  debounceMs = 300,
  onReady,
}: RichDocEditorProps) {
  const { locale, t } = useI18n();
  const dictionary = useMemo(() => {
    const { base, columns } = pickDictionaries(locale);
    return { ...base, multi_column: columns };
  }, [locale]);
  const mediaGroupLabel = (dictionary.slash_menu?.image?.group as string | undefined) || "Media";
  const basicGroupLabel =
    (dictionary.slash_menu?.paragraph?.group as string | undefined) || "Basic blocks";

  const editor = useCreateBlockNote({
    schema,
    initialContent: toInitialContent(blocks),
    dictionary,
    // Dragging a block onto the left or right edge of another one turns the
    // two into columns. Without this cursor the sideways drop still works,
    // but nothing on screen tells the user it is there.
    dropCursor: multiColumnDropCursor,
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

  // Hand the live editor instance to a wrapper once it exists. `editor`
  // identity is stable for the lifetime of the component, so this runs once.
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    onReadyRef.current?.(editor);
  }, [editor]);

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
        title: t("blockEditor.slashMenu.embed.title", "Embed"),
        subtext: t("blockEditor.slashMenu.embed.subtext", "YouTube, Vimeo, Loom, Streamable"),
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
        title: t("blockEditor.slashMenu.driveImage.title", "Drive Image"),
        subtext: t("blockEditor.slashMenu.driveImage.subtext", "Pick an image from Google Drive"),
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
      // The two column items come from the multi-column package already
      // localised — including their group, which is the same "basic blocks"
      // group the default items use, so they slot in there instead of
      // opening a group of their own. They ship without a React key.
      const columnItems = getMultiColumnSlashMenuItems(editor).map((item, i) => ({
        ...item,
        key: `multi-column-${i}`,
      }));
      const calloutsGroup = t("blockEditor.slashMenu.calloutsGroup", "Callouts");
      const calloutItems = CALLOUT_VARIANTS.map((variant: CalloutVariant) => ({
        key: `callout-${variant.id}`,
        title: t(`blockEditor.slashMenu.callout.${variant.id}.title`, variant.defaultTitle),
        subtext: t(`blockEditor.slashMenu.callout.${variant.id}.subtext`, variant.defaultSubtext),
        aliases: variant.aliases,
        group: calloutsGroup,
        icon: <span style={{ fontSize: 18 }}>{variant.icon}</span>,
        onItemClick: () => {
          const cursor = editor.getTextCursorPosition().block;
          editor.insertBlocks(
            [{ type: "callout", props: { variant: variant.id } }],
            cursor,
            "after",
          );
        },
      }));
      // Spoiler rides in the same group as the callouts: it is the same
      // family of block (a framed aside), only one the reader opens.
      const spoilerItem = {
        key: "spoiler",
        title: t("blockEditor.slashMenu.spoiler.title", "Spoiler"),
        subtext: t(
          "blockEditor.slashMenu.spoiler.subtext",
          "Hidden content — the reader clicks to reveal it",
        ),
        aliases: ["spoiler", "hidden", "escondido", "revelar", "reveal", "segredo", "solucao", "resposta"],
        group: calloutsGroup,
        icon: <span style={{ fontSize: 18 }}>🔒</span>,
        onItemClick: () => {
          const cursor = editor.getTextCursorPosition().block;
          editor.insertBlocks([{ type: "spoiler", props: { label: "" } }], cursor, "after");
        },
      };
      const asideItems = [...calloutItems, spoilerItem];
      // Each insertion is against the *localised* group label, so the grouping
      // survives the editor running in pt or es. The callouts are a group of
      // our own — nothing to slot into, so they just go last.
      const withMedia = insertAfterGroup(defaults, mediaGroupLabel, [embedItem, driveImageItem]);
      const withColumns = insertAfterGroup(withMedia, basicGroupLabel, columnItems);
      const combined = [...withColumns, ...asideItems];
      return filterSuggestionItems(combined, query);
    };
  }, [editor, mediaGroupLabel, basicGroupLabel, t]);

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
