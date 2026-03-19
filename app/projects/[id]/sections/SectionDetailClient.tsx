"use client";

import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownWithReferences } from "@/components/MarkdownWithReferences";
import { getBacklinks, convertReferencesToIds, convertReferencesToNames, extractSectionReferences, findSection } from "@/utils/sectionReferences";
import { useMarkdownAutocomplete } from "@/hooks/useMarkdownAutocomplete";
import { addColorButtonToToolbar, addImageUrlButtonToToolbar, addDriveImageButtonToToolbar, addReferenceButtonToToolbar } from "@/utils/toastui-color-plugin";
import { driveFileIdToImageUrl, normalizeDriveUrlsInMarkdown } from "@/lib/googleDrivePicker";
import { useAIConfig } from "@/hooks/useAIConfig";
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
import { GAME_DESIGN_DOMAIN_IDS, normalizeDomainTags } from "@/lib/gameDesignDomains";
import { BalanceAddonPanel } from "@/components/BalanceAddonPanel";
import { createDefaultBalanceAddon } from "@/lib/balance/formulaEngine";
import type { BalanceAddonDraft } from "@/lib/balance/types";

interface Props {
  projectId: string;
  sectionId: string;
  /** Quando true, abre direto no modo edição inline (ex.: vindo de /sections/[id]/edit) */
  openEdit?: boolean;
}

export default function SectionDetailClient({ projectId, sectionId, openEdit = false }: Props) {
  const { t } = useI18n();
  const { user, profile } = useAuthStore();
  const { hasValidConfig, getAIHeaders } = useAIConfig();
  const getProject = useProjectStore((s) => s.getProject);
  const removeSection = useProjectStore((s) => s.removeSection);
  const addSection = useProjectStore((s) => s.addSection);
  const addSubsection = useProjectStore((s) => s.addSubsection);
  const countDescendants = useProjectStore((s) => s.countDescendants);
  const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
  const reorderSections = useProjectStore((s) => s.reorderSections);
  const editSection = useProjectStore((s) => s.editSection);
  const setSectionBalanceAddons = useProjectStore((s) => s.setSectionBalanceAddons);
  const projects = useProjectStore((s) => s.projects);
  const lastSyncedAt = useProjectStore((s) => s.lastSyncedAt);
  const lastSyncStats = useProjectStore((s) => s.lastSyncStats);

  const sectionAuditBy = user ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null } : undefined;
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
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedNewParent, setSelectedNewParent] = useState<string | null>(null);
  const [sectionVersions, setSectionVersions] = useState<Array<{ id: string; title: string; content: string; color?: string | null; created_at: string; updated_by_name?: string | null }>>([]);
  const [sectionVersionsLoading, setSectionVersionsLoading] = useState(false);
  const [restoreVersionId, setRestoreVersionId] = useState<string | null>(null);
  const [suggestDomainLoading, setSuggestDomainLoading] = useState(false);
  const [showAddonMenu, setShowAddonMenu] = useState(false);
  const router = useRouter();

  const sections = project?.sections || [];
  const balanceAddons = section?.balanceAddons || [];
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const { AutocompleteDropdown } = useMarkdownAutocomplete({
    sections,
    containerRef: inlineEdit ? editorContainerRef : undefined,
  });

  // Redirecionamento de /sections/[id]/edit: abrir direto no modo edição inline
  useEffect(() => {
    if (openEdit) setInlineEdit(true);
  }, [openEdit]);

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

      // Breadcrumb: caminho da raiz até a seção atual (títulos) para a IA entender a hierarquia
      const breadcrumb: string[] = [];
      let ancestor: typeof section | undefined = section;
      const sectionById = new Map(sections.map((s: any) => [s.id, s]));
      while (ancestor) {
        breadcrumb.unshift(String(ancestor.title || ""));
        ancestor = ancestor.parentId ? sectionById.get(ancestor.parentId) : undefined;
      }
      
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
          breadcrumb: breadcrumb.length > 0 ? breadcrumb : undefined,
          parentContent: parentSection?.content ? String(parentSection.content).trim().slice(0, 1500) : undefined,
          subsections: subsections,
          otherSections: otherSections
        },
        projectTitle: String(project.title || 'GDD'),
        model: 'llama-3.1-8b-instant',
        additionalRequest: additionalRequest ? String(additionalRequest) : undefined
      };

      const response = await fetch('/api/ai/improve-content', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAIHeaders(),
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        setImproveError(data.error || t('sectionDetail.errors.improveFailed'));
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
      setImproveError(t('sectionDetail.errors.apiConnection'));
    } finally {
      setIsImproving(false);
    }
  }

  function handleConfirmImprovement() {
    if (!section) return;
    
    // Aplica o conteúdo melhorado
    editSection(projectId, sectionId, section.title, previewContent, undefined, undefined, sectionAuditBy);
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
      setImproveError(t('sectionDetail.errors.enterModification'));
      return;
    }
    
    await handleImproveWithAI(modificationRequest.trim());
  }

  // Função auxiliar para pegar todos os descendentes de uma seção
  function getAllDescendants(sectionId: string, allSections: any[]): string[] {
    const descendants: string[] = [];
    const children = allSections.filter(s => s.parentId === sectionId);
    
    for (const child of children) {
      descendants.push(child.id);
      descendants.push(...getAllDescendants(child.id, allSections));
    }
    
    return descendants;
  }

  // Função para mover a seção
  function handleMoveSection() {
    if (!section || !project) return;
    
    // Se selecionou "Raiz", selectedNewParent será null
    const newParentId = selectedNewParent === 'root' ? null : selectedNewParent;
    
    // Validações
    if (newParentId === sectionId) {
      alert(t('sectionDetail.move.cannotBeOwnParent'));
      return;
    }
    
    if (newParentId) {
      // Verificar se o novo pai é um descendente da seção atual
      const descendants = getAllDescendants(sectionId, sections);
      if (descendants.includes(newParentId)) {
        alert(t('sectionDetail.move.cannotMoveToDescendant'));
        return;
      }
    }
    
    // Atualizar o parentId (não mexe em title, content e color)
    editSection(projectId, sectionId, section.title, section.content, newParentId, section.color, sectionAuditBy);
    
    // Fechar modal e resetar
    setShowMoveModal(false);
    setSelectedNewParent(null);
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

  useEffect(() => {
    setShowAddonMenu(false);
  }, [sectionId]);

  // Buscar histórico de versões da seção (após carregar)
  useEffect(() => {
    if (!loaded || !projectId || !sectionId) return;
    let cancelled = false;
    setSectionVersionsLoading(true);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/versions`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { versions: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.versions)) setSectionVersions(data.versions);
      })
      .catch(() => { if (!cancelled) setSectionVersions([]); })
      .finally(() => { if (!cancelled) setSectionVersionsLoading(false); });
    return () => { cancelled = true; };
  }, [loaded, projectId, sectionId]);

  // Atualizar histórico quando um sync deste projeto termina (novo ponto de versão pode ter sido criado)
  useEffect(() => {
    if (!loaded || !projectId || !sectionId || !lastSyncedAt || !lastSyncStats || lastSyncStats.projectId !== projectId) return;
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/versions`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { versions: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.versions)) setSectionVersions(data.versions);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loaded, projectId, sectionId, lastSyncedAt, lastSyncStats]);

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
      const contentForEditor = normalizeDriveUrlsInMarkdown(
        convertReferencesToNames(section?.content || "", sections)
      );
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
        // "table" removido: plugin de tabelas do Toast UI causa erros no console (CellSelection/removeRow) em certas interações
        toolbarItems: [
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol", "task"],
          ["link"],
          ["code", "codeblock"],
        ],
      });
      (editorRef as any).current = instance;
      
      // Adiciona botão de cor
      addColorButtonToToolbar(instance);

      // Adiciona botão de imagem por URL
      addImageUrlButtonToToolbar(instance);

      // Adiciona botão de imagem do Google Drive (ao lado do anterior). getCurrentEditor evita referência destruída após o Picker fechar.
      addDriveImageButtonToToolbar(instance, {
        notConfiguredMessage: t("sectionEdit.driveNotConfigured"),
        pasteHintMessage: t("sectionEdit.drivePasteHint"),
        getMarkdownToInsert: (fileId, fileName) => {
          const alt = fileName.replace(/\.(png|jpe?g|gif|webp|bmp|svg)$/i, "");
          return `![${alt}](${driveFileIdToImageUrl(fileId)})`;
        },
        getCurrentEditor: () => (editorRef as any).current ?? null,
      });
      addReferenceButtonToToolbar(instance, {
        sections: project?.sections || [],
        buttonTitle: t("sectionEdit.insertReference"),
        searchPlaceholder: t("sectionEdit.referenceSearchPlaceholder"),
      });
    }
    mountEditor();
    return () => {
      cancelled = true;
      if (instance && instance.destroy) {
        instance.destroy();
      }
      (editorRef as any).current = null;
    };
  }, [inlineEdit, containerEl, sectionId, editorMode, section, projectId, editorHeight, t]);

  useEffect(() => {
    if ((editorRef as any).current) {
      (editorRef as any).current.setHeight(editorHeight);
    }
  }, [editorHeight]);

  // Inserção de imagem do Drive: plugin dispara evento em document; aqui temos o editorRef válido
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ markdownImage: string }>).detail;
      if (!detail?.markdownImage) return;
      const inst = (editorRef as any).current;
      if (!inst || typeof inst.getMarkdown !== "function" || typeof inst.setMarkdown !== "function") return;
      try {
        const current = inst.getMarkdown();
        const newMarkdown = (current || "").trimEnd() + "\n" + detail.markdownImage;
        inst.setMarkdown(newMarkdown, false);
        (document as unknown as { __gddDriveImageInserted?: boolean }).__gddDriveImageInserted = true;
      } catch {
        // ignore
      }
    };
    document.addEventListener("gdd-insert-drive-image", handler);
    return () => document.removeEventListener("gdd-insert-drive-image", handler);
  }, []);

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
            <ul className="mt-2 space-y-2">
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
      <ul className="mt-2 space-y-2 pl-3 border-l border-gray-700/60">
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
              <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-700 p-2.5 rounded-lg">
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
                    className="text-gray-300 hover:text-white font-bold w-4 text-sm"
                  >
                    {isExpanded ? '−' : '+'}
                  </button>
                )}
                {!hasChildren && <span className="w-4"></span>}
                <button
                  className="min-w-0 flex-1 text-left text-blue-300 underline hover:text-blue-200 break-words"
                  onClick={() => router.push(`/projects/${projectId}/sections/${sub.id}`)}
                >
                  {searchTerm.trim() ? highlightText(sub.title, searchTerm) : sub.title}
                </button>
                {matchesDirectly && searchTerm.trim() && (
                  <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">✓ Match</span>
                )}
              </div>
              {contentSnippet && (
                <div className="ml-3 text-xs text-gray-300 italic mt-1 bg-yellow-950/30 border border-yellow-700/60 p-2 rounded">
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

  if (!loaded) return <div className="min-h-screen bg-gray-900 text-white p-6">{t('common.loading')}</div>;
  if (!section) return <div className="min-h-screen bg-gray-900 text-white p-6">{t('sectionDetail.notFound')} <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors" onClick={() => router.push(`/projects/${projectId}`)}>{t('common.back')}</button></div>;

  const addBalanceAddon = () => {
    const addonId = `balance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newAddon = createDefaultBalanceAddon(addonId);
    setSectionBalanceAddons(projectId, sectionId, [...balanceAddons, newAddon], sectionAuditBy);
    setShowAddonMenu(false);
  };

  const updateBalanceAddon = (addonId: string, nextAddon: BalanceAddonDraft) => {
    setSectionBalanceAddons(
      projectId,
      sectionId,
      balanceAddons.map((addon: BalanceAddonDraft) => (addon.id === addonId ? nextAddon : addon)),
      sectionAuditBy
    );
  };

  const removeBalanceAddon = (addonId: string) => {
    setSectionBalanceAddons(
      projectId,
      sectionId,
      balanceAddons.filter((addon: BalanceAddonDraft) => addon.id !== addonId),
      sectionAuditBy
    );
  };

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
    editSection={(pid: string, sid: string, title: string, content: string, parentId?: string | null, color?: string, domainTags?: string[]) => editSection(pid, sid, title, content, parentId, color, sectionAuditBy, domainTags)}
    inlineEdit={inlineEdit}
    setInlineEdit={setInlineEdit}
    containerEl={containerEl}
    setContainerEl={setContainerEl}
    editorContainerRef={editorContainerRef}
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
    addSection={(pid: string, title: string, content?: string) => addSection(pid, title, content, sectionAuditBy)}
    addSubsection={(pid: string, parentId: string, title: string, content?: string) => addSubsection(pid, parentId, title, content, sectionAuditBy)}
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
    setImproveError={setImproveError}
    getAIHeaders={getAIHeaders}
    handleImproveWithAI={handleImproveWithAI}
    showPreview={showPreview}
    previewContent={previewContent}
    setPreviewContent={setPreviewContent}
    modificationRequest={modificationRequest}
    setModificationRequest={setModificationRequest}
    handleConfirmImprovement={handleConfirmImprovement}
    handleCancelImprovement={handleCancelImprovement}
    handleRequestModification={handleRequestModification}
    sectionColor={sectionColor}
    setSectionColor={setSectionColor}
    hasValidConfig={hasValidConfig}
    showMoveModal={showMoveModal}
    setShowMoveModal={setShowMoveModal}
    selectedNewParent={selectedNewParent}
    setSelectedNewParent={setSelectedNewParent}
    handleMoveSection={handleMoveSection}
    sections={project?.sections || []}
    setSection={setSection}
    sectionVersions={sectionVersions}
    sectionVersionsLoading={sectionVersionsLoading}
    restoreVersionId={restoreVersionId}
    setSectionVersions={setSectionVersions}
    setRestoreVersionId={setRestoreVersionId}
    suggestDomainLoading={suggestDomainLoading}
    setSuggestDomainLoading={setSuggestDomainLoading}
    showAddonMenu={showAddonMenu}
    setShowAddonMenu={setShowAddonMenu}
    balanceAddons={balanceAddons}
    onAddBalanceAddon={addBalanceAddon}
    onUpdateBalanceAddon={updateBalanceAddon}
    onRemoveBalanceAddon={removeBalanceAddon}
      />
      <AutocompleteDropdown />
    </>
  );
}

/** Retorna referências $[Nome] do conteúdo que não existem como seção e se o projeto foi referenciado como seção */
function getUnresolvedRefsFromContent(
  content: string,
  sections: Array<{ id: string; title: string }>,
  projectTitle: string
): { unresolvedNames: string[]; hasProjectTitleRef: boolean } {
  if (!content || !sections) return { unresolvedNames: [], hasProjectTitleRef: false };
  const refs = extractSectionReferences(content);
  const projectTitleLower = (projectTitle || "").trim().toLowerCase();
  const unresolvedNames: string[] = [];
  let hasProjectTitleRef = false;
  const seen = new Set<string>();
  for (const ref of refs) {
    const found = findSection(sections, ref);
    if (found) continue;
    if (ref.refType !== "name") continue;
    const name = ref.refValue.trim();
    if (!name) continue;
    if (name.toLowerCase() === projectTitleLower) {
      hasProjectTitleRef = true;
      continue;
    }
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unresolvedNames.push(name);
    }
  }
  return { unresolvedNames, hasProjectTitleRef };
}

function getBreadcrumb(sectionId: string, sections: Array<{ id: string; title?: string; parentId?: string }>): string[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const path: string[] = [];
  let curr = byId.get(sectionId);
  while (curr) {
    path.unshift(String(curr.title || ""));
    curr = curr.parentId ? byId.get(curr.parentId) : undefined;
  }
  return path;
}

function UnresolvedRefsPanel({
  unresolvedNames,
  hasProjectTitleRef,
  projectTitle,
  previewContent,
  setPreviewContent,
  onRemoveProjectRefFromSection,
  projectId,
  sectionId,
  sections,
  currentContextPath,
  addSection,
  addSubsection,
  getAIHeaders,
  router,
  onLimitError,
  onAiError,
  hasDuplicateName,
}: {
  unresolvedNames: string[];
  hasProjectTitleRef: boolean;
  projectTitle: string;
  previewContent?: string;
  setPreviewContent?: (content: string) => void;
  onRemoveProjectRefFromSection?: () => void;
  projectId: string;
  sectionId: string;
  sections: Array<{ id: string; title?: string; parentId?: string }>;
  currentContextPath?: string[];
  addSection: (projectId: string, title: string, content?: string) => string;
  addSubsection: (projectId: string, parentId: string, title: string, content?: string) => string;
  getAIHeaders?: () => Record<string, string>;
  router: { push: (url: string) => void };
  onLimitError?: (message: string) => void;
  onAiError?: (message: string) => void;
  hasDuplicateName: (projectId: string, title: string, parentId?: string, excludeId?: string) => boolean;
}) {
  const { t } = useI18n();
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [chooseParentFor, setChooseParentFor] = useState<string | null>(null);
  const [useAILoadingFor, setUseAILoadingFor] = useState<string | null>(null);

  if (unresolvedNames.length === 0 && !hasProjectTitleRef) return null;

  const runWithLimitCheck = (fn: () => void) => {
    try {
      fn();
      setOpenMenuFor(null);
      setChooseParentFor(null);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("structural_limit") && onLimitError) {
        onLimitError(e.message === "structural_limit_sections_total" ? t("limits.sectionsTotal") : t("limits.sectionsPerProject"));
      } else {
        throw e;
      }
    }
  };

  const handleRemoveProjectRef = () => {
    if (setPreviewContent && previewContent != null && projectTitle) {
      const re = new RegExp(`\\$\\[${escapeRegExp(projectTitle)}\\]`, "gi");
      setPreviewContent(previewContent.replace(re, projectTitle));
    } else if (onRemoveProjectRefFromSection) {
      onRemoveProjectRefFromSection();
    }
  };

  const possibleParents = chooseParentFor
    ? sections.filter((s) => !hasDuplicateName(projectId, chooseParentFor, s.id))
    : [];

  const findSectionByTitleUnderParent = (title: string, parentId: string | undefined) =>
    sections.find(
      (s) => (s.parentId ?? undefined) === (parentId ?? undefined) && (s.title || "").toLowerCase() === title.toLowerCase()
    );

  const applyPathAndNavigate = async (name: string) => {
    if (!getAIHeaders) {
      onAiError?.(t("sectionDetail.errors.apiConnection"));
      setUseAILoadingFor(null);
      return;
    }
    setUseAILoadingFor(name);
    setOpenMenuFor(null);
    setChooseParentFor(null);
    try {
      const res = await fetch("/api/ai/suggest-section-path", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAIHeaders() },
        body: JSON.stringify({
          projectTitle,
          sections: sections.map((s) => ({ id: s.id, title: s.title ?? "", parentId: s.parentId ?? undefined, domainTags: (s as { domainTags?: string[] }).domainTags })),
          newSectionTitle: name,
          currentContextPath: currentContextPath?.length ? currentContextPath : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onAiError?.(data.error || "Erro ao sugerir caminho");
        setUseAILoadingFor(null);
        return;
      }
      const path = Array.isArray(data.path) ? data.path.map((p: string) => String(p).trim()).filter(Boolean) : [];
      if (path.length === 0) {
        onAiError?.("IA não retornou um caminho válido.");
        setUseAILoadingFor(null);
        return;
      }
      let parentId: string | undefined = undefined;
      for (const segment of path) {
        const existing = findSectionByTitleUnderParent(segment, parentId);
        if (existing) {
          parentId = existing.id;
        } else {
          try {
            parentId = parentId === undefined
              ? addSection(projectId, segment, "")
              : addSubsection(projectId, parentId, segment, "");
          } catch (e) {
            if (e instanceof Error && e.message.startsWith("structural_limit") && onLimitError) {
              onLimitError(e.message === "structural_limit_sections_total" ? t("limits.sectionsTotal") : t("limits.sectionsPerProject"));
            } else {
              throw e;
            }
            setUseAILoadingFor(null);
            return;
          }
        }
      }
      if (parentId) router.push(`/projects/${projectId}/sections/${parentId}`);
    } catch (err) {
      onAiError?.(err instanceof Error ? err.message : "Erro ao usar IA");
    } finally {
      setUseAILoadingFor(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto mb-4 bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-amber-200 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14L21 3m-6 0h6v6M14 10L3 21m0-6v6h6" />
        </svg>
        {t("sectionDetail.ai.unresolvedRefsTitle")}
      </h3>
      <p className="text-xs text-amber-200/80 mb-3">{t("sectionDetail.ai.createSectionHint")}</p>
      <div className="space-y-2">
        {unresolvedNames.map((name) => {
          const existsHere = hasDuplicateName(projectId, name, sectionId);
          const existsAtRoot = hasDuplicateName(projectId, name);
          const anyExists = existsHere || existsAtRoot;
          return (
            <div key={name} className="flex items-center justify-between gap-3 bg-gray-900/50 border border-amber-700/30 rounded-lg px-3 py-2">
              <span className="text-sm text-amber-100 truncate">$[{name}]</span>
              <div className="shrink-0 relative">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  disabled={anyExists}
                  onClick={() => setOpenMenuFor((prev) => (prev === name ? null : name))}
                >
                  {anyExists ? t("sectionDetail.suggestions.alreadyCreated") : t("sectionDetail.ai.createSection")}
                  {!anyExists && " ▾"}
                </button>
                {openMenuFor === name && !anyExists && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenuFor(null)} aria-hidden />
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[12rem] py-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                        onClick={() => runWithLimitCheck(() => addSubsection(projectId, sectionId, name, ""))}
                      >
                        {t("sectionDetail.ai.createHere")}
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                        onClick={() => runWithLimitCheck(() => addSection(projectId, name, ""))}
                      >
                        {t("sectionDetail.ai.createAtRoot")}
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
                        onClick={() => {
                          setOpenMenuFor(null);
                          setChooseParentFor(name);
                        }}
                      >
                        {t("sectionDetail.ai.chooseParent")}
                      </button>
                      {getAIHeaders && (
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-amber-200 hover:bg-amber-900/50 border-t border-gray-600 mt-1"
                          onClick={() => applyPathAndNavigate(name)}
                          disabled={useAILoadingFor !== null}
                        >
                          {useAILoadingFor === name ? (
                            t("sectionDetail.ai.useAILoading")
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l1.8 4.8L19 9.6l-4.1 3.2L16.2 18 12 15l-4.2 3 1.3-5.2L5 9.6l5.2-1.8L12 3z" />
                              </svg>
                              {t("sectionDetail.ai.useAI")}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {hasProjectTitleRef && (
          <div className="flex items-center justify-between gap-3 bg-gray-900/50 border border-amber-700/30 rounded-lg px-3 py-2">
            <span className="text-sm text-amber-100">
              $[{projectTitle}] — {t("sectionDetail.ai.projectNotSection")}
            </span>
            <button
              type="button"
              className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-700 transition-colors"
              onClick={handleRemoveProjectRef}
            >
              {t("sectionDetail.ai.removeProjectRef")}
            </button>
          </div>
        )}
      </div>

      {/* Modal: escolher seção pai para criar a nova seção */}
      {chooseParentFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setChooseParentFor(null)}>
          <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-xl max-w-md w-full max-h-[70vh] flex flex-col text-white" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-gray-600">
              <h4 className="font-semibold">{t("sectionDetail.ai.chooseParentModalTitle").replace("{name}", chooseParentFor)}</h4>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg text-sm bg-gray-700/50 hover:bg-gray-700"
                onClick={() => runWithLimitCheck(() => addSection(projectId, chooseParentFor, ""))}
              >
                📁 {t("sectionDetail.ai.createAtRoot")}
              </button>
              {possibleParents.map((s) => {
                const path = getBreadcrumb(s.id, sections);
                const pathStr = path.length > 0 ? path.join(" › ") : String(s.title || "");
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-lg text-sm bg-gray-700/50 hover:bg-gray-700 truncate"
                    title={pathStr}
                    onClick={() => runWithLimitCheck(() => addSubsection(projectId, s.id, chooseParentFor, ""))}
                  >
                    {pathStr}
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t border-gray-600">
              <button type="button" className="text-sm text-gray-400 hover:text-white" onClick={() => setChooseParentFor(null)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-700 p-2.5 rounded-lg">
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
            className="text-gray-300 hover:text-white font-bold w-4 text-sm"
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
        {!hasChildren && <span className="w-4"></span>}
        <button
          className="min-w-0 flex-1 text-left text-blue-300 underline hover:text-blue-200 break-words"
          onClick={() => router.push(`/projects/${projectId}/sections/${sub.id}`)}
        >
          {searchTerm.trim() ? highlightText(sub.title, searchTerm) : sub.title}
        </button>
        {matchesDirectly && searchTerm.trim() && (
          <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-700/60">✓ Match</span>
        )}
      </div>
      {contentSnippet && (
        <div className="ml-3 text-xs text-gray-300 italic mt-1 bg-yellow-950/30 border border-yellow-700/60 p-2 rounded">
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
  inlineEdit, setInlineEdit, containerEl, setContainerEl, editorContainerRef, editorRef, editorMode, setEditorMode,
  removeSection, countDescendants, renderSubsectionTree,
  newSubTitle, setNewSubTitle, nameError, setNameError, addSection, addSubsection, hasDuplicateName,
  router, searchTerm, setSearchTerm, expandedSections, setExpandedSections,
  editorHeight, setEditorHeight, isFullscreen, setIsFullscreen,
  isImproving, improveError, setImproveError, getAIHeaders, handleImproveWithAI,
  showPreview, previewContent, setPreviewContent, modificationRequest, setModificationRequest,
  handleConfirmImprovement, handleCancelImprovement, handleRequestModification,
  sectionColor, setSectionColor, hasValidConfig,
  showMoveModal, setShowMoveModal,
  selectedNewParent, setSelectedNewParent,
  handleMoveSection,
  sections,
  setSection,
  sectionVersions,
  sectionVersionsLoading,
  restoreVersionId,
  setSectionVersions,
  setRestoreVersionId,
  suggestDomainLoading,
  setSuggestDomainLoading,
  showAddonMenu,
  setShowAddonMenu,
  balanceAddons,
  onAddBalanceAddon,
  onUpdateBalanceAddon,
  onRemoveBalanceAddon,
}: any) {
  const { t } = useI18n();
  const { user, profile } = useAuthStore();
  const [historyExpanded, setHistoryExpanded] = useState(false);
  // Mantém o estado de visibilidade por addon (chave: "tipo:id"), já escalável para futuros tipos.
  const [collapsedAddonKeys, setCollapsedAddonKeys] = useState<Record<string, boolean>>({});
  const { unresolvedNames, hasProjectTitleRef } = showPreview && previewContent
    ? getUnresolvedRefsFromContent(previewContent, sections || [], project?.title || "")
    : { unresolvedNames: [] as string[], hasProjectTitleRef: false };
  const unresolvedFromPage = getUnresolvedRefsFromContent(
    section?.content || "",
    sections || [],
    project?.title || ""
  );
  const showPageRefsPanel = !showPreview && (unresolvedFromPage.unresolvedNames.length > 0 || unresolvedFromPage.hasProjectTitleRef);
  const subsectionsPanel = (
    <div className="bg-gray-800/70 border border-gray-700/80 rounded-2xl p-4 md:p-5 overflow-x-hidden">
      <h2 className="font-semibold text-lg">{t('sectionDetail.subsections.title')}</h2>

      {/* Campo de busca */}
      <div className="mb-3">
        <input
          type="text"
          placeholder={t('sectionDetail.subsections.searchPlaceholder')}
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
          className="w-full bg-gray-900/70 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="max-h-[46vh] overflow-y-auto overflow-x-hidden pr-1">
        {renderSubsectionTree(sectionId) || (
          <p className="text-gray-400 text-sm">{t('sectionDetail.subsections.empty')}</p>
        )}
      </div>

      <div className="mt-2">
        <div className="flex gap-2">
          <input
            value={newSubTitle}
            onChange={(e) => {
              const val = e.target.value;
              setNewSubTitle(val);
              if (val.trim() && hasDuplicateName(projectId, val.trim(), sectionId)) {
                setNameError(t('sectionDetail.subsections.duplicate'));
              } else {
                setNameError("");
              }
            }}
            placeholder={t('sectionDetail.subsections.addPlaceholder')}
            className={`flex-1 min-w-0 bg-gray-900/70 border rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-400 ${nameError ? "border-red-500" : "border-gray-600"}`}
          />
          <button
            className="shrink-0 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            disabled={!newSubTitle.trim() || !!nameError}
            onClick={() => {
              const trimmed = newSubTitle.trim();
              if (!trimmed || nameError) return;
              try {
                addSubsection(projectId, sectionId, trimmed, "");
                setNewSubTitle("");
                setNameError("");
              } catch (e) {
                if (e instanceof Error && e.message.startsWith("structural_limit")) {
                  setNameError(e.message === "structural_limit_sections_total" ? t("limits.sectionsTotal") : t("limits.sectionsPerProject"));
                } else {
                  throw e;
                }
              }
            }}
          >{t('projectDetail.add')}</button>
        </div>
        {nameError && (
          <span className="text-red-400 text-sm mt-1 block">{nameError}</span>
        )}
      </div>
    </div>
  );

  useEffect(() => {
    const balanceKeys = new Set(
      (Array.isArray(balanceAddons) ? balanceAddons : []).map((addon: BalanceAddonDraft) => `balance:${addon.id}`)
    );
    setCollapsedAddonKeys((prev) => {
      const next = { ...prev };

      // Novos addons iniciam ocultos por padrão.
      for (const key of balanceKeys) {
        if (next[key] === undefined) next[key] = true;
      }

      // Remove chaves antigas de balance addons removidos.
      for (const key of Object.keys(next)) {
        if (key.startsWith("balance:") && !balanceKeys.has(key)) {
          delete next[key];
        }
      }

      return next;
    });
  }, [balanceAddons]);

  const toggleAddonCollapsed = (addonKey: string) => {
    setCollapsedAddonKeys((prev) => ({
      ...prev,
      [addonKey]: !(prev[addonKey] ?? true),
    }));
  };

  return (
    <div className={inlineEdit && isFullscreen ? "fixed inset-0 z-50 bg-gray-900 text-white overflow-auto p-6" : "min-h-screen bg-gray-900 text-white px-4 py-8 md:px-8 md:py-10"}>
      {/* Fullscreen header */}
      {inlineEdit && isFullscreen && (
        <div className="mb-4 flex items-center justify-between border-b border-gray-700 pb-4">
          <h2 className="text-xl font-bold">Editando: {section.title}</h2>
          <button
            onClick={() => {
              setIsFullscreen(false);
              setEditorHeight('320px');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1"
            title={t('sectionDetail.actions.exitFullscreen')}
          >
            ⤓ {t('sectionDetail.actions.exitFullscreen')}
          </button>
        </div>
      )}
      
      {/* Breadcrumbs */}
      {!(inlineEdit && isFullscreen) && (
        <div className="max-w-6xl mx-auto mb-4 text-sm text-gray-400 flex items-center gap-1 flex-wrap">
        <button
          className="hover:text-blue-300 underline"
          onClick={() => router.push(`/projects/${projectId}`)}
        >
          {project?.title || "Projeto"}
        </button>
        {breadcrumbs.map((crumb: any, idx: number) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <span>/</span>
            {idx === breadcrumbs.length - 1 ? (
              <span className="text-gray-200 font-semibold">{crumb.title}</span>
            ) : (
              <button
                className="hover:text-blue-300 underline"
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
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 mb-2 group bg-gray-800/70 border border-gray-700/80 rounded-2xl p-4 md:p-5">
          {/* Esquerda: cor, título (ou edição) e lápis de editar */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isEditingTitle ? (
              <>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editedTitle.trim()) {
                      const sections = project?.sections || [];
                      const convertedContent = convertReferencesToIds(section.content || '', sections);
                      editSection(projectId, sectionId, editedTitle.trim(), convertedContent, undefined, undefined);
                      setIsEditingTitle(false);
                    } else if (e.key === 'Escape') {
                      setEditedTitle(section.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="flex-1 text-2xl font-bold bg-gray-900 border border-blue-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    if (editedTitle.trim()) {
                      const sections = project?.sections || [];
                      const convertedContent = convertReferencesToIds(section.content || '', sections);
                      editSection(projectId, sectionId, editedTitle.trim(), convertedContent, undefined, undefined);
                      setIsEditingTitle(false);
                    }
                  }}
                  className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition-colors"
                >
                  ✓ {t('common.save')}
                </button>
                <button
                  onClick={() => {
                    setEditedTitle(section.title);
                    setIsEditingTitle(false);
                  }}
                  className="bg-gray-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-gray-500 transition-colors"
                >
                  ✕ {t('common.cancel')}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="color"
                    value={sectionColor}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      setSectionColor(newColor);
                      editSection(projectId, sectionId, section.title, section.content, undefined, newColor);
                    }}
                    className="h-8 w-8 border border-gray-600 rounded cursor-pointer bg-gray-900"
                    title="Cor no mapa mental"
                  />
                  {section?.color && (
                    <button
                      onClick={() => {
                        setSectionColor("#3b82f6");
                        editSection(projectId, sectionId, section.title, section.content, undefined, undefined);
                      }}
                      className="h-8 px-2 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                      title="Resetar para cor padrão do nível"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5.636 18.364A9 9 0 003.05 9m17.9 6a9 9 0 00-2.586-9.364" />
                      </svg>
                    </button>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{section.title}</h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-300 transition-opacity text-xl shrink-0"
                  title="Editar nome da seção"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h-5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 14l-4 1 1-4 7.5-7.5z" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Direita: ações (IA, mapa mental, documento, mover, excluir) */}
          <div className="relative flex items-center gap-2 shrink-0">
            {!inlineEdit && !isEditingTitle && (
              <>
                <button
                  onClick={() => setShowAddonMenu((prev: boolean) => !prev)}
                  className={`h-8 w-8 flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                    showAddonMenu ? "bg-cyan-600 text-white" : "bg-gray-700 text-gray-100 hover:bg-gray-600"
                  }`}
                  title="Adicionar addon nesta pagina"
                  aria-expanded={showAddonMenu}
                  aria-haspopup="true"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                {showAddonMenu && (
                  <>
                    <div className="absolute right-0 top-10 z-50 w-52 rounded-lg border border-gray-600 bg-gray-800 shadow-xl py-1" role="menu">
                      <button
                        type="button"
                        onClick={() => {
                          onAddBalanceAddon();
                          setShowAddonMenu(false);
                        }}
                        className="w-full text-left rounded px-3 py-2 text-sm text-gray-100 hover:bg-gray-700 flex items-center gap-2"
                        role="menuitem"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                        </svg>
                        Balanceamento
                      </button>
                    </div>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAddonMenu(false)} aria-hidden />
                  </>
                )}
                <button
                  onClick={handleImproveWithAI}
                  disabled={isImproving || !hasValidConfig}
                  className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title={hasValidConfig ? "Melhorar conteúdo com IA preservando imagens e links" : "Configure sua API key em Configurações de IA"}
                >
                  {isImproving ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l1.8 4.8L19 9.6l-4.1 3.2L16.2 18 12 15l-4.2 3 1.3-5.2L5 9.6l5.2-1.8L12 3z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => router.push(`/projects/${projectId}/mindmap?focus=${sectionId}`)}
                  className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Ver no mapa mental"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16M8 4a16 16 0 000 16m8-16a16 16 0 010 16" />
                  </svg>
                </button>
                <button
                  onClick={() => router.push(`/projects/${projectId}/view?focus=${encodeURIComponent(sectionId)}#section-${sectionId}`)}
                  className="w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                  title={t('sectionDetail.actions.goToDocument')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h7l5 5v13a1 1 0 01-1 1H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v6h6M9 13h6M9 17h6" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowMoveModal(true)}
                  className="w-8 h-8 flex items-center justify-center bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
                  title="Mover seção para outro local"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M10 7h7v7" />
                  </svg>
                </button>
              </>
            )}
            {!isEditingTitle && (
              <button
                className="w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                onClick={() => {
                  const count = countDescendants(projectId, sectionId);
                  const msg = count > 0 
                    ? t('sectionDetail.confirmDeleteWithChildren').replace('{count}', String(count))
                    : t('sectionDetail.confirmDelete');
                  if (window.confirm(msg)) {
                    const parentId = section?.parentId;
                    removeSection(projectId, sectionId);
                    if (parentId) {
                      router.push(`/projects/${projectId}/sections/${parentId}`);
                    } else {
                      router.push(`/projects/${projectId}`);
                    }
                  }
                }}
                title={t('sectionDetail.actions.deleteSection')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12h8l1-12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Domínio / Sistemas (modelo de game design para IA e relações) */}
      {section && !inlineEdit && (
        <div className="max-w-6xl mx-auto px-4 md:px-6 mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-400">{t("sectionDetail.domain.label")}:</span>
          {GAME_DESIGN_DOMAIN_IDS.map((id) => {
            const current = section?.domainTags ?? [];
            const isSelected = current.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const next = isSelected
                    ? current.filter((t: string) => t !== id)
                    : normalizeDomainTags([...current, id]);
                  editSection(projectId, sectionId, section.title, section.content ?? "", undefined, undefined, next);
                  setSection({ ...section, domainTags: next.length ? next : undefined });
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-300"
                }`}
              >
                {t(`sectionDetail.domain.${id}`)}
              </button>
            );
          })}
          <button
            type="button"
            disabled={suggestDomainLoading || !hasValidConfig}
            onClick={async () => {
              if (!section || !hasValidConfig) return;
              setSuggestDomainLoading(true);
              try {
                const res = await fetch("/api/ai/suggest-domain-tags", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAIHeaders() },
                  body: JSON.stringify({
                    sectionTitle: section.title,
                    sectionContent: (section.content || "").slice(0, 2000),
                    existingTags: section.domainTags,
                  }),
                });
                const data = await res.json();
                if (res.ok && Array.isArray(data.suggestedTags) && data.suggestedTags.length > 0) {
                  const next = normalizeDomainTags(data.suggestedTags);
                  editSection(projectId, sectionId, section.title, section.content ?? "", undefined, undefined, next);
                  setSection({ ...section, domainTags: next });
                }
              } catch (e) {
                console.error("Suggest domain tags:", e);
              } finally {
                setSuggestDomainLoading(false);
              }
            }}
            className="ml-2 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {suggestDomainLoading ? t("sectionDetail.domain.suggesting") : t("sectionDetail.domain.suggestWithAI")}
          </button>
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
          className="max-w-6xl mx-auto mb-4 bg-gray-800/70 border border-gray-700/80 rounded-2xl p-4 md:p-5"
          onDoubleClick={() => setInlineEdit(true)}
        >
          {section.content ? (
            <MarkdownWithReferences 
              content={section.content} 
              projectId={projectId} 
              sections={project?.sections || []} 
            />
          ) : (
            <p className="text-gray-400">{t('projectDetail.noDescription')}</p>
          )}
          {(section?.created_by_name != null || section?.created_at != null || section?.updated_by_name != null || section?.updated_at != null) && (
            <div className="mt-4 pt-3 border-t border-gray-700/80 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              {section?.created_by_name != null && section?.created_at != null && (
                <span>{t("sectionDetail.audit.createdBy").replace("{{name}}", section.created_by_name).replace("{{date}}", new Date(section.created_at).toLocaleString())}</span>
              )}
              {section?.updated_by_name != null && section?.updated_at != null && (
                <span>{t("sectionDetail.audit.updatedBy").replace("{{name}}", section.updated_by_name).replace("{{date}}", new Date(section.updated_at).toLocaleString())}</span>
              )}
              {section?.created_by_name == null && section?.created_at != null && (
                <span>{t("sectionDetail.audit.createdAt").replace("{{date}}", new Date(section.created_at).toLocaleString())}</span>
              )}
              {section?.updated_by_name == null && section?.updated_at != null && section?.created_at !== section?.updated_at && (
                <span>{t("sectionDetail.audit.updatedAt").replace("{{date}}", new Date(section.updated_at).toLocaleString())}</span>
              )}
            </div>
          )}
        </div>
      )}
      {!inlineEdit && balanceAddons.length > 0 && (
        <div className="max-w-6xl mx-auto mb-4 space-y-3">
          {balanceAddons.map((addon: BalanceAddonDraft) => (
            <div key={addon.id} className="rounded-2xl border border-cyan-800/60 bg-gray-900/70 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAddonCollapsed(`balance:${addon.id}`)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-800/70 transition-colors"
                aria-expanded={!(collapsedAddonKeys[`balance:${addon.id}`] ?? true)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-cyan-200 truncate">{addon.name || "Addon de balanceamento"}</p>
                  <p className="text-xs text-gray-400">Balanceamento</p>
                </div>
                <span
                  className="text-gray-300 shrink-0 transition-transform duration-200"
                  style={{ transform: (collapsedAddonKeys[`balance:${addon.id}`] ?? true) ? "rotate(0deg)" : "rotate(180deg)" }}
                >
                  ▼
                </span>
              </button>
              {!(collapsedAddonKeys[`balance:${addon.id}`] ?? true) && (
                <div className="border-t border-cyan-900/50 p-3">
                  <BalanceAddonPanel
                    addon={addon}
                    onChange={(nextAddon) => onUpdateBalanceAddon(addon.id, nextAddon)}
                    onRemove={() => onRemoveBalanceAddon(addon.id)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Histórico de versões (colapsável) */}
      <div className="max-w-6xl mx-auto mb-4 bg-gray-800/70 border border-gray-700/80 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setHistoryExpanded((e) => !e)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-700/50 transition-colors"
          aria-expanded={historyExpanded}
        >
          <span className="text-sm font-semibold text-gray-200">
            {t("sectionDetail.history.title")}
            {!sectionVersionsLoading && sectionVersions.length > 0 && (
              <span className="text-gray-500 font-normal ml-1">
                ({sectionVersions.length} {sectionVersions.length === 1 ? t("sectionDetail.history.versionOne") : t("sectionDetail.history.versionMany")})
              </span>
            )}
          </span>
          <span className="text-gray-400 shrink-0 transition-transform duration-200" style={{ transform: historyExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
            ▼
          </span>
        </button>
        {historyExpanded && (
          <div className="px-4 pb-4 pt-0 border-t border-gray-700/80">
        {sectionVersionsLoading ? (
          <p className="text-xs text-gray-500 pt-2">{t("sectionDetail.history.loading")}</p>
        ) : sectionVersions.length === 0 ? (
          <p className="text-xs text-gray-500 pt-2">{t("sectionDetail.history.empty")}</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-auto pt-2">
            {sectionVersions.map((v: { id: string; title: string; content: string; color?: string | null; created_at: string; updated_by_name?: string | null }) => {
              const contentPreview = (v.content || "").replace(/\s+/g, " ").trim().slice(0, 80);
              return (
              <li
                key={v.id}
                className="flex flex-wrap items-start justify-between gap-2 text-xs bg-gray-900/60 border border-gray-700 rounded-lg px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-gray-300 truncate">
                    {new Date(v.created_at).toLocaleString()}
                    {(v.updated_by_name != null && v.updated_by_name !== "") && (
                      <span className="text-gray-500 ml-1">
                        {t("sectionDetail.history.by").replace("{{name}}", v.updated_by_name)}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-400 font-medium truncate mt-0.5" title={v.title}>
                    {(v.title && v.title.trim()) || t("sectionDetail.history.untitled")}
                  </div>
                  {contentPreview ? (
                    <div className="text-gray-500 truncate mt-0.5" title={v.content}>
                      {contentPreview}{v.content.length > 80 ? "…" : ""}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={restoreVersionId !== null}
                  onClick={async () => {
                    if (!v.id) return;
                    setRestoreVersionId(v.id);
                    try {
                      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/restore`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ versionId: v.id }),
                        credentials: "include",
                      });
                      if (res.ok) {
                        editSection(projectId, sectionId, v.title, v.content, undefined, v.color ?? undefined);
                        setSection((prev: any) => (prev ? { ...prev, title: v.title, content: v.content, color: v.color ?? prev.color, updated_at: new Date().toISOString(), updated_by_name: profile?.display_name ?? user?.email ?? null } : null));
                        const data = await fetch(`/api/projects/${encodeURIComponent(projectId)}/sections/${encodeURIComponent(sectionId)}/versions`, { credentials: "include" }).then((r) => r.ok ? r.json() : { versions: [] });
                        if (Array.isArray(data?.versions)) setSectionVersions(data.versions);
                      }
                    } finally {
                      setRestoreVersionId(null);
                    }
                  }}
                  className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  {restoreVersionId === v.id ? t("sectionDetail.history.restoring") : t("sectionDetail.history.restore")}
                </button>
              </li>
            );
            })}
          </ul>
        )}
          </div>
        )}
      </div>

      {showPageRefsPanel && (
        <UnresolvedRefsPanel
          unresolvedNames={unresolvedFromPage.unresolvedNames}
          hasProjectTitleRef={unresolvedFromPage.hasProjectTitleRef}
          projectTitle={project?.title || ""}
          onRemoveProjectRefFromSection={() => {
            const projectTitle = project?.title || "";
            if (!section?.content || !projectTitle) return;
            const re = new RegExp(`\\$\\[${escapeRegExp(projectTitle)}\\]`, "gi");
            const newContent = section.content.replace(re, projectTitle);
            editSection(projectId, sectionId, section.title, newContent, undefined, undefined);
            setSection({ ...section, content: newContent });
          }}
          projectId={projectId}
          sectionId={sectionId}
          sections={sections || []}
          currentContextPath={getBreadcrumb(sectionId, sections || [])}
          addSection={addSection}
          addSubsection={addSubsection}
          getAIHeaders={getAIHeaders}
          router={router}
          onLimitError={(msg) => setNameError(msg)}
          onAiError={setImproveError}
          hasDuplicateName={hasDuplicateName}
        />
      )}

      {inlineEdit && (
        <div className="max-w-6xl mx-auto mb-3 bg-gray-800/70 border border-gray-700/80 rounded-2xl p-4 md:p-5">
          {!isFullscreen && (
            <div className="flex items-center gap-2 mb-2 justify-end">
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1 border border-gray-700">
                <button
                  onClick={() => setEditorHeight((prev: string) => {
                    const current = parseInt(prev);
                    return `${Math.max(200, current - 100)}px`;
                  })}
                  className="text-gray-300 hover:text-white font-bold"
                  title="Diminuir altura"
                >
                  −
                </button>
                <span className="text-sm text-gray-300 min-w-[60px] text-center">
                  {editorHeight}
                </span>
                <button
                  onClick={() => setEditorHeight((prev: string) => {
                    const current = parseInt(prev);
                    return `${current + 100}px`;
                  })}
                  className="text-gray-300 hover:text-white font-bold"
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
                ⤢ {t('sectionDetail.actions.fullscreen')}
              </button>
            </div>
          )}
          <div ref={(el) => { editorContainerRef.current = el; setContainerEl(el); }} />
          <div className="mt-2 flex gap-2">
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg transition-colors"
              onClick={() => {
                const md = (editorRef as any).current?.getMarkdown?.() || "";
                const sections = project?.sections || [];
                const convertedMd = convertReferencesToIds(md, sections);
                editSection(projectId, sectionId, section.title, convertedMd, undefined, undefined);
                setInlineEdit(false);
              }}
            >Salvar</button>
            <button
              className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-lg transition-colors"
              onClick={() => setInlineEdit(false)}
            >{t('common.cancel')}</button>
            <button
              className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-lg text-sm transition-colors"
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
          {/* Desktop grande: painel lateral fixo para navegação rápida entre subseções */}
          <div className="hidden 2xl:block fixed left-4 top-24 w-80 z-20 max-h-[calc(100vh-7rem)] overflow-y-auto overflow-x-hidden">
            {subsectionsPanel}
          </div>

          {/* Telas menores: mantém bloco abaixo para evitar sobreposição */}
          <div className="2xl:hidden max-w-6xl mx-auto mt-6">
            {subsectionsPanel}
          </div>
        </>
      )}

      {/* Modal de Preview da IA */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col text-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l1.8 4.8L19 9.6l-4.1 3.2L16.2 18 12 15l-4.2 3 1.3-5.2L5 9.6l5.2-1.8L12 3z" />
                </svg>
                Preview do Conteúdo Melhorado
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                Revise o conteúdo e confirme ou solicite modificações
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {improveError && (
                <div className="mb-4 p-3 bg-amber-900/30 border border-amber-600 rounded-lg text-amber-200 text-sm">
                  {improveError}
                </div>
              )}

              <div className="prose prose-sm prose-invert max-w-none bg-gray-800/70 rounded-lg p-6 border border-gray-700 text-gray-100">
                <MarkdownWithReferences 
                  content={previewContent} 
                  projectId={projectId} 
                  sections={project?.sections || []} 
                />
              </div>

              <div className="mt-4 space-y-4">
                <UnresolvedRefsPanel
                  unresolvedNames={unresolvedNames}
                  hasProjectTitleRef={hasProjectTitleRef}
                  projectTitle={project?.title || ""}
                  previewContent={previewContent || ""}
                  setPreviewContent={setPreviewContent}
                  projectId={projectId}
                  sectionId={sectionId}
                  sections={sections || []}
                  currentContextPath={getBreadcrumb(sectionId, sections || [])}
                  addSection={addSection}
                  addSubsection={addSubsection}
                  getAIHeaders={getAIHeaders}
                  router={router}
                  onLimitError={(msg) => setNameError(msg)}
                  onAiError={setImproveError}
                  hasDuplicateName={hasDuplicateName}
                />
              </div>
            </div>

            {/* Footer com ações */}
            <div className="border-t border-gray-700 p-6 bg-gray-900/90">
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-200 mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h-5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 14l-4 1 1-4 7.5-7.5z" />
                  </svg>
                  Solicitar modificações (opcional):
                </label>
                <textarea
                  value={modificationRequest}
                  onChange={(e) => setModificationRequest(e.target.value)}
                  placeholder="Ex: Adicione mais exemplos práticos, reduza o texto, foque mais em mecânicas..."
                  className="w-full bg-gray-800 border border-gray-600 text-white placeholder:text-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-20"
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelImprovement}
                  disabled={isImproving}
                  className="px-6 py-3 border border-gray-600 text-gray-200 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {t('common.cancel')}
                </button>
                
                <button
                  onClick={handleRequestModification}
                  disabled={isImproving || !modificationRequest.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isImproving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <span>{t('sectionDetail.ai.modifying')}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5.636 18.364A9 9 0 003.05 9m17.9 6a9 9 0 00-2.586-9.364" />
                      </svg>
                      <span>{t('sectionDetail.ai.modify')}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleConfirmImprovement}
                  disabled={isImproving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t('sectionDetail.ai.confirmApply')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mover Seção */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-gray-900 border border-gray-700 text-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M10 7h7v7" />
                  </svg>
                  Mover Seção
                </h2>
                <button
                  onClick={() => {
                    setShowMoveModal(false);
                    setSelectedNewParent(null);
                  }}
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-gray-300 mt-2">
                Mover "<strong>{section?.title}</strong>" para outro local
              </p>
            </div>

            {/* Body - Árvore de seções */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-1">
                {/* Opção: Raiz (sem pai) */}
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedNewParent === 'root'
                      ? 'bg-blue-900/40 border-2 border-blue-500'
                      : 'bg-gray-800 hover:bg-gray-700 border-2 border-transparent'
                  }`}
                >
                  <input
                    type="radio"
                    name="newParent"
                    value="root"
                    checked={selectedNewParent === 'root'}
                    onChange={() => setSelectedNewParent('root')}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-100">📁 Raiz do Projeto</div>
                    <div className="text-xs text-gray-400">{t('sectionDetail.move.makeRoot')}</div>
                  </div>
                </label>

                {/* Renderizar árvore de seções */}
                {sections
                  .filter((s: any) => !s.parentId && s.id !== sectionId) // Seções raiz, exceto a atual
                  .map((s: any) => (
                    <SectionTreeItem
                      key={s.id}
                      section={s}
                      allSections={sections}
                      currentSectionId={sectionId}
                      selectedParent={selectedNewParent}
                      onSelect={setSelectedNewParent}
                      level={0}
                    />
                  ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setSelectedNewParent(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-200 rounded-lg hover:bg-gray-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleMoveSection}
                disabled={!selectedNewParent}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('sectionDetail.move.move')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para renderizar item da árvore de seções no modal
function SectionTreeItem({ 
  section, 
  allSections, 
  currentSectionId, 
  selectedParent, 
  onSelect, 
  level 
}: { 
  section: any; 
  allSections: any[]; 
  currentSectionId: string; 
  selectedParent: string | null; 
  onSelect: (id: string) => void; 
  level: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Pegar filhos
  const children = allSections.filter(s => s.parentId === section.id);
  
  // Verificar se esta seção é descendente da seção atual (não pode ser selecionada)
  function isDescendantOf(childId: string, ancestorId: string, sections: any[]): boolean {
    const child = sections.find(s => s.id === childId);
    if (!child || !child.parentId) return false;
    if (child.parentId === ancestorId) return true;
    return isDescendantOf(child.parentId, ancestorId, sections);
  }
  
  const isDisabled = section.id === currentSectionId || isDescendantOf(section.id, currentSectionId, allSections);
  const hasChildren = children.length > 0;
  const indent = level * 24; // 24px por nível
  
  return (
    <div>
      <label
        className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
          isDisabled
            ? 'opacity-40 cursor-not-allowed'
            : selectedParent === section.id
              ? 'bg-blue-900/40 border-2 border-blue-500 cursor-pointer'
              : 'bg-gray-800 hover:bg-gray-700 border-2 border-transparent cursor-pointer'
        }`}
        style={{ marginLeft: `${indent}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }}
            className="text-gray-300 hover:text-white font-bold w-4 text-sm"
          >
            {isExpanded ? '−' : '+'}
          </button>
        )}
        {!hasChildren && <span className="w-4"></span>}
        
        <input
          type="radio"
          name="newParent"
          value={section.id}
          checked={selectedParent === section.id}
          onChange={() => !isDisabled && onSelect(section.id)}
          disabled={isDisabled}
          className="w-4 h-4"
        />
        <div className="flex-1">
          <div className={`text-sm ${isDisabled ? 'text-gray-500' : 'text-gray-100 font-medium'}`}>
            {section.title}
            {isDisabled && section.id === currentSectionId && (
              <span className="ml-2 text-xs text-amber-400">(seção atual)</span>
            )}
            {isDisabled && section.id !== currentSectionId && (
              <span className="ml-2 text-xs text-amber-400">(descendente)</span>
            )}
          </div>
        </div>
      </label>
      
      {/* Renderizar filhos se expandido */}
      {hasChildren && isExpanded && children.map(child => (
        <SectionTreeItem
          key={child.id}
          section={child}
          allSections={allSections}
          currentSectionId={currentSectionId}
          selectedParent={selectedParent}
          onSelect={onSelect}
          level={level + 1}
        />
      ))}
    </div>
  );
}

// Componente de Backlinks (seções que referenciam esta)
function BacklinksSection({ projectId, sectionId, sections, router }: any) {
  const { t } = useI18n();
  const backlinks = getBacklinks(sectionId, sections);

  if (backlinks.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto mt-6 mb-4 p-4 bg-blue-900/20 rounded-xl border border-blue-700/50">
      <h3 className="text-sm font-semibold text-blue-200 mb-2 flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14L21 3m-6 0h6v6M14 10L3 21m0-6v6h6" />
        </svg>
        <span>{t('sectionDetail.backlinks')}</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {backlinks.map((link, index) => (
          <span key={link.id} className="inline-flex items-center">
            <button
              onClick={() => router.push(`/projects/${projectId}/sections/${link.id}`)}
              className="text-blue-300 hover:text-blue-200 hover:underline text-sm font-medium"
            >
              {link.title}
            </button>
            {index < backlinks.length - 1 && <span className="text-blue-500 ml-1">,</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// Nota: O autocomplete é renderizado no componente principal via <AutocompleteDropdown />