"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { LEGAL_PAGES, legalHref, pick, type LegalSlug } from "@/lib/legal/pages";

/**
 * Os cinco cartões numerados (termos, privacidade, esquecimento, exportar,
 * garantias). Usados na home e no índice /legal; `current` destaca o da
 * página aberta.
 */
export function LegalCards({ current, className = "" }: { current?: LegalSlug; className?: string }) {
  const { locale } = useI18n();

  return (
    <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 ${className}`}>
      {LEGAL_PAGES.map((p) => {
        const active = p.slug === current;
        return (
          <li key={p.slug}>
            <Link
              href={legalHref(p.slug)}
              aria-current={active ? "page" : undefined}
              className={`flex h-full items-start gap-3 rounded-2xl border p-4 transition-colors ${
                active ? `border-line-strong ${p.soft}` : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${p.tile}`}>{p.number}</span>
              <span className="min-w-0">
                <strong className="block text-sm font-semibold text-ink">{pick(p.title, locale)}</strong>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{pick(p.summary, locale)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
