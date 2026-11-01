"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { IconVision } from "@/components/project/ProjectSidebar";
import { useI18n } from "@/lib/i18n/provider";
import { useAuthStore } from "@/store/authStore";
import { LEGAL_OPERATOR, LEGAL_OPERATOR_URL, LEGAL_PAGES, LEGAL_UI, legalHref, pick } from "@/lib/legal/pages";

/**
 * A casca das páginas /legal: topo com a marca e a lista das cinco páginas
 * ao lado. Pública — quem chega sem login vê o mesmo texto, só muda o botão
 * do topo (voltar aos projetos ou entrar).
 */
export function LegalShell({ children }: { children: ReactNode }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-on-accent">
            <IconVision className="h-4 w-4" />
          </span>
          {t("common.appName", "GDD Manager")}
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href={user ? "/" : "/login"} className="inline-flex h-9 items-center rounded-lg bg-accent-soft px-3 text-sm font-semibold text-accent hover:opacity-90">
            {user ? pick(LEGAL_UI.backToProjects, locale) : pick(LEGAL_UI.signIn, locale)}
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label={pick(LEGAL_UI.navLabel, locale)} className="lg:sticky lg:top-20 lg:self-start">
          <Link href="/legal" className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle hover:text-ink">
            {pick(LEGAL_UI.navLabel, locale)}
          </Link>
          <ul className="mt-2 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {LEGAL_PAGES.map((p) => {
              const active = pathname === legalHref(p.slug);
              return (
                <li key={p.slug} className="shrink-0">
                  <Link
                    href={legalHref(p.slug)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      active ? "bg-accent-soft font-semibold text-accent" : "text-ink hover:bg-surface-2"
                    }`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${p.tile}`}>{p.number}</span>
                    {pick(p.title, locale)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0">{children}</main>
      </div>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted md:px-8">
        {pick(LEGAL_UI.maintainedBy, locale)}{" "}
        <a href={LEGAL_OPERATOR_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline-offset-2 hover:underline">
          {LEGAL_OPERATOR}
        </a>{" "}
        · {LEGAL_OPERATOR_URL.replace(/^https:\/\//, "")}
      </footer>
    </div>
  );
}
