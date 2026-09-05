"use client";

import { useProjectStore } from "@/store/projectStore";
import { toSlug, projectPath, sectionPath, sectionPathById } from "@/lib/utils/slug";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import PageModeLinks from "@/components/project/PageModeLinks";
import { SectionPickerModal, SECTION_PICKER_ROOT } from "@/components/SectionPickerModal";
import { getBacklinks, convertReferencesToIds, convertReferencesToNames, convertBlockRefsToNames, extractSectionReferences, findSection } from "@/utils/sectionReferences";
import { getSectionAiContent } from "@/utils/sectionAiContent";
import {
  driveFileIdToImageUrl,
  getDriveImageDisplayCandidates,
  getGoogleClientId,
  normalizeDriveUrlsInMarkdown,
  openGoogleDriveImagePicker,
} from "@/lib/googleDrivePicker";
import { useAIConfig } from "@/hooks/useAIConfig";
import SectionTasksPanel from "@/components/agenda/SectionTasksPanel";
import StatusPicker from "@/components/pageStatus/StatusPicker";
import StaleNotice from "@/components/pageStatus/StaleNotice";
import SectionDescriptionEditor, { isRichDocEmpty } from "@/components/SectionDescriptionEditor";
import SectionDescriptionReadOnly from "@/components/SectionDescriptionReadOnly";
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
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useI18n } from "@/lib/i18n/provider";
import { ImageLibraryPicker } from "@/components/common/ImageLibraryPicker";
import type { ProjectImage } from "@/store/slices/types";
import { GAME_DESIGN_DOMAIN_IDS, normalizeDomainTags } from "@/lib/gameDesignDomains";
import EmojiQuickPicker from "@/components/EmojiQuickPicker";
import { appendEmojiWithSpacing } from "@/lib/emojiPresets";
import SpecialTokensHelp from "@/components/SpecialTokensHelp";
import { normalizeSpecialTokenSyntax } from "@/lib/sections/specialTokens";

interface Props {
  projectId: string;
  sectionId: string;
  /** Quando true, abre direto no modo edição inline (ex.: vindo de /sections/[id]/edit) */
  openEdit?: boolean;
}

type SectionVersionEntry = {
  id: string;
  title: string;
  content: string;
  color?: string | null;
  sort_order?: number | null;
  created_at: string;
  updated_by_name?: string | null;
};

export default function SectionDetailClient({ projectId, sectionId, openEdit = false }: Props) {
  const { t } = useI18n();
  const { user, profile } = useAuthStore();
  const { hasValidConfig, getAIHeaders } = useAIConfig();
  const getProjectBySlug = useProjectStore((s) => s.getProjectBySlug);
  const removeSection = useProjectStore((s) => s.removeSection);
  const addSection = useProjectStore((s) => s.addSection);
  const addSubsection = useProjectStore((s) => s.addSubsection);
  const duplicateSection = useProjectStore((s) => s.duplicateSection);
  const countDescendants = useProjectStore((s) => s.countDescendants);
  const hasDuplicateName = useProjectStore((s) => s.hasDuplicateName);
  const reorderSections = useProjectStore((s) => s.reorderSections);
  const editSection = useProjectStore((s) => s.editSection);
  const updateSectionDescription = useProjectStore((s) => s.updateSectionDescription);
  const setSectionThumbImage = useProjectStore((s) => s.setSectionThumbImage);
  const setSectionFlowchartEnabled = useProjectStore((s) => s.setSectionFlowchartEnabled);
  const disableSectionFlowchartAndClearDiagram = useProjectStore((s) => s.disableSectionFlowchartAndClearDiagram);
  const projects = useProjectStore((s) => s.projects);
  // Limites efetivos do usuário logado (já com overrides individuais).
  const { FREE_MAX_SECTIONS_PER_PROJECT } = useProjectStore((s) => s.appLimits);
  const lastSyncedAt = useProjectStore((s) => s.lastSyncedAt);
  const lastSyncStats = useProjectStore((s) => s.lastSyncStats);

  const sectionAuditBy = user ? { userId: user.id, displayName: profile?.display_name ?? user.email ?? null } : undefined;
  const [section, setSection] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  // Tracks the UUID of the last successfully resolved section so we can survive a title rename
  // without flashing the "not found" page while the URL updates.
  const lastKnownSectionUUIDRef = useRef<string | null>(null);
  const realProjectId = project?.id ?? "";
  const realSectionId = section?.id ?? "";
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [nameError, setNameError] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [inlineEdit, setInlineEdit] = useState(false);
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
  const [showMoveChildrenModal, setShowMoveChildrenModal] = useState(false);
  const [sectionVersions, setSectionVersions] = useState<SectionVersionEntry[]>([]);
  const [sectionVersionsLoading, setSectionVersionsLoading] = useState(false);
  const [restoreVersionId, setRestoreVersionId] = useState<string | null>(null);
  const [suggestDomainLoading, setSuggestDomainLoading] = useState(false);

  // Page-level keyboard shortcuts. Bail when focus is on an editable field so
  // native keys (italic, etc.) keep working in inputs and the Toast UI editor.
  //   Ctrl+M         → open "move section" modal (Ctrl+Shift+M on Mac, to avoid Cmd+M minimize)
  //   Ctrl+D         → duplicate page (overrides browser bookmark — confirmed with user)
  const duplicateRef = useRef<() => void>(() => {});
  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    const handler = (event: KeyboardEvent) => {
      const usesMeta = event.ctrlKey || event.metaKey;
      if (!usesMeta) return;
      if (event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target.isContentEditable) return;
      if (target.closest?.(".toastui-editor, .ProseMirror, .CodeMirror, .cm-editor")) return;

      const key = event.key.toLowerCase();
      // Ctrl+M (or Ctrl+Shift+M on Mac) → move section modal
      const wantsShift = isMac;
      if (key === "m" && event.shiftKey === wantsShift) {
        event.preventDefault();
        setShowMoveModal(true);
        return;
      }
      // Ctrl+D (Cmd+D on Mac) → duplicate page
      if (key === "d" && !event.shiftKey) {
        event.preventDefault();
        duplicateRef.current();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const [isPickingSectionThumb, setIsPickingSectionThumb] = useState(false);
  const [showThumbLibrary, setShowThumbLibrary] = useState(false);
  const [sectionThumbError, setSectionThumbError] = useState("");
  const [sectionThumbCandidateIndex, setSectionThumbCandidateIndex] = useState(0);
  const router = useRouter();

  const sections = project?.sections || [];
  const sectionThumbCandidates = useMemo(
    () => getDriveImageDisplayCandidates(section?.thumbImageUrl || "", 240),
    [section?.thumbImageUrl]
  );


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
          content: String(s.content || ''),
          pageTypeId: s.pageTypeId ? String(s.pageTypeId) : undefined,
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
          otherSections: otherSections,
          pageTypeId: (section as any).pageTypeId ? String((section as any).pageTypeId) : undefined,
          projectDescription: project?.description ? String(project.description) : undefined,
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
    
    // Aplica o conteúdo melhorado. Limpa contentBlocks (no store via editSection
    // e no estado local) — a descrição passa a vir do markdown melhorado; os
    // blocks antigos seriam exibidos pela leitura, ignorando a melhoria.
    editSection(realProjectId, realSectionId,section.title, previewContent, undefined, undefined, sectionAuditBy);
    setSection({ ...section, content: previewContent, contentBlocks: undefined });
    
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


  function handleDuplicateSection() {
    if (!section || !project) return;
    const suffix = t("sectionDetail.duplicate.copySuffix", " (cópia)");
    const outcome = duplicateSection(realProjectId, realSectionId,suffix, sectionAuditBy);

    if (!outcome.newRootId) {
      alert(
        t("sectionDetail.duplicate.blockedPerProject", "").replace(
          "{max}",
          String(FREE_MAX_SECTIONS_PER_PROJECT)
        )
      );
      return;
    }

    if (outcome.skipped.length > 0) {
      const max = FREE_MAX_SECTIONS_PER_PROJECT;
      const key = "sectionDetail.duplicate.partialPerProject";
      const total = outcome.duplicated.length + outcome.skipped.length;
      const titles = outcome.duplicated.map((d) => `"${d.title}"`).join(", ");
      const skippedTitles = outcome.skipped.map((d) => `"${d.title}"`).join(", ");
      alert(
        t(key, "")
          .replace("{max}", String(max))
          .replace("{count}", String(outcome.duplicated.length))
          .replace("{total}", String(total))
          .replace("{titles}", titles)
          .replace("{skippedTitles}", skippedTitles)
      );
    }

    const updatedProject = getProjectBySlug(projectId) ?? project;
    router.push(sectionPathById(updatedProject ?? { title: "", sections: [] }, outcome.newRootId));
  }

  duplicateRef.current = handleDuplicateSection;

  // Função para mover a seção
  function handleMoveSection(target: string) {
    if (!section || !project) return;

    const newParentId = target === SECTION_PICKER_ROOT ? null : target;

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
    editSection(realProjectId, realSectionId,section.title, section.content, newParentId, section.color, sectionAuditBy);

    // Fechar modal
    setShowMoveModal(false);
  }

  function handleMoveChildren(target: string) {
    if (!section || !project) return;
    const newParentId = target === SECTION_PICKER_ROOT ? null : target;
    const directChildren = sections.filter((s: any) => s.parentId === realSectionId);
    for (const child of directChildren) {
      editSection(realProjectId, child.id, child.title, child.content ?? '', newParentId, child.color, sectionAuditBy);
    }
    setShowMoveChildrenModal(false);
  }

  /** Grava o ícone da página a partir de um arquivo do Drive. */
  function applySectionThumb(fileId: string) {
    const nextThumb = driveFileIdToImageUrl(fileId);
    setSectionThumbImage(realProjectId, realSectionId, nextThumb);
    setSectionThumbCandidateIndex(0);
    setSection((prev: any) => (prev ? { ...prev, thumbImageUrl: nextThumb } : prev));
  }

  /**
   * Se o projeto tem biblioteca indexada, abre a grade interna — bem mais rápido
   * que o picker do Google. Sem biblioteca, cai no picker como antes.
   */
  function handlePickSectionThumb() {
    if (project?.imageLibrary?.files?.length) {
      setShowThumbLibrary(true);
      return;
    }
    return pickSectionThumbFromDrive();
  }

  async function pickSectionThumbFromDrive() {
    if (!section || isPickingSectionThumb) return;
    setSectionThumbError("");
    setIsPickingSectionThumb(true);
    try {
      const googleClientId = await getGoogleClientId();
      if (!googleClientId) {
        setSectionThumbError(t("sectionDetail.thumbnail.missingGoogleConfig"));
        return;
      }
      const picked = await openGoogleDriveImagePicker(googleClientId);
      if (!picked?.id) return;
      applySectionThumb(picked.id);
    } catch {
      setSectionThumbError(t("sectionDetail.thumbnail.pickFailed"));
    } finally {
      setIsPickingSectionThumb(false);
    }
  }

  useEffect(() => {
    const proj = getProjectBySlug(projectId);
    setProject(proj || null);
    let sec = proj?.sections?.find((s: any) => toSlug(s.title) === sectionId);

    // Slug lookup failed — could be a title rename that updated the store before the URL changed.
    // Fall back to the last known UUID so we don't flash "not found" while navigating.
    if (!sec && lastKnownSectionUUIDRef.current && proj) {
      const renamed = proj.sections?.find((s: any) => s.id === lastKnownSectionUUIDRef.current);
      if (renamed) {
        router.replace(sectionPath(proj, renamed));
        return;
      }
    }

    if (sec) lastKnownSectionUUIDRef.current = sec.id;
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
  }, [projectId, sectionId, getProjectBySlug, projects, router]);

  useEffect(() => {
    setSectionThumbCandidateIndex(0);
  }, [section?.thumbImageUrl]);

  // Buscar histórico de versões da seção (após carregar)
  useEffect(() => {
    if (!loaded || !realProjectId || !realSectionId) return;
    let cancelled = false;
    setSectionVersionsLoading(true);
    fetch(`/api/projects/${encodeURIComponent(realProjectId)}/sections/${encodeURIComponent(realSectionId)}/versions`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { versions: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.versions)) setSectionVersions(data.versions);
      })
      .catch(() => { if (!cancelled) setSectionVersions([]); })
      .finally(() => { if (!cancelled) setSectionVersionsLoading(false); });
    return () => { cancelled = true; };
  }, [loaded, realProjectId, realSectionId]);

  // Atualizar histórico quando um sync deste projeto termina (novo ponto de versão pode ter sido criado)
  useEffect(() => {
    if (!loaded || !realProjectId || !realSectionId || !lastSyncedAt || !lastSyncStats || lastSyncStats.projectId !== realProjectId) return;
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(realProjectId)}/sections/${encodeURIComponent(realSectionId)}/versions`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { versions: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.versions)) setSectionVersions(data.versions);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loaded, realProjectId, realSectionId, lastSyncedAt, lastSyncStats]);

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
    reorderSections(realProjectId, newOrder);
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
                  className="min-w-0 flex-1 text-left text-blue-300 hover:text-blue-200 break-words"
                  onClick={() => router.push(sectionPathById(project ?? { title: "", sections: [] }, sub.id))}
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
  if (!section) return <div className="min-h-screen bg-gray-900 text-white p-6">{t('sectionDetail.notFound')} <button className="ml-2 px-3 py-1 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors" onClick={() => project ? router.push(projectPath(project)) : router.push("/")}>{t('common.back')}</button></div>;

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
    updateSectionDescription={(pid: string, sid: string, blocks: any[], md: string) => updateSectionDescription(pid, sid, blocks, md, sectionAuditBy)}
    inlineEdit={inlineEdit}
    setInlineEdit={setInlineEdit}
    editorRef={editorRef}
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
    handleMoveSection={handleMoveSection}
    showMoveChildrenModal={showMoveChildrenModal}
    setShowMoveChildrenModal={setShowMoveChildrenModal}
    handleMoveChildren={handleMoveChildren}
    handleDuplicateSection={handleDuplicateSection}
    sections={project?.sections || []}
    setSection={setSection}
    sectionVersions={sectionVersions}
    sectionVersionsLoading={sectionVersionsLoading}
    restoreVersionId={restoreVersionId}
    setSectionVersions={setSectionVersions}
    setRestoreVersionId={setRestoreVersionId}
    suggestDomainLoading={suggestDomainLoading}
    setSuggestDomainLoading={setSuggestDomainLoading}
    isPickingSectionThumb={isPickingSectionThumb}
    sectionThumbError={sectionThumbError}
    sectionThumbCandidateIndex={sectionThumbCandidateIndex}
    setSectionThumbCandidateIndex={setSectionThumbCandidateIndex}
    sectionThumbCandidates={sectionThumbCandidates}
    handlePickSectionThumb={handlePickSectionThumb}
    setSectionThumbImage={setSectionThumbImage}
    setSectionFlowchartEnabled={setSectionFlowchartEnabled}
    disableSectionFlowchartAndClearDiagram={disableSectionFlowchartAndClearDiagram}
      />
      {showThumbLibrary && project?.imageLibrary && (
        <ImageLibraryPicker
          files={project.imageLibrary.files}
          selectedName={
            project.imageLibrary.files.find((f: ProjectImage) =>
              section?.thumbImageUrl?.includes(f.fileId))?.name
          }
          onPick={(file: ProjectImage) => {
            applySectionThumb(file.fileId);
            setShowThumbLibrary(false);
          }}
          onClose={() => setShowThumbLibrary(false)}
          onUseDrivePicker={() => {
            setShowThumbLibrary(false);
            void pickSectionThumbFromDrive();
          }}
        />
      )}
    </>
  );
}

/** Retorna todos os IDs descendentes de uma seção (filhos, netos, etc.) */
function getAllDescendants(sectionId: string, allSections: any[]): string[] {
  const descendants: string[] = [];
  const children = allSections.filter((s) => s.parentId === sectionId);
  for (const child of children) {
    descendants.push(child.id);
    descendants.push(...getAllDescendants(child.id, allSections));
  }
  return descendants;
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
  projectDescription,
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
  projectDescription?: string;
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
        onLimitError(t("limits.sectionsPerProject"));
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
          projectDescription,
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
              onLimitError(t("limits.sectionsPerProject"));
            } else {
              throw e;
            }
            setUseAILoadingFor(null);
            return;
          }
        }
      }
      if (parentId) router.push(sectionPathById({ title: projectTitle ?? "", sections: sections.map((s) => ({ id: s.id, title: s.title ?? "" })) }, parentId));
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
          className="min-w-0 flex-1 text-left text-blue-300 hover:text-blue-200 break-words"
          onClick={() => router.push(sectionPathById(project ?? { title: "", sections: [] }, sub.id))}
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
  isEditingTitle, setIsEditingTitle, editedTitle, setEditedTitle, editSection, updateSectionDescription,
  inlineEdit, setInlineEdit, editorRef,
  removeSection, countDescendants, renderSubsectionTree,
  newSubTitle, setNewSubTitle, nameError, setNameError, addSection, addSubsection, hasDuplicateName,
  router, searchTerm, setSearchTerm, expandedSections, setExpandedSections,
  editorHeight, setEditorHeight, isFullscreen, setIsFullscreen,
  isImproving, improveError, setImproveError, getAIHeaders, handleImproveWithAI,
  showPreview, previewContent, setPreviewContent, modificationRequest, setModificationRequest,
  handleConfirmImprovement, handleCancelImprovement, handleRequestModification,
  sectionColor, setSectionColor, hasValidConfig,
  showMoveModal, setShowMoveModal,
  handleMoveSection,
  showMoveChildrenModal, setShowMoveChildrenModal,
  handleMoveChildren,
  handleDuplicateSection,
  sections,
  setSection,
  sectionVersions,
  sectionVersionsLoading,
  restoreVersionId,
  setSectionVersions,
  setRestoreVersionId,
  suggestDomainLoading,
  setSuggestDomainLoading,
  isPickingSectionThumb,
  sectionThumbError,
  sectionThumbCandidateIndex,
  setSectionThumbCandidateIndex,
  sectionThumbCandidates,
  handlePickSectionThumb,
  setSectionThumbImage,
  setSectionFlowchartEnabled,
  disableSectionFlowchartAndClearDiagram,
}: any) {
  const { t } = useI18n();
  const { user, profile } = useAuthStore();
  const realProjectId: string = project?.id ?? projectId ?? "";
  const realSectionId: string = section?.id ?? sectionId ?? "";
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const buildVersionChangeSummary = (current: SectionVersionEntry, previous?: SectionVersionEntry): string | null => {
    if (!previous) return null;
    const labels: string[] = [];
    const seen = new Set<string>();
    const pushUnique = (value: string) => {
      const normalized = value.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      labels.push(value.trim());
    };

    if ((current.title || "") !== (previous.title || "")) {
      pushUnique(t("sectionDetail.history.changeFacets.title"));
    }
    if ((current.content || "") !== (previous.content || "")) {
      pushUnique(t("sectionDetail.history.changeFacets.content"));
    }
    if ((current.color || null) !== (previous.color || null)) {
      pushUnique(t("sectionDetail.history.changeFacets.color"));
    }
    if (Number(current.sort_order ?? 0) !== Number(previous.sort_order ?? 0)) {
      pushUnique(t("sectionDetail.history.changeFacets.order"));
    }

    if (labels.length === 0) return null;
    const maxLabels = 6;
    const visible = labels.slice(0, maxLabels);
    const extraCount = Math.max(0, labels.length - visible.length);
    const suffix = extraCount > 0
      ? ` ${t("sectionDetail.history.moreItems").replace("{{count}}", String(extraCount))}`
      : "";
    return `${t("sectionDetail.history.modifiedPrefix")}: ${visible.join(", ")}${suffix}`;
  };
  const [isEditingDataId, setIsEditingDataId] = useState(false);
  const [dataIdDraft, setDataIdDraft] = useState("");
  const [dataIdError, setDataIdError] = useState<string | null>(null);
  const setSectionDataId = useProjectStore((s) => s.setSectionDataId);
  const hasDuplicateDataId = useProjectStore((s) => s.hasDuplicateDataId);
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
              if (val.trim() && hasDuplicateName(realProjectId, val.trim(), realSectionId)) {
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
                addSubsection(realProjectId, realSectionId, trimmed, "");
                setNewSubTitle("");
                setNameError("");
              } catch (e) {
                if (e instanceof Error && e.message.startsWith("structural_limit")) {
                  setNameError(t("limits.sectionsPerProject"));
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
      

      {!(inlineEdit && isFullscreen) && (
        <div className="max-w-6xl mx-auto flex items-center gap-4 mb-3">
          {/* Thumbnail fora do card, lateral esquerda */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={handlePickSectionThumb}
              disabled={isPickingSectionThumb}
              className={`h-24 w-24 md:h-28 md:w-28 rounded-xl overflow-hidden flex items-center justify-center transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                section?.thumbImageUrl && sectionThumbCandidateIndex < sectionThumbCandidates.length
                  ? "hover:ring-2 hover:ring-indigo-400/70"
                  : "border-2 border-dashed border-gray-600 bg-gray-900/40 hover:border-indigo-400"
              }`}
              title={t("sectionDetail.thumbnail.pickTooltip")}
              aria-label={t("sectionDetail.thumbnail.pickTooltip")}
            >
              {section?.thumbImageUrl && sectionThumbCandidateIndex < sectionThumbCandidates.length ? (
                <img
                  src={sectionThumbCandidates[sectionThumbCandidateIndex]}
                  alt={t("sectionDetail.thumbnail.alt")}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  onError={() => {
                    setSectionThumbCandidateIndex((idx: number) => idx + 1);
                  }}
                />
              ) : (
                <span className="text-[11px] text-gray-400 px-1 text-center leading-tight">
                  {isPickingSectionThumb ? t("sectionDetail.thumbnail.picking") : t("sectionDetail.thumbnail.empty")}
                </span>
              )}
            </button>
            {section?.thumbImageUrl && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSectionThumbImage(realProjectId, realSectionId,undefined);
                  setSection((prev: any) => (prev ? { ...prev, thumbImageUrl: undefined } : prev));
                  setSectionThumbCandidateIndex(0);
                }}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 text-white text-sm hover:bg-red-700 transition-colors flex items-center justify-center shadow-lg"
                title={t("sectionDetail.thumbnail.removeTooltip")}
                aria-label={t("sectionDetail.thumbnail.removeTooltip")}
              >
                ×
              </button>
            )}
          </div>

          {/* Header card à direita da imagem */}
          <div className="flex items-center justify-between gap-4 group ui-card-premium relative flex-1 min-w-0">
            <span className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-fuchsia-500/10 pointer-events-none" aria-hidden />
            {/* Esquerda: cor, título (ou edição), lápis de editar e DataID abaixo */}
            <div className="relative flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
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
                      const newTitle = editedTitle.trim();
                      editSection(realProjectId, realSectionId, newTitle, convertedContent, undefined, undefined);
                      setIsEditingTitle(false);
                      if (project && newTitle !== section.title) {
                        router.replace(sectionPath(project, { title: newTitle }));
                      }
                    } else if (e.key === 'Escape') {
                      setEditedTitle(section.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="ui-input-dark ui-focus-ring-indigo flex-1 text-2xl font-bold rounded-lg px-3 py-2 border border-indigo-500/70"
                />
                <EmojiQuickPicker
                  onSelect={(emoji) => setEditedTitle((prev: string) => appendEmojiWithSpacing(prev, emoji))}
                />
                <button
                  onClick={() => {
                    if (editedTitle.trim()) {
                      const sections = project?.sections || [];
                      const convertedContent = convertReferencesToIds(section.content || '', sections);
                      const newTitle = editedTitle.trim();
                      editSection(realProjectId, realSectionId, newTitle, convertedContent, undefined, undefined);
                      setIsEditingTitle(false);
                      if (project && newTitle !== section.title) {
                        router.replace(sectionPath(project, { title: newTitle }));
                      }
                    }
                  }}
                  className="inline-flex items-center rounded-lg border border-emerald-500/40 bg-emerald-600/85 text-white px-3 py-1 text-sm hover:bg-emerald-500 transition-colors"
                >
                  ✓ {t('common.save')}
                </button>
                <button
                  onClick={() => {
                    setEditedTitle(section.title);
                    setIsEditingTitle(false);
                  }}
                  className="inline-flex items-center rounded-lg border border-gray-500/50 bg-gray-700 text-white px-3 py-1 text-sm hover:bg-gray-600 transition-colors"
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
                      editSection(realProjectId, realSectionId,section.title, section.content, undefined, newColor);
                    }}
                    className="h-8 w-8 border border-gray-600 rounded cursor-pointer bg-gray-900/90"
                    title={t("sectionDetail.actions.mapColor")}
                  />
                  {section?.color && (
                    <button
                      onClick={() => {
                        setSectionColor("#3b82f6");
                        editSection(realProjectId, realSectionId,section.title, section.content, undefined, undefined);
                      }}
                      className="h-8 px-2 text-xs bg-gray-700/90 hover:bg-gray-600 text-white rounded border border-gray-500/40 transition-colors"
                      title={t("sectionDetail.actions.resetLevelColor")}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5.636 18.364A9 9 0 003.05 9m17.9 6a9 9 0 00-2.586-9.364" />
                      </svg>
                    </button>
                  )}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{section.title}</h1>
                {section?.flowchartEnabled && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/55 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-200 shrink-0">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                    </span>
                    {t("sectionDetail.flowchart.breadcrumb")}
                  </span>
                )}
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="opacity-60 group-hover:opacity-100 text-gray-400 hover:text-indigo-300 transition-opacity text-xl shrink-0"
                  title={t("sectionDetail.actions.editSectionName")}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h-5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 14l-4 1 1-4 7.5-7.5z" />
                  </svg>
                </button>
              </>
            )}
              </div>
              {/* Estado e DataID - abaixo do título, dentro do card */}
              {!isEditingTitle && (
                <div className="pl-10 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <StatusPicker
                    projectId={realProjectId}
                    sectionId={realSectionId}
                    status={section?.status}
                  />
                  {!isEditingDataId && section?.dataId && (
                    <button
                      type="button"
                      onClick={() => { setDataIdDraft(section.dataId ?? ""); setIsEditingDataId(true); }}
                      className="text-[10px] font-mono text-gray-500 hover:text-gray-300 bg-gray-800/50 rounded px-2 py-0.5 border border-gray-700/50 transition-colors"
                      title="Editar DataID"
                    >
                      ID: {section.dataId}
                    </button>
                  )}
                  {!isEditingDataId && !section?.dataId && (
                    <button
                      type="button"
                      onClick={() => {
                        const suggested = "DATA_" + (section.title || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
                        setDataIdDraft(suggested);
                        setIsEditingDataId(true);
                      }}
                      className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                      title="Adicionar DataID"
                    >
                      + DataID
                    </button>
                  )}
                  {isEditingDataId && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wide text-gray-500">DataID</span>
                        <input
                          autoFocus
                          type="text"
                          value={dataIdDraft}
                          onChange={(e) => {
                            setDataIdDraft(e.target.value);
                            if (dataIdError) setDataIdError(null);
                          }}
                          onBlur={() => {
                            const trimmed = dataIdDraft.trim();
                            if (trimmed && hasDuplicateDataId(realProjectId, trimmed, realSectionId)) {
                              setDataIdError(t("sectionDetail.dataId.duplicate"));
                              return;
                            }
                            setSectionDataId(realProjectId, realSectionId, trimmed || undefined);
                            setDataIdError(null);
                            setIsEditingDataId(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            else if (e.key === "Escape") {
                              setDataIdError(null);
                              setIsEditingDataId(false);
                            }
                          }}
                          className={`bg-transparent border-b text-xs font-mono text-gray-200 outline-none px-1 py-0.5 w-48 placeholder-gray-600 ${
                            dataIdError ? "border-red-500" : "border-indigo-500"
                          }`}
                          placeholder="ex: FARM_ANIMAL_CHICKEN"
                          aria-invalid={dataIdError ? true : undefined}
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setDataIdError(null);
                            setIsEditingDataId(false);
                          }}
                          className="text-gray-500 hover:text-gray-300 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      {dataIdError && (
                        <span className="text-[10px] text-red-400 font-medium">{dataIdError}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Direita: ações (IA, mapa mental, documento, mover, excluir) */}
          <div className="relative flex items-center gap-2 shrink-0">
            {!inlineEdit && !isEditingTitle && (
              <>
                <button
                  onClick={handleImproveWithAI}
                  disabled={isImproving || !hasValidConfig}
                  className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg border border-purple-400/40 hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    hasValidConfig
                      ? t("sectionDetail.ai.improveTooltip")
                      : t("sectionDetail.ai.configureApiKeyTooltip")
                  }
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
                {/* Ver esta pagina nos outros modos. As cores continuam as
                    daqui — o componente so decide QUAIS modos e para onde. */}
                <PageModeLinks
                  current="editor"
                  projectId={projectId}
                  project={project}
                  sectionId={realSectionId}
                  className="gap-2"
                  iconClassName="w-4 h-4"
                  buttonClassName={(mode) =>
                    "w-8 h-8 flex items-center justify-center text-white rounded-lg border transition-colors " +
                    (mode === "graph"
                      ? "bg-blue-600 border-blue-400/40 hover:bg-blue-700"
                      : mode === "doc"
                        ? "bg-indigo-600 border-indigo-400/40 hover:bg-indigo-700"
                        : "bg-teal-600 border-teal-400/40 hover:bg-teal-700")
                  }
                />
                <button
                  onClick={() => setShowMoveModal(true)}
                  className="w-8 h-8 flex items-center justify-center bg-amber-600 text-white rounded-lg border border-amber-400/40 hover:bg-amber-700 transition-colors"
                  title={t("sectionDetail.actions.moveSection")}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M10 7h7v7" />
                  </svg>
                </button>
                {sections.some((s: any) => s.parentId === realSectionId) && (
                  <button
                    onClick={() => setShowMoveChildrenModal(true)}
                    className="w-8 h-8 flex items-center justify-center bg-amber-500 text-white rounded-lg border border-amber-400/40 hover:bg-amber-600 transition-colors"
                    title={t("sectionDetail.actions.moveChildren", "Mover todos os filhos para...")}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={handleDuplicateSection}
                  className="w-8 h-8 flex items-center justify-center bg-violet-600 text-white rounded-lg border border-violet-400/40 hover:bg-violet-700 transition-colors"
                  title={t("sectionDetail.actions.duplicateSection")}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="9" y="9" width="11" height="11" rx="2" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15V6a1 1 0 011-1h9" />
                  </svg>
                </button>
              </>
            )}
            {!isEditingTitle && (
              <button
                className="w-8 h-8 flex items-center justify-center bg-red-600 text-white rounded-lg border border-red-400/40 hover:bg-red-700 transition-colors"
                onClick={() => {
                  const count = countDescendants(realProjectId, realSectionId);
                  const msg = count > 0 
                    ? t('sectionDetail.confirmDeleteWithChildren').replace('{count}', String(count))
                    : t('sectionDetail.confirmDelete');
                  if (window.confirm(msg)) {
                    const parentId = section?.parentId;
                    removeSection(realProjectId, realSectionId);
                    if (parentId) {
                      router.push(sectionPathById(project ?? { title: "", sections: [] }, parentId));
                    } else {
                      router.push(project ? projectPath(project) : "/");
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
        </div>
      )}

      {sectionThumbError && (
        <div className="max-w-6xl mx-auto mb-2 text-xs text-red-300">
          {sectionThumbError}
        </div>
      )}

      {/* Aviso de página firme cujas referências mudaram depois da confirmação */}
      {section && !inlineEdit && (
        <div className="max-w-6xl mx-auto">
          <StaleNotice
            projectId={realProjectId}
            projectSlug={projectId}
            section={section}
            sections={sections || []}
          />
        </div>
      )}

      {/* Domínio / Sistemas (modelo de game design para IA e relações) */}
      {section && !inlineEdit && (
        <div className="max-w-6xl mx-auto mb-3 ui-card-premium flex flex-wrap items-center gap-2">
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
                  editSection(realProjectId, realSectionId,section.title, section.content ?? "", undefined, undefined, next);
                  setSection({ ...section, domainTags: next.length ? next : undefined });
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  isSelected
                    ? "border-indigo-400/60 bg-indigo-600/85 text-white hover:bg-indigo-500"
                    : "border-gray-600 bg-gray-800/90 text-gray-300 hover:bg-gray-700 hover:text-gray-100"
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
                    projectTitle: project?.title,
                    projectDescription: project?.description,
                    sectionTitle: section.title,
                    sectionContent: getSectionAiContent(section).slice(0, 2000),
                    existingTags: section.domainTags,
                  }),
                });
                const data = await res.json();
                if (res.ok && Array.isArray(data.suggestedTags) && data.suggestedTags.length > 0) {
                  const next = normalizeDomainTags(data.suggestedTags);
                  editSection(realProjectId, realSectionId,section.title, section.content ?? "", undefined, undefined, next);
                  setSection({ ...section, domainTags: next });
                }
              } catch (e) {
                console.error("Suggest domain tags:", e);
              } finally {
                setSuggestDomainLoading(false);
              }
            }}
            className="ml-2 px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-600 bg-gray-800/90 text-gray-200 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {suggestDomainLoading ? t("sectionDetail.domain.suggesting") : t("sectionDetail.domain.suggestWithAI")}
          </button>
        </div>
      )}
      
      {/* Tarefas vinculadas a esta seção */}
      {!inlineEdit && project?.id && section?.id && (
        <SectionTasksPanel
          projectId={project.id}
          sectionId={section.id}
          sectionTitle={section.title ?? ""}
        />
      )}

      {/* Mensagem de erro/aviso da IA */}
      {improveError && (
        <div className="max-w-6xl mx-auto mb-4 p-3 bg-amber-900/30 border border-amber-600 rounded-xl text-amber-200 text-sm">
          {improveError}
        </div>
      )}
      {!inlineEdit && !(inlineEdit && isFullscreen) && (
        <div
          className="group/description relative max-w-6xl mx-auto mb-4 ui-card-premium transition-colors hover:ring-1 hover:ring-indigo-500/40"
          onDoubleClick={() => setInlineEdit(true)}
          title={(!isRichDocEmpty(section.contentBlocks) || (section.content && section.content.trim())) ? t('sectionDetail.descriptionEditHint', 'Duplo clique para editar a descrição') : undefined}
        >
          {(!isRichDocEmpty(section.contentBlocks) || (section.content && section.content.trim())) ? (
            <>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); setInlineEdit(true); }}
                onDoubleClick={(event) => event.stopPropagation()}
                aria-label={t('sectionDetail.descriptionEditAria', 'Editar descrição')}
                title={t('sectionDetail.descriptionEditHint', 'Duplo clique para editar a descrição')}
                className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-gray-900/85 px-2.5 py-1.5 text-xs text-indigo-100 opacity-0 shadow-sm backdrop-blur transition-opacity duration-150 hover:border-indigo-300/70 hover:bg-indigo-600/25 hover:text-white focus-visible:opacity-100 group-hover/description:opacity-100"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h-5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 14l-4 1 1-4 7.5-7.5z" />
                </svg>
                <span>{t('sectionDetail.descriptionEditButton', 'Editar')}</span>
              </button>
              <div className="cursor-text">
                <SectionDescriptionReadOnly
                  blocks={section.contentBlocks}
                  markdown={section.content}
                  projectId={realProjectId}
                  sections={project?.sections || []}
                  projectTokenSource={project}
                  currentSectionId={realSectionId}
                  referenceLinkMode="manager"
                  theme="dark"
                />
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setInlineEdit(true)}
              className="w-full flex items-center gap-3 rounded-lg border border-dashed border-gray-600 bg-gray-900/40 px-4 py-6 text-left text-sm text-gray-300 transition-colors hover:border-indigo-400/60 hover:bg-indigo-600/10 hover:text-indigo-100"
            >
              <svg className="h-5 w-5 shrink-0 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h-5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L12 14l-4 1 1-4 7.5-7.5z" />
              </svg>
              <span className="flex-1">
                {t('sectionDetail.descriptionEmptyPrompt', 'Clique para adicionar uma descrição para esta página')}
              </span>
            </button>
          )}

          {(section?.created_by_name != null || section?.created_at != null || section?.updated_by_name != null || section?.updated_at != null) && (
            <div className="mt-4 pt-3 border-t border-gray-700/80 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
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
      {section && !inlineEdit && (
        <div
          className={`max-w-6xl mx-auto mb-4 ui-card-premium border ${
            section?.flowchartEnabled ? "border-emerald-500/35 bg-emerald-900/10" : "border-gray-700/80"
          }`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex items-start gap-3">
              <span
                className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border ${
                  section?.flowchartEnabled
                    ? "border-emerald-400/50 bg-emerald-600/25 text-emerald-200"
                    : "border-gray-600/80 bg-gray-800/70 text-gray-300"
                }`}
                aria-hidden="true"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="7" height="5" rx="1.2" strokeWidth={1.8} />
                  <rect x="14" y="3" width="7" height="6" rx="1.2" strokeWidth={1.8} />
                  <rect x="8" y="15" width="8" height="6" rx="1.2" strokeWidth={1.8} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 6.5h4m3.5 2.5v2.5M8.5 15v-2.5m6.5 2.5v-2.5" />
                </svg>
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-100">{t("sectionDetail.flowchart.title")}</h3>
                <p className="text-xs text-gray-400 mt-1">{t("sectionDetail.flowchart.description")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${section?.flowchartEnabled ? "text-emerald-300" : "text-gray-400"}`}>
                {section?.flowchartEnabled ? t("sectionDetail.flowchart.statusOn") : t("sectionDetail.flowchart.statusOff")}
              </span>
              <ToggleSwitch
                checked={Boolean(section?.flowchartEnabled)}
                ariaLabel={t("sectionDetail.flowchart.switchAria")}
                onChange={(nextEnabled) => {
                  if (nextEnabled) {
                    setSectionFlowchartEnabled(realProjectId, realSectionId, true);
                    setSection({ ...section, flowchartEnabled: true });
                    return;
                  }
                  const confirmed = window.confirm(t("sectionDetail.flowchart.disableConfirm"));
                  if (!confirmed) return;
                  disableSectionFlowchartAndClearDiagram(realProjectId, realSectionId);
                  setSection({ ...section, flowchartEnabled: false });
                }}
              />
            </div>
          </div>
          {section?.flowchartEnabled && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => router.push(`${sectionPath(project, section)}/diagramas`)}
                className="h-9 px-3.5 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg border border-emerald-300/50 shadow-lg shadow-emerald-900/20 hover:from-emerald-600 hover:to-teal-600 transition-all text-xs font-semibold"
                title={t("sectionDetail.flowchart.open")}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h6m0 0v6m0-6l-8 8m-4 0h4v4" />
                </svg>
                {t("sectionDetail.flowchart.openWithTitle").replace("{{title}}", section.title)}
              </button>
            </div>
          )}
        </div>
      )}
      {/* Backlinks Section */}
      {!(inlineEdit && isFullscreen) && (
        <BacklinksSection
          projectId={projectId}
          sectionId={realSectionId}
          sections={project?.sections || []}
          router={router}
        />
      )}

      {/* Histórico de versões (colapsável) */}
      <div className="max-w-6xl mx-auto mb-4 ui-card-premium overflow-hidden">
        <button
          type="button"
          onClick={() => setHistoryExpanded((e) => !e)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-800/80 transition-colors"
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
          <div className="px-4 pb-4 pt-0 border-t border-gray-700/80 bg-gray-900/25">
        {sectionVersionsLoading ? (
          <p className="text-xs text-gray-500 pt-2">{t("sectionDetail.history.loading")}</p>
        ) : sectionVersions.length === 0 ? (
          <p className="text-xs text-gray-500 pt-2">{t("sectionDetail.history.empty")}</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-auto pt-2">
            {sectionVersions.map((v: SectionVersionEntry, index: number) => {
              const contentPreview = (v.content || "").replace(/\s+/g, " ").trim().slice(0, 80);
              const versionSummary = buildVersionChangeSummary(v, sectionVersions[index + 1]);
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
                  {versionSummary ? (
                    <div className="text-gray-400 truncate mt-0.5" title={versionSummary}>
                      {versionSummary}
                    </div>
                  ) : contentPreview ? (
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
                      const res = await fetch(`/api/projects/${encodeURIComponent(realProjectId)}/sections/${encodeURIComponent(realSectionId)}/restore`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ versionId: v.id }),
                        credentials: "include",
                      });
                      if (res.ok) {
                        editSection(realProjectId, realSectionId, v.title, v.content, undefined, v.color ?? undefined);
                        // Versões guardam só markdown — limpa contentBlocks (store + local)
                        // pra leitura renderizar o markdown restaurado, não os blocks atuais.
                        setSection((prev: any) => (prev ? { ...prev, title: v.title, content: v.content, contentBlocks: undefined, color: v.color ?? prev.color, updated_at: new Date().toISOString(), updated_by_name: profile?.display_name ?? user?.email ?? null } : null));
                        const data = await fetch(`/api/projects/${encodeURIComponent(realProjectId)}/sections/${encodeURIComponent(realSectionId)}/versions`, { credentials: "include" }).then((r) => r.ok ? r.json() : { versions: [] });
                        if (Array.isArray(data?.versions)) setSectionVersions(data.versions);
                      }
                    } finally {
                      setRestoreVersionId(null);
                    }
                  }}
                  className="text-blue-300 hover:text-blue-200 disabled:opacity-50 rounded px-1.5 py-0.5 hover:bg-blue-500/10 transition-colors"
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
          projectDescription={project?.description || ""}
          onRemoveProjectRefFromSection={() => {
            const projectTitle = project?.title || "";
            if (!section?.content || !projectTitle) return;
            const re = new RegExp(`\\$\\[${escapeRegExp(projectTitle)}\\]`, "gi");
            const newContent = section.content.replace(re, projectTitle);
            editSection(realProjectId, realSectionId,section.title, newContent, undefined, undefined);
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
        <div className="max-w-6xl mx-auto mb-3 ui-card-premium">
          {!isFullscreen && (
            <div className="flex items-center gap-2 mb-2 justify-end">
              <div className="flex items-center gap-2 bg-gray-800/90 rounded-lg px-3 py-1 border border-gray-700">
                <button
                  onClick={() => setEditorHeight((prev: string) => {
                    const current = parseInt(prev);
                    return `${Math.max(200, current - 100)}px`;
                  })}
                  className="text-gray-300 hover:text-white font-bold"
                  title={t("sectionDetail.actions.decreaseHeight")}
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
                  title={t("sectionDetail.actions.increaseHeight")}
                >
                  +
                </button>
              </div>
              <button
                onClick={() => {
                  setIsFullscreen(true);
                  setEditorHeight('calc(100vh - 200px)');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm border border-blue-400/40 flex items-center gap-1 transition-colors"
                title={t("sectionDetail.actions.fullscreen")}
              >
                ⤢ {t('sectionDetail.actions.fullscreen')}
              </button>
            </div>
          )}
          <SectionDescriptionEditor
            initialBlocks={convertBlockRefsToNames(section?.contentBlocks, project?.sections || [])}
            markdown={normalizeDriveUrlsInMarkdown(
              convertReferencesToNames(section?.content || "", project?.sections || [])
            )}
            minHeight={editorHeight}
            apiRef={editorRef}
            sections={project?.sections?.map((s: any) => ({ id: s.id, title: s.title }))}
            onChange={(blocks, md) => {
              // Auto-save (Notion-style): persist blocks (source of truth) +
              // derived markdown mirror on every debounced edit. Clearing the
              // description to empty is allowed — `blocks` and `md` always come
              // from the same live editor (see SectionDescriptionEditor), so an
              // empty here means the user really emptied it.
              const normalizedMd = normalizeSpecialTokenSyntax(md);
              const convertedMd = convertReferencesToIds(normalizedMd, project?.sections || []);
              updateSectionDescription(realProjectId, realSectionId, blocks, convertedMd);
            }}
          />
          <div className="mt-3">
            <SpecialTokensHelp
              title={t("sectionDetail.specialTokens.title", "Chaves especiais")}
              onInsertToken={(token) => {
                const inst = (editorRef as any).current;
                if (inst?.insertText) {
                  inst.insertText(token);
                  return;
                }
                const current = inst?.getMarkdown?.() || "";
                const next = `${current}${current.endsWith("\n") || current.length === 0 ? "" : "\n"}${token}`;
                inst?.setMarkdown?.(next);
              }}
            />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
              onClick={() => {
                // Auto-save already persisted edits as the user typed. On exit,
                // flush any change still inside the debounce window so nothing
                // is lost, then leave edit mode. Empty is allowed (clearing the
                // description); blocks + md come from the same live editor.
                const api = (editorRef as any).current;
                if (api && typeof api.getBlocks === "function") {
                  const blocks = api.getBlocks() || [];
                  const md = api.getMarkdown?.() || "";
                  const normalizedMd = normalizeSpecialTokenSyntax(md);
                  const convertedMd = convertReferencesToIds(normalizedMd, project?.sections || []);
                  updateSectionDescription(realProjectId, realSectionId, blocks, convertedMd);
                }
                setInlineEdit(false);
              }}
            >✓ {t("sectionDetail.descriptionDone", "Concluir")}</button>
            <span className="text-xs text-gray-400">
              {t("sectionDetail.descriptionAutosaveHint", "Salvo automaticamente")}
            </span>
          </div>
        </div>
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
                {t("sectionDetail.ai.previewTitle")}
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                {t("sectionDetail.ai.previewSubtitle")}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {improveError && (
                <div className="mb-4 p-3 bg-amber-900/30 border border-amber-600 rounded-lg text-amber-200 text-sm">
                  {improveError}
                </div>
              )}

              <div className="prose max-w-none bg-gray-800/70 rounded-lg p-6 border border-gray-700 text-gray-100">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewContent}</ReactMarkdown>
              </div>

              <div className="mt-4 space-y-4">
                <UnresolvedRefsPanel
                  unresolvedNames={unresolvedNames}
                  hasProjectTitleRef={hasProjectTitleRef}
                  projectTitle={project?.title || ""}
                  projectDescription={project?.description || ""}
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
                  {t("sectionDetail.ai.modificationRequestLabel")}
                </label>
                <textarea
                  value={modificationRequest}
                  onChange={(e) => setModificationRequest(e.target.value)}
                  placeholder={t("sectionDetail.ai.modificationRequestPlaceholder")}
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

      {/* Modal: Mover pagina */}
      <SectionPickerModal
        open={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        onConfirm={handleMoveSection}
        title={t('sectionDetail.move.title', 'Mover pagina')}
        description={section ? (<>Mover <strong className="text-gray-100">{section.title}</strong> {t('sectionDetail.copy.descriptionTo', 'para outra pagina')}</>) : null}
        confirmLabel={t('sectionDetail.move.move')}
        confirmVariant="blue"
        sections={sections}
        allowRoot
        rootLabel={t('sectionDetail.move.rootLabel', '📁 Raiz do projeto')}
        rootDescription={t('sectionDetail.move.makeRoot')}
        disabledSectionIds={[sectionId, ...getAllDescendants(sectionId, sections)]}
        disabledReason={(id) =>
          id === sectionId
            ? t('sectionDetail.picker.disabledCurrent', 'atual')
            : t('sectionDetail.picker.disabledDescendant', 'descendente')
        }
      />

      {/* Modal: Mover todos os filhos para outra pagina */}
      {(() => {
        const directChildren = sections.filter((s: any) => s.parentId === realSectionId);
        return (
          <SectionPickerModal
            open={showMoveChildrenModal}
            onClose={() => setShowMoveChildrenModal(false)}
            onConfirm={handleMoveChildren}
            title={t("sectionDetail.moveChildren.title", "Mover filhos para...")}
            description={section ? (
              <>
                Mover <strong className="text-gray-100">{directChildren.length} {directChildren.length === 1 ? 'filho' : 'filhos'}</strong> de{" "}
                <strong className="text-gray-100">{section.title}</strong> para outra página
              </>
            ) : null}
            confirmLabel={t("sectionDetail.moveChildren.confirm", "Mover filhos")}
            confirmVariant="blue"
            sections={sections}
            allowRoot
            rootLabel={t('sectionDetail.move.rootLabel', '📁 Raiz do projeto')}
            rootDescription={t('sectionDetail.move.makeRoot')}
            disabledSectionIds={[realSectionId, ...getAllDescendants(realSectionId, sections)]}
            disabledReason={(id) =>
              id === realSectionId
                ? t('sectionDetail.picker.disabledCurrent', 'atual')
                : t('sectionDetail.picker.disabledDescendant', 'descendente')
            }
          />
        );
      })()}
    </div>
  );
}

// Componente de Backlinks (seções que referenciam esta)
function BacklinksSection({ projectId, sectionId, sections, router }: any) {
  const { t } = useI18n();
  const backlinks = getBacklinks(sectionId, sections);
  const [pending, setPending] = useState<{ id: string; title: string; shortDescription: string } | null>(null);

  if (backlinks.length === 0) return null;

  const handleClick = (link: { id: string; title: string }) => {
    const sec = sections.find((s: any) => s.id === link.id);
    const rawContent = typeof sec?.content === "string" ? sec.content : "";
    const shortDescription = rawContent
      .replace(/[$@]\[[^\]]*\]/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[*_`>~|]/g, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 150);
    setPending({ id: link.id, title: link.title, shortDescription });
  };

  const navigate = (id: string) => {
    const sec = sections.find((s: any) => s.id === id);
    router.push(sec ? `/projects/${projectId}/sections/${toSlug(sec.title ?? "")}` : `/projects/${projectId}`);
  };

  return (
    <>
      <div className="max-w-6xl mx-auto mt-6 mb-4 p-4 bg-blue-900/20 rounded-xl border border-blue-700/50">
        <h3 className="text-sm font-semibold text-blue-200 mb-2 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14L21 3m-6 0h6v6M14 10L3 21m0-6v6h6" />
          </svg>
          <span>{t('sectionDetail.backlinks')}</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {backlinks.map((link: any, index: number) => (
            <span key={link.id} className="inline-flex items-center">
              <button
                onClick={() => handleClick(link)}
                className="text-blue-300 hover:text-blue-200 hover:underline text-sm font-medium"
              >
                {link.title}
              </button>
              {index < backlinks.length - 1 && <span className="text-blue-500 ml-1">,</span>}
            </span>
          ))}
        </div>
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 bg-black/30 p-4 flex items-center justify-center" onClick={() => setPending(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('view.anchorPreview.title', 'Section Preview')}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">{pending.title}</h3>
            </div>
            <div className="px-5 py-4">
              {pending.shortDescription ? (
                <p className="text-sm leading-6 text-gray-700">{pending.shortDescription}</p>
              ) : (
                <p className="text-sm leading-6 text-gray-500">{t('view.anchorPreview.noDescription', 'No description.')}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => { const id = pending.id; setPending(null); navigate(id); }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t('view.anchorPreview.goButton', 'Go to section')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
