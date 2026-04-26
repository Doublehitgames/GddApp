import type { ReactNode } from "react";
import type { Metadata } from "next";
import { DocsHeader } from "@/components/docs/DocsHeader";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsTOC } from "@/components/docs/DocsTOC";
import { buildSidebarTree } from "@/lib/docs/tree";

export const metadata: Metadata = {
  title: "Documentação · GDD Manager",
  description:
    "Como usar o GDD Manager para organizar Game Design Documents — addons, page types, Remote Config, AI e integrações.",
};

/**
 * Shell layout for /docs/*. The route lives in a route group so it owns
 * its own header/sidebar without inheriting the app shell. Auth is NOT
 * required — anonymous visitors can read everything.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  const tree = buildSidebarTree();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <DocsHeader />
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
