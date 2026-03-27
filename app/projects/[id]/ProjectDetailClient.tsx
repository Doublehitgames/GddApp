"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { MarkdownWithReferences } from "@/components/MarkdownWithReferences";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useI18n } from "@/lib/i18n/provider";
import AIChat from "@/components/AIChat";
import { GAME_DESIGN_DOMAIN_IDS } from "@/lib/gameDesignDomains";
import {
    driveFileIdToImageUrl,
    getDriveImageDisplayCandidates,
    getGoogleClientId,
    openGoogleDriveImagePicker,
} from "@/lib/googleDrivePicker";

interface Props {
    projectId: string;
}

export default function ProjectDetailClient({ projectId }: Props) {
    const { t } = useI18n();
    const { user, profile } = useAuthStore();
    const sectionAuditBy = user ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null } : undefined;

    const router = useRouter();
    const pathname = usePathname();
    const getProject = useProjectStore((s) => s.getProject);
    const addSection = useProjectStore((s) => s.addSection);
    const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
    const reorderSections = useProjectStore((s) => s.reorderSections);
    const setProjectCoverImage = useProjectStore((s) => s.setProjectCoverImage);
    const projects = useProjectStore((s) => s.projects);

    const [mounted, setMounted] = useState(false);
    const [project, setProject] = useState<any>(null);
    const [chatOpen, setChatOpen] = useState(false);
    const [sectionTitle, setSectionTitle] = useState("");
    const [nameError, setNameError] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [isPickingCoverImage, setIsPickingCoverImage] = useState(false);
    const [coverImageError, setCoverImageError] = useState("");
    const [coverImageCandidateIndex, setCoverImageCandidateIndex] = useState(0);
    const [showSectionTopFade, setShowSectionTopFade] = useState(false);
    const [showSectionBottomFade, setShowSectionBottomFade] = useState(false);
    const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
    const [selectedAddonFilters, setSelectedAddonFilters] = useState<string[]>([]);
    const [tagFilterMenuOpen, setTagFilterMenuOpen] = useState(false);
    const [addonFilterMenuOpen, setAddonFilterMenuOpen] = useState(false);
    const sectionListRef = useRef<HTMLDivElement | null>(null);
    const tagFilterMenuRef = useRef<HTMLDivElement | null>(null);
    const addonFilterMenuRef = useRef<HTMLDivElement | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Garantir que estamos no client antes de acessar o store
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (mounted) {
            const p = getProject(projectId);
            setProject(p);
        }
    }, [mounted, projectId, projects]);

    const coverImageCandidates = useMemo(
        () => getDriveImageDisplayCandidates(project?.coverImageUrl || ""),
        [project?.coverImageUrl]
    );

    useEffect(() => {
        setCoverImageCandidateIndex(0);
    }, [project?.coverImageUrl]);

    function handleAddSection() {
        if (!sectionTitle.trim() || nameError) return;

        try {
            addSection(projectId, sectionTitle.trim(), undefined, sectionAuditBy);
            setSectionTitle("");
            setNameError("");
        } catch (e) {
            if (e instanceof Error && (e.message === "structural_limit_sections_per_project" || e.message === "structural_limit_sections_total")) {
                setNameError(e.message === "structural_limit_sections_total" ? t("limits.sectionsTotal") : t("limits.sectionsPerProject"));
            } else {
                throw e;
            }
        }
    }

    async function handlePickCoverImage() {
        if (isPickingCoverImage) return;
        setCoverImageError("");
        setIsPickingCoverImage(true);
        try {
            const googleClientId = await getGoogleClientId();
            if (!googleClientId) {
                setCoverImageError(t("projectDetail.cover.missingGoogleConfig"));
                return;
            }
            const picked = await openGoogleDriveImagePicker(googleClientId);
            if (!picked?.id) return;
            setProjectCoverImage(projectId, driveFileIdToImageUrl(picked.id));
            setCoverImageCandidateIndex(0);
        } catch {
            setCoverImageError(t("projectDetail.cover.pickFailed"));
        } finally {
            setIsPickingCoverImage(false);
        }
    }

    const projectContext = project ? {
        projectId: project.id,
        projectTitle: project.title,
        projectDescription: project.description,
        sections: (project.sections || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            content: s.content,
            parentId: s.parentId,
            domainTags: s.domainTags,
            addonTypes: Array.from(new Set((s.addons || []).map((addon: any) => addon.type))).filter(Boolean),
        })),
    } : undefined;

    const navigationActions = [
        {
            href: `/projects/${projectId}/mindmap`,
            label: t("projectDetail.actions.mindMap"),
            accentClass: "from-sky-500/25 to-cyan-500/10",
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            ),
        },
        {
            href: `/projects/${projectId}/view`,
            label: t("projectDetail.actions.viewDocument"),
            accentClass: "from-indigo-500/25 to-violet-500/10",
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            href: `/projects/${projectId}/settings`,
            label: t("projectDetail.actions.settings"),
            accentClass: "from-slate-400/20 to-gray-500/10",
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        },
        {
            href: `/projects/${projectId}/backup`,
            label: t("projectDetail.actions.backup"),
            accentClass: "from-emerald-500/25 to-green-500/10",
            icon: (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
            ),
        },
    ];

    const aiActions = [
        {
            href: `/projects/${projectId}/relations`,
            label: t("projectDetail.aiMenu.suggestRelations"),
            emoji: "🔗",
            accentClass: "from-fuchsia-500/25 to-purple-500/10",
        },
        {
            href: `/projects/${projectId}/analysis`,
            label: t("projectDetail.aiMenu.analyzeConsistency"),
            emoji: "⚖️",
            accentClass: "from-violet-500/25 to-indigo-500/10",
        },
        {
            href: `/projects/${projectId}/assign-tags`,
            label: t("projectDetail.aiMenu.assignTags"),
            emoji: "🏷️",
            accentClass: "from-pink-500/25 to-fuchsia-500/10",
        },
    ];
    const activeSectionId = useMemo(() => {
        const match = pathname.match(/\/projects\/[^/]+\/sections\/([^/?#]+)/);
        return match?.[1] ?? null;
    }, [pathname]);
    const sectionIds = useMemo(
        () => (project?.sections || []).map((s: any) => s.id),
        [project?.sections]
    );
    const availableDomainTags = useMemo(() => {
        const tags = new Set<string>(GAME_DESIGN_DOMAIN_IDS as unknown as string[]);
        (project?.sections || []).forEach((section: any) => {
            const sectionTags = Array.isArray(section?.domainTags) ? section.domainTags : [];
            sectionTags.forEach((tag: string) => {
                if (tag?.trim()) tags.add(tag.trim());
            });
        });
        return Array.from(tags).sort((a, b) => a.localeCompare(b));
    }, [project?.sections]);
    const availableAddonTypes = useMemo(() => {
        const addonTypes = new Set<string>();
        (project?.sections || []).forEach((section: any) => {
            const sectionAddons = Array.isArray(section?.addons)
                ? section.addons
                : Array.isArray(section?.balanceAddons)
                    ? section.balanceAddons
                    : [];
            sectionAddons.forEach((addon: any) => {
                const type = typeof addon?.type === "string" ? addon.type.trim() : "";
                if (type) addonTypes.add(type);
            });
        });
        return Array.from(addonTypes).sort((a, b) =>
            t(`sectionDetail.history.addonType.${a}`, a).localeCompare(
                t(`sectionDetail.history.addonType.${b}`, b)
            )
        );
    }, [project?.sections, t]);
    const updateSectionFades = useCallback(() => {
        const el = sectionListRef.current;
        if (!el) {
            setShowSectionTopFade(false);
            setShowSectionBottomFade(false);
            return;
        }
        const { scrollTop, scrollHeight, clientHeight } = el;
        const hasScrollableContent = scrollHeight - clientHeight > 2;
        if (!hasScrollableContent) {
            setShowSectionTopFade(false);
            setShowSectionBottomFade(false);
            return;
        }
        setShowSectionTopFade(scrollTop > 2);
        setShowSectionBottomFade(scrollTop + clientHeight < scrollHeight - 2);
    }, []);

    useEffect(() => {
        updateSectionFades();
        window.addEventListener("resize", updateSectionFades);
        return () => window.removeEventListener("resize", updateSectionFades);
    }, [updateSectionFades, project?.sections, searchTerm, expandedSections]);
    useEffect(() => {
        setSelectedTagFilters((prev) => prev.filter((tag) => availableDomainTags.includes(tag)));
    }, [availableDomainTags]);
    useEffect(() => {
        setSelectedAddonFilters((prev) => prev.filter((type) => availableAddonTypes.includes(type)));
    }, [availableAddonTypes]);
    useEffect(() => {
        if (!tagFilterMenuOpen) return;
        const onPointerDown = (event: MouseEvent) => {
            if (tagFilterMenuRef.current?.contains(event.target as Node)) return;
            setTagFilterMenuOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [tagFilterMenuOpen]);
    useEffect(() => {
        if (!addonFilterMenuOpen) return;
        const onPointerDown = (event: MouseEvent) => {
            if (addonFilterMenuRef.current?.contains(event.target as Node)) return;
            setAddonFilterMenuOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [addonFilterMenuOpen]);
    const canExpandAll = sectionIds.some((id: string) => !expandedSections.has(id));
    const canCollapseAll = expandedSections.size > 0;
    const handleExpandAllSections = () => {
        setExpandedSections(new Set(sectionIds));
    };
    const handleCollapseAllSections = () => {
        setExpandedSections(new Set());
    };
    const toggleTagFilter = (tag: string) => {
        setSelectedTagFilters((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    };
    const toggleAddonFilter = (type: string) => {
        setSelectedAddonFilters((prev) =>
            prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
        );
    };

    if (!mounted) return <div className="min-h-screen bg-gray-900 text-white p-6">{t("common.loading")}</div>;

    if (!project) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-6">
                <div className="max-w-5xl mx-auto">
                    <button className="mb-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors" onClick={() => router.push("/")}>
                        {t("projectDetail.backHome")}
                    </button>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-red-300">{t("projectDetail.notFound")} "{projectId}"</div>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-900 text-white px-4 py-8 md:px-8 md:py-10 lg:px-10">
            <div className="mx-auto w-full max-w-7xl">
                <div className="grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="space-y-6">
                        <header className="rounded-xl bg-gray-800/50 border border-gray-700/60 px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <Link
                                    href="/"
                                    className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-700/80 hover:text-white shrink-0"
                                    aria-label={t("projectDetail.backHome")}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    <span className="hidden sm:inline">{t("projectDetail.backHome")}</span>
                                </Link>
                                <span className="text-gray-500 hidden sm:inline">/</span>
                                <span className="truncate text-gray-300 font-semibold" title={project.title}>
                                    {project.title}
                                </span>
                            </div>
                        </header>
                        <section className="ui-card-premium">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{project.title}</h1>
                                <button
                                    className="bg-yellow-500 text-black px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-yellow-400 transition-colors"
                                    onClick={() => router.push(`/projects/${projectId}/edit`)}
                                >
                                    {t("projectDetail.edit")}
                                </button>
                            </div>

                            <div className="mb-4">
                                {coverImageError && (
                                    <p className="text-sm text-red-300 mb-3">{coverImageError}</p>
                                )}
                                <button
                                    type="button"
                                    onClick={handlePickCoverImage}
                                    disabled={isPickingCoverImage}
                                    aria-label={t("projectDetail.cover.selectFromDrive")}
                                    className="w-full text-left rounded-xl overflow-hidden border border-gray-600/70 bg-gray-900/60 hover:border-blue-500/70 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {project.coverImageUrl && coverImageCandidateIndex < coverImageCandidates.length ? (
                                        <div className="relative">
                                            <img
                                                src={coverImageCandidates[coverImageCandidateIndex]}
                                                alt={t("projectDetail.cover.alt", "Capa do projeto")}
                                                onError={() => {
                                                    setCoverImageCandidateIndex((prev) => prev + 1);
                                                }}
                                                className="w-full max-h-[320px] object-cover"
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 px-3 py-2 text-xs bg-black/55 text-gray-100">
                                                {isPickingCoverImage ? t("projectDetail.cover.picking") : t("projectDetail.cover.hint")}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-48 md:h-56 border-2 border-dashed border-gray-600 rounded-xl m-3 flex flex-col items-center justify-center gap-2 text-center px-4">
                                            <span className="text-3xl">🖼️</span>
                                            <p className="text-sm font-medium text-gray-200">
                                                {isPickingCoverImage
                                                    ? t("projectDetail.cover.picking")
                                                    : t("projectDetail.cover.selectFromDrive")}
                                            </p>
                                            <p className="text-xs text-gray-400">{t("projectDetail.cover.noImage")}</p>
                                        </div>
                                    )}
                                </button>
                                {project.coverImageUrl && coverImageCandidateIndex >= coverImageCandidates.length && (
                                    <p className="text-amber-300 text-sm mt-2">{t("projectDetail.cover.loadFailed")}</p>
                                )}
                            </div>

                            <div className="text-gray-200">
                                {project.description ? (
                                    <MarkdownWithReferences
                                        content={project.description}
                                        projectId={projectId}
                                        sections={project.sections || []}
                                        projectTokenSource={project}
                                    />
                                ) : (
                                    <p className="text-gray-400 italic">{t("projectDetail.noDescription")}</p>
                                )}
                            </div>
                        </section>

                        <section className="ui-card-premium">
                            <h2 className="text-xl font-semibold tracking-tight mb-4">{t("projectDetail.actions.navMenuLabel")}</h2>
                            <div className="scrollbar-premium scrollbar-premium-subtle flex gap-3 overflow-x-auto overflow-y-visible pt-1 pb-2 snap-x snap-mandatory scroll-px-1 sm:snap-none">
                                {navigationActions.map((action) => {
                                    const isActive = pathname === action.href;
                                    return (
                                        <Link
                                            key={action.href}
                                            href={action.href}
                                            prefetch={false}
                                            className={`group relative overflow-hidden shrink-0 snap-start w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-xl border flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-2 text-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset ${isActive
                                                ? "border-indigo-300 bg-indigo-600/20 text-indigo-100 shadow-lg shadow-indigo-900/40 -translate-y-0.5"
                                                : "border-gray-600 bg-gray-900/60 text-gray-300 hover:border-indigo-500 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px hover:shadow-sm hover:shadow-black/25"
                                                }`}
                                        >
                                            <span className={`absolute inset-0 bg-gradient-to-br ${action.accentClass} opacity-80`} aria-hidden />
                                            <span className="relative text-inherit group-hover:scale-105 transition-transform">{action.icon}</span>
                                            <span className="relative text-[11px] sm:text-xs font-medium leading-tight">{action.label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="ui-card-premium">
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold tracking-tight">{t("projectDetail.aiMenu.title")}</h2>
                                <p className="text-xs text-gray-400 mt-1">{t("projectDetail.aiMenu.improveHint")}</p>
                            </div>
                            <div className="scrollbar-premium scrollbar-premium-subtle flex gap-3 overflow-x-auto overflow-y-visible pt-1 pb-2 snap-x snap-mandatory scroll-px-1 sm:snap-none">
                                {aiActions.map((action) => {
                                    const isActive = pathname === action.href;
                                    return (
                                        <Link
                                            key={action.href}
                                            href={action.href}
                                            prefetch={false}
                                            className={`group relative overflow-hidden shrink-0 snap-start w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-xl border flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-2 text-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset ${isActive
                                                ? "border-fuchsia-300 bg-fuchsia-600/20 text-fuchsia-100 shadow-lg shadow-fuchsia-900/40 -translate-y-0.5"
                                                : "border-gray-600 bg-gray-900/60 text-gray-300 hover:border-fuchsia-500 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px hover:shadow-sm hover:shadow-black/25"
                                                }`}
                                        >
                                            <span className={`absolute inset-0 bg-gradient-to-br ${action.accentClass} opacity-80`} aria-hidden />
                                            <span className="relative text-xl sm:text-2xl leading-none group-hover:scale-105 transition-transform">{action.emoji}</span>
                                            <span className="relative text-[11px] sm:text-xs font-medium leading-tight">{action.label}</span>
                                        </Link>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setChatOpen(true)}
                                    className={`group relative overflow-hidden shrink-0 snap-start w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-xl border flex flex-col items-center justify-center gap-1.5 sm:gap-2 px-2 text-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset ${chatOpen
                                        ? "border-fuchsia-300 bg-fuchsia-600/20 text-fuchsia-100 shadow-lg shadow-fuchsia-900/40 -translate-y-0.5"
                                        : "border-gray-600 bg-gray-900/60 text-gray-300 hover:border-fuchsia-500 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px hover:shadow-sm hover:shadow-black/25"
                                        }`}
                                >
                                    <span className="absolute inset-0 bg-gradient-to-br from-rose-500/25 to-fuchsia-500/10 opacity-80" aria-hidden />
                                    <span className="relative text-xl sm:text-2xl leading-none group-hover:scale-105 transition-transform">💬</span>
                                    <span className="relative text-[11px] sm:text-xs font-medium leading-tight">{t("projectDetail.aiMenu.openChat")}</span>
                                </button>
                            </div>
                        </section>
                    </div>

                    <aside className="relative overflow-hidden bg-gray-800/75 border border-gray-700/80 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/10 lg:sticky lg:top-6 lg:self-start lg:h-[calc(100vh-6.5rem)] lg:flex lg:flex-col">
                        <span className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10 pointer-events-none" aria-hidden />
                        <div className="relative mb-4" ref={tagFilterMenuRef}>
                            <div>
                                <h2 className="text-xl font-semibold tracking-tight">{t("projectDetail.sectionsTitle")}</h2>
                                <p className="text-sm text-gray-400 mt-1">{t("projectDetail.sectionsSubtitle")}</p>
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-indigo-400/45 bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/20 px-2 text-xs font-semibold text-indigo-100 tabular-nums shadow-sm shadow-indigo-900/25">
                                    {(project.sections || []).length}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handleExpandAllSections}
                                        disabled={!canExpandAll || sectionIds.length === 0}
                                        title={t("projectDetail.expandAllSections")}
                                        aria-label={t("projectDetail.expandAllSections")}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-600 bg-gray-900/75 text-gray-200 transition-all duration-150 hover:border-indigo-400 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7l5 5 5-5M7 13l5 5 5-5" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCollapseAllSections}
                                        disabled={!canCollapseAll}
                                        title={t("projectDetail.collapseAllSections")}
                                        aria-label={t("projectDetail.collapseAllSections")}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-600 bg-gray-900/75 text-gray-200 transition-all duration-150 hover:border-indigo-400 hover:text-white hover:bg-gray-800/90 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 11l-5-5-5 5M17 17l-5-5-5 5" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTagFilterMenuOpen((v) => !v)}
                                        title={t("projectDetail.tagFilterLabel")}
                                        aria-label={t("projectDetail.tagFilterLabel")}
                                        aria-expanded={tagFilterMenuOpen}
                                        aria-haspopup="true"
                                        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border text-gray-200 transition-all duration-150 hover:-translate-y-px ${tagFilterMenuOpen || selectedTagFilters.length > 0
                                            ? "border-indigo-400 bg-indigo-600/20 text-indigo-100 shadow-md shadow-indigo-900/30"
                                            : "border-gray-600 bg-gray-900/75 hover:border-indigo-400 hover:text-white hover:bg-gray-800/90"
                                            }`}
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
                                        </svg>
                                        {selectedTagFilters.length > 0 && (
                                            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-indigo-500 text-[10px] font-semibold text-white">
                                                {selectedTagFilters.length}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAddonFilterMenuOpen((v) => !v)}
                                        title={t("projectDetail.addonFilterLabel")}
                                        aria-label={t("projectDetail.addonFilterLabel")}
                                        aria-expanded={addonFilterMenuOpen}
                                        aria-haspopup="true"
                                        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg border text-gray-200 transition-all duration-150 hover:-translate-y-px ${addonFilterMenuOpen || selectedAddonFilters.length > 0
                                            ? "border-fuchsia-400 bg-fuchsia-600/20 text-fuchsia-100 shadow-md shadow-fuchsia-900/30"
                                            : "border-gray-600 bg-gray-900/75 hover:border-fuchsia-400 hover:text-white hover:bg-gray-800/90"
                                            }`}
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10l2 3-3 2v5l-4 2v-7l-3-2 2-3z" />
                                        </svg>
                                        {selectedAddonFilters.length > 0 && (
                                            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-fuchsia-500 text-[10px] font-semibold text-white">
                                                {selectedAddonFilters.length}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                            {tagFilterMenuOpen && (
                                <div className="ui-menu-pop absolute z-30 right-0 mt-2 w-80 rounded-xl border border-gray-600/90 bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-black/35 p-3">
                                    <div className="flex items-center justify-between gap-2 px-1 pb-3 border-b border-gray-700/70 mb-3">
                                        <span className="text-xs font-medium text-gray-300">{t("projectDetail.tagFilterLabel")}</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTagFilters([])}
                                            disabled={selectedTagFilters.length === 0}
                                            className="text-xs text-indigo-300 hover:text-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {t("projectDetail.tagFilterClear")}
                                        </button>
                                    </div>
                                    {availableDomainTags.length === 0 ? (
                                        <p className="text-xs text-gray-400 px-1 py-3">{t("projectDetail.tagFilterNoTags")}</p>
                                    ) : (
                                        <div className="max-h-56 overflow-y-auto scrollbar-premium pr-1 space-y-1.5">
                                            {availableDomainTags.map((tag) => {
                                                const checked = selectedTagFilters.includes(tag);
                                                return (
                                                    <label key={tag} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm cursor-pointer transition-all ${checked ? "border-indigo-400/60 bg-gradient-to-r from-indigo-600/25 to-fuchsia-600/20 text-indigo-100" : "border-gray-700/80 text-gray-200 hover:bg-gray-800/80 hover:border-gray-600"}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleTagFilter(tag)}
                                                            className="sr-only"
                                                        />
                                                        <span
                                                            aria-hidden="true"
                                                            className={`inline-flex h-4 w-4 items-center justify-center rounded border transition-all duration-150 ${checked
                                                                ? "border-indigo-300/80 bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-sm shadow-indigo-900/30"
                                                                : "border-gray-500 bg-gray-900/70"
                                                                }`}
                                                        >
                                                            {checked && (
                                                                <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </span>
                                                        <span className="truncate">{t(`sectionDetail.domain.${tag}`, tag)}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {selectedTagFilters.length > 0 && (
                                        <div className="pt-3 mt-3 border-t border-gray-700/70 text-[11px] text-gray-400">
                                            {selectedTagFilters.length} {t("projectDetail.tagFilterSelectedCount")}
                                        </div>
                                    )}
                                </div>
                            )}
                            {addonFilterMenuOpen && (
                                <div ref={addonFilterMenuRef} className="ui-menu-pop absolute z-30 right-0 mt-2 w-80 rounded-xl border border-gray-600/90 bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-black/35 p-3">
                                    <div className="flex items-center justify-between gap-2 px-1 pb-3 border-b border-gray-700/70 mb-3">
                                        <span className="text-xs font-medium text-gray-300">{t("projectDetail.addonFilterLabel")}</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedAddonFilters([])}
                                            disabled={selectedAddonFilters.length === 0}
                                            className="text-xs text-fuchsia-300 hover:text-fuchsia-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {t("projectDetail.addonFilterClear")}
                                        </button>
                                    </div>
                                    {availableAddonTypes.length === 0 ? (
                                        <p className="text-xs text-gray-400 px-1 py-3">{t("projectDetail.addonFilterNoAddons")}</p>
                                    ) : (
                                        <div className="max-h-56 overflow-y-auto scrollbar-premium pr-1 space-y-1.5">
                                            {availableAddonTypes.map((type) => {
                                                const checked = selectedAddonFilters.includes(type);
                                                return (
                                                    <label key={type} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm cursor-pointer transition-all ${checked ? "border-fuchsia-400/60 bg-gradient-to-r from-fuchsia-600/25 to-indigo-600/20 text-fuchsia-100" : "border-gray-700/80 text-gray-200 hover:bg-gray-800/80 hover:border-gray-600"}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleAddonFilter(type)}
                                                            className="sr-only"
                                                        />
                                                        <span
                                                            aria-hidden="true"
                                                            className={`inline-flex h-4 w-4 items-center justify-center rounded border transition-all duration-150 ${checked
                                                                ? "border-fuchsia-300/80 bg-gradient-to-br from-fuchsia-500 to-indigo-500 shadow-sm shadow-fuchsia-900/30"
                                                                : "border-gray-500 bg-gray-900/70"
                                                                }`}
                                                        >
                                                            {checked && (
                                                                <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </span>
                                                        <span className="truncate">{t(`sectionDetail.history.addonType.${type}`, type)}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {selectedAddonFilters.length > 0 && (
                                        <div className="pt-3 mt-3 border-t border-gray-700/70 text-[11px] text-gray-400">
                                            {selectedAddonFilters.length} {t("projectDetail.addonFilterSelectedCount")}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="relative mb-4">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
                            </svg>
                            <input
                                type="text"
                                placeholder={t("projectDetail.searchPlaceholder")}
                                value={searchTerm}
                                onChange={(e) => {
                                    const term = e.target.value;
                                    setSearchTerm(term);
                                    if (term.trim()) {
                                        const allIds = new Set<string>();
                                        function collectIds(sectionsList: any[]) {
                                            sectionsList.forEach((s: any) => {
                                                allIds.add(s.id);
                                                const children = (project.sections || []).filter((child: any) => child.parentId === s.id);
                                                if (children.length > 0) {
                                                    collectIds(children);
                                                }
                                            });
                                        }
                                        collectIds(project.sections || []);
                                        setExpandedSections(allIds);
                                    }
                                }}
                                className="ui-input-dark ui-focus-ring-indigo w-full pl-9 pr-3 py-2.5 text-sm"
                            />
                        </div>

                        <div className="relative lg:flex-1 lg:min-h-0">
                            <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-gray-800/90 to-transparent transition-opacity duration-300 ease-out ${showSectionTopFade ? "opacity-90" : "opacity-0"}`} aria-hidden />
                            <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-gray-800/90 to-transparent transition-opacity duration-300 ease-out ${showSectionBottomFade ? "opacity-90" : "opacity-0"}`} aria-hidden />
                            <div
                                ref={sectionListRef}
                                onScroll={updateSectionFades}
                                className="scrollbar-premium max-h-[45vh] overflow-y-auto overscroll-y-contain pr-1 lg:h-full lg:max-h-none"
                            >
                                <SectionTree
                                    sections={project.sections || []}
                                    projectId={projectId}
                                    reorderSections={reorderSections}
                                    sensors={sensors}
                                    searchTerm={searchTerm}
                                selectedTagFilters={selectedTagFilters}
                                selectedAddonFilters={selectedAddonFilters}
                                    activeSectionId={activeSectionId}
                                    expandedSections={expandedSections}
                                    setExpandedSections={setExpandedSections}
                                    labels={{
                                        resultsFoundOne: t("projectDetail.resultsFoundOne"),
                                        resultsFoundMany: t("projectDetail.resultsFoundMany"),
                                        match: t("projectDetail.match"),
                                        reorder: t("projectDetail.reorder"),
                                    }}
                                />
                            </div>
                        </div>

                        <div className="relative z-20 mt-4 pt-4 border-t border-gray-700/80">
                            <div className="flex gap-2 flex-wrap items-center">
                                <input
                                    value={sectionTitle}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSectionTitle(val);
                                        if (val.trim() && hasDuplicateName(projectId, val.trim(), undefined)) {
                                            setNameError(t("projectDetail.rootSectionDuplicate"));
                                        } else {
                                            setNameError("");
                                        }
                                    }}
                                    placeholder={t("projectDetail.newSectionPlaceholder")}
                                    className={`ui-input-dark ui-focus-ring-indigo flex-1 min-w-[160px] px-3 py-2 text-sm ${nameError ? "border-red-500" : "border-gray-600"}`}
                                />
                                <button onClick={handleAddSection} className="ui-btn-primary-gradient relative z-20 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-900/30 disabled:opacity-100 disabled:brightness-75 disabled:saturate-50 disabled:cursor-not-allowed" disabled={!sectionTitle.trim() || !!nameError}>
                                    <span className="text-base leading-none">+</span>
                                    {t("projectDetail.add")}
                                </button>
                            </div>
                            {nameError && (
                                <span className="text-red-400 text-sm mt-1 block">{nameError}</span>
                            )}
                        </div>
                    </aside>
                </div>
            </div>

            {/* Painel do chat IA (drawer lateral) - aberto pelo menu */}
            {chatOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setChatOpen(false)} aria-hidden />
                    <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
                        <AIChat
                            projectContext={projectContext}
                            onClose={() => setChatOpen(false)}
                            isOpen={chatOpen}
                        />
                    </div>
                </div>
            )}
        </main>
    );
}

// Componente auxiliar para renderizar árvore de seções (somente links)
function SectionTree({ sections, projectId, reorderSections, sensors, searchTerm, selectedTagFilters, selectedAddonFilters, activeSectionId, expandedSections, setExpandedSections, labels }: { 
    sections: any[]; 
    projectId: string; 
    reorderSections: any; 
    sensors: any; 
    searchTerm: string;
    selectedTagFilters: string[];
    selectedAddonFilters: string[];
    activeSectionId: string | null;
    expandedSections: Set<string>;
    setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
    labels: {
        resultsFoundOne: string;
        resultsFoundMany: string;
        match: string;
        reorder: string;
    };
}) {
    // Filtrar seções que correspondem ao termo de busca
    const matchesSearch = (section: any): boolean => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const titleMatch = section.title.toLowerCase().includes(term);
        const contentMatch = section.content?.toLowerCase().includes(term) || false;
        return titleMatch || contentMatch;
    };
    const matchesTags = (section: any): boolean => {
        if (selectedTagFilters.length === 0) return true;
        const sectionTags = Array.isArray(section?.domainTags) ? section.domainTags : [];
        return sectionTags.some((tag: string) => selectedTagFilters.includes(tag));
    };
    const matchesAddons = (section: any): boolean => {
        if (selectedAddonFilters.length === 0) return true;
        const sectionAddons = Array.isArray(section?.addons)
            ? section.addons
            : Array.isArray(section?.balanceAddons)
                ? section.balanceAddons
                : [];
        const addonTypes = sectionAddons
            .map((addon: any) => (typeof addon?.type === "string" ? addon.type : ""))
            .filter(Boolean);
        return addonTypes.some((type: string) => selectedAddonFilters.includes(type));
    };
    const matchesFilters = (section: any): boolean => matchesSearch(section) && matchesTags(section) && matchesAddons(section);

    // Filtrar raízes que correspondem ou têm filhos que correspondem
    const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
        const section = allSections.find(s => s.id === sectionId);
        if (!section) return false;
        if (matchesFilters(section)) return true;
        
        const children = allSections.filter(s => s.parentId === sectionId);
        return children.some(child => sectionMatchesOrHasMatchingChildren(child.id, allSections));
    };

    const roots = sections
        .filter((s) => !s.parentId)
        .filter(s => sectionMatchesOrHasMatchingChildren(s.id, sections))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    const totalMatches = (searchTerm.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0) ? sections.filter(matchesFilters).length : 0;

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = roots.findIndex((r) => r.id === active.id);
        const newIndex = roots.findIndex((r) => r.id === over.id);

        const newRoots = arrayMove(roots, oldIndex, newIndex);
        const newOrder = newRoots.map((r) => r.id);
        reorderSections(projectId, newOrder);
    }

    return (
        <>
            {(searchTerm.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0) && totalMatches > 0 && (
                <p className="text-sm text-gray-400 mb-2 ml-1">
                    {totalMatches} {totalMatches === 1 ? labels.resultsFoundOne : labels.resultsFoundMany}
                </p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={roots.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-2">
                        {roots.map((sec) => (
                            <SortableRootItem 
                                key={sec.id} 
                                section={sec} 
                                sections={sections} 
                                projectId={projectId} 
                                searchTerm={searchTerm}
                                selectedTagFilters={selectedTagFilters}
                                selectedAddonFilters={selectedAddonFilters}
                                activeSectionId={activeSectionId}
                                expandedSections={expandedSections}
                                setExpandedSections={setExpandedSections}
                                labels={labels}
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>
        </>
    );
}

function SortableRootItem({ section, sections, projectId, searchTerm, selectedTagFilters, selectedAddonFilters, activeSectionId, expandedSections, setExpandedSections, labels }: { 
    section: any; 
    sections: any[]; 
    projectId: string; 
    searchTerm: string;
    selectedTagFilters: string[];
    selectedAddonFilters: string[];
    activeSectionId: string | null;
    expandedSections: Set<string>;
    setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
    labels: {
        match: string;
        reorder: string;
    };
}) {
    const highlightText = (text: string, term?: string) => {
        if (!term || !term.trim()) return text;
        const regex = new RegExp(`(${term})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) => 
            regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
        );
    };

    const matchesDirectly = (sec: any): boolean => {
        if (!searchTerm || !searchTerm.trim()) return false;
        const term = searchTerm.toLowerCase();
        return sec.title.toLowerCase().includes(term) || sec.content?.toLowerCase().includes(term);
    };

    const getContentSnippet = (content: string, term: string): string => {
        if (!content || !term) return '';
        const lowerContent = content.toLowerCase();
        const lowerTerm = term.toLowerCase();
        const index = lowerContent.indexOf(lowerTerm);
        if (index === -1) return '';
        const start = Math.max(0, index - 40);
        const end = Math.min(content.length, index + term.length + 40);
        let snippet = content.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        return snippet;
    };

    const directMatch = matchesDirectly(section);
    const contentSnippet = directMatch && section.content ? getContentSnippet(section.content, searchTerm) : '';
    const isActiveSection = activeSectionId === section.id;
    
    const hasChildren = sections.some((s: any) => s.parentId === section.id);
    const isExpanded = expandedSections.has(section.id) || searchTerm.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0;

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: section.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <li ref={setNodeRef} style={style} className="mb-2">
            <div className={`group relative overflow-hidden flex items-center gap-2 border p-2.5 rounded-xl transition-all duration-150 ${isActiveSection
                ? "border-indigo-300/70 bg-indigo-600/20 shadow-md shadow-indigo-900/25"
                : "border-gray-700 bg-gray-900/70 hover:border-indigo-500/60 hover:-translate-y-px"
                }`}>
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent pointer-events-none" aria-hidden />
                <span
                    className="relative text-gray-400 cursor-grab active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                    aria-label={labels.reorder}
                >
                    ⋮⋮
                </span>
                {hasChildren && (
                    <button
                        onClick={() => {
                            const newExpanded = new Set(expandedSections);
                            if (expandedSections.has(section.id)) {
                                newExpanded.delete(section.id);
                            } else {
                                newExpanded.add(section.id);
                            }
                            setExpandedSections(newExpanded);
                        }}
                        className={`relative inline-flex items-center justify-center h-5 w-5 rounded-md border text-sm transition-colors ${isActiveSection
                            ? "border-indigo-300/60 text-indigo-100 bg-indigo-500/20"
                            : "border-gray-600 text-gray-300 hover:text-white hover:border-indigo-400"
                            }`}
                    >
                        {isExpanded ? '−' : '+'}
                    </button>
                )}
                {!hasChildren && <span className="w-4"></span>}
                <Link
                    href={`/projects/${projectId}/sections/${section.id}`}
                    className={`relative flex-1 min-w-0 truncate text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-inset rounded px-0.5 ${isActiveSection ? "text-indigo-100 font-semibold" : "text-blue-300 hover:text-blue-200"}`}
                    prefetch={false}
                >
                    {highlightText(section.title, searchTerm)}
                </Link>
                {directMatch && searchTerm.trim() && (
                    <span className="relative text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">✓ {labels.match}</span>
                )}
            </div>
            {contentSnippet && (
                <div className="ml-8 text-xs text-gray-300 italic mt-1 bg-yellow-950/30 border border-yellow-700/60 p-2 rounded-lg">
                    {highlightText(contentSnippet, searchTerm)}
                </div>
            )}
            {hasChildren && (
                <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                        <SectionChildren 
                            parentId={section.id} 
                            sections={sections} 
                            projectId={projectId} 
                            searchTerm={searchTerm}
                            selectedTagFilters={selectedTagFilters}
                            selectedAddonFilters={selectedAddonFilters}
                            activeSectionId={activeSectionId}
                            expandedSections={expandedSections}
                            setExpandedSections={setExpandedSections}
                            labels={labels}
                        />
                    </div>
                </div>
            )}
        </li>
    );
}

function SectionChildren({ parentId, sections, projectId, searchTerm, selectedTagFilters, selectedAddonFilters, activeSectionId, expandedSections, setExpandedSections, labels }: { 
    parentId: string; 
    sections: any[]; 
    projectId: string; 
    searchTerm?: string;
    selectedTagFilters: string[];
    selectedAddonFilters: string[];
    activeSectionId: string | null;
    expandedSections: Set<string>;
    setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
    labels: {
        match: string;
    };
}) {
    const matchesSearch = (section: any): boolean => {
        if (!searchTerm || !searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const titleMatch = section.title.toLowerCase().includes(term);
        const contentMatch = section.content?.toLowerCase().includes(term) || false;
        return titleMatch || contentMatch;
    };
    const matchesTags = (section: any): boolean => {
        if (selectedTagFilters.length === 0) return true;
        const sectionTags = Array.isArray(section?.domainTags) ? section.domainTags : [];
        return sectionTags.some((tag: string) => selectedTagFilters.includes(tag));
    };
    const matchesAddons = (section: any): boolean => {
        if (selectedAddonFilters.length === 0) return true;
        const sectionAddons = Array.isArray(section?.addons)
            ? section.addons
            : Array.isArray(section?.balanceAddons)
                ? section.balanceAddons
                : [];
        const addonTypes = sectionAddons
            .map((addon: any) => (typeof addon?.type === "string" ? addon.type : ""))
            .filter(Boolean);
        return addonTypes.some((type: string) => selectedAddonFilters.includes(type));
    };
    const matchesFilters = (section: any): boolean => matchesSearch(section) && matchesTags(section) && matchesAddons(section);

    const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
        const section = allSections.find(s => s.id === sectionId);
        if (!section) return false;
        if (matchesFilters(section)) return true;
        
        const children = allSections.filter(s => s.parentId === sectionId);
        return children.some(child => sectionMatchesOrHasMatchingChildren(child.id, allSections));
    };

    const kids = sections
        .filter((s) => s.parentId === parentId)
        .filter(s => sectionMatchesOrHasMatchingChildren(s.id, sections))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const highlightText = (text: string, term?: string) => {
        if (!term || !term.trim()) return text;
        const regex = new RegExp(`(${term})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) => 
            regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
        );
    };

    const getContentSnippet = (content: string, term: string): string => {
        if (!content || !term) return '';
        const lowerContent = content.toLowerCase();
        const lowerTerm = term.toLowerCase();
        const index = lowerContent.indexOf(lowerTerm);
        if (index === -1) return '';
        const start = Math.max(0, index - 40);
        const end = Math.min(content.length, index + term.length + 40);
        let snippet = content.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        return snippet;
    };

    if (kids.length === 0) return null;
    return (
        <ul className="ml-4 mt-2 pl-3 border-l border-gray-700/70 space-y-2">
            {kids.map((sec) => {
                const directMatch = matchesSearch(sec);
                const contentSnippet = directMatch && sec.content && searchTerm ? getContentSnippet(sec.content, searchTerm) : '';
                const hasChildren = sections.some((s: any) => s.parentId === sec.id);
                const isExpanded = expandedSections.has(sec.id) || searchTerm?.trim() || selectedTagFilters.length > 0 || selectedAddonFilters.length > 0;
                const isActiveSection = activeSectionId === sec.id;
                
                return (
                    <li key={sec.id} className="mb-2">
                        <div className={`group relative overflow-hidden flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors ${isActiveSection
                            ? "border-indigo-300/60 bg-indigo-600/20"
                            : "border-gray-700/80 bg-gray-900/50 hover:border-indigo-500/50"
                            }`}>
                            {hasChildren && (
                                <button
                                    onClick={() => {
                                        const newExpanded = new Set(expandedSections);
                                        if (expandedSections.has(sec.id)) {
                                            newExpanded.delete(sec.id);
                                        } else {
                                            newExpanded.add(sec.id);
                                        }
                                        setExpandedSections(newExpanded);
                                    }}
                                    className={`inline-flex items-center justify-center h-5 w-5 rounded-md border text-sm transition-colors ${isActiveSection
                                        ? "border-indigo-300/60 text-indigo-100 bg-indigo-500/20"
                                        : "border-gray-600 text-gray-300 hover:text-white hover:border-indigo-400"
                                        }`}
                                >
                                    {isExpanded ? '−' : '+'}
                                </button>
                            )}
                            {!hasChildren && <span className="w-5" />}
                            <Link
                                href={`/projects/${projectId}/sections/${sec.id}`}
                                className={`flex-1 min-w-0 truncate text-sm transition-colors ${isActiveSection ? "text-indigo-100 font-semibold" : "text-blue-300 hover:text-blue-200"}`}
                                prefetch={false}
                            >
                                {highlightText(sec.title, searchTerm)}
                            </Link>
                            {directMatch && searchTerm && searchTerm.trim() && (
                                <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">✓ {labels.match}</span>
                            )}
                        </div>
                        {contentSnippet && (
                            <div className="text-xs text-gray-300 italic mt-1 bg-yellow-950/30 border border-yellow-700/60 p-2 rounded ml-4">
                                {highlightText(contentSnippet, searchTerm || '')}
                            </div>
                        )}
                        {hasChildren && (
                            <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"}`}>
                                <div className="overflow-hidden">
                                    <SectionChildren 
                                        parentId={sec.id} 
                                        sections={sections} 
                                        projectId={projectId} 
                                        searchTerm={searchTerm}
                                        selectedTagFilters={selectedTagFilters}
                                        selectedAddonFilters={selectedAddonFilters}
                                        activeSectionId={activeSectionId}
                                        expandedSections={expandedSections}
                                        setExpandedSections={setExpandedSections}
                                        labels={labels}
                                    />
                                </div>
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
