"use client";

import { useProjectStore } from "@/store/projectStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  projectId: string;
  sectionId: string;
}

export default function SectionDetailClient({ projectId, sectionId }: Props) {
  const getProject = useProjectStore((s) => s.getProject);
  const removeSection = useProjectStore((s) => s.removeSection);
  const addSubsection = useProjectStore((s) => s.addSubsection);
  const countDescendants = useProjectStore((s) => s.countDescendants);
  const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
  const moveSectionUp = useProjectStore((s) => s.moveSectionUp);
  const moveSectionDown = useProjectStore((s) => s.moveSectionDown);
  const projects = useProjectStore((s) => s.projects);
  const [section, setSection] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [nameError, setNameError] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const proj = getProject(projectId);
    setProject(proj || null);
    const sec = proj?.sections?.find((s: any) => s.id === sectionId);
    setSection(sec || null);
    const kids = (proj?.sections || []).filter((s: any) => s.parentId === sectionId).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    setChildren(kids);
    
    // Build breadcrumb trail
    const trail: any[] = [];
    if (sec) {
      let current: any = sec;
      while (current) {
        trail.unshift(current);
        if (current.parentId) {
          current = project?.sections?.find((s: any) => s.id === current.parentId) || null;
        } else {
          current = null;
        }
      }
    }
    setBreadcrumbs(trail);
    setLoaded(true);
  }, [projectId, sectionId, getProject, projects]);

  if (!loaded) return <div className="p-6">Carregando...</div>;
  if (!section) return <div className="p-6">Seção não encontrada. <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded" onClick={() => router.push(`/projects/${projectId}`)}>Voltar</button></div>;

  return (
    <div className="p-6 max-w-lg mx-auto">
      {/* Breadcrumbs */}
      <div className="mb-4 text-sm text-gray-500 flex items-center gap-1 flex-wrap">
        <button
          className="hover:text-blue-400 underline"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          {project?.title || "Projeto"}
        </button>
        {breadcrumbs.map((crumb, idx) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <span>/</span>
            {idx === breadcrumbs.length - 1 ? (
              <span className="text-gray-700 font-semibold">{crumb.title}</span>
            ) : (
              <button
                className="hover:text-blue-400 underline"
                onClick={() => router.push(`/projects/${projectId}/sections/${crumb.id}`)}
              >
                {crumb.title}
              </button>
            )}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-2xl font-bold">{section.title}</h1>
        <button
          className="bg-yellow-500 text-black px-2 py-1 rounded text-sm"
          onClick={() => router.push(`/projects/${projectId}/sections/${sectionId}/edit`)}
        >Editar</button>
        <button
          className="bg-red-600 text-white px-2 py-1 rounded text-sm"
          onClick={() => {
            const count = countDescendants(projectId, sectionId);
            const msg = count > 0 
              ? `Tem certeza que deseja excluir esta seção e suas ${count} subseção(s)?`
              : "Tem certeza que deseja excluir esta seção?";
            if (window.confirm(msg)) {
              removeSection(projectId, sectionId);
              router.push(`/projects/${projectId}`);
            }
          }}
        >Excluir</button>
      </div>
      <p className="text-gray-400 mb-4">{section.content || "Sem descrição."}</p>

      <h2 className="mt-4 font-semibold">Subseções</h2>
      {children.length === 0 && (
        <p className="text-gray-500 text-sm">Nenhuma subseção ainda.</p>
      )}
      {children.length > 0 && (
        <ul className="ml-6 mb-3 space-y-1">
          {children.map((c, idx) => (
            <li key={c.id} className="flex items-center gap-2">
              <div className="flex flex-col">
                <button 
                  className="text-xs px-1 py-0 bg-gray-300 hover:bg-gray-400 rounded disabled:opacity-30"
                  onClick={() => moveSectionUp(projectId, c.id)}
                  disabled={idx === 0}
                  title="Mover para cima"
                >↑</button>
                <button 
                  className="text-xs px-1 py-0 bg-gray-300 hover:bg-gray-400 rounded disabled:opacity-30"
                  onClick={() => moveSectionDown(projectId, c.id)}
                  disabled={idx === children.length - 1}
                  title="Mover para baixo"
                >↓</button>
              </div>
              <button className="text-blue-400 underline hover:text-blue-600" onClick={() => router.push(`/projects/${projectId}/sections/${c.id}`)}>
                {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2">
        <div className="flex gap-2">
          <input
            value={newSubTitle}
            onChange={(e) => {
              const val = e.target.value;
              setNewSubTitle(val);
              if (val.trim() && hasDuplicateName(projectId, val.trim(), sectionId)) {
                setNameError("Já existe uma subseção com este nome.");
              } else {
                setNameError("");
              }
            }}
            placeholder="Adicionar subseção"
            className={`border px-2 py-1 ${nameError ? "border-red-500" : ""}`}
          />
          <button
            className="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
            disabled={!newSubTitle.trim() || !!nameError}
            onClick={() => {
              const t = newSubTitle.trim();
              if (!t || nameError) return;
              addSubsection(projectId, sectionId, t);
              setNewSubTitle("");
              setNameError("");
            }}
          >Adicionar</button>
        </div>
        {nameError && (
          <span className="text-red-500 text-sm mt-1 block">{nameError}</span>
        )}
      </div>
    </div>
  );
}
