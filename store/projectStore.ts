// src/store/projectStore.ts
import { create } from "zustand";

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
    labelVisibility?: {
      section?: number;
      project?: number;
    };
    targetApparentSize?: number;
    zoomMargin?: number;
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

interface ProjectStore {
  projects: Project[];
  addProject: (name: string, description: string) => string;
  getProject: (id: UUID) => Project | undefined;
  addSection: (projectId: UUID, title: string, content?: string) => UUID;
  addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string) => UUID;
  removeProject: (id: UUID) => void;
  editProject: (id: UUID, name: string, description: string) => void;
  editSection: (projectId: UUID, sectionId: UUID, title: string, content: string, color?: string) => void;
  removeSection: (projectId: UUID, sectionId: UUID) => void;
  moveSectionUp: (projectId: UUID, sectionId: UUID) => void;
  moveSectionDown: (projectId: UUID, sectionId: UUID) => void;
  reorderSections: (projectId: UUID, sectionIds: UUID[]) => void;
  countDescendants: (projectId: UUID, sectionId: UUID) => number;
  hasDuplicateName: (projectId: UUID, title: string, parentId?: UUID, excludeId?: UUID) => boolean;
  loadFromStorage: () => void;
  importProject: (project: Project) => void;
  importAllProjects: (projects: Project[]) => void;
  updateProjectSettings: (projectId: UUID, settings: MindMapSettings) => void;
}

const STORAGE_KEY = "gdd_projects_v1";

export const useProjectStore = create<ProjectStore>((set, get) => {
  // não acessamos localStorage na criação do módulo para evitar erros SSR;
  // usaremos loadFromStorage no client para carregar os dados.

  const persist = (projects: Project[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.warn("Could not persist projects to localStorage", e);
    }
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
      console.warn("persist failed", e);
    }
  };

  return {
    projects: [],

    addProject: (name: string, description: string) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      wrappedSet((prev) => [
        ...prev,
        {
          id,
          title: name,
          description,
          sections: [],
          createdAt: now,
          updatedAt: now,
        },
      ]);
      return id;
    },

    getProject: (id: UUID) => {
      return get().projects.find((p) => p.id === id);
    },

    addSection: (projectId: UUID, title: string, content?: string) => {
      const newId = crypto.randomUUID();
      wrappedSet((prev) =>
        prev.map((p) => {
          if (p.id === projectId) {
            const siblings = (p.sections || []).filter((s) => !s.parentId);
            const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order || 0)) : -1;
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: [
                ...(p.sections || []),
                {
                  id: newId,
                  title,
                  content: content || "",
                  created_at: new Date().toISOString(),
                  parentId: undefined,
                  order: maxOrder + 1,
                } as Section,
              ],
            };
          }
          return p;
        })
      );
      return newId;
    },

    addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string) => {
      const newId = crypto.randomUUID();
      wrappedSet((prev) =>
        prev.map((p) => {
          if (p.id === projectId) {
            const siblings = (p.sections || []).filter((s) => s.parentId === parentId);
            const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order || 0)) : -1;
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: [
                ...(p.sections || []),
                {
                  id: newId,
                  title,
                  content: content || "",
                  created_at: new Date().toISOString(),
                  parentId,
                  order: maxOrder + 1,
                } as Section,
              ],
            };
          }
          return p;
        })
      );
      return newId;
    },

    removeProject: (id: UUID) => {
      wrappedSet((prev) => prev.filter((p) => p.id !== id));
    },

    editProject: (id: UUID, name: string, description: string) => {
      wrappedSet((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, title: name, description, updatedAt: new Date().toISOString() }
            : p
        )
      );
    },

    editSection: (projectId: UUID, sectionId: UUID, title: string, content: string, color?: string) => {
      wrappedSet((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                updatedAt: new Date().toISOString(),
                sections: (p.sections || []).map((s) => {
                  if (s.id === sectionId) {
                    const updated: any = { ...s, title, content };
                    // Só adicionar cor se foi fornecida, senão remover propriedade
                    if (color !== undefined) {
                      updated.color = color;
                    } else {
                      delete updated.color;
                    }
                    return updated;
                  }
                  return s;
                }),
              }
            : p
        )
      );
    },

    removeSection: (projectId: UUID, sectionId: UUID) => {
      wrappedSet((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                updatedAt: new Date().toISOString(),
                sections: (p.sections || []).filter((s) => s.id !== sectionId),
              }
            : p
        )
      );
    },

    moveSectionUp: (projectId: UUID, sectionId: UUID) => {
      wrappedSet((prev) =>
        prev.map((p) => {
          if (p.id === projectId) {
            const sections = p.sections || [];
            const section = sections.find((s) => s.id === sectionId);
            if (!section) return p;
            
            const siblings = sections.filter((s) => s.parentId === section.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = siblings.findIndex((s) => s.id === sectionId);
            if (currentIndex <= 0) return p; // já é o primeiro
            
            // Trocar order com o anterior
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
          }
          return p;
        })
      );
    },

    moveSectionDown: (projectId: UUID, sectionId: UUID) => {
      wrappedSet((prev) =>
        prev.map((p) => {
          if (p.id === projectId) {
            const sections = p.sections || [];
            const section = sections.find((s) => s.id === sectionId);
            if (!section) return p;
            
            const siblings = sections.filter((s) => s.parentId === section.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = siblings.findIndex((s) => s.id === sectionId);
            if (currentIndex === -1 || currentIndex >= siblings.length - 1) return p; // já é o último
            
            // Trocar order com o próximo
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
          }
          return p;
        })
      );
    },

    reorderSections: (projectId: UUID, sectionIds: UUID[]) => {
      wrappedSet((prev) =>
        prev.map((p) => {
          if (p.id === projectId) {
            const sections = p.sections || [];
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: sections.map((s) => {
                const newIndex = sectionIds.indexOf(s.id);
                if (newIndex !== -1) {
                  return { ...s, order: newIndex };
                }
                return s;
              }),
            };
          }
          return p;
        })
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
        console.warn("Failed to load projects from localStorage", e);
      }
    },

    importProject: (project: Project) => {
      wrappedSet((prev) => {
        // Remove existing project with same ID if exists
        const filtered = prev.filter(p => p.id !== project.id);
        return [...filtered, project];
      });
    },

    importAllProjects: (projects: Project[]) => {
      wrappedSet(() => projects);
    },

    updateProjectSettings: (projectId: UUID, settings: MindMapSettings) => {
      wrappedSet((prev) =>
        prev.map((p) => {
          if (p.id === projectId) {
            return {
              ...p,
              mindMapSettings: settings,
              updatedAt: new Date().toISOString(),
            };
          }
          return p;
        })
      );
    },
  };
});
