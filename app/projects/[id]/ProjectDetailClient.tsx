"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInitProjects } from "@/hooks/useInitProjects";
import { useProjectStore } from "@/store/projectStore";
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


    if (!mounted) return <div>Carregando...</div>;


    if (!project) {
        return (
            <div>
                <div className="p-6">
                    <button className="mb-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800" onClick={() => router.push("/")}>
                        Voltar para Home
                    </button>
                </div>
                <div>Projeto não encontrado. "{projectId}"</div>
            </div>
        );
    }

    function handleAddSection() {
        if (!sectionTitle.trim() || nameError) return;

        addSection(projectId, sectionTitle.trim());
        setSectionTitle("");
        setNameError("");
    }

    return (
        <div className="p-6">
            
            <button className="mb-4 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-800" onClick={() => router.push("/")}>
                Voltar para Home
            </button>
            
            <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold">{project.name}</h1>
                <button
                    className="bg-yellow-500 text-black px-2 py-1 rounded text-sm"
                    onClick={() => router.push(`/projects/${projectId}/edit`)}
                >Editar</button>
            </div>
            <p className="text-gray-400"><i>{project.description}</i></p>

            <div className="mt-6 mb-4">
                <input
                    type="text"
                    placeholder="🔍 Buscar seções por título ou conteúdo..."
                    value={searchTerm}
                    onChange={(e) => {
                        const term = e.target.value;
                        setSearchTerm(term);
                        // Se houver busca, expandir automaticamente todas as seções
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
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <h2 className="mt-4 font-semibold">Seções</h2>
            <SectionTree 
                sections={project.sections || []} 
                projectId={projectId} 
                reorderSections={reorderSections} 
                sensors={sensors} 
                searchTerm={searchTerm}
                expandedSections={expandedSections}
                setExpandedSections={setExpandedSections}
            />

            <div className="mt-4">
                <div className="flex gap-2">
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
                        className={`border px-2 py-1 ${nameError ? "border-red-500" : ""}`}
                    />
                    <button onClick={handleAddSection} className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50" disabled={!sectionTitle.trim() || !!nameError}>Adicionar</button>
                </div>
                {nameError && (
                    <span className="text-red-500 text-sm mt-1 block">{nameError}</span>
                )}
            </div>
        </div>
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
                <p className="text-sm text-gray-600 mb-2 ml-6">
                    {totalMatches} {totalMatches === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                </p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={roots.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    <ul className="ml-6 space-y-1">
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
            <div className="flex items-center gap-2 bg-gray-100 p-2 rounded hover:bg-gray-200">
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
                        className="text-gray-600 hover:text-gray-800 font-bold w-4 text-sm"
                    >
                        {isExpanded ? '−' : '+'}
                    </button>
                )}
                {!hasChildren && <span className="w-4"></span>}
                <Link href={`/projects/${projectId}/sections/${section.id}`} className="text-blue-400 underline hover:text-blue-600">
                    {highlightText(section.title, searchTerm)}
                </Link>
                {directMatch && searchTerm.trim() && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">✓ Match</span>
                )}
            </div>
            {contentSnippet && (
                <div className="ml-8 text-xs text-gray-600 italic mt-1 bg-yellow-50 p-2 rounded">
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
                                    className="text-gray-600 hover:text-gray-800 font-bold w-4 text-sm"
                                >
                                    {isExpanded ? '−' : '+'}
                                </button>
                            )}
                            {!hasChildren && <span className="w-4"></span>}
                            <Link href={`/projects/${projectId}/sections/${sec.id}`} className="text-blue-300 underline hover:text-blue-500">
                                {highlightText(sec.title, searchTerm)}
                            </Link>
                            {directMatch && searchTerm && searchTerm.trim() && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">✓ Match</span>
                            )}
                        </div>
                        {contentSnippet && (
                            <div className="text-xs text-gray-600 italic mt-1 bg-yellow-50 p-2 rounded ml-4">
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
