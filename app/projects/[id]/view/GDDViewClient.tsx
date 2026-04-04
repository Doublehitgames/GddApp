"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { MarkdownWithReferences } from "@/components/MarkdownWithReferences";
import { useI18n } from "@/lib/i18n/provider";
import { ADDON_REGISTRY } from "@/lib/addons/registry";
import { getDriveImageDisplayCandidates } from "@/lib/googleDrivePicker";
import { resolveProjectSpecialTokensForProject } from "@/lib/addons/projectSpecialTokens";
import { normalizeDocumentTheme } from "@/lib/documentThemes";

interface Props {
  projectId: string;
  publicToken?: string;
}

interface DocumentAnchorPreview {
  title: string;
  shortDescription: string;
}

const DOCUMENT_ANCHOR_PREVIEW_MAX_LENGTH = 420;

function SectionThumb({
  src,
  alt,
  depth,
  compact = false,
}: {
  src?: string;
  alt: string;
  depth: number;
  compact?: boolean;
}) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidates = useMemo(() => getDriveImageDisplayCandidates(src || ""), [src]);

  useEffect(() => {
    setCandidateIndex(0);
  }, [src]);

  if (!src) return null;
  if (candidateIndex >= candidates.length) return null;

  const sizeClass = compact
    ? depth <= 0
      ? "h-6 w-6"
      : "h-5 w-5"
    : depth <= 0
      ? "h-12 w-12"
      : depth === 1
        ? "h-10 w-10"
        : "h-9 w-9";

  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100 ${sizeClass}`}>
      <img
        src={candidates[candidateIndex]}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setCandidateIndex((prev) => prev + 1)}
      />
    </span>
  );
}

function normalizeReferenceText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function replaceReferenceTokens(text: string, sections: any[]): string {
  if (!text || !text.includes("$[")) return text;

  const sectionById = new Map<string, any>();
  const sectionByNormalizedName = new Map<string, any>();

  for (const section of sections) {
    if (section?.id) {
      sectionById.set(section.id, section);
    }
    const normalizedTitle = normalizeReferenceText(section?.title || "");
    if (normalizedTitle && !sectionByNormalizedName.has(normalizedTitle)) {
      sectionByNormalizedName.set(normalizedTitle, section);
    }
  }

  return text.replace(/\$\[([^\]]+)\]/g, (_fullMatch, rawRef: string) => {
    const ref = String(rawRef || "").trim();
    if (!ref) return "";

    if (ref.startsWith("#")) {
      const targetId = ref.slice(1).trim();
      return sectionById.get(targetId)?.title || targetId;
    }

    const normalizedRef = normalizeReferenceText(ref);
    return sectionByNormalizedName.get(normalizedRef)?.title || ref;
  });
}

function toAnchorPreviewMarkdown(value: string): string {
  if (!value) return "";

  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .trim();
}

function truncatePreview(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

export default function GDDViewClient({ projectId, publicToken }: Props) {
  const { t, locale } = useI18n();
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
  const [showDesktopToc, setShowDesktopToc] = useState(false);
  const [openSectionMenuId, setOpenSectionMenuId] = useState<string | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [coverImageCandidateIndex, setCoverImageCandidateIndex] = useState(0);
  const isPublicMode = Boolean(publicToken);
  const [isPublicLoading, setIsPublicLoading] = useState(Boolean(publicToken));
  const sectionMenuRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const showChartInDoc = true;
  const coverImageCandidates = useMemo(
    () => getDriveImageDisplayCandidates(project?.coverImageUrl || ""),
    [project?.coverImageUrl]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCoverImageCandidateIndex(0);
  }, [project?.coverImageUrl]);

  useEffect(() => {
    if (openSectionMenuId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sectionMenuRef.current?.contains(e.target as Node)) return;
      setOpenSectionMenuId(null);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openSectionMenuId]);

  useEffect(() => {
    if (!showActionsMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current?.contains(e.target as Node)) return;
      setShowActionsMenu(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showActionsMenu]);

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
  const sectionPreviewById = useMemo(() => {
    const map = new Map<string, DocumentAnchorPreview>();

    for (const section of projectSections) {
      const title = (section?.title || "").trim() || t("sectionDetail.history.untitled");
      const descriptionSource =
        typeof section?.description === "string" && section.description.trim()
          ? section.description
          : section?.content || "";
      const descriptionWithResolvedTokens = resolveProjectSpecialTokensForProject(descriptionSource, project);
      const descriptionWithResolvedReferences = replaceReferenceTokens(descriptionWithResolvedTokens, projectSections);
      const markdownDescription = toAnchorPreviewMarkdown(descriptionWithResolvedReferences);

      map.set(section.id, {
        title,
        shortDescription: truncatePreview(markdownDescription, DOCUMENT_ANCHOR_PREVIEW_MAX_LENGTH),
      });
    }

    return map;
  }, [project, projectSections, t]);

  const resolveDocumentAnchorPreview = (sectionId: string): DocumentAnchorPreview | null => {
    return sectionPreviewById.get(sectionId) || null;
  };

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

  const getFlowchartUrl = (sectionId: string) => {
    if (isPublicMode) {
      return `/s/${encodeURIComponent(publicToken || "")}?mode=diagramas&sectionId=${encodeURIComponent(sectionId)}`;
    }
    return `/projects/${projectId}/sections/${sectionId}/diagramas`;
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
            <SectionThumb
              src={node.thumbImageUrl}
              alt={t("sectionDetail.thumbnail.alt")}
              depth={depth}
              compact
            />
            <span className="leading-5">{highlightSearchTerm(node.title)}</span>
          </a>

          {node.subsections?.length > 0 && (
            <div className="ml-2 mt-1 space-y-1 border-l border-slate-200/80 pl-2">
              {renderTocNodes(node.subsections, depth + 1, onNavigate)}
            </div>
          )}
        </div>
      );
    });
  };

  const getHeadingTag = (depth: number): "h2" | "h3" | "h4" | "h5" | "h6" => {
    if (depth <= 1) return depth === 0 ? "h2" : "h3";
    if (depth === 2) return "h4";
    if (depth === 3) return "h5";
    return "h6";
  };

  const getHeadingClass = (depth: number) => {
    const base = "flex items-center gap-2 flex-wrap";
    switch (depth) {
      case 0:
        return `${base} text-3xl font-extrabold text-slate-900 mb-6`;
      case 1:
        return `${base} text-2xl font-semibold text-gray-800 mb-4`;
      case 2:
        return `${base} text-xl font-semibold text-gray-800 mb-3`;
      case 3:
        return `${base} text-lg font-medium text-gray-700 mb-3`;
      case 4:
        return `${base} text-base font-medium text-gray-700 mb-2`;
      default:
        return `${base} text-sm font-medium text-gray-600 mb-2`;
    }
  };

  const getSectionIndentClass = (depth: number) => {
    if (depth === 0) return "";
    if (depth === 1) return "ml-4";   // 1rem
    if (depth === 2) return "ml-8";   // 2rem
    return "ml-10";                   // 2.5rem (cap)
  };

  const renderSectionNodes = (nodes: any[], depth = 0) => {
    if (!nodes || nodes.length === 0) return null;

    const HeadingTag = getHeadingTag(depth);
    const headingClass = getHeadingClass(depth);
    const indentClass = getSectionIndentClass(depth);

    return nodes.map((node: any, index: number) => {
      const isRootSection = depth === 0;
      const hasFlowchart = Boolean((node as any).flowchartEnabled);
      const sectionShellClass = ["section-content", indentClass, isRootSection ? "gdd-root-section" : "", hasFlowchart ? "gdd-has-flowchart" : ""]
        .filter(Boolean)
        .join(" ");
      const headingClassName = isRootSection ? `${headingClass} gdd-root-heading` : headingClass;
      const headingButtonClass = isRootSection
        ? "gdd-root-heading-button text-left rounded-xl px-3 py-2 -mx-1 transition-colors inline-flex items-center gap-3"
        : "text-left rounded-md hover:bg-gray-100 px-1 -mx-1 transition-colors inline-flex items-center gap-2";

      return (
        <div key={node.id} className={sectionShellClass}>
          <div
            id={`section-${node.id}`}
            data-section-anchor={node.id}
            className={`scroll-mt-44 section-anchor-target ${matchedSectionIdSet.has(node.id) ? "gdd-search-match" : ""} ${activeMatchId === node.id ? "gdd-search-active" : ""}`}
          >
            <HeadingTag className={headingClassName}>
              <div
                ref={openSectionMenuId === node.id ? sectionMenuRef : undefined}
                className="relative inline-flex"
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenSectionMenuId((prev) => (prev === node.id ? null : node.id));
                  }}
                  className={headingButtonClass}
                  title={t("view.actionsMenu")}
                >
                  {isRootSection && (
                    <span className="gdd-root-section-badge" aria-hidden>
                      {index + 1}
                    </span>
                  )}
                  <SectionThumb
                    src={node.thumbImageUrl}
                    alt={t("sectionDetail.thumbnail.alt")}
                    depth={depth}
                  />
                  {highlightSearchTerm(node.title)}
                  {hasFlowchart && (
                    <span className="gdd-flowchart-chip" title={t("sectionDetail.flowchart.open")}>
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="4" width="7" height="5" rx="1.2" strokeWidth={1.8} />
                        <rect x="14" y="3" width="7" height="6" rx="1.2" strokeWidth={1.8} />
                        <rect x="8" y="15" width="8" height="6" rx="1.2" strokeWidth={1.8} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6.5h4m3.5 2.5v2.5M8.5 15v-2.5m6.5 2.5v-2.5" />
                      </svg>
                      <span>{t("sectionDetail.flowchart.breadcrumb")}</span>
                    </span>
                  )}
                  <span className="text-gray-400 text-sm shrink-0" aria-hidden>▾</span>
                </button>
                {openSectionMenuId === node.id && (
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[12rem] py-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenSectionMenuId(null);
                        router.push(getMindMapFocusUrl(node.id));
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      🧠 {t("sectionDetail.actions.goToMindMap")}
                    </button>
                    {!isPublicMode && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenSectionMenuId(null);
                          router.push(`/projects/${projectId}/sections/${node.id}`);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        📄 {t("sectionDetail.actions.goToSectionPage")}
                      </button>
                    )}
                    {Boolean((node as any).flowchartEnabled) && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenSectionMenuId(null);
                          router.push(getFlowchartUrl(node.id));
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h6m0 0v6m0-6l-8 8m-4 0h4v4" />
                        </svg>
                        {t("sectionDetail.flowchart.open")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </HeadingTag>

            {node.content && node.content.trim() ? (
              <div className={depth === 0 ? "prose prose-lg max-w-none mb-8" : depth === 1 ? "prose max-w-none mb-6" : "prose prose-sm max-w-none mb-4"}>
                <MarkdownWithReferences
                  content={node.content}
                  projectId={projectId}
                  sections={project.sections || []}
                  projectTokenSource={project}
                  referenceLinkMode="document"
                  documentAnchorOffset={180}
                  resolveDocumentAnchorPreview={resolveDocumentAnchorPreview}
                />
              </div>
            ) : (
              <div className={depth <= 1 ? "text-gray-500 italic py-4 px-6 bg-gray-50 rounded-lg border border-gray-200 mb-6" : "text-gray-500 italic py-3 px-4 bg-gray-50 rounded-lg text-sm border border-gray-200 mb-4"}>
                {!isPublicMode ? (
                  <button
                    onClick={() => router.push(`/projects/${projectId}/sections/${node.id}`)}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {t("view.emptyContent")}
                  </button>
                ) : (
                  <span>{t("view.emptyContent")}</span>
                )}
              </div>
            )}
            {Boolean((node as any).flowchartEnabled) && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => router.push(getFlowchartUrl(node.id))}
                  className="gdd-flowchart-cta inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="4" width="7" height="5" rx="1.2" strokeWidth={1.8} />
                    <rect x="14" y="3" width="7" height="6" rx="1.2" strokeWidth={1.8} />
                    <rect x="8" y="15" width="8" height="6" rx="1.2" strokeWidth={1.8} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6.5h4m3.5 2.5v2.5M8.5 15v-2.5m6.5 2.5v-2.5" />
                  </svg>
                  {t("sectionDetail.flowchart.openWithTitle").replace("{{title}}", node.title)}
                </button>
              </div>
            )}
            {Array.isArray(node.addons) && node.addons.length > 0 && (
              <div className="mb-6">
                {node.addons.map((addon: any) => {
                  const entry = ADDON_REGISTRY.find((item) => item.type === addon.type);
                  if (!entry) return null;
                  return (
                    <div key={addon.id}>
                      {entry.renderReadOnly(addon, {
                        showChart: showChartInDoc,
                        maxRows: 100,
                        theme: "light",
                        layout: "sideBySide",
                        showSummary: true,
                        showTable: false,
                      })}
                    </div>
                  );
                })}
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
            ← {t("view.backHome")}
          </button>
        )}
        <div className="text-gray-600">
          {isPublicMode ? t("view.publicProjectNotFound") : t("view.projectNotFound")}
        </div>
      </div>
    );
  }

  const documentTheme = normalizeDocumentTheme(project?.mindMapSettings?.documentView?.theme);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Welcome Banner (shows only when new=true) */}
      {showWelcome && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <span className="font-semibold">{t("view.welcomeReady")}</span>
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
                <button
                  onClick={() => router.push("/")}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  🏠 {t("view.home")}
                </button>
              ) : (
                <span className="text-sm text-gray-600">🔓 {t("view.publicView")}</span>
              )}
            </div>
            <div className="relative" ref={actionsMenuRef}>
              <button
                type="button"
                onClick={() => setShowActionsMenu((v) => !v)}
                className="p-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
                title={t("view.actionsMenu")}
                aria-expanded={showActionsMenu}
                aria-haspopup="true"
                aria-label={t("view.actionsMenu")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                  <circle cx="12" cy="18" r="1.5" fill="currentColor" />
                </svg>
              </button>
              {showActionsMenu && (
                <div className="absolute right-0 top-full mt-1 py-1 min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  {!isPublicMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsMenu(false);
                        router.push(`/projects/${projectId}`);
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      ← {t("view.managementMode")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionsMenu(false);
                      router.push(
                        isPublicMode
                          ? `/s/${encodeURIComponent(publicToken || "")}?mode=mindmap`
                          : `/projects/${projectId}/mindmap`
                      );
                    }}
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    🧠 {t("view.mindMap")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionsMenu(false);
                      window.print();
                    }}
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    🖨️ {t("view.print")}
                  </button>
                </div>
              )}
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
              placeholder={t("view.searchPlaceholder")}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => goToSearchMatch(-1)}
              disabled={matchedSectionIds.length === 0}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title={t("view.previousResult")}
            >
              ↑
            </button>
            <button
              onClick={() => goToSearchMatch(1)}
              disabled={matchedSectionIds.length === 0}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title={t("view.nextResult")}
            >
              ↓
            </button>
            <span className="text-sm text-gray-600 whitespace-nowrap">
              {matchedSectionIds.length > 0
                ? `${activeMatchIndex + 1}/${matchedSectionIds.length}`
                : t("view.noResults")}
            </span>
            {documentSearch && (
              <button
                onClick={() => {
                  setDocumentSearch("");
                  setActiveMatchIndex(0);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                title={t("view.clearSearch")}
              >
                {t("view.clearSearch")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="w-full px-4 py-8 lg:px-8 xl:px-10">
        <div
          className={`xl:grid xl:gap-3 ${
            sectionsWithHierarchy.length > 0
              ? showDesktopToc
                ? "xl:grid-cols-[minmax(280px,30fr)_24px_minmax(0,70fr)]"
                : "xl:grid-cols-[minmax(0,15fr)_24px_minmax(0,70fr)_minmax(0,15fr)]"
              : "xl:grid-cols-[minmax(0,1fr)]"
          }`}
        >
          {sectionsWithHierarchy.length > 0 && (
            <aside className="hidden xl:block gdd-sidebar-toc w-full">
              {showDesktopToc ? (
                <div className="sticky top-28 w-full rounded-2xl border border-slate-200 bg-white/85 backdrop-blur-md shadow-lg p-4 max-h-[calc(100vh-9rem)] overflow-y-auto">
                  <div className="mb-3 pb-3 border-b border-slate-200">
                    <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">📑 {t("view.navigation")}</h2>
                  </div>
                  <div className="space-y-1.5">
                    {renderTocNodes(sectionsWithHierarchy)}
                  </div>
                </div>
              ) : (
                <div className="w-full" aria-hidden />
              )}
            </aside>
          )}

          {sectionsWithHierarchy.length > 0 && (
            <div className="hidden xl:flex gdd-toc-toggle -mx-2 z-10">
              <div className="sticky top-1/2 -translate-y-1/2 self-start">
                <button
                  onClick={() => setShowDesktopToc((prev) => !prev)}
                  className="w-8 h-8 rounded-full border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-100"
                  title={showDesktopToc ? t("view.hideSummary") : t("view.showSummary")}
                  aria-label={showDesktopToc ? t("view.hideSummary") : t("view.showSummary")}
                >
                  {showDesktopToc ? "‹" : "›"}
                </button>
              </div>
            </div>
          )}

          <div className="min-w-0 xl:-ml-2">
            {sectionsWithHierarchy.length > 0 && (
              <div className="xl:hidden mb-4 gdd-mobile-toc">
                <button
                  onClick={() => setShowMobileToc((prev) => !prev)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold text-left"
                >
                  {showMobileToc ? `✕ ${t("view.hideSummary")}` : `📑 ${t("view.showSummary")}`}
                </button>
                {showMobileToc && (
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-white/95 shadow-lg p-4 max-h-[50vh] overflow-y-auto">
                    <div className="mb-3 pb-2 border-b border-slate-200">
                      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">📑 {t("view.navigation")}</h2>
                    </div>
                    <div className="space-y-1.5">
                      {renderTocNodes(sectionsWithHierarchy, 0, () => setShowMobileToc(false))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Document Paper Style */}
            <div className={`gdd-doc-paper gdd-doc-theme-${documentTheme} bg-white shadow-2xl rounded-lg overflow-hidden`}>
              <div className="p-12">
            {/* Cover Page */}
            <div className="text-center mb-16 pb-12 border-b-2 border-gray-200">
              {project.coverImageUrl && (
                <div className="mb-8">
                  {coverImageCandidateIndex < coverImageCandidates.length ? (
                    <img
                      src={coverImageCandidates[coverImageCandidateIndex]}
                      alt={t("projectDetail.cover.alt", "Capa do projeto")}
                      onError={() => setCoverImageCandidateIndex((prev) => prev + 1)}
                      className="w-full max-h-[420px] object-cover rounded-2xl border border-gray-200 shadow-sm"
                      loading="lazy"
                    />
                  ) : (
                    <p className="text-sm text-amber-700">{t("projectDetail.cover.loadFailed")}</p>
                  )}
                </div>
              )}
              <div className="mb-6">
                <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6">
                  <span className="text-6xl">🎮</span>
                </div>
              </div>
              <h1 className="text-5xl font-bold text-gray-900 mb-4">
                {project.title}
              </h1>
              <p className="text-xl text-gray-700 font-semibold mb-8">
                {t("view.documentTitle")}
              </p>
              {project.description && (
                <div className="max-w-2xl mx-auto prose prose-lg">
                  <MarkdownWithReferences 
                    content={project.description}
                    projectId={projectId}
                    sections={project.sections || []}
                    projectTokenSource={project}
                    referenceLinkMode="document"
                    documentAnchorOffset={180}
                    resolveDocumentAnchorPreview={resolveDocumentAnchorPreview}
                  />
                </div>
              )}
              <div className="mt-8 space-y-1 text-sm text-gray-600">
                <div>
                  <strong>{t("view.createdAtLabel")}</strong> {project.createdAt ? new Date(project.createdAt).toLocaleDateString(locale, {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : t("view.dateUnavailable")}
                </div>
                <div>
                  <strong>{t("view.updatedAtLabel")}</strong> {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString(locale, {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : t("view.dateUnavailable")}
                </div>
              </div>
            </div>

            {/* Sections Content */}
            <div className="space-y-12">
              {sectionsWithHierarchy.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <p className="text-lg mb-2 font-medium">📝 {t("view.noSectionsTitle")}</p>
                  <p className="text-sm">
                    {t("view.noSectionsHint")}
                  </p>
                </div>
              ) : (
                renderSectionNodes(sectionsWithHierarchy)
              )}
            </div>

            {/* Footer */}
            <div className="mt-16 pt-8 border-t border-gray-200 text-center text-gray-600 text-sm">
              <p>{t("view.documentTitle")} - {project.title}</p>
              <p className="mt-1">{t("view.generatedBy")}</p>
            </div>
          </div>
        </div>
          </div>
          {sectionsWithHierarchy.length > 0 && !showDesktopToc && (
            <div className="hidden xl:block" aria-hidden />
          )}
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

        .gdd-doc-paper {
          --gdd-root-border: #e6d5b1;
          --gdd-root-background: linear-gradient(180deg, #fffdfa 0%, #fff8ec 16%, #ffffff 34%);
          --gdd-root-shadow: 0 16px 38px rgba(62, 41, 17, 0.08);
          --gdd-root-top-line: linear-gradient(90deg, #f2dfb4 0%, #b88a44 38%, #8d6a32 72%, #f0deba 100%);
          --gdd-root-glow: radial-gradient(circle, rgba(214, 170, 102, 0.18) 0%, rgba(214, 170, 102, 0) 68%);
          --gdd-root-heading-border: #ebdcbc;
          --gdd-root-title-color: #3f2d16;
          --gdd-root-title-hover: #fff3dc;
          --gdd-root-title-font: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
          --gdd-root-badge-border: #d8b97b;
          --gdd-root-badge-background: linear-gradient(180deg, #fff7e5 0%, #f7dfab 100%);
          --gdd-root-badge-color: #8a6226;
          --gdd-root-badge-shadow: inset 0 1px 0 #fffdf8, 0 2px 5px rgba(111, 79, 31, 0.15);
          --gdd-root-title-shadow: 0 1px 0 rgba(255, 255, 255, 0.65);
        }

        .gdd-doc-paper.gdd-doc-theme-clean {
          --gdd-root-border: #d7dce3;
          --gdd-root-background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
          --gdd-root-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
          --gdd-root-top-line: linear-gradient(90deg, #cfd8e3 0%, #8ca1ba 50%, #dbe4ef 100%);
          --gdd-root-glow: radial-gradient(circle, rgba(203, 213, 225, 0.2) 0%, rgba(203, 213, 225, 0) 70%);
          --gdd-root-heading-border: #dde3eb;
          --gdd-root-title-color: #1f2937;
          --gdd-root-title-hover: #f2f5f9;
          --gdd-root-title-font: "Segoe UI", Tahoma, sans-serif;
          --gdd-root-badge-border: #cfd8e3;
          --gdd-root-badge-background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
          --gdd-root-badge-color: #475569;
          --gdd-root-badge-shadow: inset 0 1px 0 #ffffff, 0 1px 3px rgba(15, 23, 42, 0.12);
          --gdd-root-title-shadow: none;
        }

        .gdd-doc-paper.gdd-doc-theme-modern {
          --gdd-root-border: #c9d6e6;
          --gdd-root-background: linear-gradient(160deg, #f4f9ff 0%, #eef7ff 24%, #ffffff 60%);
          --gdd-root-shadow: 0 14px 30px rgba(30, 64, 175, 0.12);
          --gdd-root-top-line: linear-gradient(90deg, #38bdf8 0%, #2563eb 42%, #0ea5e9 100%);
          --gdd-root-glow: radial-gradient(circle, rgba(14, 165, 233, 0.2) 0%, rgba(14, 165, 233, 0) 68%);
          --gdd-root-heading-border: #c9ddf3;
          --gdd-root-title-color: #0f2a44;
          --gdd-root-title-hover: #e8f3ff;
          --gdd-root-title-font: "Trebuchet MS", "Segoe UI", sans-serif;
          --gdd-root-badge-border: #93c5fd;
          --gdd-root-badge-background: linear-gradient(180deg, #e0f2fe 0%, #bfdbfe 100%);
          --gdd-root-badge-color: #1d4ed8;
          --gdd-root-badge-shadow: inset 0 1px 0 #ffffff, 0 2px 6px rgba(37, 99, 235, 0.18);
          --gdd-root-title-shadow: 0 1px 0 rgba(255, 255, 255, 0.45);
        }

        .gdd-doc-paper.gdd-doc-theme-editorial {
          --gdd-root-border: #d4ccbf;
          --gdd-root-background: linear-gradient(180deg, #fdfaf4 0%, #fffdf9 52%, #ffffff 100%);
          --gdd-root-shadow: 0 16px 30px rgba(71, 56, 36, 0.09);
          --gdd-root-top-line: linear-gradient(90deg, #6b7280 0%, #111827 50%, #6b7280 100%);
          --gdd-root-glow: radial-gradient(circle, rgba(148, 163, 184, 0.16) 0%, rgba(148, 163, 184, 0) 72%);
          --gdd-root-heading-border: #ddd3c3;
          --gdd-root-title-color: #2b2318;
          --gdd-root-title-hover: #f4eee3;
          --gdd-root-title-font: "Times New Roman", Georgia, serif;
          --gdd-root-badge-border: #bca892;
          --gdd-root-badge-background: linear-gradient(180deg, #f8efe3 0%, #e8d7bf 100%);
          --gdd-root-badge-color: #6b4f2c;
          --gdd-root-badge-shadow: inset 0 1px 0 #fffaf1, 0 2px 5px rgba(55, 48, 35, 0.14);
          --gdd-root-title-shadow: none;
        }

        .gdd-doc-paper.gdd-doc-theme-night {
          --gdd-root-border: #334155;
          --gdd-root-background: linear-gradient(180deg, #0f172a 0%, #111827 52%, #1f2937 100%);
          --gdd-root-shadow: 0 18px 36px rgba(15, 23, 42, 0.35);
          --gdd-root-top-line: linear-gradient(90deg, #22d3ee 0%, #38bdf8 38%, #818cf8 100%);
          --gdd-root-glow: radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(56, 189, 248, 0) 70%);
          --gdd-root-heading-border: #334155;
          --gdd-root-title-color: #e2e8f0;
          --gdd-root-title-hover: #1e293b;
          --gdd-root-title-font: "Segoe UI", "Trebuchet MS", sans-serif;
          --gdd-root-badge-border: #38bdf8;
          --gdd-root-badge-background: linear-gradient(180deg, #1e3a5f 0%, #1d4b73 100%);
          --gdd-root-badge-color: #bae6fd;
          --gdd-root-badge-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 6px rgba(14, 165, 233, 0.22);
          --gdd-root-title-shadow: none;
        }

        .gdd-root-section {
          position: relative;
          margin-bottom: 2.75rem;
          border: 1px solid var(--gdd-root-border);
          border-radius: 1rem;
          background: var(--gdd-root-background);
          box-shadow: var(--gdd-root-shadow);
          padding: 1.15rem 1.1rem 0.3rem;
          overflow: hidden;
        }

        .gdd-root-section::before {
          content: "";
          position: absolute;
          left: 1.1rem;
          right: 1.1rem;
          top: 0.7rem;
          height: 3px;
          border-radius: 999px;
          background: var(--gdd-root-top-line);
          opacity: 0.9;
          pointer-events: none;
        }

        .gdd-root-section::after {
          content: "";
          position: absolute;
          right: -80px;
          top: -90px;
          width: 240px;
          height: 240px;
          border-radius: 999px;
          background: var(--gdd-root-glow);
          pointer-events: none;
        }

        .gdd-root-heading {
          margin-bottom: 1rem;
          padding-top: 0.55rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--gdd-root-heading-border);
        }

        .gdd-root-heading-button {
          color: var(--gdd-root-title-color);
          font-weight: 800;
          letter-spacing: -0.01em;
          font-family: var(--gdd-root-title-font);
          text-shadow: var(--gdd-root-title-shadow);
        }

        .gdd-root-heading-button:hover {
          background: var(--gdd-root-title-hover);
        }

        .gdd-root-section-badge {
          min-width: 2rem;
          height: 2rem;
          border-radius: 999px;
          border: 1px solid var(--gdd-root-badge-border);
          background: var(--gdd-root-badge-background);
          color: var(--gdd-root-badge-color);
          font-size: 0.82rem;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--gdd-root-badge-shadow);
        }

        .gdd-root-section .section-content {
          margin-bottom: 2rem;
        }

        .gdd-flowchart-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.28rem;
          border-radius: 999px;
          border: 1px solid #34d399;
          background: #ecfdf5;
          color: #065f46;
          padding: 0.14rem 0.48rem;
          font-size: 0.72rem;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0.01em;
        }

        .gdd-has-flowchart > .section-anchor-target {
          border-left: 4px solid #34d399;
          padding-left: 0.7rem;
          border-radius: 0.6rem;
          background: linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0) 70%);
        }

        .gdd-flowchart-cta {
          color: #065f46;
          border-color: #6ee7b7;
          background: linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%);
          box-shadow: 0 6px 16px rgba(5, 150, 105, 0.14);
          transition: transform 0.15s ease, box-shadow 0.2s ease, filter 0.2s ease;
          animation: gddFlowchartPulseIn 620ms ease-out;
        }

        .gdd-flowchart-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(5, 150, 105, 0.22);
          filter: saturate(1.06);
        }

        .gdd-doc-paper.gdd-doc-theme-night .gdd-flowchart-chip {
          border-color: #22d3ee;
          background: rgba(8, 47, 73, 0.75);
          color: #a5f3fc;
        }

        .gdd-doc-paper.gdd-doc-theme-night .gdd-has-flowchart > .section-anchor-target {
          border-left-color: #22d3ee;
          background: linear-gradient(90deg, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0) 72%);
        }

        .gdd-doc-paper.gdd-doc-theme-night .gdd-flowchart-cta {
          color: #cffafe;
          border-color: #06b6d4;
          background: linear-gradient(180deg, #0f766e 0%, #155e75 100%);
          box-shadow: 0 8px 18px rgba(8, 145, 178, 0.28);
        }

        @keyframes gddFlowchartPulseIn {
          0% {
            transform: scale(0.96);
            box-shadow: 0 0 0 rgba(16, 185, 129, 0);
          }
          65% {
            transform: scale(1.02);
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.12);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 6px 16px rgba(5, 150, 105, 0.14);
          }
        }

        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .prose,
        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .prose p,
        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .prose li,
        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .prose strong {
          color: #dbe7f5 !important;
        }

        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .prose h1,
        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .prose h2,
        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .prose h3,
        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .prose h4 {
          color: #f8fafc !important;
        }

        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .prose .markdown-with-refs th,
        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .prose .markdown-with-refs td {
          color: #e5e7eb;
          border-color: #334155;
          background-color: #111827;
        }

        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .text-gray-500 {
          color: #94a3b8 !important;
        }

        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .text-gray-400 {
          color: #93c5fd !important;
        }

        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .bg-gray-50 {
          background-color: #1e293b !important;
          border-color: #334155 !important;
        }

        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .text-blue-600,
        .gdd-doc-paper.gdd-doc-theme-night .gdd-root-section .hover\:text-blue-800:hover {
          color: #7dd3fc !important;
        }

        @media (max-width: 1024px) {
          .gdd-root-section {
            padding: 1rem 0.85rem 0.15rem;
          }

          .gdd-root-section::before {
            left: 0.85rem;
            right: 0.85rem;
          }
        }

        @media print {
          .gdd-sidebar-toc,
          .gdd-mobile-toc,
          .gdd-toc-toggle {
            display: none !important;
          }
          .gdd-root-section {
            box-shadow: none !important;
            border-color: #d1d5db !important;
            background: #ffffff !important;
            break-inside: avoid;
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
          h2, h3, h4, h5, h6 {
            page-break-after: avoid;
          }
        }
      `}</style>
    </div>
  );
}
