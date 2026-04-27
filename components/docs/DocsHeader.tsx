"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

const LOCALE_LABELS: Record<string, string> = {
  "pt-BR": "PT",
  en: "EN",
  es: "ES",
};

export function DocsHeader({ locale }: { locale?: string }) {
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();
  const backHref = user ? "/" : "/login";
  const backLabel = user ? "Voltar ao app" : "Entrar no app";

  function switchLocaleHref(newLocale: string): string {
    if (!locale) return `/docs/${newLocale}`;
    return pathname.replace(`/docs/${locale}`, `/docs/${newLocale}`);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between pl-14 pr-4 py-3 md:pr-6 lg:pl-4 lg:pr-6">
        <Link
          href={locale ? `/docs/${locale}` : "/docs"}
          className="flex items-center gap-2 text-sm font-semibold text-gray-100 hover:text-white"
        >
          <span aria-hidden="true" className="text-base">📚</span>
          <span>GDD Manager Docs</span>
        </Link>

        <div className="flex items-center gap-2">
          {locale && (
            <div className="flex items-center gap-0.5 rounded-lg border border-gray-800 bg-gray-900 p-0.5">
              {SUPPORTED_LOCALES.map((loc) => (
                <Link
                  key={loc}
                  href={switchLocaleHref(loc)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    loc === locale
                      ? "bg-indigo-600 text-white"
                      : "text-gray-400 hover:text-gray-100"
                  }`}
                >
                  {LOCALE_LABELS[loc]}
                </Link>
              ))}
            </div>
          )}
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-200 hover:border-indigo-500 hover:text-white transition-colors"
          >
            <span>{backLabel}</span>
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
