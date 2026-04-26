"use client";

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { usePathname } from "next/navigation";
import type { SidebarNode } from "@/lib/docs/tree";
import { DocsSidebar } from "./DocsSidebar";

interface DocsMobileMenuProps {
  tree: SidebarNode[];
}

/**
 * Mobile-only navigation. The desktop sidebar is hidden below the `lg`
 * breakpoint, so we surface a fixed hamburger button at the top-left
 * that opens a slide-in drawer containing the same DocsSidebar.
 *
 * Three close affordances cover every reasonable user gesture:
 *  - tap outside (backdrop)
 *  - press Escape
 *  - tap a link inside the drawer (auto-close after navigation)
 *
 * Body scroll is locked while the drawer is open so the page doesn't
 * scroll under the overlay.
 */
export function DocsMobileMenu({ tree }: DocsMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on every route change. Covers cases the click
  // delegate below misses (e.g. browser back, programmatic nav).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes; body scroll locked while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Click delegate: if the user tapped an anchor inside the drawer,
  // close — they've navigated and want the menu out of the way.
  const handleDrawerClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("a")) setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu de documentação"
        aria-expanded={open}
        className="fixed left-3 top-2.5 z-40 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-700 bg-gray-900/90 text-gray-100 shadow-lg shadow-black/30 backdrop-blur transition-colors hover:border-indigo-500 hover:text-white lg:hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navegação da documentação"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-gray-800 bg-gray-950 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <span className="text-sm font-semibold text-gray-100">Documentação</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-800/80 hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto px-3 py-4"
              onClick={handleDrawerClick}
            >
              <DocsSidebar tree={tree} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
