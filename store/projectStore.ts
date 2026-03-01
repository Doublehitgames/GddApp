// src/store/projectStore.ts
import { create } from "zustand";
import {
  fetchProjectsFromSupabase,
  upsertProjectToSupabase,
  deleteProjectFromSupabase,
} from "@/lib/supabase/projectSync";

export type UUID = string;

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
};

//Definição da Seção. A seção pode ter um parentId opcional para suportar subseções.
export type Section = {
  id: UUID;
  title: string;
  content?: string;
  created_at: string;
  parentId?: UUID; // Se parentId for null, é uma seção raiz; se tiver valor, é uma subseção de outra seção.
  order: number; // Ordem de exibição dentro do mesmo nível (mesmo parentId)
  color?: string; // Cor personalizada para o mapa mental (formato hex: #3b82f6)
};

//Definição do Projeto. Um projeto pode ter várias seções.
export type Project = {
  id: UUID;
  title: string;
  description?: string;
  sections?: Section[];
  createdAt: string;
  updatedAt: string;
  mindMapSettings?: MindMapSettings; // Configurações personalizadas do mapa mental
};

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export type PersistenceConfig = {
  debounceMs: number;
  autosaveIntervalMs: number;
  syncOnBlur: boolean;
  syncOnVisibilityHidden: boolean;
  syncOnBeforeUnload: boolean;
  syncOnPageHide: boolean;
};

interface ProjectStore {
  projects: Project[];
  syncStatus: SyncStatus;
  pendingSyncCount: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  persistenceConfig: PersistenceConfig;
  // Auth sync
  userId: string | null;
  setUserId: (id: string | null) => void;
  updatePersistenceConfig: (config: Partial<PersistenceConfig>) => void;
  // Mutations
  addProject: (name: string, description: string) => string;
  getProject: (id: UUID) => Project | undefined;
  addSection: (projectId: UUID, title: string, content?: string) => UUID;
  addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string) => UUID;
  removeProject: (id: UUID) => void;
  editProject: (id: UUID, name: string, description: string) => void;
  editSection: (projectId: UUID, sectionId: UUID, title: string, content: string, parentId?: string | null, color?: string) => void;
  removeSection: (projectId: UUID, sectionId: UUID) => void;
  moveSectionUp: (projectId: UUID, sectionId: UUID) => void;
  moveSectionDown: (projectId: UUID, sectionId: UUID) => void;
  reorderSections: (projectId: UUID, sectionIds: UUID[]) => void;
  countDescendants: (projectId: UUID, sectionId: UUID) => number;
  hasDuplicateName: (projectId: UUID, title: string, parentId?: UUID, excludeId?: UUID) => boolean;
  // Storage
  loadFromStorage: () => void;
  loadFromSupabase: () => Promise<"loaded" | "empty" | "error">;
  syncProjectToSupabase: (projectId: UUID) => Promise<void>;
  flushPendingSyncs: () => Promise<void>;
  importProject: (project: Project) => void;
  importAllProjects: (projects: Project[]) => void;
  updateProjectSettings: (projectId: UUID, settings: MindMapSettings) => void;
}

const STORAGE_KEY = "gdd_projects_v1";
const PERSISTENCE_CONFIG_KEY = "gdd_persistence_config_v1";

const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  debounceMs: 1500,
  autosaveIntervalMs: 30000,
  syncOnBlur: true,
  syncOnVisibilityHidden: true,
  syncOnBeforeUnload: true,
  syncOnPageHide: true,
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

  const persist = (projects: Project[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      logWarn("Could not persist projects to localStorage", e);
    }
  };

  const loadPersistenceConfig = (): PersistenceConfig => {
    try {
      const raw = localStorage.getItem(PERSISTENCE_CONFIG_KEY);
      if (!raw) return DEFAULT_PERSISTENCE_CONFIG;
      const parsed = JSON.parse(raw) as Partial<PersistenceConfig>;
      return { ...DEFAULT_PERSISTENCE_CONFIG, ...parsed };
    } catch {
      return DEFAULT_PERSISTENCE_CONFIG;
    }
  };

  const persistPersistenceConfig = (config: PersistenceConfig) => {
    try {
      localStorage.setItem(PERSISTENCE_CONFIG_KEY, JSON.stringify(config));
    } catch {}
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

  const getProjectSnapshotForSync = (projectId: string): Project | null => {
    const fromState = get().projects.find((p) => p.id === projectId);
    if (fromState) return fromState;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Project[];
      return parsed.find((p) => p.id === projectId) || null;
    } catch {
      return null;
    }
  };

  const markProjectDirty = (projectId: string) => {
    dirtyProjectIds.add(projectId);
    updatePendingSyncCount();
  };

  const clearProjectDirty = (projectId: string) => {
    dirtyProjectIds.delete(projectId);
    updatePendingSyncCount();
  };

  const syncNow = async (projectId: string) => {
    const project = getProjectSnapshotForSync(projectId);
    if (!project) return;

    set({ syncStatus: "syncing", lastSyncError: null });

    const { error, skippedReason } = await upsertProjectToSupabase(project);
    if (error) {
      console.error("[projectStore] Falha no sync imediato:", error);
      set({ syncStatus: "error", lastSyncError: error });
      return;
    }

    if (!skippedReason) {
      clearProjectDirty(projectId);
      syncRetryCount.delete(projectId);
      set({ syncStatus: "synced", lastSyncedAt: new Date().toISOString(), lastSyncError: null });
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
  };

  const debouncedSync = (projectId: string) => {
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
    pendingSyncCount: 0,
    lastSyncedAt: null,
    lastSyncError: null,
    persistenceConfig: loadPersistenceConfig(),
    userId: null,

    updatePersistenceConfig: (config: Partial<PersistenceConfig>) => {
      const current = get().persistenceConfig;
      const next = { ...current, ...config };
      set({ persistenceConfig: next });
      persistPersistenceConfig(next);
    },

    setUserId: (id: string | null) => {
      set({ userId: id });
      if (id) {
        const projects = get().projects;
        projects.forEach((p) => {
          markProjectDirty(p.id);
          debouncedSync(p.id);
        });
      }
    },

    addProject: (name: string, description: string) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      wrappedSetWithSync(
        (prev) => [
          ...prev,
          { id, title: name, description, sections: [], createdAt: now, updatedAt: now },
        ],
        id
      );
      void syncNow(id);
      return id;
    },

    getProject: (id: UUID) => {
      return get().projects.find((p) => p.id === id);
    },

    addSection: (projectId: UUID, title: string, content?: string) => {
      const newId = crypto.randomUUID();
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const siblings = (p.sections || []).filter((s) => !s.parentId);
              const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order || 0)) : -1;
              return {
                ...p,
                updatedAt: new Date().toISOString(),
                sections: [
                  ...(p.sections || []),
                  { id: newId, title, content: content || "", created_at: new Date().toISOString(), parentId: undefined, order: maxOrder + 1 } as Section,
                ],
              };
            }
            return p;
          }),
        projectId
      );
      return newId;
    },

    addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string) => {
      const newId = crypto.randomUUID();
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const siblings = (p.sections || []).filter((s) => s.parentId === parentId);
              const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order || 0)) : -1;
              return {
                ...p,
                updatedAt: new Date().toISOString(),
                sections: [
                  ...(p.sections || []),
                  { id: newId, title, content: content || "", created_at: new Date().toISOString(), parentId, order: maxOrder + 1 } as Section,
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
      // Busca userId internamente no deleteProjectFromSupabase — sem race condition
      deleteProjectFromSupabase(id).then(({ error }) => {
        if (error) console.error("[projectStore] Falha ao deletar projeto no Supabase:", error);
        else logInfo("[projectStore] Projeto deletado no Supabase:", id);
      });
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

    editSection: (projectId: UUID, sectionId: UUID, title: string, content: string, parentId?: string | null, color?: string) => {
      wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: new Date().toISOString(),
                  sections: (p.sections || []).map((s) => {
                    if (s.id === sectionId) {
                      const updated: any = { ...s, title, content };
                      const isColorPassedAsParentId =
                        typeof parentId === "string" && parentId.startsWith("#") && color === undefined;

                      const resolvedParentId = isColorPassedAsParentId ? undefined : parentId;
                      const resolvedColor = isColorPassedAsParentId ? parentId : color;

                      if (resolvedParentId !== undefined) {
                        if (resolvedParentId === null) delete updated.parentId;
                        else updated.parentId = resolvedParentId;
                      }
                      if (resolvedColor !== undefined) updated.color = resolvedColor;
                      else delete updated.color;
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
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Project[];
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
      } catch (e) {
        logWarn("Failed to load projects from localStorage", e);
      }
    },

    syncProjectToSupabase: async (projectId: UUID) => {
      markProjectDirty(projectId);
      await syncNow(projectId);
    },

    flushPendingSyncs: async () => {
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
      // (o store pode estar vazio se loadFromStorage ainda não foi chamado)
      let localProjects = get().projects;
      if (localProjects.length === 0) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) localProjects = JSON.parse(raw) as Project[];
        } catch {}
      }

      // Se nuvem está vazia, sinaliza para o hook de init disparar migração
      if (remote.length === 0) return "empty";

      // ── Merge inteligente ─────────────────────────────────────────────────
      // Regra: prefere o mais recente (updatedAt) quando existe nos dois lados.
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
          // Usa o mais recente entre local e cloud
          return new Date(local.updatedAt) > new Date(remoteProject.updatedAt)
            ? local
            : remoteProject;
        }),
        ...localOnly, // Projetos que só existem localmente
      ];

      set({ projects: merged });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {}

      // Sobe ao cloud os projetos que só existiam localmente
      const toUpload = [...localOnly, ...localNewerSameId];
      if (toUpload.length > 0) {
        logInfo(`[projectStore] Subindo ${toUpload.length} projeto(s) local/newer para o cloud...`);
        toUpload.forEach((p) => {
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
  };
});
