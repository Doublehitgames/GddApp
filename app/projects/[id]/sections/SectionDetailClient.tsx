"use client";

import { useProjectStore } from "@/store/projectStore";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import dynamic from "next/dynamic";

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
  const reorderSections = useProjectStore((s) => s.reorderSections);
  const editSection = useProjectStore((s) => s.editSection);
  const projects = useProjectStore((s) => s.projects);
  const [section, setSection] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [nameError, setNameError] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [inlineEdit, setInlineEdit] = useState(false);
  const [editorMode, setEditorMode] = useState<"wysiwyg" | "markdown">("wysiwyg");
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
          // Use 'proj' (valor atual) e não o state 'project', que ainda pode não ter atualizado
          current = proj?.sections?.find((s: any) => s.id === current.parentId) || null;
        } else {
          current = null;
        }
      }
    }
    setBreadcrumbs(trail);
    setLoaded(true);
  }, [projectId, sectionId, getProject, projects]);

  // Inicializa/destroi o editor WYSIWYG inline quando modo de edição é ativado
  useEffect(() => {
    let instance: any;
    let cancelled = false;
    async function mountEditor() {
      if (!inlineEdit || !containerEl) return;
      const mod: any = await import("@toast-ui/editor");
      if (cancelled) return;
      const ToastEditor = mod.default || mod;
      instance = new ToastEditor({
        el: containerEl,
        initialEditType: editorMode,
        previewStyle: "vertical",
        height: "320px",
        initialValue: section?.content || "",
        usageStatistics: false,
        toolbarItems: [
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol", "task"],
          ["table", "link", "image"],
          ["code", "codeblock"],
        ],
        hooks: {
          addImageBlobHook: async (blob: Blob, callback: (url: string, altText: string) => void) => {
            try {
              const formData = new FormData();
              formData.append('image', blob);
              formData.append('projectId', projectId);

              const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
              });

              if (!response.ok) {
                const error = await response.json();
                alert(`Erro ao fazer upload: ${error.error || 'Erro desconhecido'}`);
                return;
              }

              const data = await response.json();
              callback(data.url, 'Uploaded image');
            } catch (error) {
              console.error('Upload error:', error);
              alert('Erro ao fazer upload da imagem');
            }
          },
        },
      });
      (editorRef as any).current = instance;
    }
    mountEditor();
    return () => {
      cancelled = true;
      if (instance && instance.destroy) {
        instance.destroy();
      }
      (editorRef as any).current = null;
    };
  }, [inlineEdit, containerEl, sectionId, editorMode, section, projectId]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = children.findIndex((c) => c.id === active.id);
    const newIndex = children.findIndex((c) => c.id === over.id);

    const newChildren = arrayMove(children, oldIndex, newIndex);
    const newOrder = newChildren.map((c) => c.id);
    reorderSections(projectId, newOrder);
  }

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
        {!inlineEdit && (
          <button
            className="bg-blue-600 text-white px-2 py-1 rounded text-sm"
            onClick={() => setInlineEdit(true)}
          >Editar no preview</button>
        )}
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
      {!inlineEdit && (
        <div className="prose prose-invert max-w-none mb-4">
          {section.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
          ) : (
            <p className="text-gray-400">Sem descrição.</p>
          )}
        </div>
      )}
      {inlineEdit && (
        <div className="mb-3">
          <div ref={setContainerEl as any} />
          <div className="mt-2 flex gap-2">
            <button
              className="bg-green-600 text-white px-3 py-1 rounded"
              onClick={() => {
                const md = (editorRef as any).current?.getMarkdown?.() || "";
                editSection(projectId, sectionId, section.title, md);
                setInlineEdit(false);
              }}
            >Salvar</button>
            <button
              className="bg-gray-600 text-white px-3 py-1 rounded"
              onClick={() => setInlineEdit(false)}
            >Cancelar</button>
            <button
              className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
              onClick={() => {
                const next = editorMode === "wysiwyg" ? "markdown" : "wysiwyg";
                setEditorMode(next);
                if ((editorRef as any).current?.changeMode) {
                  (editorRef as any).current.changeMode(next, true);
                }
              }}
            >Modo: {editorMode === "wysiwyg" ? "WYSIWYG" : "Markdown"}</button>
          </div>
        </div>
      )}

      <h2 className="mt-4 font-semibold">Subseções</h2>
      {children.length > 0 && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="🔍 Buscar subseções..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
      {children.length === 0 && (
        <p className="text-gray-500 text-sm">Nenhuma subseção ainda.</p>
      )}
      {children.length > 0 && (
        <SubsectionTree 
          sections={project?.sections || []} 
          parentId={sectionId} 
          projectId={projectId} 
          searchTerm={searchTerm}
          reorderSections={reorderSections}
          sensors={sensors}
        />
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

// Componente para renderizar árvore de subseções recursivamente
function SubsectionTree({ sections, parentId, projectId, searchTerm, reorderSections, sensors }: { 
  sections: any[]; 
  parentId: string; 
  projectId: string; 
  searchTerm: string;
  reorderSections: any;
  sensors: any;
}) {
  const matchesSearch = (section: any): boolean => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return section.title.toLowerCase().includes(term) || section.content?.toLowerCase().includes(term);
  };

  const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
    const section = allSections.find(s => s.id === sectionId);
    if (!section) return false;
    if (matchesSearch(section)) return true;
    
    const children = allSections.filter(s => s.parentId === sectionId);
    return children.some(child => sectionMatchesOrHasMatchingChildren(child.id, allSections));
  };

  const children = sections
    .filter((s) => s.parentId === parentId)
    .filter(s => !searchTerm.trim() || sectionMatchesOrHasMatchingChildren(s.id, sections))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (children.length === 0 && searchTerm.trim()) {
    return <p className="text-gray-500 text-sm ml-6">Nenhuma subseção encontrada para "{searchTerm}".</p>;
  }

  if (children.length === 0) {
    return null;
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = children.findIndex((c) => c.id === active.id);
    const newIndex = children.findIndex((c) => c.id === over.id);

    const newChildren = arrayMove(children, oldIndex, newIndex);
    const newOrder = newChildren.map((c) => c.id);
    reorderSections(projectId, newOrder);
  }

  const totalMatches = searchTerm.trim() ? sections.filter(matchesSearch).length : 0;

  return (
    <>
      {searchTerm.trim() && totalMatches > 0 && (
        <p className="text-sm text-gray-600 mb-2 ml-6">
          {totalMatches} {totalMatches === 1 ? 'resultado encontrado' : 'resultados encontrados'}
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="ml-6 mb-3 space-y-1">
            {children.map((c) => (
              <SortableSubsectionItem 
                key={c.id} 
                section={c} 
                sections={sections}
                projectId={projectId} 
                searchTerm={searchTerm}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </>
  );
}

// Componente sortable para cada item da lista com filhos recursivos
function SortableSubsectionItem({ section, sections, projectId, searchTerm }: { 
  section: any; 
  sections: any[];
  projectId: string; 
  searchTerm?: string;
}) {
  const router = useRouter();
  
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

  const directMatch = matchesDirectly(section);

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

  const hasChildren = sections.some(s => s.parentId === section.id);

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
        <button
          className="text-blue-400 underline hover:text-blue-600"
          onClick={() => router.push(`/projects/${projectId}/sections/${section.id}`)}
        >
          {highlightText(section.title, searchTerm)}
        </button>
        {directMatch && searchTerm && searchTerm.trim() && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">✓ Match</span>
        )}
      </div>
      {hasChildren && (
        <SubsectionChildren 
          sections={sections} 
          parentId={section.id} 
          projectId={projectId}
          searchTerm={searchTerm}
        />
      )}
    </li>
  );
}

// Componente recursivo para filhos (apenas links, sem DnD nos níveis aninhados)
function SubsectionChildren({ sections, parentId, projectId, searchTerm }: { 
  sections: any[]; 
  parentId: string; 
  projectId: string;
  searchTerm?: string;
}) {
  const matchesSearch = (section: any): boolean => {
    if (!searchTerm || !searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return section.title.toLowerCase().includes(term) || section.content?.toLowerCase().includes(term);
  };

  const sectionMatchesOrHasMatchingChildren = (sectionId: string, allSections: any[]): boolean => {
    const section = allSections.find(s => s.id === sectionId);
    if (!section) return false;
    if (matchesSearch(section)) return true;
    
    const children = allSections.filter(s => s.parentId === sectionId);
    return children.some(child => sectionMatchesOrHasMatchingChildren(child.id, allSections));
  };

  const children = sections
    .filter((s) => s.parentId === parentId)
    .filter(s => !searchTerm || !searchTerm.trim() || sectionMatchesOrHasMatchingChildren(s.id, sections));

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

  if (children.length === 0) return null;

  return (
    <ul className="list-circle ml-6 mt-2">
      {children.map((sec) => {
        const directMatch = matchesDirectly(sec);
        return (
          <li key={sec.id} className="mb-1">
            <div className="flex items-center gap-2">
              <button
                className="text-blue-300 underline hover:text-blue-500"
                onClick={() => window.location.href = `/projects/${projectId}/sections/${sec.id}`}
              >
                {highlightText(sec.title, searchTerm)}
              </button>
              {directMatch && searchTerm && searchTerm.trim() && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">✓ Match</span>
              )}
            </div>
            <SubsectionChildren sections={sections} parentId={sec.id} projectId={projectId} searchTerm={searchTerm} />
          </li>
        );
      })}
    </ul>
  );
}

// Componente sortable para cada item da lista
function SortableItem({ id, title, projectId, searchTerm }: { id: string; title: string; projectId: string; searchTerm?: string }) {
  const router = useRouter();
  
  const highlightText = (text: string, term: string) => {
    if (!term || !term.trim()) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
    );
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-gray-100 p-2 rounded hover:bg-gray-200"
    >
      <span
        className="text-gray-400 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
      >
        ⋮⋮
      </span>
      <button
        className="text-blue-400 underline hover:text-blue-600"
        onClick={() => router.push(`/projects/${projectId}/sections/${id}`)}
      >
        {highlightText(title, searchTerm || "")}
      </button>
    </li>
  );
}
