// src/store/projectStore.ts
import { create } from "zustand";
import {
  fetchProjectsFromSupabase,
  fetchDeletedProjectIds,
  fetchQuotaStatus,
  upsertProjectToSupabase,
  deleteProjectFromSupabase,
} from "@/lib/supabase/projectSync";
import type { CloudSyncQuotaStatus, SyncStats } from "@/lib/supabase/projectSync";
import {
  FREE_MAX_PROJECTS,
  FREE_MAX_SECTIONS_PER_PROJECT,
  FREE_MAX_SECTIONS_TOTAL,
} from "@/lib/structuralLimits";
import type { SectionAddon } from "@/lib/addons/types";
import { normalizeSectionAddons } from "@/lib/addons/normalize";

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
};

/** Dados do usuário para auditoria (criado por / modificado por). */
export type SectionAuditBy = { userId: string; displayName: string | null };

//Definição da Seção. A seção pode ter um parentId opcional para suportar subseções.
export type Section = {
  id: UUID;
  title: string;
  content?: string;
  created_at: string;
  parentId?: UUID; // Se parentId for null, é uma seção raiz; se tiver valor, é uma subseção de outra seção.
  order: number; // Ordem de exibição dentro do mesmo nível (mesmo parentId)
  color?: string; // Cor personalizada para o mapa mental (formato hex: #3b82f6)
  /** Tags de domínio de game design (combat, economy, progression, etc.) para IA e relações entre sistemas. */
  domainTags?: string[];
  /** Addons genéricos vinculados a esta seção. */
  addons?: SectionAddon[];
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

interface ProjectStore {
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
  addSection: (projectId: UUID, title: string, content?: string, createdBy?: SectionAuditBy) => UUID;
  addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string, createdBy?: SectionAuditBy) => UUID;
  removeProject: (id: UUID) => void;
  /** Remove projeto só localmente (e persiste), sem chamar API de delete. Usado quando o dono já excluiu e o servidor retorna 410. */
  removeProjectLocally: (id: UUID) => void;
  editProject: (id: UUID, name: string, description: string) => void;
  setProjectCoverImage: (id: UUID, coverImageUrl?: string) => void;
  editSection: (
    projectId: UUID,
    sectionId: UUID,
    title: string,
    content: string,
    parentId?: string | null,
    color?: string,
    updatedBy?: SectionAuditBy,
    domainTags?: string[],
    addons?: SectionAddon[]
  ) => void;
  setSectionAddons: (projectId: UUID, sectionId: UUID, addons: SectionAddon[], updatedBy?: SectionAuditBy) => void;
  addSectionAddon: (projectId: UUID, sectionId: UUID, addon: SectionAddon, updatedBy?: SectionAuditBy) => void;
  updateSectionAddon: (projectId: UUID, sectionId: UUID, addonId: string, nextAddon: SectionAddon, updatedBy?: SectionAuditBy) => void;
  removeSectionAddon: (projectId: UUID, sectionId: UUID, addonId: string, updatedBy?: SectionAuditBy) => void;
  removeSection: (projectId: UUID, sectionId: UUID) => void;
  moveSectionUp: (projectId: UUID, sectionId: UUID) => void;
  moveSectionDown: (projectId: UUID, sectionId: UUID) => void;
  reorderSections: (projectId: UUID, sectionIds: UUID[]) => void;
  countDescendants: (projectId: UUID, sectionId: UUID) => number;
  hasDuplicateName: (projectId: UUID, title: string, parentId?: UUID, excludeId?: UUID) => boolean;
  // Storage
  loadFromStorage: () => void;
  loadFromSupabase: () => Promise<"loaded" | "empty" | "error">;
  /** Grava o estado atual no localStorage (útil em beforeunload/visibilitychange para não perder dados). */
  persistToStorage: () => void;
  syncProjectToSupabase: (projectId: UUID) => Promise<void>;
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

const STORAGE_KEY = "gdd_projects_v1";
const PERSISTENCE_CONFIG_KEY = "gdd_persistence_config_v1";
const SYNC_STATE_KEY = "gdd_sync_state_v1";
const LAST_ANALYSES_KEY = "gdd_last_analyses_v1";
const LAST_RELATIONS_KEY = "gdd_last_relations_v1";
const MAX_IMAGE_SRC_LENGTH = 2048;
const DATA_IMAGE_URI_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/g;
const SYNC_FAILURE_WINDOW_MS = 120000;
const SYNC_CIRCUIT_BREAKER_THRESHOLD = 5;
const SYNC_CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;
const SYNC_BACKOFF_BASE_MS = 30000;
const SYNC_BACKOFF_MAX_MS = 5 * 60 * 1000;
const SYNC_STATS_HISTORY_LIMIT = 12;

const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  debounceMs: 1500,
  autosaveIntervalMs: 30000,
  syncAutomatic: false,
};

export const useProjectStore = create<ProjectStore>((set, get) => {
  const isProduction = process.env.NODE_ENV === "production";
  const logInfo = (...args: unknown[]) => {
    if (!isProduction) console.log(...args);
  };
  const logWarn = (...args: unknown[]) => {
    if (!isProduction) console.warn(...args);
  };

  // não acessamos localStorage na criação do módulo para evitar erros SSR;
  // usaremos loadFromStorage no client para carregar os dados.

  const sanitizeRichText = (value?: string): string | undefined => {
    if (!value) return value;

    const withoutDataUris = value.replace(DATA_IMAGE_URI_RE, "[imagem-removida-data-uri]");
    const withoutHeavyImgs = withoutDataUris.replace(/<img\b[^>]*>/gi, (imgTag) => {
      const srcMatch = imgTag.match(/\bsrc\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/i);
      const src = (srcMatch?.[2] || srcMatch?.[3] || "").trim();
      if (!src) return "";
      if (src.toLowerCase().startsWith("data:image/")) return "";
      if (src.length > MAX_IMAGE_SRC_LENGTH) return "";
      return imgTag;
    });

    return withoutHeavyImgs;
  };

  const sanitizeProjectForStorage = (project: Project): Project => {
    return {
      ...project,
      description: sanitizeRichText(project.description),
      sections: (project.sections || []).map((section) => ({
        ...section,
        content: sanitizeRichText(section.content),
        addons: normalizeSectionAddons(
          section.addons || (section as unknown as { balanceAddons?: unknown }).balanceAddons
        ),
      })),
    };
  };

  const sanitizeProjectsForStorage = (projects: Project[]): Project[] => {
    return projects.map(sanitizeProjectForStorage);
  };

  const parseProjectsFromStorage = (raw: string): Project[] | null => {
    try {
      const preSanitizedRaw = raw.replace(DATA_IMAGE_URI_RE, "[imagem-removida-data-uri]");
      const parsed = JSON.parse(preSanitizedRaw) as Project[];
      if (!Array.isArray(parsed)) return null;
      return sanitizeProjectsForStorage(parsed);
    } catch {
      return null;
    }
  };

  const persist = (projects: Project[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProjectsForStorage(projects)));
    } catch (e) {
      logWarn("Could not persist projects to localStorage", e);
    }
  };

  const loadPersistenceConfig = (): PersistenceConfig => {
    try {
      const raw = localStorage.getItem(PERSISTENCE_CONFIG_KEY);
      if (!raw) return DEFAULT_PERSISTENCE_CONFIG;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        debounceMs: Number(parsed.debounceMs) || DEFAULT_PERSISTENCE_CONFIG.debounceMs,
        autosaveIntervalMs: Number(parsed.autosaveIntervalMs) || DEFAULT_PERSISTENCE_CONFIG.autosaveIntervalMs,
        syncAutomatic: Boolean(parsed.syncAutomatic),
      };
    } catch {
      return DEFAULT_PERSISTENCE_CONFIG;
    }
  };

  const persistPersistenceConfig = (config: PersistenceConfig) => {
    try {
      localStorage.setItem(PERSISTENCE_CONFIG_KEY, JSON.stringify(config));
    } catch {}
  };

  const loadLastAnalyses = (): Record<string, LastConsistencyAnalysis> => {
    try {
      if (typeof window === "undefined") return {};
      const raw = localStorage.getItem(LAST_ANALYSES_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, LastConsistencyAnalysis>;
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  };

  const persistLastAnalyses = (data: Record<string, LastConsistencyAnalysis>) => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(LAST_ANALYSES_KEY, JSON.stringify(data));
    } catch (e) {
      logWarn("Could not persist last analyses", e);
    }
  };

  const loadLastRelations = (): Record<string, LastRelationsAnalysis> => {
    try {
      if (typeof window === "undefined") return {};
      const raw = localStorage.getItem(LAST_RELATIONS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, LastRelationsAnalysis>;
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  };

  const persistLastRelations = (data: Record<string, LastRelationsAnalysis>) => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(LAST_RELATIONS_KEY, JSON.stringify(data));
    } catch (e) {
      logWarn("Could not persist last relations", e);
    }
  };

  type PersistedSyncState = {
    lastQuotaStatus: CloudSyncQuotaStatus | null;
    lastSyncedAt: string | null;
    lastSyncStats: LastSyncStats | null;
    lastSyncStatsHistory: LastSyncStats[];
    dirtyProjectIds: string[];
  };

  const persistSyncState = () => {
    try {
      if (typeof window === "undefined") return;
      const state = get();
      const payload: PersistedSyncState = {
        lastQuotaStatus: state.lastQuotaStatus,
        lastSyncedAt: state.lastSyncedAt,
        lastSyncStats: state.lastSyncStats,
        lastSyncStatsHistory: state.lastSyncStatsHistory || [],
        dirtyProjectIds: Array.from(dirtyProjectIds),
      };
      localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(payload));
    } catch {}
  };

  const loadSyncState = (): Partial<PersistedSyncState> | null => {
    try {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem(SYNC_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedSyncState;
      if (!parsed || typeof parsed !== "object") return null;
      return {
        lastQuotaStatus: parsed.lastQuotaStatus ?? null,
        lastSyncedAt: parsed.lastSyncedAt ?? null,
        lastSyncStats: parsed.lastSyncStats ?? null,
        lastSyncStatsHistory: Array.isArray(parsed.lastSyncStatsHistory) ? parsed.lastSyncStatsHistory.slice(0, SYNC_STATS_HISTORY_LIMIT) : [],
        dirtyProjectIds: Array.isArray(parsed.dirtyProjectIds) ? parsed.dirtyProjectIds : undefined,
      };
    } catch {
      return null;
    }
  };

  const updatePendingSyncCount = () => {
    set({ pendingSyncCount: dirtyProjectIds.size });
  };

  // wrappedSet: recebe uma função que transforma a lista de projetos
  const wrappedSet = (fn: (s: Project[]) => Project[]) => {
    // atualiza o estado
    set((state) => {
      const next = fn(state.projects);
      return { projects: next };
    });
    // persiste a versão atualizada
    try {
      const after = get().projects;
      persist(after);
    } catch (e) {
      logWarn("persist failed", e);
    }
  };

  // Debounce map para evitar múltiplas syncs do mesmo projeto em sequência
  const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const syncRetryCount = new Map<string, number>();
  const dirtyProjectIds = new Set<string>();
  const MAX_SYNC_RETRIES = 10;
  const inFlightSyncProjectIds = new Set<string>();
  const syncedProjectHash = new Map<string, string>();
  const syncFailureCountByProject = new Map<string, number>();
  const syncBackoffUntilByProject = new Map<string, number>();
  let consecutiveSyncFailures = 0;
  let firstFailureAtMs = 0;

  const sanitizeProjectForSync = (project: Project): Project => sanitizeProjectForStorage(project);

  const buildProjectHash = (project: Project): string => {
    const normalized = sanitizeProjectForSync(project);
    const normalizedSections = [...(normalized.sections || [])]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((section) => ({
        id: section.id,
        title: section.title,
        content: section.content || "",
        parentId: section.parentId || null,
        order: section.order,
        color: section.color || null,
        addons: section.addons || [],
      }));

    const payload = {
      id: normalized.id,
      title: normalized.title,
      description: normalized.description || "",
      updatedAt: normalized.updatedAt,
      mindMapSettings: normalized.mindMapSettings || null,
      sections: normalizedSections,
    };

    return JSON.stringify(payload);
  };

  const getBackoffDelayMs = (failureCount: number): number => {
    const raw = Math.min(SYNC_BACKOFF_BASE_MS * Math.pow(2, Math.max(0, failureCount - 1)), SYNC_BACKOFF_MAX_MS);
    const jitter = Math.floor(raw * Math.random() * 0.2);
    return raw + jitter;
  };

  const clearProjectBackoff = (projectId: string) => {
    syncFailureCountByProject.delete(projectId);
    syncBackoffUntilByProject.delete(projectId);
  };

  const isProjectBackoffActive = (projectId: string) => {
    const backoffUntil = syncBackoffUntilByProject.get(projectId);
    if (!backoffUntil) return false;
    if (Date.now() >= backoffUntil) {
      syncBackoffUntilByProject.delete(projectId);
      return false;
    }
    return true;
  };

  const isCloudSyncPaused = () => {
    const pausedUntil = get().cloudSyncPausedUntil;
    if (!pausedUntil) return false;

    const pausedUntilMs = new Date(pausedUntil).getTime();
    if (!Number.isFinite(pausedUntilMs)) return false;

    if (Date.now() >= pausedUntilMs) {
      set({ cloudSyncPausedUntil: null, cloudSyncPauseReason: null, lastSyncError: null, lastSyncFailureReason: null, syncStatus: "idle" });
      consecutiveSyncFailures = 0;
      firstFailureAtMs = 0;
      return false;
    }

    return true;
  };

  const registerSyncFailure = (projectId: string, errorMessage: string) => {
    const now = Date.now();
    if (!firstFailureAtMs || now - firstFailureAtMs > SYNC_FAILURE_WINDOW_MS) {
      firstFailureAtMs = now;
      consecutiveSyncFailures = 1;
    } else {
      consecutiveSyncFailures += 1;
    }

    if (consecutiveSyncFailures >= SYNC_CIRCUIT_BREAKER_THRESHOLD) {
      const pausedUntil = new Date(now + SYNC_CIRCUIT_BREAKER_COOLDOWN_MS).toISOString();
      set({
        cloudSyncPausedUntil: pausedUntil,
        cloudSyncPauseReason: "failures",
        syncStatus: "idle",
        lastSyncError: "Cloud sync pausado temporariamente devido a falhas repetidas.",
        lastSyncFailureReason: errorMessage,
      });
      return;
    }

    const projectFailures = (syncFailureCountByProject.get(projectId) || 0) + 1;
    syncFailureCountByProject.set(projectId, projectFailures);
    const backoffDelay = getBackoffDelayMs(projectFailures);
    syncBackoffUntilByProject.set(projectId, now + backoffDelay);
    setTimeout(() => debouncedSync(projectId), backoffDelay);

    set({ syncStatus: "error", lastSyncError: errorMessage, lastSyncFailureReason: errorMessage });
  };

  const clearSyncFailureState = () => {
    consecutiveSyncFailures = 0;
    firstFailureAtMs = 0;
  };

  const getProjectSnapshotForSync = (projectId: string): Project | null => {
    const fromState = get().projects.find((p) => p.id === projectId);
    if (fromState) return fromState;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = parseProjectsFromStorage(raw);
      if (!parsed) return null;
      return parsed.find((p) => p.id === projectId) || null;
    } catch {
      return null;
    }
  };

  const markProjectDirty = (projectId: string) => {
    dirtyProjectIds.add(projectId);
    updatePendingSyncCount();
    persistSyncState();
  };

  const clearProjectDirty = (projectId: string) => {
    dirtyProjectIds.delete(projectId);
    updatePendingSyncCount();
    persistSyncState();
  };

  const syncNow = async (projectId: string) => {
    if (isCloudSyncPaused()) return;
    if (isProjectBackoffActive(projectId)) return;
    if (inFlightSyncProjectIds.has(projectId)) return;

    const project = getProjectSnapshotForSync(projectId);
    if (!project) return;

    const projectHash = buildProjectHash(project);
    const previousHash = syncedProjectHash.get(projectId);
    if (previousHash && previousHash === projectHash) {
      clearProjectDirty(projectId);
      return;
    }

    inFlightSyncProjectIds.add(projectId);

    try {
      set({ syncStatus: "syncing", lastSyncError: null });

      const { error, errorCode, structuralLimitReason, skippedReason, stats, quota, partial, remainingCreditsNeeded, syncedBy } =
        await upsertProjectToSupabase(sanitizeProjectForSync(project));
      if (quota) {
        set({ lastQuotaStatus: quota });
        persistSyncState();
      }
      if (error) {
        if (errorCode === "project_deleted") {
          get().removeProjectLocally(projectId);
          set({ syncStatus: "idle", lastSyncError: null });
          return;
        }
        if (errorCode === "quota_exceeded") {
          const until = quota?.windowEndsAt || null;
          const nextError =
            quota && Number.isFinite(quota.remainingInWindow)
              ? `Limite de créditos de sync por hora atingido (${quota.usedInWindow}/${quota.limitPerHour}).`
              : "Limite de créditos de sync por hora atingido.";
          set({
            syncStatus: "error",
            lastSyncError: nextError,
            lastSyncFailureReason: "quota_exceeded",
            cloudSyncPausedUntil: until,
            cloudSyncPauseReason: until ? "quota" : null,
            ...(quota ? { lastQuotaStatus: quota } : {}),
          });
          persistSyncState();
          return;
        }
        if (errorCode === "rate_limit") {
          const until = new Date(Date.now() + 60 * 1000).toISOString();
          set({
            syncStatus: "error",
            lastSyncError: "Muitas requisições de sync por minuto. Tente em breve.",
            cloudSyncPausedUntil: until,
            cloudSyncPauseReason: "rate_limit",
          });
          return;
        }
        if (errorCode === "structural_limit_exceeded") {
          const msg =
            structuralLimitReason === "projects_limit"
              ? "Limite do plano Free: máximo de 2 projetos."
              : structuralLimitReason === "sections_per_project_limit"
                ? `Limite do plano Free: máximo de ${FREE_MAX_SECTIONS_PER_PROJECT} seções por projeto.`
                : structuralLimitReason === "sections_total_limit"
                  ? `Limite do plano Free: máximo de ${FREE_MAX_SECTIONS_TOTAL} seções na conta.`
                  : "Limite estrutural do plano Free atingido.";
          set({ syncStatus: "error", lastSyncError: msg });
          return;
        }
        const reasonWithCode = errorCode ? `${error} (passo: ${errorCode})` : error;
        console.error("[projectStore] Falha no sync imediato:", reasonWithCode);
        registerSyncFailure(projectId, reasonWithCode);
        return;
      }

      if (!skippedReason) {
        if (!partial) {
          clearProjectDirty(projectId);
          syncRetryCount.delete(projectId);
          clearSyncFailureState();
          clearProjectBackoff(projectId);
          syncedProjectHash.set(projectId, projectHash);
        }
        const syncedAt = new Date().toISOString();
        const partialMessage =
          partial && typeof remainingCreditsNeeded === "number"
            ? ` Sincronização parcial: faltam ${remainingCreditsNeeded} crédito(s). Sincronize novamente após o reset da janela.`
            : "";
        if (stats) {
          const currentHistory = get().lastSyncStatsHistory;
          const nextEntry: LastSyncStats = {
            projectId,
            syncedAt,
            ...stats,
            creditsConsumed: quota?.consumedThisSync,
            ...(syncedBy ? { syncedByUserId: syncedBy.userId, syncedByDisplayName: syncedBy.displayName } : {}),
          };
          set({
            syncStatus: "synced",
            lastSyncedAt: syncedAt,
            lastSyncError: partial ? partialMessage.trim() : null,
            lastSyncFailureReason: null,
            lastSyncStats: nextEntry,
            lastSyncStatsHistory: [nextEntry, ...currentHistory].slice(0, SYNC_STATS_HISTORY_LIMIT),
            cloudSyncPausedUntil: null,
            cloudSyncPauseReason: null,
          });
        } else {
          set({
            syncStatus: "synced",
            lastSyncedAt: syncedAt,
            lastSyncError: partial ? partialMessage.trim() : null,
            lastSyncFailureReason: null,
            cloudSyncPausedUntil: null,
            cloudSyncPauseReason: null,
          });
        }
        persistSyncState();
        return;
      }

      if (skippedReason === "unauthenticated") {
        set({ syncStatus: "idle" });
        const retries = syncRetryCount.get(projectId) || 0;
        if (retries < MAX_SYNC_RETRIES) {
          syncRetryCount.set(projectId, retries + 1);
          setTimeout(() => debouncedSync(projectId), 2000);
        } else {
          logWarn("[projectStore] Sync abandonado após tentativas sem sessão:", projectId);
          set({ syncStatus: "error", lastSyncError: "Sessão não autenticada para sincronização." });
        }
      }
    } finally {
      inFlightSyncProjectIds.delete(projectId);
    }
  };

  const debouncedSync = (projectId: string) => {
    if (isCloudSyncPaused()) return;
    if (!get().persistenceConfig.syncAutomatic) return;

    const debounceMs = get().persistenceConfig.debounceMs;
    if (syncTimers.has(projectId)) clearTimeout(syncTimers.get(projectId)!);
    syncTimers.set(
      projectId,
      setTimeout(async () => {
        syncTimers.delete(projectId);
        const project = getProjectSnapshotForSync(projectId);
        if (project) {
          await syncNow(projectId);
        } else {
          logWarn("[projectStore] Projeto não encontrado para sync:", projectId);
        }
      }, debounceMs)
    );
  };

  // wrappedSet com Supabase sync
  const wrappedSetWithSync = (fn: (s: Project[]) => Project[], affectedProjectId?: string) => {
    wrappedSet(fn);
    if (affectedProjectId) {
      markProjectDirty(affectedProjectId);
      debouncedSync(affectedProjectId);
    }
  };

  return {
    projects: [],
    syncStatus: "idle",
    cloudSyncPausedUntil: null,
    cloudSyncPauseReason: null,
    lastSyncFailureReason: null,
    pendingSyncCount: 0,
    lastSyncedAt: null,
    lastSyncStats: null,
    lastSyncStatsHistory: [],
    lastQuotaStatus: null,
    lastSyncError: null,
    persistenceConfig: loadPersistenceConfig(),
    userId: null,
    lastConsistencyAnalysisByProject: {},
    lastRelationsAnalysisByProject: {},

    updatePersistenceConfig: (config: Partial<PersistenceConfig>) => {
      const current = get().persistenceConfig;
      const next = { ...current, ...config };
      set({ persistenceConfig: next });
      persistPersistenceConfig(next);
    },

    setUserId: (id: string | null) => {
      set({ userId: id });
      // Não agendar sync aqui: ao fazer login isso disparava sync de todos os projetos e consumia créditos.
      // Projetos só locais (localOnly) são enviados em loadFromSupabase; edições disparam sync via wrappedSetWithSync.
    },

    addProject: (name: string, description: string) => {
      const { projects, userId } = get();
      const myCount = projects.filter((p) => p.ownerId === userId || (p.ownerId == null && userId)).length;
      if (myCount >= FREE_MAX_PROJECTS) {
        throw new Error("structural_limit_projects");
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      wrappedSetWithSync(
        (prev) => [
          ...prev,
          { id, title: name, description, sections: [], createdAt: now, updatedAt: now, ownerId: userId ?? undefined },
        ],
        id
      );
      void syncNow(id);
      return id;
    },

    getProject: (id: UUID) => {
      return get().projects.find((p) => p.id === id);
    },

    addSection: (projectId: UUID, title: string, content?: string, createdBy?: SectionAuditBy) => {
      const projects = get().projects;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return "" as UUID;
      const sectionsInProject = (project.sections || []).length;
      if (sectionsInProject >= FREE_MAX_SECTIONS_PER_PROJECT) {
        throw new Error("structural_limit_sections_per_project");
      }
      const totalSections = projects.reduce((sum, p) => sum + (p.sections || []).length, 0);
      if (totalSections >= FREE_MAX_SECTIONS_TOTAL) {
        throw new Error("structural_limit_sections_total");
      }
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const audit = createdBy
        ? { created_by: createdBy.userId, created_by_name: createdBy.displayName ?? null, updated_at: now, updated_by: createdBy.userId, updated_by_name: createdBy.displayName ?? null }
        : {};
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const siblings = (p.sections || []).filter((s) => !s.parentId);
              const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order || 0)) : -1;
              return {
                ...p,
                updatedAt: now,
                sections: [
                  ...(p.sections || []),
                  { id: newId, title, content: content || "", created_at: now, parentId: undefined, order: maxOrder + 1, ...audit } as Section,
                ],
              };
            }
            return p;
          }),
        projectId
      );
      return newId;
    },

    addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string, createdBy?: SectionAuditBy) => {
      const projects = get().projects;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return "" as UUID;
      const sectionsInProject = (project.sections || []).length;
      if (sectionsInProject >= FREE_MAX_SECTIONS_PER_PROJECT) {
        throw new Error("structural_limit_sections_per_project");
      }
      const totalSections = projects.reduce((sum, p) => sum + (p.sections || []).length, 0);
      if (totalSections >= FREE_MAX_SECTIONS_TOTAL) {
        throw new Error("structural_limit_sections_total");
      }
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const audit = createdBy
        ? { created_by: createdBy.userId, created_by_name: createdBy.displayName ?? null, updated_at: now, updated_by: createdBy.userId, updated_by_name: createdBy.displayName ?? null }
        : {};
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const siblings = (p.sections || []).filter((s) => s.parentId === parentId);
              const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order || 0)) : -1;
              return {
                ...p,
                updatedAt: now,
                sections: [
                  ...(p.sections || []),
                  { id: newId, title, content: content || "", created_at: now, parentId, order: maxOrder + 1, ...audit } as Section,
                ],
              };
            }
            return p;
          }),
        projectId
      );
      return newId;
    },

    removeProject: (id: UUID) => {
      wrappedSet((prev) => prev.filter((p) => p.id !== id));
      clearProjectDirty(id);
      syncedProjectHash.delete(id);
      clearProjectBackoff(id);
      deleteProjectFromSupabase(id).then(({ error }) => {
        if (error) {
          console.error("[projectStore] Falha ao deletar projeto no Supabase:", error);
          get().loadFromSupabase();
        } else {
          logInfo("[projectStore] Projeto deletado no Supabase:", id);
        }
      });
    },

    removeProjectLocally: (id: UUID) => {
      wrappedSet((prev) => prev.filter((p) => p.id !== id));
      clearProjectDirty(id);
      syncedProjectHash.delete(id);
      clearProjectBackoff(id);
      try {
        const next = get().projects;
        persist(next);
      } catch {}
      persistSyncState();
    },

    editProject: (id: UUID, name: string, description: string) => {
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, title: name, description, updatedAt: new Date().toISOString() }
              : p
          ),
        id
      );
    },

    setProjectCoverImage: (id: UUID, coverImageUrl?: string) => {
      const normalizedCoverUrl =
        typeof coverImageUrl === "string" && coverImageUrl.trim()
          ? coverImageUrl.trim()
          : undefined;
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, coverImageUrl: normalizedCoverUrl, updatedAt: new Date().toISOString() }
              : p
          ),
        id
      );
    },

    editSection: (
      projectId: UUID,
      sectionId: UUID,
      title: string,
      content: string,
      parentId?: string | null,
      color?: string,
      updatedBy?: SectionAuditBy,
      domainTags?: string[],
      addons?: SectionAddon[]
    ) => {
      const now = new Date().toISOString();
      const audit: Partial<Section> = { updated_at: now };
      if (updatedBy) {
        audit.updated_by = updatedBy.userId;
        audit.updated_by_name = updatedBy.displayName ?? null;
      }
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) => {
                    if (s.id === sectionId) {
                      const updated: Section = { ...s, title, content, ...audit };
                      const isColorPassedAsParentId =
                        typeof parentId === "string" && parentId.startsWith("#") && color === undefined;

                      const resolvedParentId = isColorPassedAsParentId ? undefined : parentId;
                      const resolvedColor = isColorPassedAsParentId ? parentId : color;

                      if (resolvedParentId !== undefined) {
                        if (resolvedParentId === null) delete updated.parentId;
                        else updated.parentId = resolvedParentId;
                      }
                      if (resolvedColor !== undefined) updated.color = resolvedColor;
                      else if (resolvedColor === undefined) delete updated.color;
                      if (domainTags !== undefined) updated.domainTags = domainTags.length ? domainTags : undefined;
                      if (addons !== undefined) updated.addons = addons.length ? addons : undefined;
                      return updated;
                    }
                    return s;
                  }),
                }
              : p
          ),
        projectId
      );
    },

    setSectionAddons: (projectId: UUID, sectionId: UUID, addons: SectionAddon[], updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      get().editSection(
        projectId,
        sectionId,
        section.title,
        section.content || "",
        undefined,
        section.color,
        updatedBy,
        section.domainTags,
        addons
      );
    },
    addSectionAddon: (projectId: UUID, sectionId: UUID, addon: SectionAddon, updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const current = section.addons || [];
      get().setSectionAddons(projectId, sectionId, [...current, addon], updatedBy);
    },
    updateSectionAddon: (projectId: UUID, sectionId: UUID, addonId: string, nextAddon: SectionAddon, updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const current = section.addons || [];
      get().setSectionAddons(
        projectId,
        sectionId,
        current.map((addon) => (addon.id === addonId ? nextAddon : addon)),
        updatedBy
      );
    },
    removeSectionAddon: (projectId: UUID, sectionId: UUID, addonId: string, updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const current = section.addons || [];
      get().setSectionAddons(
        projectId,
        sectionId,
        current.filter((addon) => addon.id !== addonId),
        updatedBy
      );
    },

    removeSection: (projectId: UUID, sectionId: UUID) => {
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, updatedAt: new Date().toISOString(), sections: (p.sections || []).filter((s) => s.id !== sectionId) }
              : p
          ),
        projectId
      );
    },

    moveSectionUp: (projectId: UUID, sectionId: UUID) => {
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const sections = p.sections || [];
            const section = sections.find((s) => s.id === sectionId);
            if (!section) return p;
            const siblings = sections.filter((s) => s.parentId === section.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = siblings.findIndex((s) => s.id === sectionId);
            if (currentIndex <= 0) return p;
            const prevSection = siblings[currentIndex - 1];
            const tempOrder = section.order;
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: sections.map((s) => {
                if (s.id === sectionId) return { ...s, order: prevSection.order };
                if (s.id === prevSection.id) return { ...s, order: tempOrder };
                return s;
              }),
            };
          }),
        projectId
      );
    },

    moveSectionDown: (projectId: UUID, sectionId: UUID) => {
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const sections = p.sections || [];
            const section = sections.find((s) => s.id === sectionId);
            if (!section) return p;
            const siblings = sections.filter((s) => s.parentId === section.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = siblings.findIndex((s) => s.id === sectionId);
            if (currentIndex === -1 || currentIndex >= siblings.length - 1) return p;
            const nextSection = siblings[currentIndex + 1];
            const tempOrder = section.order;
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: sections.map((s) => {
                if (s.id === sectionId) return { ...s, order: nextSection.order };
                if (s.id === nextSection.id) return { ...s, order: tempOrder };
                return s;
              }),
            };
          }),
        projectId
      );
    },

    reorderSections: (projectId: UUID, sectionIds: UUID[]) => {
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const sections = p.sections || [];
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: sections.map((s) => {
                const newIndex = sectionIds.indexOf(s.id);
                return newIndex !== -1 ? { ...s, order: newIndex } : s;
              }),
            };
          }),
        projectId
      );
    },

    countDescendants: (projectId: UUID, sectionId: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return 0;
      
      const sections = project.sections || [];
      const countChildren = (parentId: UUID): number => {
        const children = sections.filter((s) => s.parentId === parentId);
        return children.reduce((sum, child) => sum + 1 + countChildren(child.id), 0);
      };
      
      return countChildren(sectionId);
    },

    hasDuplicateName: (projectId: UUID, title: string, parentId?: UUID, excludeId?: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return false;
      
      const siblings = (project.sections || []).filter(
        (s) => s.parentId === parentId && s.id !== excludeId
      );
      
      return siblings.some((s) => s.title.toLowerCase() === title.toLowerCase());
    },

    loadFromStorage: () => {
      try {
        const analyses = loadLastAnalyses();
        if (Object.keys(analyses).length > 0) {
          set({ lastConsistencyAnalysisByProject: analyses });
        }
        const relations = loadLastRelations();
        if (Object.keys(relations).length > 0) {
          set({ lastRelationsAnalysisByProject: relations });
        }
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = parseProjectsFromStorage(raw);
        if (!parsed) return;
        if (Array.isArray(parsed)) {
          // Migration: Add createdAt/updatedAt to old projects
          const migrated = parsed.map(p => {
            const now = new Date().toISOString();
            return {
              ...p,
              createdAt: p.createdAt || now,
              updatedAt: p.updatedAt || now,
            };
          });
          set({ projects: migrated });
          // Persist migrated data
          persist(migrated);
        }
        // Restaurar estado de exibição do sync (créditos, último sync, histórico) e projetos pendentes após refresh/login
        const savedSync = loadSyncState();
        if (savedSync?.dirtyProjectIds && Array.isArray(savedSync.dirtyProjectIds)) {
          const validIds = new Set(get().projects.map((p) => p.id));
          dirtyProjectIds.clear();
          savedSync.dirtyProjectIds.forEach((id: string) => {
            if (validIds.has(id)) dirtyProjectIds.add(id);
          });
          updatePendingSyncCount();
        }
        if (savedSync && (savedSync.lastQuotaStatus ?? savedSync.lastSyncedAt ?? savedSync.lastSyncStats)) {
          const prevStatus = get().syncStatus;
          const quota = savedSync.lastQuotaStatus;
          const quotaStillValid = quota && new Date(quota.windowEndsAt).getTime() > Date.now();
          set({
            lastQuotaStatus: quotaStillValid ? quota : null,
            lastSyncedAt: savedSync.lastSyncedAt ?? null,
            lastSyncStats: savedSync.lastSyncStats ?? null,
            lastSyncStatsHistory: savedSync.lastSyncStatsHistory ?? [],
            syncStatus: savedSync.lastSyncedAt ? "synced" : prevStatus,
          });
        }
      } catch (e) {
        logWarn("Failed to load projects from localStorage", e);
      }
    },

    setLastConsistencyAnalysis: (projectId: string, data: LastConsistencyAnalysis) => {
      const next = { ...get().lastConsistencyAnalysisByProject, [projectId]: data };
      set({ lastConsistencyAnalysisByProject: next });
      persistLastAnalyses(next);
    },

    getLastConsistencyAnalysis: (projectId: string) => {
      return get().lastConsistencyAnalysisByProject[projectId];
    },

    setLastRelationsAnalysis: (projectId: string, data: LastRelationsAnalysis) => {
      const next = { ...get().lastRelationsAnalysisByProject, [projectId]: data };
      set({ lastRelationsAnalysisByProject: next });
      persistLastRelations(next);
    },

    getLastRelationsAnalysis: (projectId: string) => {
      return get().lastRelationsAnalysisByProject[projectId];
    },

    persistToStorage: () => {
      try {
        persist(get().projects);
      } catch (e) {
        logWarn("persistToStorage failed", e);
      }
    },

    syncProjectToSupabase: async (projectId: UUID) => {
      markProjectDirty(projectId);
      await syncNow(projectId);
    },

    getPendingProjectIds: () => Array.from(dirtyProjectIds),

    clearSyncHistory: () => {
      set({ lastSyncStatsHistory: [] });
      persistSyncState();
    },

    refreshQuotaStatus: async (projectId?: string) => {
      if (!projectId) {
        set({ lastQuotaStatus: null });
        persistSyncState();
        return;
      }
      const q = await fetchQuotaStatus(projectId);
      if (q) {
        set({ lastQuotaStatus: q });
        persistSyncState();
      }
    },

    setProjectOwnerLocally: (projectId: UUID, ownerId: string) => {
      wrappedSet((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, ownerId, updatedAt: new Date().toISOString() }
            : p
        )
      );
    },

    flushPendingSyncs: async () => {
      if (isCloudSyncPaused()) return;

      const pendingIds = Array.from(dirtyProjectIds);
      if (pendingIds.length === 0) return;

      set({ syncStatus: "syncing", lastSyncError: null });

      await Promise.all(
        pendingIds.map(async (projectId) => {
          await syncNow(projectId);
        })
      );

      if (dirtyProjectIds.size === 0) {
        set({ syncStatus: "synced", lastSyncedAt: new Date().toISOString() });
      }
    },

    loadFromSupabase: async () => {
      const remote = await fetchProjectsFromSupabase();
      if (remote === null) return "error";

      // Garante que temos os dados locais para fazer merge
      let localProjects = get().projects;
      if (localProjects.length === 0) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = parseProjectsFromStorage(raw);
            if (parsed) localProjects = parsed;
          }
        } catch {}
      }

      // Projetos deletados pelo dono: remover da lista local para membros não re-criarem como owner
      const localIds = localProjects.map((p) => p.id);
      if (localIds.length > 0) {
        const deletedIds = await fetchDeletedProjectIds(localIds);
        deletedIds.forEach((id) => get().removeProjectLocally(id));
        localProjects = get().projects;
        if (localProjects.length === 0) {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const parsed = parseProjectsFromStorage(raw);
              if (parsed) localProjects = parsed;
            }
          } catch {}
        }
      }

      // Se nuvem está vazia, sinaliza para o hook de init disparar migração
      if (remote.length === 0) return "empty";

      // Re-lê o estado local antes do merge (pode ter mudado durante o fetch)
      localProjects = get().projects;
      if (localProjects.length === 0) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = parseProjectsFromStorage(raw);
            if (parsed) localProjects = parsed;
          }
        } catch {}
      }

      // ── Merge inteligente ─────────────────────────────────────────────────
      // Regra: prefere local se mais recente ou se tiver mais seções (evita perda quando sync falhou).
      // Projetos que só existem localmente (ainda não sincronizados) são MANTIDOS
      // e automaticamente enviados ao cloud.
      const remoteById = new Map(remote.map((p) => [p.id, p] as const));
      const remoteIds = new Set(remoteById.keys());
      const localOnly = localProjects.filter((p) => !remoteIds.has(p.id));
      const localNewerSameId = localProjects.filter((localProject) => {
        const remoteProject = remoteById.get(localProject.id);
        if (!remoteProject) return false;
        return new Date(localProject.updatedAt) > new Date(remoteProject.updatedAt);
      });

      const merged: Project[] = [
        ...remote.map((remoteProject) => {
          const local = localProjects.find((p) => p.id === remoteProject.id);
          if (!local) return remoteProject;
          const localUpdated = new Date(local.updatedAt).getTime();
          const remoteUpdated = new Date(remoteProject.updatedAt).getTime();
          const localSections = (local.sections || []).length;
          const remoteSections = (remoteProject.sections || []).length;
          // Prefere local se for mais recente OU se tiver mais seções (evita perder dados quando sync de seções falhou)
          const preferLocal =
            localUpdated > remoteUpdated || (localUpdated >= remoteUpdated && localSections >= remoteSections);
          return preferLocal ? local : remoteProject;
        }),
        ...localOnly, // Projetos que só existem localmente
      ];

      const totalSections = (arr: Project[]) =>
        arr.reduce((sum, p) => sum + (p.sections || []).length, 0);
      const mergedCount = totalSections(merged);

      // Nunca perder projeto nem seções: preferir sempre a versão com mais seções por projeto.
      // Re-lê estado atual (memória + localStorage) e garante que nenhum projeto seja removido ou encolhido.
      let toApply = merged;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const current = raw ? parseProjectsFromStorage(raw) : null;
        const inMemory = get().projects;
        const localById = new Map<string, Project>();
        for (const p of [...(current || []), ...inMemory]) {
          const existing = localById.get(p.id);
          const n = (p.sections || []).length;
          const existingN = existing ? (existing.sections || []).length : 0;
          if (!existing || n > existingN) localById.set(p.id, p);
        }
        const applyById = new Map(toApply.map((p) => [p.id, p]));
        for (const [id, localProject] of localById) {
          const applied = applyById.get(id);
          const localSections = (localProject.sections || []).length;
          const appliedSections = applied ? (applied.sections || []).length : 0;
          if (!applied || localSections > appliedSections) {
            applyById.set(id, localProject);
            if (!applied) logInfo("[projectStore] Mantendo projeto só local no merge:", id);
            else if (localSections > appliedSections) logInfo("[projectStore] Preferindo versão local com mais seções:", id);
          }
        }
        toApply = Array.from(applyById.values());
      } catch (e) {
        logWarn("[projectStore] Erro ao fazer merge defensivo; mantendo merged.", e);
      }

      set({ projects: toApply });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProjectsForStorage(toApply)));
      } catch {}

      // Sobe ao cloud apenas projetos que ainda não existem no servidor (localOnly).
      // Não disparamos sync para "localNewerSameId" aqui: após um load, comparação de datas
      // (ex.: formato do Supabase vs localStorage) pode dar falso positivo e consumir créditos no login.
      // Edições do usuário continuam disparando sync normalmente via wrappedSetWithSync.
      if (localOnly.length > 0) {
        logInfo(`[projectStore] Subindo ${localOnly.length} projeto(s) novos (só locais) para o cloud...`);
        localOnly.forEach((p) => {
          markProjectDirty(p.id);
          debouncedSync(p.id);
        });
      }

      return "loaded";
    },

    importProject: (project: Project) => {
      wrappedSetWithSync((prev) => {
        const filtered = prev.filter(p => p.id !== project.id);
        return [...filtered, project];
      }, project.id);
    },

    importAllProjects: (projects: Project[]) => {
      wrappedSet(() => projects);
      // Sincroniza todos os projetos com o Supabase
      projects.forEach((p) => {
        markProjectDirty(p.id);
        debouncedSync(p.id);
      });
    },

    updateProjectSettings: (projectId: UUID, settings: MindMapSettings) => {
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, mindMapSettings: settings, updatedAt: new Date().toISOString() }
              : p
          ),
        projectId
      );
    },

    updateProjectMindMapSettingsOnly: (projectId: UUID, settings: MindMapSettings) => {
      wrappedSet((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, mindMapSettings: settings, updatedAt: new Date().toISOString() }
            : p
        )
      );
    },
  };
});
