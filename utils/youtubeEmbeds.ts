const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{6,}$/;

export function extractYouTubeVideoId(rawInput: string): string | null {
  const input = String(rawInput || "").trim();
  if (!input) return null;

  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (host === "youtu.be") {
      const id = pathParts[0] || "";
      return YOUTUBE_ID_RE.test(id) ? id : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (url.pathname === "/watch") {
        const id = (url.searchParams.get("v") || "").trim();
        return YOUTUBE_ID_RE.test(id) ? id : null;
      }

      if (pathParts[0] === "shorts" || pathParts[0] === "embed" || pathParts[0] === "live") {
        const id = pathParts[1] || "";
        return YOUTUBE_ID_RE.test(id) ? id : null;
      }
    }
  } catch {
    // fallback below
  }

  const fallback = input.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{6,})/i);
  const id = fallback?.[1] || "";
  return YOUTUBE_ID_RE.test(id) ? id : null;
}

function buildYouTubeEmbedIframe(videoId: string): string {
  const safeId = String(videoId || "").trim();
  return `<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/${safeId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
}

function extractVideoIdFromYouTubeThumbnailUrl(rawUrl: string): string | null {
  const url = String(rawUrl || "").trim();
  if (!url) return null;

  const match = url.match(/(?:https?:)?\/\/i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{6,})\//i);
  const id = match?.[1] || "";
  return YOUTUBE_ID_RE.test(id) ? id : null;
}

export function buildYouTubeEditorPlaceholder(videoId: string): string {
  const safeId = String(videoId || "").trim();
  const thumbUrl = `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg`;
  const watchUrl = `https://youtu.be/${safeId}`;

  return [
    `<div data-gdd-youtube-id="${safeId}" class="gdd-youtube-placeholder">`,
    `  <p><strong>Video do YouTube incorporado</strong></p>`,
    `  <p><a href="${watchUrl}" target="_blank" rel="noopener noreferrer">Abrir no YouTube</a></p>`,
    `  <p><img src="${thumbUrl}" alt="Previa do video do YouTube" /></p>`,
    `</div>`,
  ].join("\n");
}

function extractVideoIdFromIframeTag(iframeTag: string): string | null {
  const srcMatch = iframeTag.match(/\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
  const src = (srcMatch?.[1] || srcMatch?.[2] || "").trim();
  if (!src) return null;
  return extractYouTubeVideoId(src);
}

export function convertYouTubeEmbedsToEditorPlaceholders(content: string): string {
  if (!content || !content.toLowerCase().includes("iframe")) return content;

  return content.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (iframeTag) => {
    const id = extractVideoIdFromIframeTag(iframeTag);
    if (!id) return iframeTag;
    return buildYouTubeEditorPlaceholder(id);
  });
}

export function convertYouTubeEditorPlaceholdersToEmbeds(content: string): string {
  if (!content) return content;

  let normalized = content;

  normalized = normalized.replace(
    /<div\b[^>]*\bdata-gdd-youtube-id\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>[\s\S]*?<\/div>/gi,
    (_full, idA: string, idB: string) => {
      const id = String(idA || idB || "").trim();
      if (!YOUTUBE_ID_RE.test(id)) return "";
      return buildYouTubeEmbedIframe(id);
    }
  );

  // Fallback: alguns fluxos do editor transformam o card em imagem markdown/html.
  normalized = normalized.replace(
    /!\[[^\]]*\]\((https?:\/\/i\.ytimg\.com\/vi\/[a-zA-Z0-9_-]{6,}\/[^(\s)]+)\)/gi,
    (_full, thumbUrl: string) => {
      const id = extractVideoIdFromYouTubeThumbnailUrl(thumbUrl);
      if (!id) return _full;
      return buildYouTubeEmbedIframe(id);
    }
  );

  normalized = normalized.replace(
    /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/gi,
    (full, srcA: string, srcB: string) => {
      const src = String(srcA || srcB || "").trim();
      const id = extractVideoIdFromYouTubeThumbnailUrl(src);
      if (!id) return full;
      return buildYouTubeEmbedIframe(id);
    }
  );

  return normalized;
}
