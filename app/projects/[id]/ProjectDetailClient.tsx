"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInitProjects } from "@/hooks/useInitProjects";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
import { useAIConfig } from "@/hooks/useAIConfig";
import AIChat from "@/components/AIChat";

interface Props {
    projectId: string;
}

export default function ProjectDetailClient({ projectId }: Props) {
    const { t } = useI18n();
    const { user, profile } = useAuthStore();
    const { hasValidConfig, getAIHeaders } = useAIConfig();
    const sectionAuditBy = user ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null } : undefined;

    const router = useRouter();
    const getProject = useProjectStore((s) => s.getProject);
    const addSection = useProjectStore((s) => s.addSection);
    const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
    const reorderSections = useProjectStore((s) => s.reorderSections);
    const projects = useProjectStore((s) => s.projects);

    const [mounted, setMounted] = useState(false);
    const [project, setProject] = useState<any>(null);
    const [chatOpen, setChatOpen] = useState(false);
    const [aiMenuOpen, setAiMenuOpen] = useState(false);
    const [navMenuOpen, setNavMenuOpen] = useState(false);
    const [projectMenuOpen, setProjectMenuOpen] = useState(false);
    const [sectionTitle, setSectionTitle] = useState("");
    const [nameError, setNameError] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

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

    const projectContext = project ? {
        projectId: project.id,
        projectTitle: project.title,
        sections: (project.sections || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            content: s.content,
            parentId: s.parentId,
            domainTags: s.domainTags,
        })),
    } : undefined;

    const navLinkClass = "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900";

    return (
        <main className="min-h-screen bg-gray-900 text-white px-4 py-8 md:px-8 md:py-10 lg:px-10">
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-gray-800/50 border border-gray-700/60 px-4 py-3">
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
                    <nav className="flex flex-wrap items-center gap-1" aria-label={t("projectDetail.actionsNavLabel", "Ações do projeto")}>
                        {/* Menu Navegação: Mapa Mental + Ver como Documento */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setNavMenuOpen((v) => !v); setProjectMenuOpen(false); setAiMenuOpen(false); }}
                                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${navMenuOpen ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
                                aria-expanded={navMenuOpen}
                                aria-haspopup="true"
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                                {t("projectDetail.actions.navMenuLabel")}
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {navMenuOpen && (
                                <>
                                    <div className="absolute left-0 top-full mt-1 py-1 w-52 rounded-lg bg-gray-800 border border-gray-600 shadow-xl z-50" role="menu">
                                        <Link href={`/projects/${projectId}/mindmap`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 rounded-t-lg" role="menuitem" onClick={() => setNavMenuOpen(false)} prefetch={false}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                            {t("projectDetail.actions.mindMap")}
                                        </Link>
                                        <Link href={`/projects/${projectId}/view`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700" role="menuitem" onClick={() => setNavMenuOpen(false)} prefetch={false}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            {t("projectDetail.actions.viewDocument")}
                                        </Link>
                                    </div>
                                    <div className="fixed inset-0 z-40" onClick={() => setNavMenuOpen(false)} aria-hidden />
                                </>
                            )}
                        </div>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setAiMenuOpen((v) => !v); setNavMenuOpen(false); setProjectMenuOpen(false); }}
                                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${aiMenuOpen ? "bg-indigo-600/80 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
                                aria-expanded={aiMenuOpen}
                                aria-haspopup="true"
                            >
                                <span className="shrink-0">✨</span>
                                {t("projectDetail.aiMenu.title")}
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {aiMenuOpen && (
                                <>
                                    <div className="absolute right-0 top-full mt-1 py-1 w-56 rounded-lg bg-gray-800 border border-gray-600 shadow-xl z-50" role="menu">
                                        <Link
                                            href={`/projects/${projectId}/relations`}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
                                            role="menuitem"
                                            onClick={() => setAiMenuOpen(false)}
                                        >
                                            <span>🔗</span>
                                            {t("projectDetail.aiMenu.suggestRelations")}
                                        </Link>
                                        <Link
                                            href={`/projects/${projectId}/analysis`}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                                            role="menuitem"
                                            onClick={() => setAiMenuOpen(false)}
                                        >
                                            <span>⚖️</span>
                                            {t("projectDetail.aiMenu.analyzeConsistency")}
                                        </Link>
                                        <Link
                                            href={`/projects/${projectId}/assign-tags`}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                                            role="menuitem"
                                            onClick={() => setAiMenuOpen(false)}
                                        >
                                            <span>🏷️</span>
                                            {t("projectDetail.aiMenu.assignTags")}
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => { setChatOpen(true); setAiMenuOpen(false); }}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                                            role="menuitem"
                                        >
                                            <span>💬</span>
                                            {t("projectDetail.aiMenu.openChat")}
                                        </button>
                                        <div className="border-t border-gray-600 px-4 py-2 text-xs text-gray-500">
                                            {t("projectDetail.aiMenu.improveHint")}
                                        </div>
                                    </div>
                                    <div className="fixed inset-0 z-40" onClick={() => setAiMenuOpen(false)} aria-hidden />
                                </>
                            )}
                        </div>
                        {/* Menu Projeto: Configurações + Backup (por último) */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => { setProjectMenuOpen((v) => !v); setNavMenuOpen(false); setAiMenuOpen(false); }}
                                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${projectMenuOpen ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
                                aria-expanded={projectMenuOpen}
                                aria-haspopup="true"
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {t("projectDetail.actions.projectMenuLabel")}
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {projectMenuOpen && (
                                <>
                                    <div className="absolute left-0 top-full mt-1 py-1 w-52 rounded-lg bg-gray-800 border border-gray-600 shadow-xl z-50" role="menu">
                                        <Link href={`/projects/${projectId}/settings`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 rounded-t-lg" role="menuitem" onClick={() => setProjectMenuOpen(false)} prefetch={false}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            {t("projectDetail.actions.settings")}
                                        </Link>
                                        <Link href={`/projects/${projectId}/backup`} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700" role="menuitem" onClick={() => setProjectMenuOpen(false)} prefetch={false}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                            {t("projectDetail.actions.backup")}
                                        </Link>
                                    </div>
                                    <div className="fixed inset-0 z-40" onClick={() => setProjectMenuOpen(false)} aria-hidden />
                                </>
                            )}
                        </div>
                    </nav>
                </header>

                <section className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/10">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{project.title}</h1>
                        <button
                            className="bg-yellow-500 text-black px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-yellow-400 transition-colors"
                            onClick={() => router.push(`/projects/${projectId}/edit`)}
                        >
                            {t("projectDetail.edit")}
                        </button>
                    </div>

                    <div className="text-gray-200">
                        {project.description ? (
                            <MarkdownWithReferences
                                content={project.description}
                                projectId={projectId}
                                sections={project.sections || []}
                            />
                        ) : (
                            <p className="text-gray-400 italic">{t("projectDetail.noDescription")}</p>
                        )}
                    </div>
                </section>

                <section className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/10">
                    <div className="mb-4">
                        <h2 className="text-xl font-semibold tracking-tight">{t("projectDetail.sectionsTitle")}</h2>
                        <p className="text-sm text-gray-400 mt-1">{t("projectDetail.sectionsSubtitle")}</p>
                    </div>

                    <div className="mb-4">
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
                            className="w-full bg-gray-900/70 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <SectionTree
                        sections={project.sections || []}
                        projectId={projectId}
                        reorderSections={reorderSections}
                        sensors={sensors}
                        searchTerm={searchTerm}
                        expandedSections={expandedSections}
                        setExpandedSections={setExpandedSections}
                        labels={{
                            resultsFoundOne: t("projectDetail.resultsFoundOne"),
                            resultsFoundMany: t("projectDetail.resultsFoundMany"),
                            match: t("projectDetail.match"),
                            reorder: t("projectDetail.reorder"),
                        }}
                    />

                    <div className="mt-5 pt-4 border-t border-gray-700">
                        <div className="flex gap-2 flex-wrap">
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
                                className={`bg-gray-900/70 border rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-400 ${nameError ? "border-red-500" : "border-gray-600"}`}
                            />
                            <button onClick={handleAddSection} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50" disabled={!sectionTitle.trim() || !!nameError}>{t("projectDetail.add")}</button>
                        </div>
                        {nameError && (
                            <span className="text-red-400 text-sm mt-1 block">{nameError}</span>
                        )}
                    </div>
                </section>
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
function SectionTree({ sections, projectId, reorderSections, sensors, searchTerm, expandedSections, setExpandedSections, labels }: { 
    sections: any[]; 
    projectId: string; 
    reorderSections: any; 
    sensors: any; 
    searchTerm: string;
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

    // Filtrar raízes que correspondem ou têm filhos que correspondem
    const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
        const section = allSections.find(s => s.id === sectionId);
        if (!section) return false;
        if (matchesSearch(section)) return true;
        
        const children = allSections.filter(s => s.parentId === sectionId);
        return children.some(child => sectionMatchesOrHasMatchingChildren(child.id, allSections));
    };

    const roots = sections
        .filter((s) => !s.parentId)
        .filter(s => !searchTerm.trim() || sectionMatchesOrHasMatchingChildren(s.id, sections))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    const totalMatches = searchTerm.trim() ? sections.filter(matchesSearch).length : 0;

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
            {searchTerm.trim() && totalMatches > 0 && (
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

function SortableRootItem({ section, sections, projectId, searchTerm, expandedSections, setExpandedSections, labels }: { 
    section: any; 
    sections: any[]; 
    projectId: string; 
    searchTerm: string;
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
    
    const hasChildren = sections.some((s: any) => s.parentId === section.id);
    const isExpanded = expandedSections.has(section.id) || searchTerm.trim();

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
            <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-700 p-2.5 rounded-lg hover:border-gray-500 transition-colors">
                <span
                    className="text-gray-400 cursor-grab active:cursor-grabbing"
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
                        className="text-gray-300 hover:text-white font-bold w-4 text-sm"
                    >
                        {isExpanded ? '−' : '+'}
                    </button>
                )}
                {!hasChildren && <span className="w-4"></span>}
                <Link href={`/projects/${projectId}/sections/${section.id}`} className="text-blue-300 underline hover:text-blue-200" prefetch={false}>
                    {highlightText(section.title, searchTerm)}
                </Link>
                {directMatch && searchTerm.trim() && (
                    <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">✓ {labels.match}</span>
                )}
            </div>
            {contentSnippet && (
                <div className="ml-8 text-xs text-gray-300 italic mt-1 bg-yellow-950/30 border border-yellow-700/60 p-2 rounded">
                    {highlightText(contentSnippet, searchTerm)}
                </div>
            )}
            {hasChildren && isExpanded && (
                <SectionChildren 
                    parentId={section.id} 
                    sections={sections} 
                    projectId={projectId} 
                    searchTerm={searchTerm}
                    expandedSections={expandedSections}
                    setExpandedSections={setExpandedSections}
                    labels={labels}
                />
            )}
        </li>
    );
}

function SectionChildren({ parentId, sections, projectId, searchTerm, expandedSections, setExpandedSections, labels }: { 
    parentId: string; 
    sections: any[]; 
    projectId: string; 
    searchTerm?: string;
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

    const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
        const section = allSections.find(s => s.id === sectionId);
        if (!section) return false;
        if (matchesSearch(section)) return true;
        
        const children = allSections.filter(s => s.parentId === sectionId);
        return children.some(child => sectionMatchesOrHasMatchingChildren(child.id, allSections));
    };

    const kids = sections
        .filter((s) => s.parentId === parentId)
        .filter(s => !searchTerm || !searchTerm.trim() || sectionMatchesOrHasMatchingChildren(s.id, sections))
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
        <ul className="list-circle ml-6 mt-2">
            {kids.map((sec) => {
                const directMatch = matchesSearch(sec);
                const contentSnippet = directMatch && sec.content && searchTerm ? getContentSnippet(sec.content, searchTerm) : '';
                const hasChildren = sections.some((s: any) => s.parentId === sec.id);
                const isExpanded = expandedSections.has(sec.id) || searchTerm?.trim();
                
                return (
                    <li key={sec.id} className="mb-2">
                        <div className="flex items-center gap-2">
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
                                    className="text-gray-300 hover:text-white font-bold w-4 text-sm"
                                >
                                    {isExpanded ? '−' : '+'}
                                </button>
                            )}
                            {!hasChildren && <span className="w-4"></span>}
                            <Link href={`/projects/${projectId}/sections/${sec.id}`} className="text-blue-300 underline hover:text-blue-200" prefetch={false}>
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
                        {hasChildren && isExpanded && (
                            <SectionChildren 
                                parentId={sec.id} 
                                sections={sections} 
                                projectId={projectId} 
                                searchTerm={searchTerm}
                                expandedSections={expandedSections}
                                setExpandedSections={setExpandedSections}
                                labels={labels}
                            />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
