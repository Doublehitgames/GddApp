import type { ProjectStore, UUID, Project, PersistenceConfig, MindMapSettings } from "./types";
import { STORAGE_KEY } from "./types";
import {
  loadDiagrams,
  parseProjectsFromStorage,
  persist,
  persistPersistenceConfig,
  logWarn,
} from "./storageHelpers";
import type { SyncEngineAPI } from "./syncEngine";

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

export function createPersistenceSlice(set: StoreSet, get: StoreGet, engine: SyncEngineAPI) {
  return {
    updatePersistenceConfig: (config: Partial<PersistenceConfig>) => {
      const current = get().persistenceConfig;
      const next = { ...current, ...config };
      set({ persistenceConfig: next });
      persistPersistenceConfig(next);
    },

    setUserId: (id: string | null) => {
      set({ userId: id });
      // Nao agendar sync aqui: ao fazer login isso disparava sync de todos os projetos e consumia creditos.
      // Projetos so locais (localOnly) sao enviados em loadFromSupabase; edicoes disparam sync via wrappedSetWithSync.
      if (id) {
        void get().fetchAppLimits();
        void get().fetchProjectOwners();
      } else {
        set({ ownersById: {} });
      }
    },

    loadFromStorage: () => {
      try {
        const diagrams = loadDiagrams();
        if (Object.keys(diagrams).length > 0) {
          set({ diagramsBySection: diagrams });
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
        // Restaurar estado de exibicao do sync (creditos, ultimo sync, historico) e projetos pendentes apos refresh/login
        const savedSync = engine.loadSyncState();
        if (savedSync?.dirtyProjectIds && Array.isArray(savedSync.dirtyProjectIds)) {
          const validIds = new Set(get().projects.map((p) => p.id));
          engine.dirtyProjectIds.clear();
          savedSync.dirtyProjectIds.forEach((id: string) => {
            if (validIds.has(id)) engine.dirtyProjectIds.add(id);
          });
          engine.updatePendingSyncCount();
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

    persistToStorage: () => {
      try {
        persist(get().projects);
      } catch (e) {
        logWarn("persistToStorage failed", e);
      }
    },

    importProject: (project: Project) => {
      engine.wrappedSetWithSync((prev) => {
        const filtered = prev.filter(p => p.id !== project.id);
        return [...filtered, project];
      }, project.id);
    },

    importAllProjects: (projects: Project[]) => {
      engine.wrappedSet(() => projects);
      // Sincroniza todos os projetos com o Supabase
      projects.forEach((p) => {
        engine.markProjectDirty(p.id);
        engine.debouncedSync(p.id);
      });
    },

    updateProjectSettings: (projectId: UUID, settings: MindMapSettings) => {
      engine.wrappedSetWithSync(
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
      engine.wrappedSet((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, mindMapSettings: settings, updatedAt: new Date().toISOString() }
            : p
        )
      );
    },

    loadRoadmapFromSupabase: async () => {
      try {
        const userId = (get() as ProjectStore & { userId?: string }).userId;
        if (!userId) return;
        const projects = get().projects as Array<{ id: string; ownerId?: string | null }>;
        if (projects.length === 0) return;

        const {
          fetchRoadmaps, upsertRoadmaps,
          fetchRoadmapPhases, upsertRoadmapPhases,
          fetchRoadmapThemes, upsertRoadmapThemes,
          fetchRoadmapItems, upsertRoadmapItems,
        } = await import("@/lib/supabase/roadmapSync");
        const {
          persistRoadmaps, persistRoadmapPhases, persistRoadmapThemes, persistRoadmapItems,
        } = await import("./storageHelpers");

        const state = get() as ProjectStore & {
          roadmapsByProject: Record<string, import("@/lib/roadmap/types").Roadmap[]>;
          phasesByProject:   Record<string, import("@/lib/roadmap/types").RoadmapPhase[]>;
          themesByProject:   Record<string, import("@/lib/roadmap/types").RoadmapTheme[]>;
          itemsByProject:    Record<string, import("@/lib/roadmap/types").RoadmapItem[]>;
        };

        const roadmapUpdates: typeof state.roadmapsByProject = {};
        const phaseUpdates:   typeof state.phasesByProject   = {};
        const themeUpdates:   typeof state.themesByProject   = {};
        const itemUpdates:    typeof state.itemsByProject     = {};

        await Promise.all(
          projects.map(async (project) => {
            const projectId = project.id;
            const isOwner = !project.ownerId || project.ownerId === userId;

            // Membros lêem os dados do dono; donos lêem os próprios dados
            const fetchUserId = isOwner ? userId : (project.ownerId as string);

            const [remoteRoadmaps, remotePhases, remoteThemes, remoteItems] = await Promise.all([
              fetchRoadmaps(fetchUserId, projectId),
              fetchRoadmapPhases(fetchUserId, projectId),
              fetchRoadmapThemes(fetchUserId, projectId),
              fetchRoadmapItems(fetchUserId, projectId),
            ]);

            // Roadmaps
            if (remoteRoadmaps && remoteRoadmaps.length > 0) {
              roadmapUpdates[projectId] = remoteRoadmaps;
            } else if (isOwner) {
              const local = state.roadmapsByProject[projectId];
              if (local && local.length > 0) void upsertRoadmaps(userId, projectId, local);
            }
            // Phases
            if (remotePhases && remotePhases.length > 0) {
              phaseUpdates[projectId] = remotePhases;
            } else if (isOwner) {
              const local = state.phasesByProject[projectId];
              if (local && local.length > 0) void upsertRoadmapPhases(userId, projectId, local);
            }
            // Themes
            if (remoteThemes && remoteThemes.length > 0) {
              themeUpdates[projectId] = remoteThemes;
            } else if (isOwner) {
              const local = state.themesByProject[projectId];
              if (local && local.length > 0) void upsertRoadmapThemes(userId, projectId, local);
            }
            // Items
            if (remoteItems && remoteItems.length > 0) {
              itemUpdates[projectId] = remoteItems;
            } else if (isOwner) {
              const local = state.itemsByProject[projectId];
              if (local && local.length > 0) void upsertRoadmapItems(userId, projectId, local);
            }
          })
        );

        const hasRoadmaps = Object.keys(roadmapUpdates).length > 0;
        const hasPhases   = Object.keys(phaseUpdates).length > 0;
        const hasThemes   = Object.keys(themeUpdates).length > 0;
        const hasItems    = Object.keys(itemUpdates).length > 0;

        if (hasRoadmaps || hasPhases || hasThemes || hasItems) {
          const merged = {
            ...(hasRoadmaps ? { roadmapsByProject: { ...state.roadmapsByProject, ...roadmapUpdates } } : {}),
            ...(hasPhases   ? { phasesByProject:   { ...state.phasesByProject,   ...phaseUpdates   } } : {}),
            ...(hasThemes   ? { themesByProject:   { ...state.themesByProject,   ...themeUpdates   } } : {}),
            ...(hasItems    ? { itemsByProject:     { ...state.itemsByProject,    ...itemUpdates    } } : {}),
          };
          set(merged as Partial<ProjectStore>);
          if (hasRoadmaps) persistRoadmaps({ ...state.roadmapsByProject, ...roadmapUpdates });
          if (hasPhases)   persistRoadmapPhases({ ...state.phasesByProject, ...phaseUpdates });
          if (hasThemes)   persistRoadmapThemes({ ...state.themesByProject, ...themeUpdates });
          if (hasItems)    persistRoadmapItems({ ...state.itemsByProject, ...itemUpdates });
        }
      } catch (e) {
        console.warn("[roadmapSync] loadRoadmapFromSupabase failed", e);
      }
    },
  };
}
