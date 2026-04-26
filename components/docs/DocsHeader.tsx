"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

/**
 * Top header for the docs site. Two responsibilities:
 *
 *   1. Brand/home link back to /docs.
 *   2. "Voltar ao app" CTA — destination depends on auth state. Logged
 *      users go straight to /projects; anonymous visitors land on /login.
 *
 * Renders identically pre- and post-login since /docs/* is public.
 */
export function DocsHeader() {
  const user = useAuthStore((state) => state.user);
  const backHref = user ? "/" : "/login";
  const backLabel = user ? "Voltar ao app" : "Entrar no app";

  return (
    <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/85 backdrop-blur">
      {/* On mobile, the hamburger from DocsMobileMenu sits absolute at
          top-left (pl-14 reserves room for it so the brand link doesn't
          overlap). lg:pl-4 restores normal padding on desktop. */}
      <div className="mx-auto flex max-w-7xl items-center justify-between pl-14 pr-4 py-3 md:pr-6 lg:pl-4 lg:pr-6">
        <Link
          href="/docs"
          className="flex items-center gap-2 text-sm font-semibold text-gray-100 hover:text-white"
        >
          <span aria-hidden="true" className="text-base">📚</span>
          <span>GDD Manager Docs</span>
        </Link>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-200 hover:border-indigo-500 hover:text-white transition-colors"
        >
          <span>{backLabel}</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  );
}
