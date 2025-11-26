"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInitProjects } from "@/hooks/useInitProjects";
import { useProjectStore } from "@/store/projectStore";

interface Props {
    projectId: string;
}

export default function ProjectDetailClient({ projectId }: Props) {

    const router = useRouter();
    const getProject = useProjectStore((s) => s.getProject);
    const addSection = useProjectStore((s) => s.addSection);
    const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
    const moveSectionUp = useProjectStore((s) => s.moveSectionUp);
    const moveSectionDown = useProjectStore((s) => s.moveSectionDown);
    const projects = useProjectStore((s) => s.projects);

    const [mounted, setMounted] = useState(false);
    const [project, setProject] = useState<any>(null);
    const [sectionTitle, setSectionTitle] = useState("");
    const [nameError, setNameError] = useState<string>("");

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

                        <h2 className="mt-6 font-semibold">Seções</h2>
                        <SectionTree sections={project.sections || []} projectId={projectId} moveSectionUp={moveSectionUp} moveSectionDown={moveSectionDown} />

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
function SectionTree({ sections, projectId, moveSectionUp, moveSectionDown }: { sections: any[]; projectId: string; moveSectionUp: any; moveSectionDown: any }) {
    const roots = sections.filter((s) => !s.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));

    return (
        <ul className="ml-6 space-y-1">
            {roots.map((sec, idx) => (
                <li key={sec.id} className="mb-2 flex items-center gap-2">
                    <div className="flex flex-col">
                        <button 
                            className="text-xs px-1 py-0 bg-gray-300 hover:bg-gray-400 rounded disabled:opacity-30"
                            onClick={() => moveSectionUp(projectId, sec.id)}
                            disabled={idx === 0}
                            title="Mover para cima"
                        >↑</button>
                        <button 
                            className="text-xs px-1 py-0 bg-gray-300 hover:bg-gray-400 rounded disabled:opacity-30"
                            onClick={() => moveSectionDown(projectId, sec.id)}
                            disabled={idx === roots.length - 1}
                            title="Mover para baixo"
                        >↓</button>
                    </div>
                    <div>
                        <Link href={`/projects/${projectId}/sections/${sec.id}`} className="text-blue-400 underline hover:text-blue-600">
                            {sec.title}
                        </Link>
                        <SectionChildren parentId={sec.id} sections={sections} projectId={projectId} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

function SectionChildren({ parentId, sections, projectId }: { parentId: string; sections: any[]; projectId: string }) {
    const kids = sections.filter((s) => s.parentId === parentId);
    if (kids.length === 0) return null;
    return (
        <ul className="list-circle ml-6 mt-2">
            {kids.map((sec) => (
                <li key={sec.id} className="mb-1">
                    <Link href={`/projects/${projectId}/sections/${sec.id}`} className="text-blue-300 underline hover:text-blue-500">
                        {sec.title}
                    </Link>
                    <SectionChildren parentId={sec.id} sections={sections} projectId={projectId} />
                </li>
            ))}
        </ul>
    );
}
