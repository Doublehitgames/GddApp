"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { LEGAL_UI, LEGAL_UPDATED_AT, legalPage, pick, type LegalSlug } from "@/lib/legal/pages";

/**
 * Peças de texto comuns às cinco páginas /legal, para que todas tenham o
 * mesmo cabeçalho, o mesmo ritmo de seção e a mesma tipografia.
 */
export function LegalHeader({ slug }: { slug: LegalSlug }) {
  const { locale } = useI18n();
  const page = legalPage(slug);
  const updated = new Date(`${LEGAL_UPDATED_AT}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  return (
    <header className={`mb-8 rounded-2xl p-6 ${page.soft}`}>
      <span className={`grid h-10 w-10 place-items-center rounded-full text-base font-bold ${page.tile}`}>{page.number}</span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">{pick(page.title, locale)}</h1>
      <p className="mt-2 max-w-2xl text-base text-muted">{pick(page.summary, locale)}</p>
      <p className="mt-4 text-xs text-subtle">
        {pick(LEGAL_UI.updatedAt, locale)} {updated}
      </p>
    </header>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold tracking-tight text-ink">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-ink [&_a]:font-medium [&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

/** Caixa de destaque para um aviso ou um resumo curto ("em uma frase: …"). */
export function LegalCallout({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "danger" }) {
  const toneClass =
    tone === "danger" ? "border-danger/40 bg-danger-soft" : tone === "warn" ? "border-line bg-warn-soft text-warn-ink" : "border-line bg-surface";
  return <div className={`mb-8 rounded-xl border p-4 text-[15px] leading-relaxed ${toneClass}`}>{children}</div>;
}
