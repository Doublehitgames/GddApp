import type { Metadata } from "next";
import { getServerLocale } from "@/lib/i18n/server";
import { LEGAL_UI, legalPage, pick, type LegalSlug } from "@/lib/legal/pages";

/**
 * Título da aba e descrição (busca, prévia de link) das páginas /legal no
 * idioma de quem abre. Arquivo à parte porque lê cookie no servidor e
 * pages.ts também roda no navegador.
 */
export async function legalMetadata(slug?: LegalSlug): Promise<Metadata> {
  const locale = await getServerLocale();
  if (!slug) {
    return { title: `${pick(LEGAL_UI.navLabel, locale)} · GDD Manager`, description: pick(LEGAL_UI.indexLead, locale) };
  }
  const page = legalPage(slug);
  return { title: `${pick(page.title, locale)} · GDD Manager`, description: pick(page.summary, locale) };
}
