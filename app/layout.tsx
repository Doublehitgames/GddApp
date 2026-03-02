import type { Metadata } from "next";
import "./globals.css";
import "@toast-ui/editor/dist/toastui-editor.css";
import ClientInit from "./client-init";
import { I18nProvider } from "@/lib/i18n/provider";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale, type AppLocale } from "@/lib/i18n/config";

function resolveLocaleFromAcceptLanguage(acceptLanguage: string | null): AppLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const normalized = acceptLanguage.toLowerCase();
  if (normalized.includes("pt-br") || normalized.includes("pt")) return "pt-BR";
  if (normalized.includes("en")) return "en";
  if (normalized.includes("es")) return "es";

  return DEFAULT_LOCALE;
}

export const metadata: Metadata = {
  title: "GDD App",
  description: "App para organizar documentos de design de jogos",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const localeCookie = cookieStore.get("gdd_locale")?.value;
  const initialLocale: AppLocale = localeCookie && isSupportedLocale(localeCookie)
    ? localeCookie
    : resolveLocaleFromAcceptLanguage(headerStore.get("accept-language"));

  return (
    <html lang={initialLocale}>
      <body>
        <I18nProvider initialLocale={initialLocale}>
          <ClientInit />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
