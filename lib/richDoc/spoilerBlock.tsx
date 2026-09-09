"use client";

import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";

/**
 * /spoiler custom block — content the reader only sees on purpose.
 *
 * The use case is a page that documents a puzzle: the walkthrough is the
 * point of the page, but the answer (the safe combination, the boss's
 * weakness) should not be in the reader's eye by accident. So the block
 * ships closed: a bar with a lock and an optional label, and the text
 * behind it appears only after a click.
 *
 * `label` is the teaser on the closed bar — "Senha do cofre" tells the
 * reader what they are about to spoil. Empty falls back to SPOILER_LABEL.
 *
 * In the editor the block is always open (you cannot write into something
 * you cannot see) and the closed state is suggested only by the dashed
 * frame; opening and closing is the read-only behaviour, and the read path
 * that actually matters is components/BlocksReadOnly.tsx.
 */

/** Shown when the block carries no label of its own. Same word in the
 *  three locales the app ships, so it needs no dictionary entry. */
export const SPOILER_LABEL = "Spoiler";

/** Marker that carries the block through markdown, in the same shape as the
 *  callout syntax the AI prompts teach. `lib/richDoc/markdownToBlocks.ts`
 *  reads it back — it repeats the literal because it must stay server-safe
 *  and cannot import this client module. */
export const SPOILER_MARKDOWN_TAG = "[!spoiler]";

export function spoilerLabelOf(props: unknown): string {
  const label = (props as { label?: unknown })?.label;
  const trimmed = typeof label === "string" ? label.trim() : "";
  return trimmed || SPOILER_LABEL;
}

interface SpoilerViewProps {
  label: string;
  editable: boolean;
  onLabelCommit: (next: string) => void;
  contentRef: (node: HTMLElement | null) => void;
}

function SpoilerView({ label, editable, onLabelCommit, contentRef }: SpoilerViewProps) {
  const [revealed, setRevealed] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const open = editable || revealed;

  return (
    <div className="rich-doc-spoiler" data-open={open ? "true" : "false"}>
      {/* contentEditable={false} keeps ProseMirror's hands off the header —
          without it the label input never gets the keystrokes. */}
      <div className="rich-doc-spoiler-bar" contentEditable={false}>
        <span className="rich-doc-spoiler-lock" aria-hidden="true">
          {open ? "🔓" : "🔒"}
        </span>
        {editable ? (
          <input
            className="rich-doc-spoiler-label-input"
            value={draftLabel}
            placeholder={SPOILER_LABEL}
            onChange={(e) => setDraftLabel(e.target.value)}
            onBlur={() => onLabelCommit(draftLabel.trim())}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                onLabelCommit(draftLabel.trim());
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="rich-doc-spoiler-toggle"
            aria-expanded={revealed}
            onClick={() => setRevealed((v) => !v)}
          >
            {draftLabel.trim() || SPOILER_LABEL}
          </button>
        )}
      </div>
      {/* The content DOM stays mounted even while closed — ProseMirror needs
          it to exist — so hiding is CSS, never unmounting. */}
      <div
        className="rich-doc-spoiler-content"
        ref={contentRef}
        style={open ? undefined : { display: "none" }}
      />
    </div>
  );
}

export const SpoilerBlock = createReactBlockSpec(
  {
    type: "spoiler",
    propSchema: {
      label: { default: "" },
    },
    content: "inline",
  },
  {
    render: ({ block, editor, contentRef }) => {
      const label = (block.props as { label?: string }).label;
      return (
        <SpoilerView
          label={typeof label === "string" ? label : ""}
          editable={editor.isEditable}
          onLabelCommit={(next) => {
            if (next === label) return;
            editor.updateBlock(block, { type: "spoiler", props: { label: next } });
          }}
          contentRef={contentRef}
        />
      );
    },

    /**
     * What the block becomes outside the editor — the markdown mirror kept
     * on `section.content` (and from there the md/PDF/Word export) comes from
     * this. An export cannot be clicked open, so it reveals the text and
     * keeps the `[!spoiler]` marker: the label still warns the reader, and
     * `markdownToBlocks` reads the marker back into a real spoiler block.
     */
    toExternalHTML: ({ block, contentRef }) => (
      <blockquote>
        <p>{`${SPOILER_MARKDOWN_TAG} ${spoilerLabelOf(block.props)}`}</p>
        <p ref={contentRef} />
      </blockquote>
    ),
  },
);
