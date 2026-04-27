import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/i18n/config";
import type { AppLocale } from "@/lib/i18n/config";

type RouteParams = { slug?: string[] };

function resolveLocale(acceptLanguage: string | null): AppLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const normalized = acceptLanguage.toLowerCase();
  if (normalized.includes("pt-br") || normalized.includes("pt")) return "pt-BR";
  if (normalized.includes("en")) return "en";
  if (normalized.includes("es")) return "es";
  return DEFAULT_LOCALE;
}

export default async function DocsLegacyRedirect({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug = [] } = await params;
  const path = slug.length > 0 ? `/${slug.join("/")}` : "";

  const cookieStore = await cookies();
  const headerStore = await headers();
  const localeCookie = cookieStore.get("gdd_locale")?.value;
  const locale: AppLocale =
    localeCookie && isSupportedLocale(localeCookie)
      ? localeCookie
      : resolveLocale(headerStore.get("accept-language"));

  redirect(`/docs/${locale}${path}`);
}
