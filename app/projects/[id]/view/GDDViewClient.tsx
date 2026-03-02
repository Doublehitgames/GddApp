"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { MarkdownWithReferences } from "@/components/MarkdownWithReferences";
import { useI18n } from "@/lib/i18n/provider";

interface Props {
  projectId: string;
  publicToken?: string;
}

export default function GDDViewClient({ projectId, publicToken }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const getProject = useProjectStore((s) => s.getProject);
  const projects = useProjectStore((s) => s.projects);
  
  const [mounted, setMounted] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const initialFocusHandledRef = useRef(false);
  const [showMobileToc, setShowMobileToc] = useState(false);
  const [showDesktopToc, setShowDesktopToc] = useState(true);
  const isPublicMode = Boolean(publicToken);
  const [isPublicLoading, setIsPublicLoading] = useState(Boolean(publicToken));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isPublicMode) {
      const p = getProject(projectId);
      setProject(p);
      
      // Check if coming from creation flow
      const isNew = searchParams?.get('new') === 'true';
      setShowWelcome(isNew);
      
      // Auto-hide welcome after 5 seconds
      if (isNew) {
        const timer = setTimeout(() => setShowWelcome(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [mounted, projectId, projects, getProject, searchParams, isPublicMode]);

  useEffect(() => {
    if (!mounted || !isPublicMode || !publicToken) return;

    let cancelled = false;
    setIsPublicLoading(true);

    const loadPublicProject = async () => {
      try {
        const response = await fetch(`/api/public/projects/${projectId}?token=${encodeURIComponent(publicToken)}`);
        if (!response.ok) {
          if (!cancelled) {
            setProject(null);
            setIsPublicLoading(false);
          }
          return;
        }

        const payload = await response.json();
        if (!cancelled) {
          setProject(payload?.project || null);
          setShowWelcome(false);
          setIsPublicLoading(false);
        }
      } catch {
        if (!cancelled) {
          setProject(null);
          setIsPublicLoading(false);
        }
      }
    };

    void loadPublicProject();

    return () => {
      cancelled = true;
    };
  }, [mounted, isPublicMode, publicToken, projectId]);

  const sortByManagerOrder = (sections: any[]) =>
    [...sections].sort((a, b) => {
      const orderA = typeof a?.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b?.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (a?.created_at || "").localeCompare(b?.created_at || "");
    });

  const projectSections = project?.sections || [];

  const buildSectionTree = (parentId?: string): any[] => {
    const children = sortByManagerOrder(
      projectSections.filter((section: any) =>
        parentId ? section.parentId === parentId : !section.parentId
      )
    );

    return children.map((section: any) => ({
      ...section,
      subsections: buildSectionTree(section.id),
    }));
  };

  const sectionsWithHierarchy = buildSectionTree();

  const flattenSectionIds = (nodes: any[]): string[] =>
    nodes.flatMap((node: any) => [node.id, ...flattenSectionIds(node.subsections || [])]);

  const orderedSectionIds = flattenSectionIds(sectionsWithHierarchy);

  const normalizedSearch = documentSearch.trim().toLowerCase();
  const matchedSectionIds = normalizedSearch
    ? orderedSectionIds.filter((id: string) => {
        const section = projectSections.find((s: any) => s.id === id);
        if (!section) return false;
        const titleMatch = (section.title || "").toLowerCase().includes(normalizedSearch);
        const contentMatch = (section.content || "").toLowerCase().includes(normalizedSearch);
        return titleMatch || contentMatch;
      })
    : [];

  const matchedSectionIdSet = new Set(matchedSectionIds);
  const activeMatchId = matchedSectionIds[activeMatchIndex] || null;

  useEffect(() => {
    if (activeMatchIndex >= matchedSectionIds.length) {
      setActiveMatchIndex(0);
    }
  }, [activeMatchIndex, matchedSectionIds.length]);

  const focusSectionById = (sectionId: string) => {
    const targetElement = document.getElementById(`section-${sectionId}`);
    if (!targetElement) return;

    targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
    targetElement.classList.add("gdd-anchor-highlight");
    window.setTimeout(() => {
      targetElement.classList.remove("gdd-anchor-highlight");
    }, 1800);
  };

  useEffect(() => {
    if (!mounted || !project || initialFocusHandledRef.current) return;

    const focusFromHash =
      typeof window !== "undefined" && window.location.hash.startsWith("#section-")
        ? window.location.hash.replace("#section-", "")
        : "";
    const focusFromQuery = searchParams?.get("focus") || "";

    const focusId = (focusFromHash || focusFromQuery).trim();
    if (!focusId) return;

    initialFocusHandledRef.current = true;

    const timer = window.setTimeout(() => {
      focusSectionById(focusId);

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.has("focus")) {
          url.searchParams.delete("focus");
          window.history.replaceState({}, "", url.toString());
        }
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [mounted, project?.id, searchParams]);

  const goToSearchMatch = (direction: 1 | -1) => {
    if (matchedSectionIds.length === 0) return;
    const nextIndex = (activeMatchIndex + direction + matchedSectionIds.length) % matchedSectionIds.length;
    setActiveMatchIndex(nextIndex);
    focusSectionById(matchedSectionIds[nextIndex]);
  };

  const getMindMapFocusUrl = (sectionId: string) => {
    if (isPublicMode) {
      return `/s/${encodeURIComponent(publicToken || "")}?mode=mindmap&focus=${encodeURIComponent(sectionId)}`;
    }
    return `/projects/${projectId}/mindmap?focus=${encodeURIComponent(sectionId)}`;
  };

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const highlightSearchTerm = (text: string) => {
    if (!normalizedSearch) return text;
    const safeTerm = escapeRegExp(normalizedSearch);
    const regex = new RegExp(`(${safeTerm})`, "ig");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      part.toLowerCase() === normalizedSearch ? (
        <mark key={`${part}-${index}`} className="bg-yellow-200 text-gray-900 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const renderTocNodes = (nodes: any[], depth = 0, onNavigate?: () => void) => {
    if (!nodes || nodes.length === 0) return null;

    return nodes.map((node: any) => {
      const isMatched = matchedSectionIdSet.has(node.id);
      const isActive = activeMatchId === node.id;
      const linkClass = [
        "group flex items-start gap-2 rounded-lg transition-all border",
        depth === 0 ? "px-3 py-2.5 text-sm font-semibold" : "px-3 py-2 text-sm",
        depth === 0
          ? "text-slate-800 bg-white/80 border-slate-200 hover:bg-slate-50"
          : "text-slate-600 bg-slate-50/70 border-slate-100 hover:bg-slate-100",
        isMatched ? "ring-1 ring-amber-300" : "",
        isActive ? "border-amber-400 bg-amber-50 text-amber-900" : "",
      ].join(" ");

      return (
        <div key={node.id}>
          <a
            href={`#section-${node.id}`}
            className={linkClass}
            onClick={(event) => {
              event.preventDefault();
              focusSectionById(node.id);
              if (typeof window !== "undefined") {
                window.history.replaceState(null, "", `#section-${node.id}`);
              }
              onNavigate?.();
            }}
          >
            <span
              className={`mt-1 h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-amber-500" : "bg-slate-300 group-hover:bg-slate-400"
              }`}
            />
            <span className="leading-5">{highlightSearchTerm(node.title)}</span>
          </a>

          {node.subsections?.length > 0 && (
            <div className="ml-4 mt-1 space-y-1 border-l border-slate-200/80 pl-3">
              {renderTocNodes(node.subsections, depth + 1, onNavigate)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderSectionNodes = (nodes: any[], depth = 0) => {
    if (!nodes || nodes.length === 0) return null;

    return nodes.map((node: any) => {
      const headingClass = depth === 0
        ? "text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3 pb-3 border-b-2 border-blue-500"
        : "text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-3";

      return (
        <div key={node.id} className={depth === 0 ? "section-content" : "ml-8"}>
          <div
            id={`section-${node.id}`}
            data-section-anchor={node.id}
            className={`scroll-mt-44 section-anchor-target ${matchedSectionIdSet.has(node.id) ? "gdd-search-match" : ""} ${activeMatchId === node.id ? "gdd-search-active" : ""}`}
          >
            {depth === 0 ? (
              <h2 className={headingClass}>
                <button
                  onClick={() => router.push(getMindMapFocusUrl(node.id))}
                  className="text-sm px-3 py-1 rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                  title="Ir para este item no mapa mental"
                >
                  🧠
                </button>
                {highlightSearchTerm(node.title)}
              </h2>
            ) : (
              <h3 className={headingClass}>
                <button
                  onClick={() => router.push(getMindMapFocusUrl(node.id))}
                  className="text-xs px-2.5 py-1 rounded-md border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                  title="Ir para este item no mapa mental"
                >
                  🧠
                </button>
                {highlightSearchTerm(node.title)}
              </h3>
            )}

            {node.content && node.content.trim() ? (
              <div className={depth === 0 ? "prose prose-lg max-w-none mb-8" : "prose max-w-none"}>
                <MarkdownWithReferences
                  content={node.content}
                  projectId={projectId}
                  sections={project.sections || []}
                  referenceLinkMode="document"
                  documentAnchorOffset={180}
                />
              </div>
            ) : (
              <div className={depth === 0 ? "text-gray-500 italic mb-8 py-4 px-6 bg-gray-50 rounded-lg border border-gray-200" : "text-gray-500 italic py-3 px-5 bg-gray-50 rounded-lg text-sm border border-gray-200"}>
                {!isPublicMode ? (
                  <button
                    onClick={() => router.push(`/projects/${projectId}/sections/${node.id}`)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Conteúdo não preenchido
                  </button>
                ) : (
                  <span>Conteúdo não preenchido</span>
                )}
              </div>
            )}
          </div>

          {node.subsections?.length > 0 && (
            <div className="space-y-8 mt-8">
              {renderSectionNodes(node.subsections, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  if (!project) {
    if (isPublicMode && isPublicLoading) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-gray-600">{t('common.loading')}</div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white p-8">
        {!isPublicMode && (
          <button
            onClick={() => router.push("/")}
            className="mb-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800"
          >
            ← Voltar para Home
          </button>
        )}
        <div className="text-gray-600">{isPublicMode ? "Projeto público não encontrado ou link inválido." : "Projeto não encontrado."}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Welcome Banner (shows only when new=true) */}
      {showWelcome && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <span className="font-semibold">Seu GDD está pronto! Role para baixo para ver tudo</span>
            <button 
              onClick={() => setShowWelcome(false)}
              className="ml-2 hover:bg-white/20 rounded-full p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Header/Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isPublicMode ? (
                <>
                  <button
                    onClick={() => router.push(`/projects/${projectId}`)}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                  >
                    ← Modo Gerenciamento
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    🏠 Home
                  </button>
                </>
              ) : (
                <span className="text-sm text-gray-600">🔓 Visualização pública</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(
                  isPublicMode
                    ? `/s/${encodeURIComponent(publicToken || "")}?mode=mindmap`
                    : `/projects/${projectId}/mindmap`
                )}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                🧠 Mapa Mental
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                🖨️ Imprimir
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 gdd-doc-searchbar">
            <input
              type="text"
              value={documentSearch}
              onChange={(e) => setDocumentSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  goToSearchMatch(e.shiftKey ? -1 : 1);
                }
              }}
              placeholder="Buscar no documento..."
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => goToSearchMatch(-1)}
              disabled={matchedSectionIds.length === 0}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Resultado anterior"
            >
              ↑
            </button>
            <button
              onClick={() => goToSearchMatch(1)}
              disabled={matchedSectionIds.length === 0}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Próximo resultado"
            >
              ↓
            </button>
            <span className="text-sm text-gray-600 whitespace-nowrap">
              {matchedSectionIds.length > 0
                ? `${activeMatchIndex + 1}/${matchedSectionIds.length}`
                : "0 resultados"}
            </span>
            {documentSearch && (
              <button
                onClick={() => {
                  setDocumentSearch("");
                  setActiveMatchIndex(0);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                title="Limpar busca"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className={`lg:grid lg:gap-2 ${showDesktopToc ? "lg:grid-cols-[280px_24px_minmax(0,1fr)]" : "lg:grid-cols-[24px_minmax(0,1fr)]"}`}>
          {sectionsWithHierarchy.length > 0 && showDesktopToc && (
            <aside className="hidden lg:block gdd-sidebar-toc">
              <div className="sticky top-28 rounded-2xl border border-slate-200 bg-white/85 backdrop-blur-md shadow-lg p-4 max-h-[calc(100vh-9rem)] overflow-y-auto">
                <div className="mb-3 pb-3 border-b border-slate-200">
                  <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">📑 Navegação</h2>
                </div>
                <div className="space-y-1.5">
                  {renderTocNodes(sectionsWithHierarchy)}
                </div>
              </div>
            </aside>
          )}

          {sectionsWithHierarchy.length > 0 && (
            <div className="hidden lg:flex gdd-toc-toggle -mx-2 z-10">
              <div className="sticky top-1/2 -translate-y-1/2 self-start">
                <button
                  onClick={() => setShowDesktopToc((prev) => !prev)}
                  className="w-8 h-8 rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-100"
                  title={showDesktopToc ? "Ocultar sumário" : "Mostrar sumário"}
                  aria-label={showDesktopToc ? "Ocultar sumário" : "Mostrar sumário"}
                >
                  {showDesktopToc ? "‹" : "›"}
                </button>
              </div>
            </div>
          )}

          <div className="min-w-0 lg:-ml-2">
            {sectionsWithHierarchy.length > 0 && (
              <div className="lg:hidden mb-4 gdd-mobile-toc">
                <button
                  onClick={() => setShowMobileToc((prev) => !prev)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold text-left"
                >
                  {showMobileToc ? "✕ Ocultar Sumário" : "📑 Exibir Sumário"}
                </button>
                {showMobileToc && (
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-white/95 shadow-lg p-4 max-h-[50vh] overflow-y-auto">
                    <div className="mb-3 pb-2 border-b border-slate-200">
                      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">📑 Navegação</h2>
                    </div>
                    <div className="space-y-1.5">
                      {renderTocNodes(sectionsWithHierarchy, 0, () => setShowMobileToc(false))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Document Paper Style */}
            <div className="bg-white shadow-2xl rounded-lg overflow-hidden">
              <div className="p-12">
            {/* Cover Page */}
            <div className="text-center mb-16 pb-12 border-b-2 border-gray-200">
              <div className="mb-6">
                <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6">
                  <span className="text-6xl">🎮</span>
                </div>
              </div>
              <h1 className="text-5xl font-bold text-gray-900 mb-4">
                {project.title || project.name}
              </h1>
              <p className="text-xl text-gray-700 font-semibold mb-8">
                Game Design Document
              </p>
              {project.description && (
                <div className="max-w-2xl mx-auto prose prose-lg">
                  <MarkdownWithReferences 
                    content={project.description}
                    projectId={projectId}
                    sections={project.sections || []}
                    referenceLinkMode="document"
                    documentAnchorOffset={180}
                  />
                </div>
              )}
              <div className="mt-8 space-y-1 text-sm text-gray-600">
                <div>
                  <strong>Criado em:</strong> {project.createdAt ? new Date(project.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Data não disponível'}
                </div>
                <div>
                  <strong>Última modificação:</strong> {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Data não disponível'}
                </div>
              </div>
            </div>

            {/* Sections Content */}
            <div className="space-y-12">
              {sectionsWithHierarchy.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <p className="text-lg mb-2 font-medium">📝 Nenhuma seção criada ainda</p>
                  <p className="text-sm">
                    Volte ao modo gerenciamento para adicionar conteúdo ao seu GDD
                  </p>
                </div>
              ) : (
                renderSectionNodes(sectionsWithHierarchy)
              )}
            </div>

            {/* Footer */}
            <div className="mt-16 pt-8 border-t border-gray-200 text-center text-gray-600 text-sm">
              <p>Game Design Document - {project.title || project.name}</p>
              <p className="mt-1">Gerado pelo GDD Manager</p>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        /* Prose customization for better readability */
        .prose {
          color: #1f2937 !important; /* gray-800 */
        }
        .prose p {
          color: #374151 !important; /* gray-700 */
          line-height: 1.8;
        }
        .prose li {
          color: #374151 !important; /* gray-700 */
        }
        .prose strong {
          color: #111827 !important; /* gray-900 */
          font-weight: 600;
        }
        .prose h1, .prose h2, .prose h3, .prose h4 {
          color: #111827 !important; /* gray-900 */
        }
        .prose blockquote {
          color: #4b5563 !important; /* gray-600 */
          border-left-color: #9ca3af;
        }
        .prose code {
          color: #1f2937 !important; /* gray-800 */
          background-color: #f3f4f6;
        }

        /* Tabelas no documento (fundo claro) */
        .prose .markdown-with-refs th,
        .prose .markdown-with-refs td {
          color: #1f2937;
          background-color: #ffffff;
          border-color: #d1d5db;
        }

        .prose .markdown-with-refs th {
          font-weight: 600;
        }

        .prose .gdd-inline-anchor {
          background: transparent !important;
          padding: 0 !important;
          border: none !important;
          display: inline !important;
          transform: none !important;
          box-shadow: none !important;
          text-decoration: underline;
        }

        .section-anchor-target {
          transition: background-color 0.35s ease;
        }

        .section-anchor-target.gdd-search-match > h2,
        .section-anchor-target.gdd-search-match > h3 {
          outline: 2px solid #fde68a;
          outline-offset: 4px;
          border-radius: 0.5rem;
        }

        .section-anchor-target.gdd-search-active > h2,
        .section-anchor-target.gdd-search-active > h3 {
          outline-color: #f59e0b;
          background-color: #fffbeb;
        }

        .section-anchor-target.gdd-anchor-highlight > h2,
        .section-anchor-target.gdd-anchor-highlight > h3 {
          background-color: #fef3c7;
          border-radius: 0.5rem;
          padding-left: 0.5rem;
          padding-right: 0.5rem;
        }

        @media print {
          .gdd-sidebar-toc,
          .gdd-mobile-toc,
          .gdd-toc-toggle {
            display: none !important;
          }
          .gdd-doc-searchbar {
            display: none !important;
          }
          .sticky {
            position: static !important;
          }
          button {
            display: none !important;
          }
          .bg-gradient-to-br {
            background: white !important;
          }
          .shadow-2xl {
            box-shadow: none !important;
          }
          .section-content {
            page-break-inside: avoid;
          }
          h2, h3 {
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  );
}
