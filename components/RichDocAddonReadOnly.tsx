"use client";

import dynamic from "next/dynamic";
import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { RichDocAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import {
  SECTION_REF_HREF_PREFIX,
  transformRichDocRefs,
  type SectionLike,
} from "@/lib/richDoc/transformRefs";
import { sectionPathById } from "@/lib/utils/slug";

const RichDocEditor = dynamic(() => import("@/components/RichDocEditor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[60px] text-xs text-gray-500">…</div>
  ),
});

interface RichDocAddonReadOnlyProps {
  addon: RichDocAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

export function RichDocAddonReadOnly({ addon, theme = "dark", bare = false }: RichDocAddonReadOnlyProps) {
  const { t } = useI18n();
  const router = useRouter();
  const isLight = theme === "light";
  const blocks = addon.blocks || [];
  const projects = useProjectStore((s) => s.projects);

  // Find the project + section that own this addon so we can resolve
  // $[Section Name] references against the same scope as the rest of
  // the app (the parent project's sections). Plain function — let the
  // React Compiler memoize it; explicit useMemo here trips the
  // "Existing memoization could not be preserved" rule.
  let ownership: { projectId: string; sections: SectionLike[] } | null = null;
  let ownerProject: { title: string; sections: any[] } | null = null;
  for (const project of projects) {
    for (const section of project.sections || []) {
      const matches = (section.addons || []).some((a: { id?: string }) => a.id === addon.id);
      if (matches) {
        ownership = {
          projectId: project.id as string,
          sections: (project.sections || []).map((s: { id: string; title: string }) => ({
            id: s.id,
            title: s.title,
          })),
        };
        ownerProject = project;
        break;
      }
    }
    if (ownership) break;
  }

  const transformedBlocks = ownership
    ? transformRichDocRefs(blocks, ownership.sections)
    : blocks;

  const hostRef = useRef<HTMLDivElement | null>(null);

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const anchor = target.closest("a") as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute("href") || "";
    if (!href.startsWith(SECTION_REF_HREF_PREFIX)) return;
    event.preventDefault();
    event.stopPropagation();
    const sectionId = href.slice(SECTION_REF_HREF_PREFIX.length);
    if (!sectionId) return;

    // Document mode (theme=light, rendered on the .gdd-doc-paper):
    // smooth-scroll to the in-page anchor and pulse-highlight it.
    if (isLight) {
      const targetEl =
        document.getElementById(`section-${sectionId}`) ||
        document.querySelector(`[data-section-anchor="${sectionId}"]`);
      if (targetEl instanceof HTMLElement) {
        const top = targetEl.getBoundingClientRect().top + window.scrollY - 180;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        targetEl.classList.add("gdd-anchor-highlight");
        window.setTimeout(() => targetEl.classList.remove("gdd-anchor-highlight"), 1800);
        window.history.replaceState(null, "", `#section-${sectionId}`);
      }
      return;
    }
    // Manager mode: navigate to the section page.
    if (ownerProject) {
      router.push(sectionPathById(ownerProject, sectionId));
    }
  };

  const inner =
    blocks.length === 0 ? (
      <div className={`text-xs italic ${isLight ? "text-gray-500" : "text-gray-500"}`}>
        {t("richDocAddon.emptyState", "Documento vazio")}
      </div>
    ) : (
      <RichDocEditor blocks={transformedBlocks} editable={false} theme={theme} />
    );

  if (bare) {
    return (
      <div ref={hostRef} className="rich-doc-readonly-host" data-theme={theme} onClick={handleClick}>
        {inner}
      </div>
    );
  }
  return (
    <div
      ref={hostRef}
      data-theme={theme}
      onClick={handleClick}
      className={`rich-doc-readonly-host rounded-xl border p-3 ${
        isLight ? "border-gray-200 bg-white" : "border-gray-800 bg-gray-900/50"
      }`}
    >
      {inner}
    </div>
  );
}
