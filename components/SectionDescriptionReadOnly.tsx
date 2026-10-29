"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useTheme } from "@/lib/theme/provider";
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
import { toPreviewText, PREVIEW_DIALOG_MAX_LENGTH, type PreviewSection } from "@/lib/richDoc/previewText";
import type { ThumbSection } from "@/components/common/SectionThumb";
import { sectionBreadcrumb, type BreadcrumbSection } from "@/lib/sections/breadcrumb";
import type { PageStatus } from "@/lib/pageStatus/types";
import type { ProjectTokenSource } from "@/lib/sections/specialTokens";
import { SectionHeroThumb } from "@/components/SectionHeroThumb";
import { SectionPreviewDialog } from "@/components/common/SectionPreviewDialog";
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
  thumb?: ThumbSection;
  path?: string[];
  status?: PageStatus;
}

interface PendingAnchor {
  sectionId: string;
  title: string;
  shortDescription: string;
  thumb?: ThumbSection;
  path?: string[];
  status?: PageStatus;
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
  theme: themeProp,
  heroThumbUrl,
  heroThumbWidth,
  documentAnchorOffset = 180,
  resolveDocumentAnchorPreview,
  onReferenceNavigate,
  onReferenceClick,
}: SectionDescriptionReadOnlyProps) {
  const appTheme = useTheme().theme;
  const theme = themeProp ?? appTheme;
  const router = useRouter();
  const { t } = useI18n();
  const projects = useProjectStore((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);
  const isDocumentMode = referenceLinkMode === "document";
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor | null>(null);

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

  /**
   * Ctrl/⌘/shift/meio numa referência abre a página citada em outra aba, como
   * qualquer link faria. Ler a referência sem perder o lugar é gesto de todo
   * dia num GDD, e até aqui o `preventDefault` engolia esses cliques: o modal
   * abria do mesmo jeito e não havia como ir pra aba nova.
   *
   * O destino é sempre a página em si, em qualquer modo — "abrir em outra aba"
   * só quer dizer uma coisa, e a página é alcançável de todos eles. O `href`
   * que o renderizador escreve é um sentinela (`gddapp.local`), não serve.
   */
  const openReferenceInNewTab = (sectionId: string): boolean => {
    if (!project) return false;
    const url = sectionPathById(project, sectionId);
    if (!url) return false;
    window.open(url, "_blank", "noopener");
    return true;
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

    const wantsNewTab = event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1;
    if (wantsNewTab && openReferenceInNewTab(sectionId)) return;

    if (onReferenceClick) {
      onReferenceClick(sectionId);
      return;
    }

    if (isDocumentMode) {
      const preview = resolveDocumentAnchorPreview?.(sectionId) || null;
      if (preview) {
        setPendingAnchor({ sectionId, title: preview.title, shortDescription: preview.shortDescription, thumb: preview.thumb, path: preview.path, status: preview.status });
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
    setPendingAnchor({
      sectionId,
      title,
      shortDescription: toPreviewText(rawContent, PREVIEW_DIALOG_MAX_LENGTH, (fullProject?.sections as PreviewSection[]) ?? sections),
      thumb: targetSection as ThumbSection | undefined,
      path: sectionBreadcrumb(sectionId, ((fullProject?.sections as BreadcrumbSection[]) ?? sections) as BreadcrumbSection[]),
      status: (targetSection as { status?: PageStatus } | undefined)?.status,
    });
  };

  return (
    <div
      ref={hostRef}
      className="rich-doc-readonly-host section-description-readonly"
      data-theme={theme}
      onClick={handleClick}
      // O clique do meio não dispara `click`, e é justamente ele que as pessoas usam pra abrir em outra aba.
      onAuxClick={(event) => {
        if (event.button === 1) handleClick(event);
      }}
    >
      {heroThumbUrl && heroThumbWidth ? (
        <SectionHeroThumb src={heroThumbUrl} alt="" width={heroThumbWidth} />
      ) : null}
      {processedBlocks ? <BlocksReadOnly blocks={processedBlocks as any} theme={theme} /> : null}
      {/* Fecha o float da hero thumb: sem isto, uma descrição mais curta que a
          imagem deixa o float vazar e o próximo título/thumb sai indentado. */}
      {heroThumbUrl && heroThumbWidth ? <div style={{ clear: "both" }} /> : null}
      {pendingAnchor && (
        <SectionPreviewDialog
          title={pendingAnchor.title}
          thumb={pendingAnchor.thumb}
          path={pendingAnchor.path}
          status={pendingAnchor.status}
          description={pendingAnchor.shortDescription}
          confirmLabel={t("view.anchorPreview.goButton").replace("{{title}}", pendingAnchor.title)}
          onCancel={() => setPendingAnchor(null)}
          onConfirm={() => {
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
        />
      )}
    </div>
  );
}
