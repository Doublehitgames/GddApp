"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GlobalPagePicker } from "@/components/GlobalPagePicker";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { MindMapSearchProvider, useMindMapSearch } from "@/lib/mindMapSearchContext";
import { sectionPath, findSectionByRef, canonicalProjectPathname } from "@/lib/utils/slug";
import { ProjectSidebar } from "@/components/project/ProjectSidebar";
import { ProjectShellBar } from "@/components/project/ProjectShellBar";

interface Props {
  children: React.ReactNode;
  projectId: string;
}

function BreadcrumbsMindMapSearch() {
  const { t } = useI18n();
  const { searchTerm, setSearchTerm, resultCount, activeIndex, navigate } = useMindMapSearch();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (resultCount === 0) return;
      navigate(event.shiftKey ? -1 : 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (resultCount === 0) return;
      navigate(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (resultCount === 0) return;
      navigate(-1);
    } else if (event.key === "Escape") {
      if (searchTerm) {
        event.preventDefault();
        setSearchTerm("");
      }
    }
  };

  const hasQuery = searchTerm.trim().length > 0;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="relative w-44 sm:w-56 md:w-64">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("mindMap.searchPlaceholder", "Buscar seções...")}
          className="h-9 w-full rounded-lg border border-line bg-canvas pl-8 pr-16 text-sm text-ink placeholder:text-subtle focus:border-line-strong focus:outline-none"
        />
        <svg
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-subtle"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
        </svg>
        {hasQuery && (
          <span
            className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-[10px] font-mono text-subtle tabular-nums"
            aria-live="polite"
          >
            {resultCount > 0 ? `${activeIndex + 1}/${resultCount}` : t("view.noResults", "0/0")}
          </span>
        )}
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-ink text-xs"
            aria-label={t("common.clear", "Clear")}
          >
            ✕
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => navigate(-1)}
        disabled={resultCount === 0}
        className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line text-muted hover:text-ink hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
        title={t("view.previousResult", "Previous result")}
        aria-label={t("view.previousResult", "Previous result")}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => navigate(1)}
        disabled={resultCount === 0}
        className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line text-muted hover:text-ink hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
        title={t("view.nextResult", "Next result")}
        aria-label={t("view.nextResult", "Next result")}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

export default function ProjectLayoutShell({ children, projectId }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const getProjectByRef = useProjectStore((s) => s.getProjectByRef);
  const projects = useProjectStore((s) => s.projects);

  const project = useMemo(() => getProjectByRef(projectId), [getProjectByRef, projectId, projects]);
  const realProjectId = project?.id ?? "";

  // Link por UUID (plugin Unity, links antigos) abre direto; aqui só se troca a
  // barra de endereço pela forma em slug, que é a que o app mostra. Mora no
  // shell porque ele envolve todas as telas de /projects/[id]/*.
  useEffect(() => {
    if (!project || !pathname) return;
    const canonical = canonicalProjectPathname(pathname, projects, project);
    if (canonical) router.replace(`${canonical}${window.location.search}${window.location.hash}`);
  }, [pathname, project, projects, router]);

  const normalizedPathname = useMemo(() => {
    if (!pathname) return "";
    return pathname.replace(/\/+$/, "");
  }, [pathname]);

  const isMindMapRoute = useMemo(() => {
    if (!normalizedPathname) return false;
    return normalizedPathname.endsWith("/mindmap");
  }, [normalizedPathname]);

  const isDocumentViewRoute = useMemo(() => {
    if (!normalizedPathname) return false;
    return /^\/projects\/[^/]+\/view$/.test(normalizedPathname);
  }, [normalizedPathname]);

  const isDeckRoute = useMemo(() => {
    if (!normalizedPathname) return false;
    return /^\/projects\/[^/]+\/deck$/.test(normalizedPathname);
  }, [normalizedPathname]);

  /**
   * Telas que montam a propria barra. O shell nao pode montar a dele por cima,
   * senao a pessoa ve duas fitas de abas empilhadas.
   */
  const trazPropriaBarra = isDocumentViewRoute || isDeckRoute;

  const currentSectionId = useMemo(() => {
    const match = pathname?.match(/\/projects\/[^/]+\/sections\/([^/?#]+)/);
    const rawRef = match?.[1] ?? null;
    if (!rawRef) return null;
    return findSectionByRef(project?.sections, rawRef)?.id ?? null;
  }, [pathname, project]);
  const isSectionDiagramRoute = useMemo(() => {
    if (!pathname) return false;
    return /^\/projects\/[^/]+\/sections\/[^/]+\/diagramas(?:\/|$)/.test(pathname);
  }, [pathname]);

  const breadcrumbSections = useMemo(() => {
    if (!project || !currentSectionId) return [];
    const sectionById = new Map((project.sections || []).map((section: any) => [section.id, section]));
    const chain: any[] = [];
    const visited = new Set<string>();
    let cursor = sectionById.get(currentSectionId);
    while (cursor && !visited.has(cursor.id)) {
      chain.unshift(cursor);
      visited.add(cursor.id);
      cursor = cursor.parentId ? sectionById.get(cursor.parentId) : undefined;
    }
    return chain;
  }, [project, currentSectionId]);

  const tituloDaTela: React.ReactNode = useMemo(() => {
    if (isMindMapRoute) return t("projectTabs.mapTitle", "Game Design Map");
    if (breadcrumbSections.length > 0) {
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          {breadcrumbSections.map((section: any, i: number) => (
            <span key={section.id} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <span className="shrink-0 font-normal text-subtle">/</span>}
              {section.id === currentSectionId && !isSectionDiagramRoute ? (
                <span className="truncate">{section.title}</span>
              ) : (
                <Link
                  href={project ? sectionPath(project, section) : "#"}
                  className="truncate hover:underline"
                >
                  {section.title}
                </Link>
              )}
            </span>
          ))}
          {isSectionDiagramRoute && (
            <>
              <span className="shrink-0 font-normal text-subtle">/</span>
              <span className="truncate">{t("sectionDetail.flowchart.breadcrumb")}</span>
            </>
          )}
        </span>
      );
    }
    return project?.title || "Projeto";
  }, [isMindMapRoute, breadcrumbSections, currentSectionId, isSectionDiagramRoute, project, t]);

  // Mapa mental e fluxograma são telas de canvas: ocupam a área de conteúdo
  // inteira, sem padding e sem rolagem, e se posicionam em `absolute inset-0`
  // dentro dela. O rodapé de sync some nelas, então a altura é tela menos barra.
  const isCanvasRoute = isMindMapRoute || isSectionDiagramRoute;

  // O documento é sempre claro, em qualquer tema do app: Doc, Deck, export e impressão.
  const isPaperRoute = /\/(export|roadmap\/print)$/.test(normalizedPathname);

  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => setDrawerOpen(false), [pathname]);

  if (trazPropriaBarra) {
    return (
      <MindMapSearchProvider>
        <GlobalPagePicker projectId={realProjectId} />
        <div data-theme="paper">{children}</div>
      </MindMapSearchProvider>
    );
  }

  return (
    <MindMapSearchProvider>
      <GlobalPagePicker projectId={realProjectId} />
      <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:block lg:h-screen print:hidden">
          {project && <ProjectSidebar project={project} projectSlug={projectId} />}
        </aside>

        {drawerOpen && project && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label={t("common.close", "Fechar")}
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[86%] max-w-[300px] bg-surface shadow-2xl">
              <ProjectSidebar project={project} projectSlug={projectId} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <div className={`flex min-w-0 flex-col ${isCanvasRoute ? "" : "pb-14"}`}>
          <ProjectShellBar
            title={tituloDaTela}
            projectSlug={projectId}
            project={project}
            onOpenMenu={() => setDrawerOpen(true)}
            busca={isMindMapRoute ? <BreadcrumbsMindMapSearch /> : undefined}
          />
          {isCanvasRoute ? (
            <div className="relative h-[calc(100dvh-3.5rem)] min-w-0 overflow-hidden">{children}</div>
          ) : (
            <div className="min-w-0 flex-1 px-4 py-5 md:px-6 lg:px-8" data-theme={isPaperRoute ? "paper" : undefined}>
              {children}
            </div>
          )}
        </div>
      </div>
    </MindMapSearchProvider>
  );
}
