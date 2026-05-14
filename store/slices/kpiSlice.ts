import type { KpiEntry, KpiState, KpiActions, KpiProjectConfig, GameGenre } from "@/lib/kpi/types";
import { persistKpiEntries, persistKpiConfigs, loadKpiEntries, loadKpiConfigs } from "./storageHelpers";

type StoreSet = (partial: Partial<KpiState & KpiActions> | ((state: KpiState & KpiActions) => Partial<KpiState & KpiActions>)) => void;
type StoreGet = () => KpiState & KpiActions & {
  kpiEntriesByProject: Record<string, KpiEntry[]>;
  kpiConfigByProject: Record<string, KpiProjectConfig>;
  userId?: string | null;
};

// ─── Debounced sync timers ────────────────────────────────────────────────────

const entrySyncTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const configSyncTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function scheduleSyncEntries(projectId: string, get: StoreGet) {
  clearTimeout(entrySyncTimers[projectId]);
  entrySyncTimers[projectId] = setTimeout(async () => {
    const state = get();
    if (!state.userId) return;
    const entries = state.kpiEntriesByProject[projectId] ?? [];
    const { upsertKpiEntries } = await import("@/lib/supabase/kpiSync");
    await upsertKpiEntries(state.userId, projectId, entries);
  }, 2000);
}

function scheduleSyncConfig(projectId: string, get: StoreGet) {
  clearTimeout(configSyncTimers[projectId]);
  configSyncTimers[projectId] = setTimeout(async () => {
    const state = get();
    if (!state.userId) return;
    const config = state.kpiConfigByProject[projectId];
    if (!config) return;
    const { upsertKpiConfig } = await import("@/lib/supabase/kpiSync");
    await upsertKpiConfig(state.userId, projectId, config);
  }, 2000);
}

// ─── Helper: atualiza store + persiste no localStorage ───────────────────────

function sp(set: StoreSet, get: StoreGet, updater: (state: KpiState & KpiActions) => Partial<KpiState & KpiActions>) {
  set(updater);
  const state = get();
  persistKpiEntries(state.kpiEntriesByProject);
  persistKpiConfigs(state.kpiConfigByProject);
}

// ─── Slice ───────────────────────────────────────────────────────────────────

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
      scheduleSyncConfig(projectId, get);
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
      scheduleSyncConfig(projectId, get);
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
      scheduleSyncEntries(projectId, get);
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
      scheduleSyncEntries(projectId, get);
    },

    deleteKpiEntry: (projectId: string, entryId: string) => {
      sp(set, get, (state) => ({
        kpiEntriesByProject: {
          ...state.kpiEntriesByProject,
          [projectId]: (state.kpiEntriesByProject[projectId] ?? []).filter((e) => e.id !== entryId),
        },
      }));
      scheduleSyncEntries(projectId, get);
    },
  };
}
