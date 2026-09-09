"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { RichDocBlock } from "@/lib/richDoc/types";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";
import { sectionPathById } from "@/lib/utils/slug";
import {
  SECTION_REF_HREF_PREFIX,
  transformRichDocRefs,
  type SectionLike,
} from "@/lib/richDoc/transformRefs";
import { resolveTokensInBlocks } from "@/lib/richDoc/resolveTokens";
import { markdownToBlocks } from "@/lib/richDoc/markdownToBlocks";
import { toPreviewText } from "@/lib/richDoc/previewText";
import type { ProjectTokenSource } from "@/lib/sections/specialTokens";
import { SectionHeroThumb } from "@/components/SectionHeroThumb";
import { getDriveImageDisplayUrl } from "@/lib/googleDrivePicker";
import BlocksReadOnly from "@/components/BlocksReadOnly";

/**
 * Rewrite raw Google Drive URLs on image blocks to the thumbnail endpoint that
 * works in <img> — the safety net MarkdownWithReferences had. Most Drive images
 * are already stored as thumbnail URLs (inserted via the picker), so this only
 * rescues manually-pasted `/file/d/ID/view` style links. Returns a new tree.
 */
function normalizeDriveImages(blocks: RichDocBlock[]): RichDocBlock[] {
  return blocks.map((b) => {
    const block = b as RichDocBlock & { props?: { url?: unknown }; children?: RichDocBlock[] };
    let next: RichDocBlock = block;
    if (block.type === "image" && typeof block.props?.url === "string" && block.props.url) {
      next = { ...block, props: { ...block.props, url: getDriveImageDisplayUrl(block.props.url) } };
    }
    if (Array.isArray((next as { children?: RichDocBlock[] }).children)) {
      next = { ...next, children: normalizeDriveImages((next as { children: RichDocBlock[] }).children) };
    }
    return next;
  });
}

interface AnchorPreview {
  title: string;
  shortDescription: string;
}

interface PendingAnchor {
  sectionId: string;
  title: string;
  shortDescription: string;
}

interface SectionDescriptionReadOnlyProps {
  /** Native blocks (source of truth). When empty, `markdown` is parsed instead. */
  blocks?: RichDocBlock[];
  /** Markdown fallback for descriptions not yet migrated to blocks. */
  markdown?: string;
  projectId: string;
  /** All sections of the project — used to resolve `$[Section]` references. */
  sections: SectionLike[];
  /** Source for `@[token]` resolution; falls back to `sections`. */
  projectTokenSource?: ProjectTokenSource;
  currentSectionId?: string;
  referenceLinkMode?: "manager" | "document";
  theme?: "dark" | "light";
  /** Hero thumbnail floated left so text wraps around it (document view). */
  heroThumbUrl?: string | null;
  heroThumbWidth?: number;
  documentAnchorOffset?: number;
  /** Returns a preview card for a referenced section, shown before navigating. */
  resolveDocumentAnchorPreview?: (sectionId: string) => AnchorPreview | null;
  /**
   * Takes over the "go" of a `$[reference]`. Screens that navigate on their own
   * — the Deck moves the grid instead of routing or scrolling — pass this so a
   * reference is not a dead click there.
   */
  onReferenceNavigate?: (sectionId: string) => void;
  /**
   * Takes over the whole click on a `$[reference]` — preview card included, so
   * this component shows none of its own. The mind map passes it: it already
   * has its own preview ("go to the dot") and a back trail this component
   * knows nothing about.
   */
  onReferenceClick?: (sectionId: string) => void;
}

/**
 * Read-only renderer for a section description: every screen that shows a page
 * without editing it comes through here — documento, deck, gerenciador, painel
 * do mapa mental.
 *
 * Renderiza com BlocksReadOnly, e só. Já foi um editor BlockNote em modo
 * não-editável, o que custava um import dinâmico e uma inicialização de editor
 * a cada leitura, e trazia o parser de markdown dele junto — o que abria
 * spoiler na tela, porque aquele parser não conhece a sintaxe do bloco.
 * Descrição que só tem o espelho markdown passa pelo parser da casa,
 * `lib/richDoc/markdownToBlocks.ts`.
 */
export default function SectionDescriptionReadOnly({
  blocks,
  markdown,
  projectId,
  sections,
  projectTokenSource,
  currentSectionId,
  referenceLinkMode = "manager",
  theme = "dark",
  heroThumbUrl,
  heroThumbWidth,
  documentAnchorOffset = 180,
  resolveDocumentAnchorPreview,
  onReferenceNavigate,
  onReferenceClick,
}: SectionDescriptionReadOnlyProps) {
  const router = useRouter();
  const { t } = useI18n();
  const projects = useProjectStore((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);
  const isDocumentMode = referenceLinkMode === "document";
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor | null>(null);
  const anchorCardRef = useRef<HTMLDivElement>(null);

  // Bloco é a fonte da verdade; página que só tem o espelho markdown (legado,
  // ou escrita pela API antes de passar pelo editor) é convertida aqui, pelo
  // parser da casa. Ler nunca carrega o editor: nem import dinâmico, nem
  // inicialização de BlockNote, nem o `[!spoiler]` virando texto na tela
  // porque o parser do editor não conhece a sintaxe.
  const processedBlocks = useMemo(() => {
    let base: RichDocBlock[] =
      Array.isArray(blocks) && blocks.length > 0 ? (blocks as RichDocBlock[]) : [];
    if (base.length === 0 && markdown && markdown.trim()) {
      base = markdownToBlocks(markdown) as unknown as RichDocBlock[];
    }
    if (base.length === 0) return null;
    const tokenSource = projectTokenSource ?? { sections: sections as never[] };
    const resolved = resolveTokensInBlocks(base, tokenSource, currentSectionId);
    const withImages = normalizeDriveImages(resolved as RichDocBlock[]);
    return transformRichDocRefs(withImages, sections);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, markdown, sections, currentSectionId, projectTokenSource?.updatedAt]);

  // Dismiss the anchor-preview popup on outside click / Escape.
  useEffect(() => {
    if (!pendingAnchor) return;
    const onPointerDown = (e: PointerEvent) => {
      if (anchorCardRef.current?.contains(e.target as Node)) return;
      setPendingAnchor(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingAnchor(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pendingAnchor]);

  const scrollToAnchor = (sectionId: string) => {
    const el =
      document.getElementById(`section-${sectionId}`) ||
      document.querySelector(`[data-section-anchor="${sectionId}"]`);
    if (!(el instanceof HTMLElement)) return;
    const top = el.getBoundingClientRect().top + window.scrollY - documentAnchorOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    el.classList.add("gdd-anchor-highlight");
    window.setTimeout(() => el.classList.remove("gdd-anchor-highlight"), 1800);
    window.history.replaceState(null, "", `#section-${sectionId}`);
  };

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest("a") as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute("href") || "";
    if (!href.startsWith(SECTION_REF_HREF_PREFIX)) return;
    event.preventDefault();
    event.stopPropagation();
    const sectionId = href.slice(SECTION_REF_HREF_PREFIX.length);
    if (!sectionId) return;

    if (onReferenceClick) {
      onReferenceClick(sectionId);
      return;
    }

    if (isDocumentMode) {
      const preview = resolveDocumentAnchorPreview?.(sectionId) || null;
      if (preview) {
        setPendingAnchor({ sectionId, title: preview.title, shortDescription: preview.shortDescription });
        return;
      }
      scrollToAnchor(sectionId);
      return;
    }
    // Manager mode: show a popup preview before navigating — same pattern as document mode.
    // Look up the target section from the store so we can show its title + short description.
    const fullProject = projects.find((p) => p.id === projectId);
    const targetSection = (fullProject?.sections as any[])?.find((s: any) => s.id === sectionId);
    const title = targetSection?.title || sections.find((s) => s.id === sectionId)?.title || "";
    const rawContent = typeof targetSection?.content === "string" ? targetSection.content : "";
    setPendingAnchor({ sectionId, title, shortDescription: toPreviewText(rawContent, 150) });
  };

  return (
    <div ref={hostRef} className="rich-doc-readonly-host section-description-readonly" data-theme={theme} onClick={handleClick}>
      {heroThumbUrl && heroThumbWidth ? (
        <SectionHeroThumb src={heroThumbUrl} alt="" width={heroThumbWidth} />
      ) : null}
      {processedBlocks ? <BlocksReadOnly blocks={processedBlocks as any} theme={theme} /> : null}
      {/* Fecha o float da hero thumb: sem isto, uma descrição mais curta que a
          imagem deixa o float vazar e o próximo título/thumb sai indentado. */}
      {heroThumbUrl && heroThumbWidth ? <div style={{ clear: "both" }} /> : null}
      {pendingAnchor && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4 flex items-center justify-center">
          <div
            ref={anchorCardRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("view.anchorPreview.title")}
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("view.anchorPreview.title")}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">{pendingAnchor.title}</h3>
            </div>
            <div className="px-5 py-4">
              {pendingAnchor.shortDescription ? (
                <p className="text-sm leading-6 text-gray-700">{pendingAnchor.shortDescription}</p>
              ) : (
                <p className="text-sm leading-6 text-gray-700">{t("view.anchorPreview.noDescription")}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAnchor(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  const sid = pendingAnchor.sectionId;
                  setPendingAnchor(null);
                  if (onReferenceNavigate) {
                    onReferenceNavigate(sid);
                  } else if (referenceLinkMode === "manager" && project) {
                    router.push(sectionPathById(project, sid));
                  } else {
                    scrollToAnchor(sid);
                  }
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("view.anchorPreview.goButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
