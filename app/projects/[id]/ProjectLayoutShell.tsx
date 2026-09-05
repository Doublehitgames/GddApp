"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProjectSectionsSidebar from "@/components/ProjectSectionsSidebar";
import { GlobalPagePicker } from "@/components/GlobalPagePicker";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { MindMapSearchProvider, useMindMapSearch } from "@/lib/mindMapSearchContext";
import { toSlug, sectionPath } from "@/lib/utils/slug";
import { PublicShareButton } from "@/components/PublicShareButton";
import { openShortcutsHelp } from "@/components/KeyboardShortcutsModal";
import { type ProjectView } from "@/components/project/ProjectViewTabs";
import { ProjectTopBar, ALTURA_BARRA, IconeMapa, IconeEditor } from "@/components/project/ProjectTopBar";

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
          className="w-full bg-white text-gray-800 placeholder:text-gray-400 border border-gray-300 rounded-md pl-8 pr-16 py-1.5 text-xs sm:text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
        <svg
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
        </svg>
        {hasQuery && (
          <span
            className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-400 tabular-nums"
            aria-live="polite"
          >
            {resultCount > 0 ? `${activeIndex + 1}/${resultCount}` : t("view.noResults", "0/0")}
          </span>
        )}
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 text-xs"
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
        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
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
        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
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
  const getProjectBySlug = useProjectStore((s) => s.getProjectBySlug);
  const projects = useProjectStore((s) => s.projects);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const project = useMemo(() => getProjectBySlug(projectId), [getProjectBySlug, projectId, projects]);
  const realProjectId = project?.id ?? "";

  const normalizedPathname = useMemo(() => {
    if (!pathname) return "";
    return pathname.replace(/\/+$/, "");
  }, [pathname]);

  const shouldShowSidebar = useMemo(() => {
    if (!normalizedPathname) return true;
    return (
      !normalizedPathname.endsWith("/mindmap") &&
      !normalizedPathname.endsWith("/view") &&
      !normalizedPathname.endsWith("/deck") &&
      !normalizedPathname.endsWith("/diagramas") &&
      !normalizedPathname.endsWith("/agenda") &&
      !normalizedPathname.endsWith("/kpi")
    );
  }, [normalizedPathname]);

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

  // O tema da barra segue a tela que ela emoldura. So o mapa e claro hoje; o
  // resto do app continua escuro, entao a barra continua escura la.
  const barraClara = isMindMapRoute;

  const abaAtiva: ProjectView | null = useMemo(() => {
    if (!normalizedPathname) return null;
    if (isMindMapRoute) return "graph";
    if (isDeckRoute) return "deck";
    if (isDocumentViewRoute) return "doc";
    // /projects/<slug> e a home do projeto — o Editor. Qualquer coisa mais
    // funda (settings, kpi, uma secao) nao e nenhuma das tres abas.
    if (normalizedPathname.split("/").length === 3) return "editor";
    return null;
  }, [normalizedPathname, isMindMapRoute, isDocumentViewRoute, isDeckRoute]);

  const clsIcone = barraClara
    ? "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900"
    : "border-gray-600 bg-gray-900/75 text-gray-100 hover:border-indigo-400 hover:bg-gray-800/90";

  const currentSectionId = useMemo(() => {
    const match = pathname?.match(/\/projects\/[^/]+\/sections\/([^/?#]+)/);
    const rawSlug = match?.[1] ?? null;
    if (!rawSlug) return null;
    let slug: string;
    try {
      slug = decodeURIComponent(rawSlug);
    } catch {
      slug = rawSlug;
    }
    return project?.sections?.find((s) => toSlug(s.title) === slug)?.id ?? null;
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
              {i > 0 && <span className="shrink-0 font-normal text-gray-400">/</span>}
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
              <span className="shrink-0 font-normal text-gray-400">/</span>
              <span className="truncate">{t("sectionDetail.flowchart.breadcrumb")}</span>
            </>
          )}
        </span>
      );
    }
    return project?.title || "Projeto";
  }, [isMindMapRoute, breadcrumbSections, currentSectionId, isSectionDiagramRoute, project, t]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!shouldShowSidebar) return;
    const persisted = window.localStorage.getItem("gdd_sidebar_open");
    setSidebarOpen(persisted === "1");
  }, [shouldShowSidebar]);

  useEffect(() => {
    if (!shouldShowSidebar) return;
    window.localStorage.setItem("gdd_sidebar_open", sidebarOpen ? "1" : "0");
  }, [sidebarOpen, shouldShowSidebar]);

  // Close the sections sidebar when a side drawer opens — both live on
  // the right side, so we avoid visual conflict by yielding to the drawer.
  useEffect(() => {
    const handler = () => setSidebarOpen(false);
    window.addEventListener("gdd:drawer-open", handler);
    return () => window.removeEventListener("gdd:drawer-open", handler);
  }, []);

  return (
    <MindMapSearchProvider>
    <GlobalPagePicker projectId={realProjectId} />
    <div className="min-h-screen bg-gray-900 pb-14">
      {!trazPropriaBarra && (
      <ProjectTopBar
        icone={isMindMapRoute ? <IconeMapa /> : <IconeEditor />}
        iconeProjetoUrl={project?.mindMapSettings?.documentView?.spotlight?.titleIconUrl}
        titulo={tituloDaTela}
        projectSlug={projectId}
        active={abaAtiva}
        theme={barraClara ? "light" : "dark"}
        badge={
          <PublicShareButton
            shareToken={project?.mindMapSettings?.sharing?.shareToken}
            isPublic={project?.mindMapSettings?.sharing?.isPublic}
            variant="inline"
            theme={barraClara ? "light" : "dark"}
          />
        }
        busca={isMindMapRoute ? <BreadcrumbsMindMapSearch /> : null}
        acoes={
          <>
          <button
            type="button"
            onClick={() => openShortcutsHelp()}
            className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${clsIcone}`}
            aria-label={t("shortcuts.modalTitle", "Atalhos de teclado")}
            title={`${t("shortcuts.modalTitle", "Atalhos de teclado")} (?)`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093V15m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <Link
            href={`/projects/${projectId}/export`}
            className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${clsIcone}`}
            aria-label={t("projectDetail.exportLabel", "Exportar")}
            title={t("projectDetail.exportLabel", "Exportar")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </Link>

          <Link
            href={`/projects/${projectId}/settings`}
            className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${clsIcone}`}
            aria-label={t("projectDetail.settingsLabel")}
            title={t("projectDetail.settingsLabel")}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          {shouldShowSidebar && (
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${clsIcone}`}
              aria-expanded={sidebarOpen}
              aria-controls="global-project-sections-sidebar"
              aria-label={sidebarOpen ? t("projectDetail.hideSectionsMenu") : t("projectDetail.showSectionsMenu")}
              title={sidebarOpen ? t("projectDetail.hideSectionsMenu") : t("projectDetail.showSectionsMenu")}
            >
              {sidebarOpen ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6l-12 12" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          )}
          </>
        }
      />
      )}

      <div
        className={trazPropriaBarra ? undefined : "print:pt-0"}
        style={trazPropriaBarra ? undefined : { paddingTop: ALTURA_BARRA }}
      >
      {shouldShowSidebar ? (
        <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6 lg:px-8">
          <div
            className={`grid items-start ${sidebarOpen && isDesktop ? "gap-0 lg:grid-cols-[minmax(0,1fr)_340px]" : "gap-0 grid-cols-1"}`}
          >
            <div className="min-w-0">{children}</div>
            {sidebarOpen && isDesktop && (
              <div
                id="global-project-sections-sidebar"
                className="lg:-ml-4 xl:-ml-5 lg:sticky lg:top-6 lg:self-start lg:h-[calc(100vh-6.5rem)]"
              >
                <ProjectSectionsSidebar projectId={realProjectId} projectSlug={projectId} />
              </div>
            )}
          </div>

          {sidebarOpen && !isDesktop && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-black/60"
                aria-label={t("projectDetail.hideSectionsMenu")}
                onClick={() => setSidebarOpen(false)}
              />
              <div
                id="global-project-sections-sidebar"
                className="absolute right-0 top-0 h-full w-full max-w-sm p-3"
              >
                <ProjectSectionsSidebar projectId={realProjectId} projectSlug={projectId} />
              </div>
            </div>
          )}
        </div>
      ) : (
        children
      )}
      </div>
    </div>
    </MindMapSearchProvider>
  );
}
