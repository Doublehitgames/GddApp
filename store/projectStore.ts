// store/projectStore.ts — Barrel: composes slices into a single Zustand store
import { create } from "zustand";
import type { ProjectStore } from "./slices/types";
import { loadPersistenceConfig } from "./slices/storageHelpers";
import { createSyncEngine } from "./slices/syncEngine";
import { createProjectCrudSlice } from "./slices/projectCrudSlice";
import { createSectionCrudSlice } from "./slices/sectionCrudSlice";
import { createAddonSlice } from "./slices/addonSlice";
import { createDiagramSlice } from "./slices/diagramSlice";
import { createAnalysisSlice } from "./slices/analysisSlice";
import { createCloudSyncSlice } from "./slices/cloudSyncSlice";
import { createPersistenceSlice } from "./slices/persistenceSlice";
import { createAgendaSlice } from "./slices/agendaSlice";
import { createKpiSlice } from "./slices/kpiSlice";

// Re-export ALL types for backward compatibility (zero breaking changes for consumers)
export type {
  UUID,
  LastConsistencyAnalysis,
  LastRelationsAnalysis,
  DiagramMarkerType,
  DiagramNode,
  DiagramEdge,
  DiagramViewport,
  DiagramState,
  LevelConfig,
  MindMapSettings,
  SectionAuditBy,
  Section,
  Project,
  SyncStatus,
  PersistenceConfig,
  LastSyncStats,
  ProjectStore,
} from "./slices/types";

export const useProjectStore = create<ProjectStore>((set, get) => {
  const engine = createSyncEngine(set, get);

  return {
    // ── Initial state ────────────────────────────────────────────────────
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
    diagramsBySection: {},

    // ── Composed actions ─────────────────────────────────────────────────
    ...createProjectCrudSlice(set, get, engine),
    ...createSectionCrudSlice(set, get, engine),
    ...createAddonSlice(set, get),
    ...createDiagramSlice(set, get, engine),
    ...createAnalysisSlice(set, get),
    ...createCloudSyncSlice(set, get, engine),
    ...createPersistenceSlice(set, get, engine),
    ...createAgendaSlice(set, get),
    ...createKpiSlice(set, get),
  };
});
