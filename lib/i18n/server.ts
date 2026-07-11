/**
 * i18n em server components / route handlers.
 *
 * Resolve o locale na ordem: cookie gdd_locale (setado pelo I18nProvider no
 * client) → header Accept-Language → DEFAULT_LOCALE. Importante para páginas
 * acessadas por visitantes sem sessão (ex.: consent OAuth vindo do claude.ai).
 */
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

const LOCALE_COOKIE = "gdd_locale";

function matchAcceptLanguage(acceptLanguage: string): AppLocale | null {
  const requested = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .filter(Boolean);

  for (const lang of requested) {
    const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === lang);
    if (exact) return exact;
    const base = lang.split("-")[0];
    const partial = SUPPORTED_LOCALES.find((l) => l.toLowerCase().split("-")[0] === base);
    if (partial) return partial;
  }
  return null;
}

export async function getServerLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (fromCookie && isSupportedLocale(fromCookie)) return fromCookie;

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (acceptLanguage) {
    const matched = matchAcceptLanguage(acceptLanguage);
    if (matched) return matched;
  }

  return DEFAULT_LOCALE;
}

/** Retorna um `t(key)` já amarrado ao locale resolvido da request. */
export async function getServerT(): Promise<(key: string, fallback?: string) => string> {
  const locale = await getServerLocale();
  return (key, fallback) => translate(locale, key, fallback);
}
