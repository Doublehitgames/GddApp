export const DOCUMENT_THEME_IDS = [
  "clean",
  "modern",
  "luxury",
  "editorial",
  "night",
] as const;

export type DocumentThemeId = (typeof DOCUMENT_THEME_IDS)[number];

export const DEFAULT_DOCUMENT_THEME: DocumentThemeId = "luxury";

export type DocumentThemeOption = {
  id: DocumentThemeId;
  labelKey: string;
  descriptionKey: string;
};

export const DOCUMENT_THEME_OPTIONS: DocumentThemeOption[] = [
  {
    id: "clean",
    labelKey: "settings.documentThemes.options.clean.label",
    descriptionKey: "settings.documentThemes.options.clean.description",
  },
  {
    id: "modern",
    labelKey: "settings.documentThemes.options.modern.label",
    descriptionKey: "settings.documentThemes.options.modern.description",
  },
  {
    id: "luxury",
    labelKey: "settings.documentThemes.options.luxury.label",
    descriptionKey: "settings.documentThemes.options.luxury.description",
  },
  {
    id: "editorial",
    labelKey: "settings.documentThemes.options.editorial.label",
    descriptionKey: "settings.documentThemes.options.editorial.description",
  },
  {
    id: "night",
    labelKey: "settings.documentThemes.options.night.label",
    descriptionKey: "settings.documentThemes.options.night.description",
  },
];

export function normalizeDocumentTheme(value: unknown): DocumentThemeId {
  if (typeof value !== "string") return DEFAULT_DOCUMENT_THEME;
  return DOCUMENT_THEME_IDS.includes(value as DocumentThemeId)
    ? (value as DocumentThemeId)
    : DEFAULT_DOCUMENT_THEME;
}

/** Default pixel width of the section hero thumbnail in the document view. */
export const DEFAULT_DOCUMENT_HERO_THUMB_WIDTH = 150;
/** Allowed range for the hero thumb width so users can't break the layout. */
export const MIN_DOCUMENT_HERO_THUMB_WIDTH = 64;
export const MAX_DOCUMENT_HERO_THUMB_WIDTH = 480;

export function normalizeDocumentHeroThumbWidth(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_DOCUMENT_HERO_THUMB_WIDTH;
  return Math.min(
    MAX_DOCUMENT_HERO_THUMB_WIDTH,
    Math.max(MIN_DOCUMENT_HERO_THUMB_WIDTH, Math.round(parsed))
  );
}
