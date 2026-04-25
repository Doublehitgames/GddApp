"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

type Pending = { sectionId: string; title: string; shortDescription: string };

function toShortDescription(raw: string): string {
  const plain = (raw || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`~_-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > 160 ? `${plain.slice(0, 157)}...` : plain;
}

interface SectionAnchorLinkProps {
  sectionId: string;
  /** Visible label. If absent, the section title is used. */
  children?: ReactNode;
  /** Visual variant — `inline` is text-link styling; `chip` adds a subtle background. */
  variant?: "inline" | "chip";
  /** Tailwind colour classes for the visible label (defaults to indigo/sky). */
  className?: string;
  theme?: "dark" | "light";
}

/**
 * Project-wide pattern for in-app section references inside ReadOnly views.
 * Click → opens a modal with the target section's title + short content
 * preview + a "Go to section" CTA. Never navigates immediately.
 *
 * The modal lives in a portal-like sibling of the link, so it can be used
 * inside flex/grid rows without breaking layout.
 */
export function SectionAnchorLink({
  sectionId,
  children,
  variant = "inline",
  className,
  theme = "dark",
}: SectionAnchorLinkProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const [pending, setPending] = useState<Pending | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const meta = (() => {
    for (const project of projects) {
      for (const section of project.sections || []) {
        if (section.id === sectionId) {
          return {
            projectId: project.id,
            title: section.title || section.id,
            content: section.content || "",
          };
        }
      }
    }
    return null;
  })();

  useEffect(() => {
    if (!pending) return;
    const onPointer = (event: PointerEvent) => {
      if (cardRef.current?.contains(event.target as Node)) return;
      setPending(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPending(null);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [pending]);

  const navigate = () => {
    if (!meta) return;
    const targetId = `section-${sectionId}`;
    const targetElement =
      (document.getElementById(targetId) as HTMLElement | null) ||
      (document.querySelector(`[data-section-anchor="${sectionId}"]`) as HTMLElement | null);
    if (!targetElement) {
      window.location.href = `/projects/${meta.projectId}/sections/${sectionId}`;
      return;
    }
    const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - 180;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    window.history.replaceState(null, "", `#${targetId}`);
    targetElement.classList.add("gdd-anchor-highlight");
    window.setTimeout(() => targetElement.classList.remove("gdd-anchor-highlight"), 1800);
  };

  const isLight = theme === "light";
  const linkColor = isLight ? "text-blue-600 hover:text-blue-800" : "text-sky-300 hover:text-sky-200";
  const baseClass =
    variant === "chip"
      ? `gdd-inline-anchor inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs cursor-pointer ${
          isLight
            ? "border-sky-300 bg-sky-100 text-sky-800 hover:bg-sky-200"
            : "border-sky-500/40 bg-sky-600/15 text-sky-200 hover:bg-sky-600/25"
        }`
      : `gdd-inline-anchor underline cursor-pointer ${linkColor}`;

  const label = children ?? meta?.title ?? sectionId;

  return (
    <>
      <a
        href={`#section-${sectionId}`}
        onClick={(event) => {
          event.preventDefault();
          if (!meta) return;
          setPending({
            sectionId,
            title: meta.title,
            shortDescription: toShortDescription(meta.content),
          });
        }}
        className={`${baseClass} ${className || ""}`}
        title={t("view.anchorPreview.goToSection", "Ir para a seção")}
      >
        {label}
      </a>
      {pending && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4 flex items-center justify-center">
          <div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("view.anchorPreview.title", "Pré-visualização")}
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("view.anchorPreview.title", "Pré-visualização")}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">{pending.title}</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm leading-6 text-gray-700">
                {pending.shortDescription || t("view.anchorPreview.noDescription", "Sem descrição.")}
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t("common.cancel", "Cancelar")}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  navigate();
                  setPending(null);
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("view.anchorPreview.goButton", "Ir para a seção")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
