// store/slices/types.ts
// Extracted types, interfaces, and constants from store/projectStore.ts

import type { CloudSyncQuotaStatus, SyncStats } from "@/lib/supabase/projectSync";
import type { DocumentThemeId } from "@/lib/documentThemes";
import type { SectionAddon } from "@/lib/addons/types";
import type { ProjectDocumentSpotlight } from "@/lib/projectSpotlight";

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
  content?: string;
  created_at: string;
  parentId?: UUID; // Se parentId for null, é uma seção raiz; se tiver valor, é uma subseção de outra seção.
  order: number; // Ordem de exibição dentro do mesmo nível (mesmo parentId)
  color?: string; // Cor personalizada para o mapa mental (formato hex: #3b82f6)
  /** Tags de domínio de game design (combat, economy, progression, etc.) para IA e relações entre sistemas. */
  domainTags?: string[];
  /** Addons genéricos vinculados a esta seção. */
  addons?: SectionAddon[];
  /** Arquétipo da página (page type) usado na criação. Opcional; undefined = legado/blank. */
  pageTypeId?: string;
  /** Notas por grupo de addons (ex.: hipotese do teste A/B). Chave = nome do grupo. */
  addonGroupNotes?: Record<string, string>;
  /** Quem criou a seção (id e nome para exibição). */
  created_by?: string | null;
  created_by_name?: string | null;
  /** Última modificação. */
  updated_at?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
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
  /** Instruções específicas do projeto para a IA (convenções de addons, estrutura de dados, etc). */
  aiInstructions?: string;
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
  updatePersistenceConfig: (config: Partial<PersistenceConfig>) => void;
  // Mutations
  addProject: (name: string, description: string) => string;
  getProject: (id: UUID) => Project | undefined;
  addSection: (projectId: UUID, title: string, content?: string, createdBy?: SectionAuditBy, pageTypeId?: string, customAddons?: SectionAddon[], domainTags?: string[]) => UUID;
  addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string, createdBy?: SectionAuditBy, pageTypeId?: string, customAddons?: SectionAddon[], domainTags?: string[]) => UUID;
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
    addons?: SectionAddon[],
    dataId?: string
  ) => void;
  setSectionDataId: (projectId: UUID, sectionId: UUID, dataId: string | undefined) => void;
  setSectionAddonGroupNote: (projectId: UUID, sectionId: UUID, group: string, note: string) => void;
  renameSectionAddonGroup: (projectId: UUID, sectionId: UUID, oldGroup: string, newGroup: string) => void;
  setSectionAddons: (projectId: UUID, sectionId: UUID, addons: SectionAddon[], updatedBy?: SectionAuditBy) => void;
  addSectionAddon: (projectId: UUID, sectionId: UUID, addon: SectionAddon, updatedBy?: SectionAuditBy) => void;
  updateSectionAddon: (projectId: UUID, sectionId: UUID, addonId: string, nextAddon: SectionAddon, updatedBy?: SectionAuditBy) => void;
  removeSectionAddon: (projectId: UUID, sectionId: UUID, addonId: string, updatedBy?: SectionAuditBy) => void;
  copyAddonToSection: (
    projectId: UUID,
    fromSectionId: UUID,
    toSectionId: UUID,
    addonId: string,
    updatedBy?: SectionAuditBy
  ) => void;
  moveAddonToSection: (
    projectId: UUID,
    fromSectionId: UUID,
    toSectionId: UUID,
    addonId: string,
    updatedBy?: SectionAuditBy
  ) => { reverseRefsUpdated: number };
  moveAddonsToSection: (
    projectId: UUID,
    fromSectionId: UUID,
    toSectionId: UUID,
    addonIds: string[],
    updatedBy?: SectionAuditBy
  ) => { reverseRefsUpdated: number };
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
