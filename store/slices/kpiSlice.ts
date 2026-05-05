import type { KpiEntry, KpiState, KpiActions, KpiProjectConfig, GameGenre, KpiGameProfile, KpiCustomBenchmarks } from "@/lib/kpi/types";
import { persistKpiEntries, persistKpiConfigs, loadKpiEntries, loadKpiConfigs } from "./storageHelpers";

type StoreSet = (partial: Partial<KpiState & KpiActions> | ((state: KpiState & KpiActions) => Partial<KpiState & KpiActions>)) => void;
type StoreGet = () => KpiState & KpiActions & { kpiEntriesByProject: Record<string, KpiEntry[]>; kpiConfigByProject: Record<string, KpiProjectConfig> };

function sp(set: StoreSet, get: StoreGet, updater: (state: KpiState & KpiActions) => Partial<KpiState & KpiActions>) {
  set(updater);
  const state = get();
  persistKpiEntries(state.kpiEntriesByProject);
  persistKpiConfigs(state.kpiConfigByProject);
}

export function createKpiSlice(set: StoreSet, get: StoreGet) {
  return {
    kpiEntriesByProject: loadKpiEntries(),
    kpiConfigByProject: loadKpiConfigs(),

    setKpiGenre: (projectId: string, genre: GameGenre) => {
      sp(set, get, (state) => ({
        kpiConfigByProject: {
          ...state.kpiConfigByProject,
          [projectId]: { ...(state.kpiConfigByProject[projectId] ?? {}), genre },
        },
      }));
    },

    updateKpiConfig: (projectId: string, patch: Partial<Omit<KpiProjectConfig, "genre">>) => {
      sp(set, get, (state) => {
        const existing = state.kpiConfigByProject[projectId] ?? { genre: "farm" as GameGenre };
        return {
          kpiConfigByProject: {
            ...state.kpiConfigByProject,
            [projectId]: { ...existing, ...patch },
          },
        };
      });
    },

    addKpiEntry: (projectId: string, entry: Omit<KpiEntry, "id" | "createdAt">): string => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const newEntry: KpiEntry = { ...entry, id, createdAt: now };
      sp(set, get, (state) => ({
        kpiEntriesByProject: {
          ...state.kpiEntriesByProject,
          [projectId]: [...(state.kpiEntriesByProject[projectId] ?? []), newEntry],
        },
      }));
      return id;
    },

    updateKpiEntry: (projectId: string, entryId: string, patch: Partial<Pick<KpiEntry, "hypothesis" | "hypothesisArea" | "outcome" | "learning" | "metrics">>) => {
      sp(set, get, (state) => ({
        kpiEntriesByProject: {
          ...state.kpiEntriesByProject,
          [projectId]: (state.kpiEntriesByProject[projectId] ?? []).map((e) =>
            e.id === entryId ? { ...e, ...patch } : e
          ),
        },
      }));
    },

    deleteKpiEntry: (projectId: string, entryId: string) => {
      sp(set, get, (state) => ({
        kpiEntriesByProject: {
          ...state.kpiEntriesByProject,
          [projectId]: (state.kpiEntriesByProject[projectId] ?? []).filter((e) => e.id !== entryId),
        },
      }));
    },
  };
}
