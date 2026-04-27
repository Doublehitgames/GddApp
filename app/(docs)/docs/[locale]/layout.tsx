import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { DocsHeader } from "@/components/docs/DocsHeader";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsTOC } from "@/components/docs/DocsTOC";
import { DocsMobileMenu } from "@/components/docs/DocsMobileMenu";
import { buildSidebarTree } from "@/lib/docs/tree";
import { SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n/config";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function DocsLocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!SUPPORTED_LOCALES.includes(locale as AppLocale)) {
    notFound();
  }

  const tree = buildSidebarTree(locale);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <DocsHeader locale={locale} />
      <DocsMobileMenu tree={tree} />
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 md:px-6 lg:gap-8">
        <aside
          className="hidden w-60 shrink-0 lg:block"
          aria-label="Sumário da documentação"
        >
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
            <DocsSidebar tree={tree} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {children}
        </main>

        <aside
          className="hidden w-44 shrink-0 xl:block"
          aria-label="Nesta página"
        >
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <DocsTOC />
          </div>
        </aside>
      </div>
    </div>
  );
}
