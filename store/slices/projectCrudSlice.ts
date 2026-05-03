import type { ProjectStore, UUID, LinkedSpreadsheet } from "./types";
import { deleteProjectFromSupabase } from "@/lib/supabase/projectSync";
import { FREE_MAX_PROJECTS } from "@/lib/structuralLimits";
import { toSlug } from "@/lib/utils/slug";
import { buildSectionDiagramKey, persistDiagrams, persist, logInfo } from "./storageHelpers";
import type { SyncEngineAPI } from "./syncEngine";

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

export function createProjectCrudSlice(set: StoreSet, get: StoreGet, engine: SyncEngineAPI) {
  return {
    addProject: (name: string, description: string) => {
      const { projects, userId } = get();
      const myCount = projects.filter((p) => p.ownerId === userId || (p.ownerId == null && userId)).length;
      if (myCount >= FREE_MAX_PROJECTS) {
        throw new Error("structural_limit_projects");
      }
      const newSlug = toSlug(name);
      const slugTaken = projects.some(
        (p) => (p.ownerId === userId || (p.ownerId == null && userId)) && toSlug(p.title) === newSlug
      );
      if (slugTaken) {
        throw new Error("duplicate_project_name");
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      engine.wrappedSetWithSync(
        (prev) => [
          ...prev,
          { id, title: name, description, sections: [], createdAt: now, updatedAt: now, ownerId: userId ?? undefined },
        ],
        id
      );
      void engine.syncNow(id);
      return id;
    },

    getProject: (id: UUID) => {
      return get().projects.find((p) => p.id === id);
    },

    getProjectBySlug: (slug: string) => {
      return get().projects.find((p) => toSlug(p.title) === slug);
    },

    editProject: (id: UUID, name: string, description: string, aiInstructions?: string) => {
      const { projects, userId } = get();
      const newSlug = toSlug(name);
      const slugTaken = projects.some(
        (p) => p.id !== id && (p.ownerId === userId || (p.ownerId == null && userId)) && toSlug(p.title) === newSlug
      );
      if (slugTaken) {
        throw new Error("duplicate_project_name");
      }
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, title: name, description, ...(aiInstructions !== undefined ? { aiInstructions } : {}), updatedAt: new Date().toISOString() }
              : p
          ),
        id
      );
    },

    removeProject: (id: UUID) => {
      const removedProject = get().projects.find((p) => p.id === id);
      engine.wrappedSet((prev) => prev.filter((p) => p.id !== id));
      const nextDiagrams = { ...get().diagramsBySection };
      for (const section of removedProject?.sections || []) {
        delete nextDiagrams[buildSectionDiagramKey(id, section.id)];
      }
      set({ diagramsBySection: nextDiagrams });
      persistDiagrams(nextDiagrams);
      engine.cleanupSyncStateForProject(id);
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
      const removedProject = get().projects.find((p) => p.id === id);
      engine.wrappedSet((prev) => prev.filter((p) => p.id !== id));
      const nextDiagrams = { ...get().diagramsBySection };
      for (const section of removedProject?.sections || []) {
        delete nextDiagrams[buildSectionDiagramKey(id, section.id)];
      }
      set({ diagramsBySection: nextDiagrams });
      persistDiagrams(nextDiagrams);
      engine.cleanupSyncStateForProject(id);
      try {
        const next = get().projects;
        persist(next);
      } catch {}
      engine.persistSyncState();
    },

    updateProjectLinkedSpreadsheets: (id: UUID, linkedSpreadsheets: LinkedSpreadsheet[]) => {
      engine.wrappedSet((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, linkedSpreadsheets, updatedAt: new Date().toISOString() }
            : p
        )
      );
      try { persist(get().projects); } catch {}
    },

    setProjectCoverImage: (id: UUID, coverImageUrl?: string) => {
      const normalizedCoverUrl =
        typeof coverImageUrl === "string" && coverImageUrl.trim()
          ? coverImageUrl.trim()
          : undefined;
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, coverImageUrl: normalizedCoverUrl, updatedAt: new Date().toISOString() }
              : p
          ),
        id
      );
    },
  };
}
