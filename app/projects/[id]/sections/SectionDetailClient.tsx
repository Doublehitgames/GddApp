"use client";

import { useProjectStore } from "@/store/projectStore";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownWithReferences } from "@/components/MarkdownWithReferences";
import { getBacklinks, convertReferencesToIds, convertReferencesToNames } from "@/utils/sectionReferences";
import { useMarkdownAutocomplete } from "@/hooks/useMarkdownAutocomplete";
import { addColorButtonToToolbar } from "@/utils/toastui-color-plugin";
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
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [nameError, setNameError] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(false);
  const [editorMode, setEditorMode] = useState<"wysiwyg" | "markdown">("wysiwyg");
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editorHeight, setEditorHeight] = useState("320px");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [improveError, setImproveError] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [modificationRequest, setModificationRequest] = useState("");
  const [sectionColor, setSectionColor] = useState("#3b82f6");
  const router = useRouter();

  const sections = project?.sections || [];
  const { AutocompleteDropdown } = useMarkdownAutocomplete({ sections });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleImproveWithAI(additionalRequest?: string) {
    if (!section || !project) return;
    
    setIsImproving(true);
    setImproveError("");

    try {
      // Coleta contexto - extrai apenas dados serializáveis
      const subsections = sections
        .filter((s: any) => s.parentId === sectionId)
        .map((s: any) => ({ 
          title: String(s.title || ''), 
          content: String(s.content || '') 
        }));
      
      const parentSection = section.parentId ? sections.find((s: any) => s.id === section.parentId) : null;
      
      // IDs das próprias subseções (não incluir na lista de outras seções)
      const ownSubsectionIds = subsections.map((s: any) => s.id);
      
      // Inclui TODAS as seções do GDD, exceto a atual e suas próprias subseções
      const otherSections = sections
        .filter((s: any) => s.id !== sectionId && !ownSubsectionIds.includes(s.id))
        .map((s: any) => ({ 
          title: String(s.title || ''),
          isEmpty: !s.content || s.content.trim().length === 0,
          isSubsection: !!s.parentId
        }));

      // Conteúdo base: usa o preview atual se existir, senão o conteúdo da seção
      const baseContent = String(showPreview ? previewContent : (section.content || ''));

      // Cria payload com apenas dados primitivos
      const payload = {
        currentContent: baseContent,
        sectionTitle: String(section.title || ''),
        sectionContext: {
          parentTitle: parentSection?.title ? String(parentSection.title) : undefined,
          subsections: subsections,
          otherSections: otherSections
        },
        projectTitle: String(project.title || 'GDD'),
        model: 'llama-3.1-8b-instant',
        additionalRequest: additionalRequest ? String(additionalRequest) : undefined
      };

      const response = await fetch('/api/ai/improve-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        setImproveError(data.error || 'Erro ao melhorar conteúdo');
        setIsImproving(false);
        return;
      }

      // Mostra preview em vez de aplicar diretamente
      setPreviewContent(data.improvedContent);
      setShowPreview(true);
      setModificationRequest(""); // Limpa campo de modificação

      // Avisa se elementos não foram preservados
      if (data.validation && !data.validation.allPreserved) {
        setImproveError(`⚠️ ${data.validation.warning}. O conteúdo foi atualizado, mas revise se está tudo correto.`);
      }

    } catch (error) {
      console.error('Error improving content:', error);
      setImproveError('Erro ao conectar com API. Tente novamente.');
    } finally {
      setIsImproving(false);
    }
  }

  function handleConfirmImprovement() {
    if (!section) return;
    
    // Aplica o conteúdo melhorado
    editSection(projectId, sectionId, section.title, previewContent);
    setSection({ ...section, content: previewContent });
    
    // Fecha o preview
    setShowPreview(false);
    setPreviewContent("");
    setImproveError("");
  }

  function handleCancelImprovement() {
    setShowPreview(false);
    setPreviewContent("");
    setModificationRequest("");
    setImproveError("");
  }

  async function handleRequestModification() {
    if (!modificationRequest.trim()) {
      setImproveError("Digite o que você quer modificar.");
      return;
    }
    
    await handleImproveWithAI(modificationRequest.trim());
  }

  useEffect(() => {
    const proj = getProject(projectId);
    setProject(proj || null);
    const sec = proj?.sections?.find((s: any) => s.id === sectionId);
    setSection(sec || null);
    setEditedTitle(sec?.title || "");
    
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
    setSectionColor(sec?.color || "#3b82f6");
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
      const project = getProject(projectId);
      const sections = project?.sections || [];
      const contentForEditor = convertReferencesToNames(section?.content || "", sections);
      instance = new ToastEditor({
        el: containerEl,
        initialEditType: editorMode,
        previewStyle: "vertical",
        height: editorHeight,
        initialValue: contentForEditor,
        usageStatistics: false,
        customHTMLRenderer: {
          htmlInline: {
            span(node: any) {
              return [
                { type: 'openTag', tagName: 'span', attributes: node.attrs },
                { type: 'html', content: node.literal || '' },
                { type: 'closeTag', tagName: 'span' }
              ];
            }
          }
        },
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
      
      // Adiciona botão de cor
      addColorButtonToToolbar(instance);
    }
    mountEditor();
    return () => {
      cancelled = true;
      if (instance && instance.destroy) {
        instance.destroy();
      }
      (editorRef as any).current = null;
    };
  }, [inlineEdit, containerEl, sectionId, editorMode, section, projectId, editorHeight]);

  useEffect(() => {
    if ((editorRef as any).current) {
      (editorRef as any).current.setHeight(editorHeight);
    }
  }, [editorHeight]);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Pegar os filhos diretos do sectionId atual
    const directChildren = (project?.sections || [])
      .filter((s: any) => s.parentId === sectionId)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    const oldIndex = directChildren.findIndex((c: any) => c.id === active.id);
    const newIndex = directChildren.findIndex((c: any) => c.id === over.id);

    const reordered = arrayMove(directChildren, oldIndex, newIndex);
    const newOrder = reordered.map((c: any) => c.id);
    reorderSections(projectId, newOrder);
  }

  // Verifica recursivamente se uma seção ou QUALQUER descendente corresponde à busca
  function matchesSearchRecursive(sectionToCheck: any, term: string): boolean {
    if (!term.trim()) return true;
    
    const lowerTerm = term.toLowerCase();
    
    // Verifica título e conteúdo da seção atual
    if (sectionToCheck.title.toLowerCase().includes(lowerTerm) || 
        sectionToCheck.content?.toLowerCase().includes(lowerTerm)) {
      return true;
    }
    
    // Verifica recursivamente em TODOS os descendentes (filhos, netos, bisnetos...)
    const allDescendants = (project?.sections || []).filter((s: any) => s.parentId === sectionToCheck.id);
    for (const descendant of allDescendants) {
      if (matchesSearchRecursive(descendant, term)) {
        return true;
      }
    }
    
    return false;
  }

  function highlightText(text: string, term: string) {
    if (!term || !term.trim()) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : part
    );
  }

  function getContentSnippet(content: string, term: string): string {
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
  }

  // Função recursiva para renderizar a árvore de subseções (sempre expandida)
  function renderSubsectionTree(parentId: string, level: number = 0): ReactNode {
    const subs = (project?.sections || [])
      .filter((s: any) => s.parentId === parentId)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    if (subs.length === 0) return null;

    // Filtrar por busca
    const filtered = subs.filter((s: any) => matchesSearchRecursive(s, searchTerm));
    if (filtered.length === 0) return null;

    // Se é o nível 0 (filhos diretos da seção atual), usar DnD
    if (level === 0) {
      return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((s: any) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="list-circle ml-6 mt-2">
              {filtered.map((sub: any) => (
                <SortableSubsectionItem 
                  key={sub.id} 
                  sub={sub} 
                  projectId={projectId} 
                  project={project}
                  router={router}
                  renderSubsectionTree={renderSubsectionTree}
                  searchTerm={searchTerm}
                  highlightText={highlightText}
                  expandedSections={expandedSections}
                  setExpandedSections={setExpandedSections}
                  getContentSnippet={getContentSnippet}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      );
    }

    // Para níveis mais profundos, renderizar sem DnD mas com busca e highlighting
    return (
      <ul className="list-circle ml-6 mt-2">
        {filtered.map((sub: any) => {
          const hasChildren = (project?.sections || []).some((s: any) => s.parentId === sub.id);
          const isExpanded = expandedSections.has(sub.id) || searchTerm.trim();
          
          // Verifica se o termo está diretamente nesta seção
          const lowerTerm = searchTerm.toLowerCase();
          const matchesDirectly = searchTerm.trim() && (
            sub.title.toLowerCase().includes(lowerTerm) || 
            sub.content?.toLowerCase().includes(lowerTerm)
          );

          const contentSnippet = matchesDirectly && sub.content && searchTerm ? getContentSnippet(sub.content, searchTerm) : '';

          return (
            <li key={sub.id} className="mb-2">
              <div className="flex items-center gap-2">
                {hasChildren && (
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedSections);
                      if (expandedSections.has(sub.id)) {
                        newExpanded.delete(sub.id);
                      } else {
                        newExpanded.add(sub.id);
                      }
                      setExpandedSections(newExpanded);
                    }}
                    className="text-gray-600 hover:text-gray-800 font-bold w-4 text-sm"
                  >
                    {isExpanded ? '−' : '+'}
                  </button>
                )}
                {!hasChildren && <span className="w-4"></span>}
                <button
                  className="text-blue-300 underline hover:text-blue-500"
                  onClick={() => router.push(`/projects/${projectId}/sections/${sub.id}`)}
                >
                  {searchTerm.trim() ? highlightText(sub.title, searchTerm) : sub.title}
                </button>
                {matchesDirectly && searchTerm.trim() && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">✓ Match</span>
                )}
              </div>
              {contentSnippet && (
                <div className="ml-8 text-xs text-gray-600 italic mt-1 bg-yellow-50 p-2 rounded">
                  {highlightText(contentSnippet, searchTerm)}
                </div>
              )}
              {hasChildren && isExpanded && renderSubsectionTree(sub.id, level + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  if (!loaded) return <div className="p-6">Carregando...</div>;
  if (!section) return <div className="p-6">Seção não encontrada. <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded" onClick={() => router.push(`/projects/${projectId}`)}>Voltar</button></div>;

  return (
    <>
      <SectionDetailContent 
        project={project}
        projectId={projectId}
        section={section}
        sectionId={sectionId}
        breadcrumbs={breadcrumbs}
    isEditingTitle={isEditingTitle}
    setIsEditingTitle={setIsEditingTitle}
    editedTitle={editedTitle}
    setEditedTitle={setEditedTitle}
    editSection={editSection}
    inlineEdit={inlineEdit}
    setInlineEdit={setInlineEdit}
    containerEl={containerEl}
    setContainerEl={setContainerEl}
    editorRef={editorRef}
    editorMode={editorMode}
    setEditorMode={setEditorMode}
    removeSection={removeSection}
    countDescendants={countDescendants}
    renderSubsectionTree={renderSubsectionTree}
    newSubTitle={newSubTitle}
    setNewSubTitle={setNewSubTitle}
    nameError={nameError}
    setNameError={setNameError}
    addSubsection={addSubsection}
    hasDuplicateName={hasDuplicateName}
    router={router}
    searchTerm={searchTerm}
    setSearchTerm={setSearchTerm}
    expandedSections={expandedSections}
    setExpandedSections={setExpandedSections}
    editorHeight={editorHeight}
    setEditorHeight={setEditorHeight}
    isFullscreen={isFullscreen}
    setIsFullscreen={setIsFullscreen}
    isImproving={isImproving}
    improveError={improveError}
    handleImproveWithAI={handleImproveWithAI}
    showPreview={showPreview}
    previewContent={previewContent}
    modificationRequest={modificationRequest}
    setModificationRequest={setModificationRequest}
    handleConfirmImprovement={handleConfirmImprovement}
    handleCancelImprovement={handleCancelImprovement}
    handleRequestModification={handleRequestModification}
    sectionColor={sectionColor}
    setSectionColor={setSectionColor}
      />
      <AutocompleteDropdown />
    </>
  );
}

// Componente sortable para subseções
function SortableSubsectionItem({ sub, projectId, project, router, renderSubsectionTree, searchTerm, highlightText, expandedSections, setExpandedSections, getContentSnippet }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sub.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasChildren = (project?.sections || []).some((s: any) => s.parentId === sub.id);
  const isExpanded = expandedSections.has(sub.id) || searchTerm.trim();
  
  // Verifica se o termo está diretamente nesta seção
  const lowerTerm = searchTerm.toLowerCase();
  const matchesDirectly = searchTerm.trim() && (
    sub.title.toLowerCase().includes(lowerTerm) || 
    sub.content?.toLowerCase().includes(lowerTerm)
  );

  const contentSnippet = matchesDirectly && sub.content && searchTerm ? getContentSnippet(sub.content, searchTerm) : '';

  return (
    <li ref={setNodeRef} style={style} className="mb-2">
      <div className="flex items-center gap-2">
        <span
          className="text-gray-400 cursor-grab active:cursor-grabbing text-sm"
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
              if (expandedSections.has(sub.id)) {
                newExpanded.delete(sub.id);
              } else {
                newExpanded.add(sub.id);
              }
              setExpandedSections(newExpanded);
            }}
            className="text-gray-600 hover:text-gray-800 font-bold w-4 text-sm"
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
        {!hasChildren && <span className="w-4"></span>}
        <button
          className="text-blue-300 underline hover:text-blue-500"
          onClick={() => router.push(`/projects/${projectId}/sections/${sub.id}`)}
        >
          {searchTerm.trim() ? highlightText(sub.title, searchTerm) : sub.title}
        </button>
        {matchesDirectly && searchTerm.trim() && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">✓ Match</span>
        )}
      </div>
      {contentSnippet && (
        <div className="ml-8 text-xs text-gray-600 italic mt-1 bg-yellow-50 p-2 rounded">
          {highlightText(contentSnippet, searchTerm)}
        </div>
      )}
      {hasChildren && isExpanded && renderSubsectionTree(sub.id, 1)}
    </li>
  );
}

// Componente principal de conteúdo
function SectionDetailContent({ 
  project, projectId, section, sectionId, breadcrumbs, 
  isEditingTitle, setIsEditingTitle, editedTitle, setEditedTitle, editSection,
  inlineEdit, setInlineEdit, containerEl, setContainerEl, editorRef, editorMode, setEditorMode,
  removeSection, countDescendants, renderSubsectionTree,
  newSubTitle, setNewSubTitle, nameError, setNameError, addSubsection, hasDuplicateName,
  router, searchTerm, setSearchTerm, expandedSections, setExpandedSections,
  editorHeight, setEditorHeight, isFullscreen, setIsFullscreen,
  isImproving, improveError, handleImproveWithAI,
  showPreview, previewContent, modificationRequest, setModificationRequest,
  handleConfirmImprovement, handleCancelImprovement, handleRequestModification,
  sectionColor, setSectionColor
}: any) {

  return (
    <div className={inlineEdit && isFullscreen ? "fixed inset-0 z-50 bg-white overflow-auto p-6" : "p-6 max-w-lg mx-auto"}>
      {/* Fullscreen header */}
      {inlineEdit && isFullscreen && (
        <div className="mb-4 flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-bold">Editando: {section.title}</h2>
          <button
            onClick={() => {
              setIsFullscreen(false);
              setEditorHeight('320px');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1"
            title="Sair do fullscreen"
          >
            ⤓ Sair do Fullscreen
          </button>
        </div>
      )}
      
      {/* Breadcrumbs */}
      {!(inlineEdit && isFullscreen) && (
        <div className="mb-4 text-sm text-gray-500 flex items-center gap-1 flex-wrap">
        <button
          className="hover:text-blue-400 underline"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          {project?.title || "Projeto"}
        </button>
        {breadcrumbs.map((crumb: any, idx: number) => (
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
      )}

      {!(inlineEdit && isFullscreen) && (
        <div className="flex items-center gap-2 mb-2 group">
        {isEditingTitle ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editedTitle.trim()) {
                  const sections = project?.sections || [];
                  const convertedContent = convertReferencesToIds(section.content || '', sections);
                  editSection(projectId, sectionId, editedTitle.trim(), convertedContent);
                  setIsEditingTitle(false);
                } else if (e.key === 'Escape') {
                  setEditedTitle(section.title);
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="flex-1 text-2xl font-bold border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                if (editedTitle.trim()) {
                  const sections = project?.sections || [];
                  const convertedContent = convertReferencesToIds(section.content || '', sections);
                  editSection(projectId, sectionId, editedTitle.trim(), convertedContent);
                  setIsEditingTitle(false);
                }
              }}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
            >
              ✓ Salvar
            </button>
            <button
              onClick={() => {
                setEditedTitle(section.title);
                setIsEditingTitle(false);
              }}
              className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              ✕ Cancelar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={sectionColor}
                onChange={(e) => {
                  const newColor = e.target.value;
                  setSectionColor(newColor);
                  editSection(projectId, sectionId, section.title, section.content, newColor);
                }}
                className="h-8 w-8 border rounded cursor-pointer"
                title="Cor no mapa mental"
              />
              {section?.color && (
                <button
                  onClick={() => {
                    setSectionColor("#3b82f6");
                    editSection(projectId, sectionId, section.title, section.content, undefined);
                  }}
                  className="h-8 px-2 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                  title="Resetar para cor padrão do nível"
                >
                  🔄
                </button>
              )}
            </div>
            <h1 className="text-2xl font-bold">{section.title}</h1>
            <button
              onClick={() => setIsEditingTitle(true)}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-blue-600 transition-opacity text-xl"
              title="Editar nome da seção"
            >
              ✏️
            </button>
          </>
        )}
        {!inlineEdit && !isEditingTitle && (
          <>
            <button
              onClick={handleImproveWithAI}
              disabled={isImproving}
              className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Melhorar conteúdo com IA preservando imagens e links"
            >
              {isImproving ? "⏳" : "✨"}
            </button>
            <button
              onClick={() => router.push(`/projects/${projectId}/mindmap?focus=${sectionId}`)}
              className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              title="Ver no mapa mental"
            >
              🌐
            </button>
          </>
        )}
        {!isEditingTitle && (
          <button
            className="w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
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
            title="Excluir seção"
          >
            🗑️
          </button>
        )}
        </div>
      )}
      
      {/* Mensagem de erro/aviso da IA */}
      {improveError && (
        <div className="mb-4 p-3 bg-amber-900/30 border border-amber-600 rounded-lg text-amber-200 text-sm">
          {improveError}
        </div>
      )}
      {!inlineEdit && !(inlineEdit && isFullscreen) && (
        <div 
          className="mb-4"
          onDoubleClick={() => setInlineEdit(true)}
        >
          {section.content ? (
            <MarkdownWithReferences 
              content={section.content} 
              projectId={projectId} 
              sections={project?.sections || []} 
            />
          ) : (
            <p className="text-gray-400">Sem descrição.</p>
          )}
        </div>
      )}
      {inlineEdit && (
        <div className="mb-3">
          {!isFullscreen && (
            <div className="flex items-center gap-2 mb-2 justify-end">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1">
                <button
                  onClick={() => setEditorHeight((prev: string) => {
                    const current = parseInt(prev);
                    return `${Math.max(200, current - 100)}px`;
                  })}
                  className="text-gray-600 hover:text-gray-900 font-bold"
                  title="Diminuir altura"
                >
                  −
                </button>
                <span className="text-sm text-gray-600 min-w-[60px] text-center">
                  {editorHeight}
                </span>
                <button
                  onClick={() => setEditorHeight((prev: string) => {
                    const current = parseInt(prev);
                    return `${current + 100}px`;
                  })}
                  className="text-gray-600 hover:text-gray-900 font-bold"
                  title="Aumentar altura"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => {
                  setIsFullscreen(true);
                  setEditorHeight('calc(100vh - 200px)');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1"
                title="Fullscreen"
              >
                ⤢ Fullscreen
              </button>
            </div>
          )}
          <div ref={setContainerEl as any} />
          <div className="mt-2 flex gap-2">
            <button
              className="bg-green-600 text-white px-3 py-1 rounded"
              onClick={() => {
                const md = (editorRef as any).current?.getMarkdown?.() || "";
                const sections = project?.sections || [];
                const convertedMd = convertReferencesToIds(md, sections);
                editSection(projectId, sectionId, section.title, convertedMd);
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

      {/* Backlinks Section */}
      {!(inlineEdit && isFullscreen) && (
        <BacklinksSection 
          projectId={projectId}
          sectionId={sectionId}
          sections={project?.sections || []}
          router={router}
        />
      )}

      {!(inlineEdit && isFullscreen) && (
        <>
      <h2 className="mt-4 font-semibold">Subseções</h2>
      
      {/* Campo de busca */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="🔍 Buscar subseções..."
          value={searchTerm}
          onChange={(e) => {
            const term = e.target.value;
            setSearchTerm(term);
            // Se houver busca, expandir automaticamente todas as seções
            if (term.trim()) {
              const allIds = new Set<string>();
              function collectIds(parentId: string) {
                const subs = (project?.sections || []).filter((s: any) => s.parentId === parentId);
                subs.forEach((s: any) => {
                  allIds.add(s.id);
                  collectIds(s.id);
                });
              }
              collectIds(sectionId);
              setExpandedSections(allIds);
            }
          }}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {renderSubsectionTree(sectionId) || (
        <p className="text-gray-500 text-sm">Nenhuma subseção ainda.</p>
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
      </>
      )}

      {/* Modal de Preview da IA */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>✨</span>
                Preview do Conteúdo Melhorado
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                Revise o conteúdo e confirme ou solicite modificações
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {improveError && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm">
                  {improveError}
                </div>
              )}

              <div className="prose prose-sm prose-slate max-w-none bg-gray-50 rounded-lg p-6 border border-gray-200 text-gray-900">
                <MarkdownWithReferences 
                  content={previewContent} 
                  projectId={projectId} 
                  sections={project?.sections || []} 
                />
              </div>
            </div>

            {/* Footer com ações */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Solicitar modificações (opcional):
                </label>
                <textarea
                  value={modificationRequest}
                  onChange={(e) => setModificationRequest(e.target.value)}
                  placeholder="Ex: Adicione mais exemplos práticos, reduza o texto, foque mais em mecânicas..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-20"
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelImprovement}
                  disabled={isImproving}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  ✕ Cancelar
                </button>
                
                <button
                  onClick={handleRequestModification}
                  disabled={isImproving || !modificationRequest.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isImproving ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>Modificando...</span>
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      <span>Modificar</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleConfirmImprovement}
                  disabled={isImproving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>Confirmar e Aplicar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente de Backlinks (seções que referenciam esta)
function BacklinksSection({ projectId, sectionId, sections, router }: any) {
  const backlinks = getBacklinks(sectionId, sections);

  if (backlinks.length === 0) return null;

  return (
    <div className="mt-6 mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
        <span>🔗</span>
        <span>Referenciado por:</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {backlinks.map((link, index) => (
          <span key={link.id} className="inline-flex items-center">
            <button
              onClick={() => router.push(`/projects/${projectId}/sections/${link.id}`)}
              className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium"
            >
              {link.title}
            </button>
            {index < backlinks.length - 1 && <span className="text-blue-400 ml-1">,</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// Nota: O autocomplete é renderizado no componente principal via <AutocompleteDropdown />