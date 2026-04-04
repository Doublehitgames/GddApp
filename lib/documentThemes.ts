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
