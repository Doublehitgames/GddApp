"use client";

import { useEffect, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";

interface AddonEditorDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  emoji?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Right-side editor drawer.
 *
 * On desktop (≥ lg), the drawer "pushes" the main content by adding a right
 * margin to `document.body` equal to the drawer width while open — the main
 * layout reflows instead of being hidden behind an overlay. On mobile, the
 * drawer overlays with a backdrop (full-width).
 *
 * The drawer stops double-click propagation so editing inside doesn't
 * accidentally trigger the section description's WYSIWYG edit handler.
 */
export function AddonEditorDrawer({
  open,
  title,
  subtitle,
  emoji,
  onClose,
  children,
}: AddonEditorDrawerProps) {
  const { t } = useI18n();

  // Close on Escape (only when open and nothing else intercepts)
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // When opening, ask any open sidebar to close (they would fight for the right side).
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("gdd:addon-drawer-open"));
  }, [open]);

  // Push layout: apply a right margin to <body> at ≥lg so the page reflows.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!body) return;
    const apply = () => {
      const isLarge = window.matchMedia("(min-width: 1024px)").matches;
      body.style.marginRight = open && isLarge ? "min(880px, 50vw)" : "";
      body.style.transition = "margin-right 180ms ease";
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      body.style.marginRight = "";
      body.style.transition = "";
    };
  }, [open]);

  return (
    <>
      {/* Mobile backdrop — only below lg */}
      {open && (
        <div
          className="fixed inset-0 z-[55] bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal={false}
        aria-label={title}
        className={`fixed top-0 right-0 z-[60] h-screen bg-gray-950 border-l border-gray-700 shadow-2xl flex flex-col transform transition-transform duration-200 ease-out
          w-full lg:w-[min(880px,50vw)]
          ${open ? "translate-x-0" : "translate-x-full pointer-events-none"}`}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-start gap-2 min-w-0">
            {emoji && (
              <span className="text-xl leading-none select-none shrink-0" aria-hidden>
                {emoji}
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-100 truncate">{title}</h3>
              {subtitle && (
                <p className="text-[11px] text-gray-500 truncate mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("addonEditorDrawer.closeAriaLabel", "Fechar editor")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-100"
            title={t("addonEditorDrawer.closeAriaLabel", "Fechar editor")}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </>
  );
}
