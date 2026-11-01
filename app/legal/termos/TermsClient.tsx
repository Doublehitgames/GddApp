"use client";

import { LegalCallout, LegalHeader, LegalSection } from "@/components/legal/LegalArticle";
import { useI18n } from "@/lib/i18n/provider";
import { pick } from "@/lib/legal/pages";
import { TERMS_CONTENT } from "./content";

export function TermsClient() {
  const { locale } = useI18n();
  const content = pick(TERMS_CONTENT, locale);

  return (
    <article>
      <LegalHeader slug="termos" />
      <LegalCallout>
        <p className="mb-2 font-semibold text-ink">{content.summaryTitle}</p>
        {content.summary}
      </LegalCallout>
      {content.sections.map((section) => (
        <LegalSection key={section.title} title={section.title}>
          {section.body}
        </LegalSection>
      ))}
    </article>
  );
}
