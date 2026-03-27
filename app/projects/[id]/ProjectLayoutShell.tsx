"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProjectSectionsSidebar from "@/components/ProjectSectionsSidebar";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface Props {
  children: React.ReactNode;
  projectId: string;
}

export default function ProjectLayoutShell({ children, projectId }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const getProject = useProjectStore((s) => s.getProject);
  const projects = useProjectStore((s) => s.projects);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const project = useMemo(() => getProject(projectId), [getProject, projectId, projects]);

  const shouldShowSidebar = useMemo(() => {
    if (!pathname) return true;
    return !pathname.endsWith("/mindmap") && !pathname.endsWith("/view");
  }, [pathname]);

  const currentSectionId = useMemo(() => {
    const match = pathname?.match(/\/projects\/[^/]+\/sections\/([^/?#]+)/);
    return match?.[1] ?? null;
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

  return (
    <div className="min-h-screen bg-gray-900 pb-14">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-gray-700/60 bg-gradient-to-r from-gray-900/92 via-gray-900/88 to-gray-900/92 backdrop-blur-md shadow-lg shadow-black/20">
        <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 text-xs sm:text-sm text-gray-300">
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
                {section.id === currentSectionId ? (
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
          </div>

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

      <div className="pt-16 md:pt-20">
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
  );
}
