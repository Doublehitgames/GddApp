// store/slices/types.ts
// Extracted types, interfaces, and constants from store/projectStore.ts

import type { CloudSyncQuotaStatus, SyncStats } from "@/lib/supabase/projectSync";
import type { DocumentThemeId } from "@/lib/documentThemes";
import type { RichDocBlock } from "@/lib/richDoc/types";
import type { ProjectDocumentSpotlight } from "@/lib/projectSpotlight";
import type { AgendaTask, RecurrenceRule } from "@/lib/agenda/types";
import type { PageStatus } from "@/lib/pageStatus/types";

export type UUID = string;

/** Resultado da última análise de consistência por projeto (persistido em localStorage). */
export type LastConsistencyAnalysis = {
  alerts: Array<{ severity?: string; title?: string; message?: string; relatedSections?: string[] }>;
  simulation: { combat?: { playerHP: number; enemyDamage: number; healPerPotion?: number; hitsToDie: number; healsToOffsetOneHit?: number } } | null;
  runAt: string;
};

/** Resultado da última análise de relações entre sistemas por projeto (persistido em localStorage). */
export type LastRelationsAnalysis = {
  suggestions: Array<{ type?: string; fromTitle?: string; toTitle?: string; domains?: string[]; suggestion?: string }>;
  runAt: string;
};

export type DiagramMarkerType = "none" | "arrow" | "circle";

export type DiagramNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    label: string;
    note?: string;
    blockType?: "retangulo" | "losango" | "pill" | "circulo";
    color?: string;
    textColor?: string;
    textAlign?: "left" | "center" | "right";
    textVerticalAlign?: "top" | "middle" | "bottom";
    fontSize?: number;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    gradientEnabled?: boolean;
    width?: number;
    height?: number;
  };
};

export type DiagramEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  edgeType?: "straight" | "step" | "smoothstep" | "bezier";
  strokeWidth?: number;
  dashed?: boolean;
  dashLength?: number;
  dashGap?: number;
  animated?: boolean;
  startMarker?: DiagramMarkerType;
  endMarker?: DiagramMarkerType;
};

export type DiagramViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type DiagramState = {
  version: number;
  updatedAt: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  viewport: DiagramViewport;
  settings?: {
    snapToGrid?: boolean;
    snapGridSize?: number;
  };
};

// Tipo para configuração de um nível no mapa mental
export type LevelConfig = {
  level: number; // 0, 1, 2, 3...
  name: string; // "Seções", "Subseções", "Sub-subseções", etc
  node: {
    color?: string;
    textColor?: string;
    padding?: number;
    borderColor?: string;
    borderWidth?: number;
    shadowColor?: string;
    hasChildrenBorder?: {
      enabled?: boolean;
      width?: number;
      color?: string;
      dashed?: boolean;
      dashPattern?: string;
    };
    selected?: {
      borderColor?: string;
      borderWidth?: number;
      glowColor?: string;
      scale?: number;
    };
    zoomOnClick?: number;
  };
  edge: {
    /** Linha visivel no estado de repouso do mapa (nenhum no selecionado). */
    visible?: boolean;
    strokeWidth?: number;
    color?: string;
    dashed?: boolean;
    dashPattern?: string;
    animated?: boolean;
    highlighted?: {
      strokeWidth?: number;
      color?: string;
      animated?: boolean;
      dashPattern?: number;
    };
  };
};

// Tipo para configurações personalizadas do mapa mental por projeto
export type MindMapSettings = {
  // Tamanhos dinâmicos
  nodeSize?: {
    baseSize?: number;
    reductionFactor?: number;
    minSize?: number;
  };
  // Fontes
  fonts?: {
    section?: {
      sizePercent?: number;
      minSize?: number;
      maxSize?: number;
    };
    project?: {
      sizePercent?: number;
      minSize?: number;
      maxSize?: number;
    };
    lineHeight?: number;
    wordBreak?: boolean;
  };
  // Zoom
  zoom?: {
    minZoom?: number;
    maxZoom?: number;
    fitViewMaxZoom?: number;
    fitViewPadding?: number;
    labelVisibility?: {
      section?: number;
      project?: number;
    };
    targetApparentSize?: number;
    zoomMargin?: number;
    onClickTargetSize?: number;
  };
  // Animação
  animation?: {
    speed?: number;
    distance?: number;
  };
  // Física
  physics?: {
    link?: {
      strength?: number;
      distance?: {
        level0?: number;
        base?: number;
        multiplier?: number;
      };
    };
    collision?: {
      enabled?: boolean;
      radiusMargin?: {
        project?: number;
        section?: number;
      };
      strength?: number;
      iterations?: number;
    };
    simulation?: {
      iterations?: number;
    };
  };
  // Projeto Central
  project?: {
    node?: {
      size?: number;
      colors?: {
        gradient?: { from?: string; to?: string; };
        text?: string;
        shadow?: string;
        glow?: string;
      };
      icon?: string;
      padding?: number;
      selected?: {
        borderColor?: string;
        borderWidth?: number;
        glowColor?: string;
        scale?: number;
      };
      zoomOnClick?: number;
    };
    edge?: {
      /** Linha visivel no estado de repouso do mapa (nenhum no selecionado). */
      visible?: boolean;
      strokeWidth?: number;
      color?: string;
      dashed?: boolean;
      dashPattern?: string;
      animated?: boolean;
      highlighted?: {
        strokeWidth?: number;
        color?: string;
        animated?: boolean;
        dashPattern?: number;
      };
    };
  };
  // Níveis dinâmicos (array de configurações)
  levels?: LevelConfig[];
  // Layout
  layout?: {
    mainOrbitRadius?: number;
    subOrbitRadius?: number;
    orbitRadiusMultiplier?: number;
    startAngle?: number;
  };
  // Background
  background?: {
    color?: string;
    dotsColor?: string;
    dotsSize?: number;
    dotsGap?: number;
  };
  // Painel lateral
  sidebar?: {
    contentScale?: number;
  };
  // Compartilhamento público
  sharing?: {
    isPublic?: boolean;
    shareToken?: string;
  };
  // Documento
  documentView?: {
    theme?: DocumentThemeId;
    spotlight?: ProjectDocumentSpotlight;
    /** Pixel width of the section hero thumbnail shown in document view. */
    heroThumbWidth?: number;
  };
};

/** Dados do usuário para auditoria (criado por / modificado por). */
export type SectionAuditBy = { userId: string; displayName: string | null };

//Definição da Seção. A seção pode ter um parentId opcional para suportar subseções.
export type Section = {
  id: UUID;
  title: string;
  /** User-defined data identifier (e.g. "FARM_ANIMAL_CHICKEN"). Used for game data binding, not internal references. */
  dataId?: string;
  thumbImageUrl?: string;
  flowchartEnabled?: boolean;
  flowchartState?: DiagramState;
  /**
   * Markdown da descrição. Durante a migração para blocks nativos (BlockNote),
   * este campo é um ESPELHO derivado automaticamente de `contentBlocks` no save,
   * mantido só para os leitores legados (busca, backlinks, IA, /view, MCP).
   * Não deve ser editado à mão. Será removido na Fase 3 da migração.
   */
  content?: string;
  /**
   * Fonte de verdade da descrição: blocks do BlockNote. Quando presente, a
   * edição carrega/salva daqui (lossless). `content` é derivado deste campo.
   */
  contentBlocks?: RichDocBlock[];
  created_at: string;
  parentId?: UUID; // Se parentId for null, é uma seção raiz; se tiver valor, é uma subseção de outra seção.
  order: number; // Ordem de exibição dentro do mesmo nível (mesmo parentId)
  color?: string; // Cor personalizada para o mapa mental (formato hex: #3b82f6)
  /** Tags de domínio de game design (combat, economy, progression, etc.) para IA e relações entre sistemas. */
  domainTags?: string[];
  /**
   * Maturidade da página: rascunho, em revisão, aprovado, no jogo, obsoleto.
   * Ausente é o normal — um GDD antigo tem centenas de páginas sem classificar.
   */
  status?: PageStatus;
  /**
   * Quando o estado atual foi carimbado. É a partir daqui que o selo de "pode
   * estar desatualizada" compara as páginas citadas: sem esta data não há de
   * quando comparar, e a página nunca é acusada.
   */
  statusAt?: string | null;
  /** ID da planilha cadastrada no projeto usada como fonte de dados desta seção. */
  /** Arquétipo da página (page type) usado na criação. Opcional; undefined = legado/blank. */
  pageTypeId?: string;
  /** Quem criou a seção (id e nome para exibição). */
  created_by?: string | null;
  created_by_name?: string | null;
  /** Última modificação da linha (qualquer campo, menos o estado). */
  updated_at?: string | null;
  /**
   * Última vez que o TEXTO mudou — título, descrição ou blocks. Mantido pelo
   * trigger do banco, nunca escrito pelo app. É o que o selo de "pode estar
   * desatualizada" lê: mudar a cor de uma página não desatualiza quem a cita.
   * Ausente em bancos sem a migração `add_sections_content_updated_at.sql`.
   */
  content_updated_at?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
};

/** Uma imagem indexada da pasta do Drive. */
export type ProjectImage = {
  /** ID do arquivo no Drive — a URL de exibição é derivada dele. */
  fileId: string;
  /** Nome do arquivo, com extensão (ex.: "SEED_TURNIP.png"). É por ele que o agente casa imagem com página. */
  name: string;
  /** Subpasta relativa à raiz indexada (ex.: "icones/sementes"). Ausente para arquivos na raiz. */
  path?: string;
};

/**
 * Índice cacheado de uma pasta pública do Drive: metadata do Google buscada no
 * browser (o picker já concede drive.readonly) e guardada aqui, para que
 * servidor e agente MCP leiam sem precisar de credencial Google.
 */
export type ProjectImageLibrary = {
  folderId: string;
  /** URL original da pasta, para exibir e reeditar. */
  folderUrl: string;
  /** Quando o índice foi atualizado pela última vez (ISO). */
  syncedAt: string;
  files: ProjectImage[];
};

//Definição do Projeto. Um projeto pode ter várias seções.
export type Project = {
  id: UUID;
  title: string;
  description?: string;
  coverImageUrl?: string;
  sections?: Section[];
  createdAt: string;
  updatedAt: string;
  mindMapSettings?: MindMapSettings; // Configurações personalizadas do mapa mental
  /** Dono do projeto (id do usuário). Preenchido ao carregar do Supabase; em projetos só locais pode ser userId ao criar. */
  ownerId?: string | null;
  /** Instruções específicas do projeto para a IA (tom, convenções de escrita, etc). */
  aiInstructions?: string;
  /** Planilhas do Google Sheets cadastradas para reutilização em vínculos de campos. */
  /** Índice de imagens da pasta do Drive, para escolher ícone sem abrir o picker. */
  imageLibrary?: ProjectImageLibrary;
};

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export type PersistenceConfig = {
  debounceMs: number;
  autosaveIntervalMs: number;
  /** Quando true, envia alterações para a nuvem no intervalo (autosaveIntervalMs). Quando false, só sincroniza ao clicar em Sincronizar. */
  syncAutomatic: boolean;
};

export type LastSyncStats = SyncStats & {
  projectId: string;
  syncedAt: string;
  creditsConsumed?: number;
  /** Quem executou o sync (visível para qualquer membro no histórico) */
  syncedByUserId?: string;
  syncedByDisplayName?: string | null;
};

/**
 * O plano dá N projetos e M páginas POR PROJETO. Não existe cota de páginas
 * somada entre projetos — cada projeto tem seu próprio teto.
 */
export type AppLimits = {
  FREE_MAX_PROJECTS: number;
  FREE_MAX_SECTIONS_PER_PROJECT: number;
  SYNC_REQUESTS_PER_MINUTE: number;
};

/** Limites por dono de projeto (inclui o próprio usuário). Ver store/slices/limits.ts. */
export type LimitsByOwner = Record<string, AppLimits>;

/** Quem é o dono de um projeto compartilhado. Resolvido pelo servidor: o
 *  perfil de outra pessoa não é legível pelo cliente. */
export type ProjectOwner = {
  displayName: string | null;
  email: string | null;
};

/** Donos, por userId, dos projetos que o usuário participa mas não possui. */
export type OwnersById = Record<string, ProjectOwner>;

export const DEFAULT_APP_LIMITS: AppLimits = {
  FREE_MAX_PROJECTS: 2,
  FREE_MAX_SECTIONS_PER_PROJECT: 300,
  SYNC_REQUESTS_PER_MINUTE: 30,
};

export interface ProjectStore {
  projects: Project[];
  syncStatus: SyncStatus;
  cloudSyncPausedUntil: string | null;
  /** Motivo da pausa: 'quota' = limite de créditos/hora; 'failures' = circuit breaker; 'rate_limit' = muitas req/min */
  cloudSyncPauseReason: "quota" | "failures" | "rate_limit" | null;
  pendingSyncCount: number;
  lastSyncedAt: string | null;
  lastSyncStats: LastSyncStats | null;
  lastSyncStatsHistory: LastSyncStats[];
  lastQuotaStatus: CloudSyncQuotaStatus | null;
  lastSyncError: string | null;
  /** Último motivo técnico de falha (ex.: sync_route_timeout); útil para debug quando pausa por falhas */
  lastSyncFailureReason: string | null;
  persistenceConfig: PersistenceConfig;
  // Auth sync
  userId: string | null;
  setUserId: (id: string | null) => void;
  // Remote config
  appLimits: AppLimits;
  /** Limites de cada dono de projeto visível ao usuário (inclui ele mesmo). */
  limitsByOwner: LimitsByOwner;
  /** Nome/e-mail dos donos dos projetos compartilhados com o usuário. */
  ownersById: OwnersById;
  fetchAppLimits: () => Promise<void>;
  fetchProjectOwners: () => Promise<void>;
  updatePersistenceConfig: (config: Partial<PersistenceConfig>) => void;
  // Mutations
  addProject: (name: string, description: string) => string;
  getProject: (id: UUID) => Project | undefined;
  getProjectBySlug: (slug: string) => Project | undefined;
  getSectionById: (projectId: UUID, sectionId: UUID) => Section | undefined;
  getSectionBySlug: (projectId: UUID, slug: string) => Section | undefined;
  addSection: (projectId: UUID, title: string, content?: string, createdBy?: SectionAuditBy, domainTags?: string[]) => UUID;
  addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string, createdBy?: SectionAuditBy, domainTags?: string[]) => UUID;
  duplicateSection: (
    projectId: UUID,
    sectionId: UUID,
    copySuffix: string,
    createdBy?: SectionAuditBy
  ) => import("./sectionCrudSlice").DuplicateSectionOutcome;
  removeProject: (id: UUID) => void;
  /** Remove projeto só localmente (e persiste), sem chamar API de delete. Usado quando o dono já excluiu e o servidor retorna 410. */
  removeProjectLocally: (id: UUID) => void;
  editProject: (id: UUID, name: string, description: string, aiInstructions?: string) => void;
  setProjectCoverImage: (id: UUID, coverImageUrl?: string) => void;
  setProjectImageLibrary: (id: UUID, imageLibrary?: ProjectImageLibrary) => void;
  setSectionThumbImage: (projectId: UUID, sectionId: UUID, thumbImageUrl?: string) => void;
  editSection: (
    projectId: UUID,
    sectionId: UUID,
    title: string,
    content: string,
    parentId?: string | null,
    color?: string,
    updatedBy?: SectionAuditBy,
    domainTags?: string[],
    dataId?: string
  ) => void;
  /**
   * Atualiza a descrição da seção a partir dos blocks nativos (fonte de verdade)
   * e do markdown derivado (espelho de compatibilidade). Ação dedicada para não
   * inflar editSection com mais parâmetros posicionais.
   */
  updateSectionDescription: (
    projectId: UUID,
    sectionId: UUID,
    contentBlocks: RichDocBlock[],
    contentMarkdown: string,
    updatedBy?: SectionAuditBy
  ) => void;
  setSectionDataId: (projectId: UUID, sectionId: UUID, dataId: string | undefined) => void;
  /** Carimba a maturidade da página. `undefined` volta a página para "sem estado". */
  setSectionStatus: (projectId: UUID, sectionId: UUID, status: PageStatus | undefined) => void;
  /** O mesmo para um lote de páginas — um ramo inteiro da árvore, tipicamente. */
  setSectionsStatus: (projectId: UUID, sectionIds: UUID[], status: PageStatus | undefined) => void;
  removeSection: (projectId: UUID, sectionId: UUID) => void;
  moveSectionUp: (projectId: UUID, sectionId: UUID) => void;
  moveSectionDown: (projectId: UUID, sectionId: UUID) => void;
  reorderSections: (projectId: UUID, sectionIds: UUID[]) => void;
  countDescendants: (projectId: UUID, sectionId: UUID) => number;
  hasDuplicateName: (projectId: UUID, title: string, parentId?: UUID, excludeId?: UUID) => boolean;
  hasDuplicateDataId: (projectId: UUID, dataId: string, excludeId?: UUID) => boolean;
  // Storage
  loadFromStorage: () => void;
  loadFromSupabase: () => Promise<"loaded" | "empty" | "error">;
  /** Grava o estado atual no localStorage (útil em beforeunload/visibilitychange para não perder dados). */
  persistToStorage: () => void;
  syncProjectToSupabase: (projectId: UUID) => Promise<void>;
  /** Descarta alterações pendentes de um projeto restaurando o último estado da nuvem. */
  discardPendingChangesForProject: (projectId: UUID) => Promise<{ error: string | null }>;
  flushPendingSyncs: () => Promise<void>;
  /** IDs dos projetos com alterações ainda não enviadas (para estimativa de créditos). */
  getPendingProjectIds: () => string[];
  /** Última análise de consistência por projectId (persistida). */
  lastConsistencyAnalysisByProject: Record<string, LastConsistencyAnalysis>;
  setLastConsistencyAnalysis: (projectId: string, data: LastConsistencyAnalysis) => void;
  getLastConsistencyAnalysis: (projectId: string) => LastConsistencyAnalysis | undefined;
  /** Última análise de relações entre sistemas por projectId (persistida). */
  lastRelationsAnalysisByProject: Record<string, LastRelationsAnalysis>;
  setLastRelationsAnalysis: (projectId: string, data: LastRelationsAnalysis) => void;
  getLastRelationsAnalysis: (projectId: string) => LastRelationsAnalysis | undefined;
  /** Estado local do editor de diagramas por seção (fonte imediata do editor; pode espelhar no sync). */
  diagramsBySection: Record<string, DiagramState>;
  getSectionDiagram: (projectId: string, sectionId: string) => DiagramState | undefined;
  saveSectionDiagram: (projectId: string, sectionId: string, state: DiagramState) => void;
  resetSectionDiagram: (projectId: string, sectionId: string) => void;
  removeSectionDiagram: (projectId: string, sectionId: string) => void;
  setSectionFlowchartEnabled: (projectId: UUID, sectionId: UUID, enabled: boolean) => void;
  disableSectionFlowchartAndClearDiagram: (projectId: UUID, sectionId: UUID) => void;
  /** Limpa o histórico de syncs (lastSyncStatsHistory) e persiste. */
  clearSyncHistory: () => void;
  /** Atualiza lastQuotaStatus com a cota do projeto (cota é por projeto). Sem projectId limpa a cota (ex.: na home). */
  refreshQuotaStatus: (projectId?: string) => Promise<void>;
  /** Atualiza ownerId localmente e persiste. Não marca dirty nem dispara sync. */
  setProjectOwnerLocally: (projectId: UUID, ownerId: string) => void;
  importProject: (project: Project) => void;
  importAllProjects: (projects: Project[]) => void;
  updateProjectSettings: (projectId: UUID, settings: MindMapSettings) => void;
  /** Atualiza só mindMapSettings no store e persiste (sem marcar dirty nem disparar sync). Usado com pushProjectMindMapSettings. */
  updateProjectMindMapSettingsOnly: (projectId: UUID, settings: MindMapSettings) => void;
  // ── Agenda ────────────────────────────────────────────────────────────────
  tasksByProject: Record<string, AgendaTask[]>;
  activeTaskId: string | null;
  addAgendaTask: (projectId: string, date: string, title: string, opts?: { sectionId?: string; sectionTitle?: string }) => string;
  carryOverAgendaTask: (projectId: string, sourceTask: AgendaTask, targetDate: string) => string;
  updateAgendaTask: (projectId: string, taskId: string, patch: Partial<Pick<AgendaTask, "title" | "date" | "order">>) => void;
  updateAgendaTaskDetail: (projectId: string, taskId: string, patch: Partial<Pick<AgendaTask, "description" | "priority" | "category">>) => void;
  addSubTask: (projectId: string, taskId: string, title: string) => void;
  toggleSubTask: (projectId: string, taskId: string, subTaskId: string) => void;
  deleteSubTask: (projectId: string, taskId: string, subTaskId: string) => void;
  deleteAgendaTask: (projectId: string, taskId: string) => void;
  playAgendaTask: (projectId: string, taskId: string) => void;
  pauseAgendaTask: (projectId: string, taskId: string) => void;
  finishAgendaTask: (projectId: string, taskId: string) => void;
  getAgendaTasksForWeek: (projectId: string, weekStart: string) => AgendaTask[];
  setAgendaTaskRecurrence: (projectId: string, taskId: string, recurrence: RecurrenceRule | undefined) => void;
  ensureRecurringTasksForRange: (projectId: string, dateStart: string, dateEnd: string) => void;
  loadAgendaFromSupabase: () => Promise<void>;
  loadKpiFromSupabase: () => Promise<void>;
  // ── KPI tracker ───────────────────────────────────────────────────────────
  kpiEntriesByProject: Record<string, import("@/lib/kpi/types").KpiEntry[]>;
  kpiConfigByProject: Record<string, import("@/lib/kpi/types").KpiProjectConfig>;
  setKpiGenre: (projectId: string, genre: import("@/lib/kpi/types").GameGenre) => void;
  updateKpiConfig: (projectId: string, patch: Partial<Omit<import("@/lib/kpi/types").KpiProjectConfig, "genre">>) => void;
  addKpiEntry: (projectId: string, entry: Omit<import("@/lib/kpi/types").KpiEntry, "id" | "createdAt">) => string;
  updateKpiEntry: (projectId: string, entryId: string, patch: Partial<Pick<import("@/lib/kpi/types").KpiEntry, "date" | "hypothesis" | "hypothesisArea" | "outcome" | "learning" | "metrics">>) => void;
  deleteKpiEntry: (projectId: string, entryId: string) => void;
  // ── Roadmap ───────────────────────────────────────────────────────────────
  roadmapsByProject: Record<string, import("@/lib/roadmap/types").Roadmap[]>;
  phasesByProject:   Record<string, import("@/lib/roadmap/types").RoadmapPhase[]>;
  themesByProject:   Record<string, import("@/lib/roadmap/types").RoadmapTheme[]>;
  itemsByProject:    Record<string, import("@/lib/roadmap/types").RoadmapItem[]>;
  createRoadmap: (projectId: string, name: string) => string;
  updateRoadmap: (projectId: string, roadmapId: string, patch: Partial<Pick<import("@/lib/roadmap/types").Roadmap, "name" | "status">>) => void;
  getRoadmaps: (projectId: string) => import("@/lib/roadmap/types").Roadmap[];
  getActiveRoadmapId: (projectId: string) => string | null;
  addRoadmapPhase: (projectId: string, roadmapId: string, name: string, opts?: Partial<Pick<import("@/lib/roadmap/types").RoadmapPhase, "headerType" | "targetDate" | "isPublic">>) => string;
  updateRoadmapPhase: (projectId: string, phaseId: string, patch: Partial<Pick<import("@/lib/roadmap/types").RoadmapPhase, "name" | "description" | "headerType" | "targetDate" | "status" | "order" | "isPublic">>) => void;
  deleteRoadmapPhase: (projectId: string, phaseId: string) => void;
  getRoadmapPhases: (projectId: string, roadmapId: string) => import("@/lib/roadmap/types").RoadmapPhase[];
  addRoadmapTheme: (projectId: string, roadmapId: string, name: string, opts?: Partial<Pick<import("@/lib/roadmap/types").RoadmapTheme, "color">>) => string;
  updateRoadmapTheme: (projectId: string, themeId: string, patch: Partial<Pick<import("@/lib/roadmap/types").RoadmapTheme, "name" | "color" | "order">>) => void;
  deleteRoadmapTheme: (projectId: string, themeId: string) => void;
  getRoadmapThemes: (projectId: string, roadmapId: string) => import("@/lib/roadmap/types").RoadmapTheme[];
  addRoadmapItem: (projectId: string, roadmapId: string, phaseId: string, themeId: string, title: string) => string;
  updateRoadmapItem: (projectId: string, itemId: string, patch: Partial<Pick<import("@/lib/roadmap/types").RoadmapItem, "title" | "description" | "thumbUrl" | "tag" | "status" | "isPublic" | "order" | "phaseId" | "themeId">>) => void;
  deleteRoadmapItem: (projectId: string, itemId: string) => void;
  getRoadmapItems: (projectId: string, roadmapId: string, phaseId?: string, themeId?: string) => import("@/lib/roadmap/types").RoadmapItem[];
  reorderRoadmapPhases: (projectId: string, roadmapId: string, orderedIds: string[]) => void;
  reorderRoadmapThemes: (projectId: string, roadmapId: string, orderedIds: string[]) => void;
  reorderRoadmapItems: (projectId: string, phaseId: string, themeId: string, orderedIds: string[]) => void;
  loadRoadmapFromSupabase: () => Promise<void>;
  // ── Activity Log ──────────────────────────────────────────────────────────
  activityLogByProject: Record<string, import("@/store/slices/activityLogSlice").ActivityLogEvent[]>;
  activityLogFetchedProjects: string[];
  pendingActivityLog: Record<string, import("@/store/slices/activityLogSlice").ActivityLogEvent[]>;
  fetchActivityLog: (projectId: string) => Promise<void>;
  /** Registra um evento localmente. Enviado ao Supabase no próximo sync do projeto. */
  logSectionActivity: (event: Omit<import("@/store/slices/activityLogSlice").ActivityLogEvent, "id" | "created_at">) => void;
  /** Enviado pelo syncEngine após sync bem-sucedido. */
  flushPendingActivityLog: (projectId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "gdd_projects_v1";
export const PERSISTENCE_CONFIG_KEY = "gdd_persistence_config_v1";
export const SYNC_STATE_KEY = "gdd_sync_state_v1";
export const LAST_ANALYSES_KEY = "gdd_last_analyses_v1";
export const LAST_RELATIONS_KEY = "gdd_last_relations_v1";
export const DIAGRAMS_KEY = "gdd_diagrams_by_section_v1";
export const AGENDA_KEY = "gdd_agenda_tasks_v1";
export const MAX_IMAGE_SRC_LENGTH = 2048;
export const DATA_IMAGE_URI_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/g;
export const SYNC_FAILURE_WINDOW_MS = 120000;
export const SYNC_CIRCUIT_BREAKER_THRESHOLD = 5;
export const SYNC_CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;
export const SYNC_BACKOFF_BASE_MS = 30000;
export const SYNC_BACKOFF_MAX_MS = 5 * 60 * 1000;
export const SYNC_STATS_HISTORY_LIMIT = 12;

export const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  debounceMs: 1500,
  autosaveIntervalMs: 30000,
  syncAutomatic: false,
};

// ---------------------------------------------------------------------------
// Internal persisted sync state type
// ---------------------------------------------------------------------------

export type PersistedSyncState = {
  lastQuotaStatus: CloudSyncQuotaStatus | null;
  lastSyncedAt: string | null;
  lastSyncStats: LastSyncStats | null;
  lastSyncStatsHistory: LastSyncStats[];
  dirtyProjectIds: string[];
};

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { CloudSyncQuotaStatus, SyncStats } from "@/lib/supabase/projectSync";
