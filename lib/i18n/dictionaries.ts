import ptBR from "@/locales/pt-BR.json";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import { AppLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";

type DictionaryValue = string | number | boolean | null | DictionaryTree;
type DictionaryTree = { [key: string]: DictionaryValue };

const dictionaries: Record<AppLocale, DictionaryTree> = {
  "pt-BR": ptBR,
  en,
  es,
};

export function getDictionary(locale: AppLocale): DictionaryTree {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

function getByPath(source: DictionaryTree, path: string): DictionaryValue | undefined {
  return path
    .split(".")
    .reduce<DictionaryValue | undefined>((acc, part) => {
      if (!acc || typeof acc !== "object" || Array.isArray(acc)) return undefined;
      return (acc as DictionaryTree)[part];
    }, source);
}

export function translate(locale: AppLocale, key: string, fallback?: string): string {
  const current = getByPath(getDictionary(locale), key);
  if (typeof current === "string") return current;

  const fromDefault = getByPath(getDictionary(DEFAULT_LOCALE), key);
  if (typeof fromDefault === "string") return fromDefault;

  return fallback ?? key;
}
