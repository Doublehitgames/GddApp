"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n/config";
import { getDictionary, translate } from "@/lib/i18n/dictionaries";

const LOCALE_STORAGE_KEY = "gdd_locale";

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (key: string, fallback?: string) => string;
  supportedLocales: readonly AppLocale[];
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: AppLocale;
}) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        if (!isSupportedLocale(next)) return;
        setLocaleState(next);
      },
      t: (key, fallback) => translate(locale, key, fallback),
      supportedLocales: SUPPORTED_LOCALES,
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function getLocaleLabel(locale: AppLocale): string {
  const dict = getDictionary(locale);
  const meta = dict.meta;

  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const value = (meta as Record<string, unknown>).languageName;
    if (typeof value === "string") return value;
  }

  return locale;
}