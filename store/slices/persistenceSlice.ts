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

    loadKpiFromSupabase: async () => {
      try {
        const userId = (get() as ProjectStore & { userId?: string }).userId;
        if (!userId) return;
        const projectIds = get().projects.map((p: { id: string }) => p.id);
        if (projectIds.length === 0) return;

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
          projectIds.map(async (projectId: string) => {
            const [remoteEntries, remoteConfig] = await Promise.all([
              fetchKpiEntries(userId, projectId),
              fetchKpiConfig(userId, projectId),
            ]);

            // Supabase tem dados → usa o remoto (fonte de verdade na nuvem)
            if (remoteEntries && remoteEntries.length > 0) {
              entryUpdates[projectId] = remoteEntries;
            } else {
              // Supabase vazio → migra dados locais existentes para a nuvem
              const localEntries = state.kpiEntriesByProject[projectId];
              if (localEntries && localEntries.length > 0) {
                void upsertKpiEntries(userId, projectId, localEntries);
              }
            }

            if (remoteConfig) {
              configUpdates[projectId] = remoteConfig;
            } else {
              // Supabase vazio → migra config local para a nuvem
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
