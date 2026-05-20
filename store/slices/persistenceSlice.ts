import type { ProjectStore, UUID, Project, PersistenceConfig, MindMapSettings } from "./types";
import { STORAGE_KEY } from "./types";
import type { AgendaTask } from "@/lib/agenda/types";
import {
  loadLastAnalyses,
  loadLastRelations,
  loadDiagrams,
  loadAgendaTasks,
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
        const diagrams = loadDiagrams();
        if (Object.keys(diagrams).length > 0) {
          set({ diagramsBySection: diagrams });
        }
        const agendaTasks = loadAgendaTasks();
        if (Object.keys(agendaTasks).length > 0) {
          set({ tasksByProject: agendaTasks });
          // Restore activeTaskId: find any task that was running when browser closed
          for (const tasks of Object.values(agendaTasks)) {
            const running = tasks.find((t) => t.status === "running");
            if (running) { set({ activeTaskId: running.id }); break; }
          }
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

    loadAgendaFromSupabase: async () => {
      try {
        const userId = (get() as ProjectStore & { userId?: string }).userId;
        if (!userId) return;
        const projectIds = get().projects.map((p: { id: string }) => p.id);
        if (projectIds.length === 0) return;

        const { fetchAgendaTasks } = await import("@/lib/supabase/agendaSync");
        const { persistAgendaTasks } = await import("./storageHelpers");

        const updates: Record<string, AgendaTask[]> = {};
        await Promise.all(
          projectIds.map(async (projectId: string) => {
            const tasks = await fetchAgendaTasks(userId, projectId);
            if (tasks && tasks.length > 0) {
              updates[projectId] = tasks;
            }
          })
        );

        if (Object.keys(updates).length > 0) {
          const merged = { ...get().tasksByProject, ...updates };
          set({ tasksByProject: merged });
          persistAgendaTasks(merged);
        }
      } catch (e) {
        console.warn("[agendaSync] loadAgendaFromSupabase failed", e);
      }
    },

    loadRoadmapFromSupabase: async () => {
      try {
        const userId = (get() as ProjectStore & { userId?: string }).userId;
        if (!userId) return;
        const projectIds = get().projects.map((p: { id: string }) => p.id);
        if (projectIds.length === 0) return;

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
          projectIds.map(async (projectId: string) => {
            const [remoteRoadmaps, remotePhases, remoteThemes, remoteItems] = await Promise.all([
              fetchRoadmaps(userId, projectId),
              fetchRoadmapPhases(userId, projectId),
              fetchRoadmapThemes(userId, projectId),
              fetchRoadmapItems(userId, projectId),
            ]);

            // Roadmaps
            if (remoteRoadmaps && remoteRoadmaps.length > 0) {
              roadmapUpdates[projectId] = remoteRoadmaps;
            } else {
              const local = state.roadmapsByProject[projectId];
              if (local && local.length > 0) void upsertRoadmaps(userId, projectId, local);
            }
            // Phases
            if (remotePhases && remotePhases.length > 0) {
              phaseUpdates[projectId] = remotePhases;
            } else {
              const local = state.phasesByProject[projectId];
              if (local && local.length > 0) void upsertRoadmapPhases(userId, projectId, local);
            }
            // Themes
            if (remoteThemes && remoteThemes.length > 0) {
              themeUpdates[projectId] = remoteThemes;
            } else {
              const local = state.themesByProject[projectId];
              if (local && local.length > 0) void upsertRoadmapThemes(userId, projectId, local);
            }
            // Items
            if (remoteItems && remoteItems.length > 0) {
              itemUpdates[projectId] = remoteItems;
            } else {
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

    loadKpiFromSupabase: async () => {
      try {
        const userId = (get() as ProjectStore & { userId?: string }).userId;
        if (!userId) return;
        const projects = get().projects as Array<{ id: string; ownerId?: string | null }>;
        if (projects.length === 0) return;

        const { fetchKpiEntries, fetchKpiConfig } = await import("@/lib/supabase/kpiSync");
        const { persistKpiEntries, persistKpiConfigs } = await import("./storageHelpers");

        const entryUpdates: Record<string, import("@/lib/kpi/types").KpiEntry[]> = {};
        const configUpdates: Record<string, import("@/lib/kpi/types").KpiProjectConfig> = {};

        const state = get() as ProjectStore & {
          kpiEntriesByProject: Record<string, import("@/lib/kpi/types").KpiEntry[]>;
          kpiConfigByProject: Record<string, import("@/lib/kpi/types").KpiProjectConfig>;
        };

        const { upsertKpiEntries, upsertKpiConfig } = await import("@/lib/supabase/kpiSync");

        await Promise.all(
          projects.map(async (project) => {
            const projectId = project.id;
            const isOwner = !project.ownerId || project.ownerId === userId;

            // Membros lêem os dados do dono; donos lêem os próprios dados
            const fetchUserId = isOwner ? userId : (project.ownerId as string);

            const [remoteEntries, remoteConfig] = await Promise.all([
              fetchKpiEntries(fetchUserId, projectId),
              fetchKpiConfig(fetchUserId, projectId),
            ]);

            // Supabase tem dados → usa o remoto (fonte de verdade na nuvem)
            if (remoteEntries && remoteEntries.length > 0) {
              entryUpdates[projectId] = remoteEntries;
            } else if (isOwner) {
              // Supabase vazio → migra dados locais existentes para a nuvem (só o dono escreve)
              const localEntries = state.kpiEntriesByProject[projectId];
              if (localEntries && localEntries.length > 0) {
                void upsertKpiEntries(userId, projectId, localEntries);
              }
            }

            if (remoteConfig) {
              configUpdates[projectId] = remoteConfig;
            } else if (isOwner) {
              // Supabase vazio → migra config local para a nuvem (só o dono escreve)
              const localConfig = state.kpiConfigByProject[projectId];
              if (localConfig) {
                void upsertKpiConfig(userId, projectId, localConfig);
              }
            }
          })
        );

        const hasEntries = Object.keys(entryUpdates).length > 0;
        const hasConfigs = Object.keys(configUpdates).length > 0;

        if (hasEntries || hasConfigs) {
          const mergedEntries = hasEntries
            ? { ...state.kpiEntriesByProject, ...entryUpdates }
            : state.kpiEntriesByProject;

          const mergedConfigs = hasConfigs
            ? { ...state.kpiConfigByProject, ...configUpdates }
            : state.kpiConfigByProject;

          set({
            kpiEntriesByProject: mergedEntries,
            kpiConfigByProject: mergedConfigs,
          } as Partial<ProjectStore>);

          if (hasEntries) persistKpiEntries(mergedEntries);
          if (hasConfigs) persistKpiConfigs(mergedConfigs);
        }
      } catch (e) {
        console.warn("[kpiSync] loadKpiFromSupabase failed", e);
      }
    },
  };
}
