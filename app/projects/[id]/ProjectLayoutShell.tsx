"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProjectSectionsSidebar from "@/components/ProjectSectionsSidebar";
import { GlobalPagePicker } from "@/components/GlobalPagePicker";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { MindMapSearchProvider, useMindMapSearch } from "@/lib/mindMapSearchContext";
import { PublicShareButton } from "@/components/PublicShareButton";
import { openShortcutsHelp } from "@/components/KeyboardShortcutsModal";

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
          placeholder={t("mindmap.searchPlaceholder", "Buscar seções...")}
          className="w-full bg-gray-800/80 text-gray-100 placeholder:text-gray-500 border border-gray-600/80 rounded-md pl-8 pr-16 py-1.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
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
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
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
        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-600/80 text-gray-300 hover:text-white hover:bg-gray-800/90 disabled:opacity-40 disabled:cursor-not-allowed"
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
        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-600/80 text-gray-300 hover:text-white hover:bg-gray-800/90 disabled:opacity-40 disabled:cursor-not-allowed"
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
  const getProject = useProjectStore((s) => s.getProject);
  const projects = useProjectStore((s) => s.projects);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const project = useMemo(() => getProject(projectId), [getProject, projectId, projects]);

  const normalizedPathname = useMemo(() => {
    if (!pathname) return "";
    return pathname.replace(/\/+$/, "");
  }, [pathname]);

  const shouldShowSidebar = useMemo(() => {
    if (!normalizedPathname) return true;
    return (
      !normalizedPathname.endsWith("/mindmap") &&
      !normalizedPathname.endsWith("/view") &&
      !normalizedPathname.endsWith("/diagramas")
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

  const currentSectionId = useMemo(() => {
    const match = pathname?.match(/\/projects\/[^/]+\/sections\/([^/?#]+)/);
    const rawId = match?.[1] ?? null;
    if (!rawId) return null;
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  }, [pathname]);
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

  // Close the sections sidebar when the addon editor drawer opens — both live on
  // the right side, so we avoid visual conflict by yielding to the drawer.
  useEffect(() => {
    const handler = () => setSidebarOpen(false);
    window.addEventListener("gdd:addon-drawer-open", handler);
    return () => window.removeEventListener("gdd:addon-drawer-open", handler);
  }, []);

  return (
    <MindMapSearchProvider>
    <GlobalPagePicker projectId={projectId} />
    <div className="min-h-screen bg-gray-900 pb-14">
      {!isDocumentViewRoute && (
      <header className="fixed inset-x-0 top-0 z-40 border-b border-gray-700/60 bg-gradient-to-r from-gray-900/92 via-gray-900/88 to-gray-900/92 backdrop-blur-md shadow-lg shadow-black/20">
        <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 text-xs sm:text-sm text-gray-300 flex-1">
            <Link
              href="/"
              className="shrink-0 rounded-md px-1.5 py-1 text-gray-300 hover:text-white hover:bg-gray-800/90 transition-colors"
              aria-label={t("projectDetail.backHome")}
            >
              {t("projectDetail.backHome")}
            </Link>
            <span className="text-gray-500">/</span>
            <Link
              href={`/projects/${projectId}`}
              className="min-w-0 truncate rounded-md px-1.5 py-1 text-gray-200 hover:text-white hover:bg-gray-800/90 transition-colors"
              title={project?.title || "Projeto"}
            >
              {project?.title || "Projeto"}
            </Link>
            {breadcrumbSections.map((section: any) => (
              <span key={section.id} className="min-w-0 flex items-center gap-2">
                <span className="text-gray-500">/</span>
                {section.id === currentSectionId && !isSectionDiagramRoute ? (
                  <span className="min-w-0 truncate text-indigo-100 font-medium" title={section.title}>
                    {section.title}
                  </span>
                ) : (
                  <Link
                    href={`/projects/${projectId}/sections/${section.id}`}
                    className="min-w-0 truncate rounded-md px-1.5 py-1 text-gray-200 hover:text-white hover:bg-gray-800/90 transition-colors"
                    title={section.title}
                  >
                    {section.title}
                  </Link>
                )}
              </span>
            ))}
            {isSectionDiagramRoute && (
              <span className="min-w-0 flex items-center gap-2">
                <span className="text-gray-500">/</span>
                <span className="min-w-0 truncate text-emerald-200 font-medium" title={t("sectionDetail.flowchart.breadcrumb")}>
                  {t("sectionDetail.flowchart.breadcrumb")}
                </span>
              </span>
            )}
            <PublicShareButton
              shareToken={project?.mindMapSettings?.sharing?.shareToken}
              isPublic={project?.mindMapSettings?.sharing?.isPublic}
              variant="inline"
              className="ml-2"
            />
          </div>

          {isMindMapRoute && <BreadcrumbsMindMapSearch />}

          <button
            type="button"
            onClick={() => openShortcutsHelp()}
            className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-600 bg-gray-900/75 text-gray-100 transition-colors hover:border-indigo-400 hover:bg-gray-800/90"
            aria-label={t("shortcuts.modalTitle", "Atalhos de teclado")}
            title={`${t("shortcuts.modalTitle", "Atalhos de teclado")} (?)`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093V15m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          <Link
            href={`/projects/${projectId}/settings`}
            className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-600 bg-gray-900/75 text-gray-100 transition-colors hover:border-indigo-400 hover:bg-gray-800/90"
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
              className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-600 bg-gray-900/75 text-gray-100 transition-colors hover:border-indigo-400 hover:bg-gray-800/90"
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
        </div>
      </header>
      )}

      <div className={isDocumentViewRoute ? undefined : "pt-16 md:pt-20"}>
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
                <ProjectSectionsSidebar projectId={projectId} />
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
                <ProjectSectionsSidebar projectId={projectId} />
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
