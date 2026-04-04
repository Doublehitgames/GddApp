export type ProjectStoreLink = {
  label: string;
  url: string;
};

export type ProjectDocumentSpotlight = {
  features: string[];
  technicalDetails: string[];
  storeLinks: ProjectStoreLink[];
};

const MAX_TEXT_LENGTH = 160;
const MAX_LINK_URL_LENGTH = 1024;

function normalizeLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_TEXT_LENGTH);
}

function normalizeStoreLink(value: unknown): ProjectStoreLink | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { label?: unknown; url?: unknown };

  const normalizedLabel = normalizeLine(raw.label);
  const normalizedUrl = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!normalizedLabel || !normalizedUrl) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  return {
    label: normalizedLabel,
    url: parsedUrl.toString().slice(0, MAX_LINK_URL_LENGTH),
  };
}

export function normalizeProjectDocumentSpotlight(value: unknown): ProjectDocumentSpotlight | undefined {
  if (!value || typeof value !== "object") return undefined;

  const raw = value as {
    features?: unknown;
    technicalDetails?: unknown;
    storeLinks?: unknown;
  };

  const features = Array.isArray(raw.features)
    ? raw.features
        .map((item) => normalizeLine(item))
        .filter((item): item is string => Boolean(item))
    : [];

  const technicalDetails = Array.isArray(raw.technicalDetails)
    ? raw.technicalDetails
        .map((item) => normalizeLine(item))
        .filter((item): item is string => Boolean(item))
    : [];

  const storeLinks = Array.isArray(raw.storeLinks)
    ? raw.storeLinks
        .map((item) => normalizeStoreLink(item))
        .filter((item): item is ProjectStoreLink => Boolean(item))
    : [];

  if (features.length === 0 && technicalDetails.length === 0 && storeLinks.length === 0) {
    return undefined;
  }

  return {
    features,
    technicalDetails,
    storeLinks,
  };
}
