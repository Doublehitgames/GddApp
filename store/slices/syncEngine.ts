import type { ProjectStore, Project, DiagramState, PersistedSyncState, LastSyncStats, Section } from "./types";
import {
  STORAGE_KEY, SYNC_STATE_KEY, SYNC_FAILURE_WINDOW_MS, SYNC_CIRCUIT_BREAKER_THRESHOLD,
  SYNC_CIRCUIT_BREAKER_COOLDOWN_MS, SYNC_BACKOFF_BASE_MS, SYNC_BACKOFF_MAX_MS,
  SYNC_STATS_HISTORY_LIMIT,
} from "./types";
import {
  upsertProjectToSupabase,
} from "@/lib/supabase/projectSync";
import {
  FREE_MAX_SECTIONS_PER_PROJECT,
  FREE_MAX_SECTIONS_TOTAL,
} from "@/lib/structuralLimits";
import {
  logInfo, logWarn, sanitizeProjectForStorage, parseProjectsFromStorage,
  persist, buildSectionDiagramKey, loadDiagrams,
} from "./storageHelpers";

// ---------------------------------------------------------------------------
// Module-level state (NOT inside any function)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Exported API type
// ---------------------------------------------------------------------------
export type SyncEngineAPI = {
  wrappedSet: (fn: (s: Project[]) => Project[]) => void;
  wrappedSetWithSync: (fn: (s: Project[]) => Project[], affectedProjectId?: string) => void;
  syncNow: (projectId: string) => Promise<void>;
  debouncedSync: (projectId: string) => void;
  markProjectDirty: (projectId: string) => void;
  clearProjectDirty: (projectId: string) => void;
  updatePendingSyncCount: () => void;
  persistSyncState: () => void;
  loadSyncState: () => Partial<PersistedSyncState> | null;
  cleanupSyncStateForProject: (projectId: string) => void;
  attachSectionFlowchartState: (project: Project, diagramsBySection: Record<string, DiagramState>) => Project;
  sanitizeProjectForSync: (project: Project) => Project;
  buildProjectHash: (project: Project) => string;
  buildProjectMetadataHash: (project: Project) => string;
  getProjectSnapshotForSync: (projectId: string) => Project | null;
  clearProjectBackoff: (projectId: string) => void;
  clearSyncFailureState: () => void;
  isCloudSyncPaused: () => boolean;
  syncedProjectHash: Map<string, string>;
  dirtyProjectIds: Set<string>;
  syncRetryCount: Map<string, number>;
  inFlightSyncProjectIds: Set<string>;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

export function createSyncEngine(set: StoreSet, get: StoreGet): SyncEngineAPI {
  // ----- updatePendingSyncCount -----
  const updatePendingSyncCount = () => {
    set({ pendingSyncCount: dirtyProjectIds.size });
  };

  // ----- wrappedSet -----
  const wrappedSet = (fn: (s: Project[]) => Project[]) => {
    // atualiza o estado
    set((state) => {
      const next = fn(state.projects);
      return { projects: next };
    });
    // persiste a versao atualizada
    try {
      const after = get().projects;
      persist(after);
    } catch (e) {
      logWarn("persist failed", e);
    }
  };

  // ----- attachSectionFlowchartState -----
  const attachSectionFlowchartState = (project: Project, diagramsBySection: Record<string, DiagramState>): Project => {
    const sections = (project.sections || []).map((section) => {
      const key = buildSectionDiagramKey(project.id, section.id);
      const diagram = diagramsBySection[key] || section.flowchartState;
      if (!section.flowchartEnabled) {
        return { ...section, flowchartState: undefined };
      }
      return { ...section, flowchartState: diagram };
    });
    return { ...project, sections };
  };

  // ----- sanitizeProjectForSync -----
  const sanitizeProjectForSync = (project: Project): Project => {
    const enriched = attachSectionFlowchartState(project, get().diagramsBySection);
    return sanitizeProjectForStorage(enriched);
  };

  // ----- buildProjectHash -----
  const buildProjectHash = (project: Project): string => {
    const normalized = sanitizeProjectForSync(project);
    const normalizedSections = [...(normalized.sections || [])]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((section) => ({
        id: section.id,
        title: section.title,
        thumbImageUrl: section.thumbImageUrl || null,
        flowchartState: section.flowchartState || null,
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

  // ----- buildProjectMetadataHash -----
  const buildProjectMetadataHash = (project: Project): string => {
    const normalized = sanitizeProjectForSync(project);
    const payload = {
      id: normalized.id,
      title: normalized.title,
      description: normalized.description || "",
      coverImageUrl: normalized.coverImageUrl || null,
      mindMapSettings: normalized.mindMapSettings || null,
    };
    return JSON.stringify(payload);
  };

  // ----- getBackoffDelayMs -----
  const getBackoffDelayMs = (failureCount: number): number => {
    const raw = Math.min(SYNC_BACKOFF_BASE_MS * Math.pow(2, Math.max(0, failureCount - 1)), SYNC_BACKOFF_MAX_MS);
    const jitter = Math.floor(raw * Math.random() * 0.2);
    return raw + jitter;
  };

  // ----- clearProjectBackoff -----
  const clearProjectBackoff = (projectId: string) => {
    syncFailureCountByProject.delete(projectId);
    syncBackoffUntilByProject.delete(projectId);
  };

  // ----- isProjectBackoffActive -----
  const isProjectBackoffActive = (projectId: string) => {
    const backoffUntil = syncBackoffUntilByProject.get(projectId);
    if (!backoffUntil) return false;
    if (Date.now() >= backoffUntil) {
      syncBackoffUntilByProject.delete(projectId);
      return false;
    }
    return true;
  };

  // ----- isCloudSyncPaused -----
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

  // ----- registerSyncFailure -----
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

  // ----- clearSyncFailureState -----
  const clearSyncFailureState = () => {
    consecutiveSyncFailures = 0;
    firstFailureAtMs = 0;
  };

  // ----- getProjectSnapshotForSync -----
  const getProjectSnapshotForSync = (projectId: string): Project | null => {
    const fromState = get().projects.find((p) => p.id === projectId);
    if (fromState) return attachSectionFlowchartState(fromState, get().diagramsBySection);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = parseProjectsFromStorage(raw);
      if (!parsed) return null;
      const fromStorage = parsed.find((p) => p.id === projectId) || null;
      if (!fromStorage) return null;
      const localDiagrams = loadDiagrams();
      return attachSectionFlowchartState(fromStorage, { ...localDiagrams, ...get().diagramsBySection });
    } catch {
      return null;
    }
  };

  // ----- persistSyncState -----
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

  // ----- loadSyncState -----
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

  // ----- markProjectDirty -----
  const markProjectDirty = (projectId: string) => {
    dirtyProjectIds.add(projectId);
    updatePendingSyncCount();
    persistSyncState();
  };

  // ----- clearProjectDirty -----
  const clearProjectDirty = (projectId: string) => {
    dirtyProjectIds.delete(projectId);
    updatePendingSyncCount();
    persistSyncState();
  };

  // ----- syncNow -----
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
          const nextEntry = {
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

  // ----- debouncedSync -----
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

  // ----- wrappedSetWithSync -----
  const wrappedSetWithSync = (fn: (s: Project[]) => Project[], affectedProjectId?: string) => {
    wrappedSet(fn);
    if (affectedProjectId) {
      markProjectDirty(affectedProjectId);
      debouncedSync(affectedProjectId);
    }
  };

  // ----- cleanupSyncStateForProject -----
  const cleanupSyncStateForProject = (projectId: string) => {
    clearProjectDirty(projectId);
    syncedProjectHash.delete(projectId);
    clearProjectBackoff(projectId);
    const timer = syncTimers.get(projectId);
    if (timer) { clearTimeout(timer); syncTimers.delete(projectId); }
    syncRetryCount.delete(projectId);
    inFlightSyncProjectIds.delete(projectId);
  };

  // ----- Return API -----
  return {
    wrappedSet,
    wrappedSetWithSync,
    syncNow,
    debouncedSync,
    markProjectDirty,
    clearProjectDirty,
    updatePendingSyncCount,
    persistSyncState,
    loadSyncState,
    cleanupSyncStateForProject,
    attachSectionFlowchartState,
    sanitizeProjectForSync,
    buildProjectHash,
    buildProjectMetadataHash,
    getProjectSnapshotForSync,
    clearProjectBackoff,
    clearSyncFailureState,
    isCloudSyncPaused,
    syncedProjectHash,
    dirtyProjectIds,
    syncRetryCount,
    inFlightSyncProjectIds,
  };
}
