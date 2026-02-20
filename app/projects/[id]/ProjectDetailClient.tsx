"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInitProjects } from "@/hooks/useInitProjects";
import { useProjectStore } from "@/store/projectStore";
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

interface Props {
    projectId: string;
}

export default function ProjectDetailClient({ projectId }: Props) {

    const router = useRouter();
    const getProject = useProjectStore((s) => s.getProject);
    const addSection = useProjectStore((s) => s.addSection);
    const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
    const reorderSections = useProjectStore((s) => s.reorderSections);
    const projects = useProjectStore((s) => s.projects);

    const [mounted, setMounted] = useState(false);
    const [project, setProject] = useState<any>(null);
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


    if (!mounted) return <div className="min-h-screen bg-gray-900 text-white p-6">Carregando...</div>;


    if (!project) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-6">
                <div className="max-w-5xl mx-auto">
                    <button className="mb-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors" onClick={() => router.push("/")}>
                        Voltar para Home
                    </button>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-red-300">Projeto não encontrado. "{projectId}"</div>
                </div>
            </div>
        );
    }

    function handleAddSection() {
        if (!sectionTitle.trim() || nameError) return;

        addSection(projectId, sectionTitle.trim());
        setSectionTitle("");
        setNameError("");
    }

    const projectContext = project ? {
        projectId: project.id,
        projectTitle: project.title || project.name,
        sections: (project.sections || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            content: s.content,
        })),
    } : undefined;

    return (
        <main className="min-h-screen bg-gray-900 text-white px-4 py-8 md:px-8 md:py-10 lg:px-10">
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <header className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
                    <button className="px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors w-fit" onClick={() => router.push("/")}>
                        ← Voltar para Home
                    </button>

                    <div className="flex flex-wrap gap-3 md:justify-end">
                        <button
                            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-semibold"
                            onClick={() => router.push(`/projects/${projectId}/mindmap`)}
                        >
                            🧠 Mapa Mental
                        </button>

                        <button
                            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold"
                            onClick={() => router.push(`/projects/${projectId}/view`)}
                        >
                            📄 Ver como Documento
                        </button>

                        <button
                            className="px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                            onClick={() => router.push(`/projects/${projectId}/settings`)}
                        >
                            ⚙️ Configurações
                        </button>

                        <button
                            className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-semibold"
                            onClick={() => router.push(`/projects/${projectId}/backup`)}
                        >
                            💾 Backup
                        </button>
                    </div>
                </header>

                <section className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/10">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{project.title || project.name}</h1>
                        <button
                            className="bg-yellow-500 text-black px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-yellow-400 transition-colors"
                            onClick={() => router.push(`/projects/${projectId}/edit`)}
                        >
                            Editar
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
                            <p className="text-gray-400 italic">Sem descrição.</p>
                        )}
                    </div>
                </section>

                <section className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-5 md:p-6 shadow-xl shadow-black/10">
                    <div className="mb-4">
                        <h2 className="text-xl font-semibold tracking-tight">Seções do Projeto</h2>
                        <p className="text-sm text-gray-400 mt-1">Busque, navegue e reordene as seções principais com arrastar e soltar.</p>
                    </div>

                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="🔍 Buscar seções por título ou conteúdo..."
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
                    />

                    <div className="mt-5 pt-4 border-t border-gray-700">
                        <div className="flex gap-2 flex-wrap">
                            <input
                                value={sectionTitle}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSectionTitle(val);
                                    if (val.trim() && hasDuplicateName(projectId, val.trim(), undefined)) {
                                        setNameError("Já existe uma seção raiz com este nome.");
                                    } else {
                                        setNameError("");
                                    }
                                }}
                                placeholder="Nova seção"
                                className={`bg-gray-900/70 border rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-400 ${nameError ? "border-red-500" : "border-gray-600"}`}
                            />
                            <button onClick={handleAddSection} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50" disabled={!sectionTitle.trim() || !!nameError}>Adicionar</button>
                        </div>
                        {nameError && (
                            <span className="text-red-400 text-sm mt-1 block">{nameError}</span>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}

// Componente auxiliar para renderizar árvore de seções (somente links)
function SectionTree({ sections, projectId, reorderSections, sensors, searchTerm, expandedSections, setExpandedSections }: { 
    sections: any[]; 
    projectId: string; 
    reorderSections: any; 
    sensors: any; 
    searchTerm: string;
    expandedSections: Set<string>;
    setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
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
                    {totalMatches} {totalMatches === 1 ? 'resultado encontrado' : 'resultados encontrados'}
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
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>
        </>
    );
}

function SortableRootItem({ section, sections, projectId, searchTerm, expandedSections, setExpandedSections }: { 
    section: any; 
    sections: any[]; 
    projectId: string; 
    searchTerm: string;
    expandedSections: Set<string>;
    setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
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
                    aria-label="Reordenar"
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
                <Link href={`/projects/${projectId}/sections/${section.id}`} className="text-blue-300 underline hover:text-blue-200">
                    {highlightText(section.title, searchTerm)}
                </Link>
                {directMatch && searchTerm.trim() && (
                    <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">✓ Match</span>
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
                />
            )}
        </li>
    );
}

function SectionChildren({ parentId, sections, projectId, searchTerm, expandedSections, setExpandedSections }: { 
    parentId: string; 
    sections: any[]; 
    projectId: string; 
    searchTerm?: string;
    expandedSections: Set<string>;
    setExpandedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
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
                            <Link href={`/projects/${projectId}/sections/${sec.id}`} className="text-blue-300 underline hover:text-blue-200">
                                {highlightText(sec.title, searchTerm)}
                            </Link>
                            {directMatch && searchTerm && searchTerm.trim() && (
                                <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">✓ Match</span>
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
                            />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
