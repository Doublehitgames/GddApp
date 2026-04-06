import type { ProjectStore, LastConsistencyAnalysis, LastRelationsAnalysis } from "./types";
import { persistLastAnalyses, persistLastRelations } from "./storageHelpers";

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

export function createAnalysisSlice(set: StoreSet, get: StoreGet) {
  return {
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
  };
}
