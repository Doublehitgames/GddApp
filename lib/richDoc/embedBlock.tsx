"use client";

import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";

/**
 * Detect a known video/iframe-embed URL and convert it to its canonical
 * embed form. Returns null when the URL is not recognised so the block
 * can fall back to its empty/edit state.
 */
export function toEmbedUrl(raw: string): { src: string; provider: string } | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url) return null;

  // YouTube — watch, short link, embed, shorts.
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  if (yt) {
    return { src: `https://www.youtube.com/embed/${yt[1]}`, provider: "youtube" };
  }

  // Vimeo — vimeo.com/ID and player.vimeo.com/video/ID.
  const vimeo = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d{4,})/);
  if (vimeo) {
    return { src: `https://player.vimeo.com/video/${vimeo[1]}`, provider: "vimeo" };
  }

  // Loom — loom.com/share/ID and loom.com/embed/ID.
  const loom = url.match(/loom\.com\/(?:share|embed)\/([A-Za-z0-9]{20,})/);
  if (loom) {
    return { src: `https://www.loom.com/embed/${loom[1]}`, provider: "loom" };
  }

  // Streamable — streamable.com/ID.
  const streamable = url.match(/streamable\.com\/(?:e\/)?([A-Za-z0-9]{4,})/);
  if (streamable) {
    return { src: `https://streamable.com/e/${streamable[1]}`, provider: "streamable" };
  }

  return null;
}

export const EmbedBlock = createReactBlockSpec(
  {
    type: "embed",
    propSchema: {
      url: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const url = (block.props as { url?: string }).url || "";
      const embed = toEmbedUrl(url);
      const editable = editor.isEditable;

      if (!embed) {
        return (
          <EmbedEmptyState
            initialUrl={url}
            editable={editable}
            onSubmit={(nextUrl) => {
              editor.updateBlock(block, { type: "embed", props: { url: nextUrl } });
            }}
          />
        );
      }

      return (
        <div
          className="rich-doc-embed-frame"
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "56.25%",
            background: "#000",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <iframe
            src={embed.src}
            title={`Embedded ${embed.provider}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
          />
        </div>
      );
    },
  },
);

interface EmbedEmptyStateProps {
  initialUrl: string;
  editable: boolean;
  onSubmit: (url: string) => void;
}

function EmbedEmptyState({ initialUrl, editable, onSubmit }: EmbedEmptyStateProps) {
  const [draft, setDraft] = useState(initialUrl);
  const trimmed = draft.trim();
  const isInvalidShape = trimmed.length > 0 && !toEmbedUrl(trimmed);

  if (!editable) {
    return (
      <div
        style={{
          width: "100%",
          padding: "16px",
          borderRadius: 6,
          border: "1px dashed currentColor",
          opacity: 0.6,
          textAlign: "center",
          fontSize: 13,
        }}
      >
        Embed sem URL
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        padding: "12px",
        borderRadius: 6,
        border: "1px dashed rgba(148, 163, 184, 0.5)",
        background: "rgba(15, 23, 42, 0.4)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <label style={{ fontSize: 12, opacity: 0.7 }}>
        Cole a URL do vídeo (YouTube, Vimeo, Loom, Streamable)
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="url"
          value={draft}
          autoFocus
          placeholder="https://www.youtube.com/watch?v=..."
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmed && !isInvalidShape) {
              e.preventDefault();
              onSubmit(trimmed);
            }
          }}
          style={{
            flex: 1,
            background: "rgba(0, 0, 0, 0.4)",
            color: "inherit",
            border: "1px solid rgba(148, 163, 184, 0.4)",
            borderRadius: 4,
            padding: "6px 10px",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          type="button"
          disabled={!trimmed || isInvalidShape}
          onClick={() => onSubmit(trimmed)}
          style={{
            padding: "6px 12px",
            borderRadius: 4,
            border: "1px solid rgba(165, 180, 252, 0.5)",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.6), rgba(217, 70, 239, 0.55))",
            color: "white",
            cursor: !trimmed || isInvalidShape ? "not-allowed" : "pointer",
            opacity: !trimmed || isInvalidShape ? 0.5 : 1,
            fontSize: 13,
          }}
        >
          Embed
        </button>
      </div>
      {isInvalidShape && (
        <div style={{ fontSize: 11, color: "rgb(252, 165, 165)" }}>
          URL não reconhecida. Suporte: YouTube, Vimeo, Loom, Streamable.
        </div>
      )}
    </div>
  );
}
