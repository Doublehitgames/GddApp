"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { sectionPathById } from "@/lib/utils/slug";
import { SectionPreviewDialog, toShortDescription } from "./SectionPreviewDialog";

type Pending = { sectionId: string; title: string; shortDescription: string };

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

  const { meta, ownerProject } = (() => {
    for (const project of projects) {
      for (const section of project.sections || []) {
        if (section.id === sectionId) {
          return {
            meta: {
              projectId: project.id,
              title: section.title || section.id,
              content: section.content || "",
            },
            ownerProject: project,
          };
        }
      }
    }
    return { meta: null, ownerProject: null };
  })();

  const navigate = () => {
    if (!meta) return;
    const targetId = `section-${sectionId}`;
    const targetElement =
      (document.getElementById(targetId) as HTMLElement | null) ||
      (document.querySelector(`[data-section-anchor="${sectionId}"]`) as HTMLElement | null);
    if (!targetElement) {
      if (ownerProject) window.location.href = sectionPathById(ownerProject, sectionId);
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
        <SectionPreviewDialog
          title={pending.title}
          description={pending.shortDescription}
          confirmLabel={t("view.anchorPreview.goButton", "Ir para a seção")}
          theme={theme}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            navigate();
            setPending(null);
          }}
        />
      )}
    </>
  );
}
