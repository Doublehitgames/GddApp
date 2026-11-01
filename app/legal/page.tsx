"use client";

import { LegalCards } from "@/components/legal/LegalCards";
import { useI18n } from "@/lib/i18n/provider";
import { LEGAL_UI, pick } from "@/lib/legal/pages";

export default function LegalIndexPage() {
  const { locale } = useI18n();
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{pick(LEGAL_UI.navLabel, locale)}</h1>
      <p className="mt-2 max-w-2xl text-base text-muted">
        {pick(LEGAL_UI.indexLead, locale)}
      </p>
      <LegalCards className="mt-8 2xl:grid-cols-3" />
    </>
  );
}
