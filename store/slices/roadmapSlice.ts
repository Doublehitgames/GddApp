import type { Roadmap, RoadmapPhase, RoadmapTheme, RoadmapItem, RoadmapState, RoadmapActions, ThemeColor } from "@/lib/roadmap/types";
import { THEME_COLORS } from "@/lib/roadmap/types";
import {
  loadRoadmaps, loadRoadmapPhases, loadRoadmapThemes, loadRoadmapItems,
  persistRoadmaps, persistRoadmapPhases, persistRoadmapThemes, persistRoadmapItems,
} from "./storageHelpers";

type StoreSet = (partial: Partial<RoadmapState & RoadmapActions> | ((state: RoadmapState & RoadmapActions) => Partial<RoadmapState & RoadmapActions>)) => void;
type StoreGet = () => RoadmapState & RoadmapActions & { userId?: string | null };

// ─── Debounced sync timers ────────────────────────────────────────────────────

const roadmapsSyncTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const phasesSyncTimers:   Record<string, ReturnType<typeof setTimeout>> = {};
const themesSyncTimers:   Record<string, ReturnType<typeof setTimeout>> = {};
const itemsSyncTimers:    Record<string, ReturnType<typeof setTimeout>> = {};

function scheduleSyncRoadmaps(projectId: string, get: StoreGet) {
  clearTimeout(roadmapsSyncTimers[projectId]);
  roadmapsSyncTimers[projectId] = setTimeout(async () => {
    const state = get();
    if (!state.userId) return;
    // TODO: upsertRoadmaps in roadmapSync once Supabase table is added
  }, 2000);
}

function scheduleSyncPhases(projectId: string, get: StoreGet) {
  clearTimeout(phasesSyncTimers[projectId]);
  phasesSyncTimers[projectId] = setTimeout(async () => {
    const state = get();
    if (!state.userId) return;
    const { upsertRoadmapPhases } = await import("@/lib/supabase/roadmapSync");
    await upsertRoadmapPhases(state.userId, projectId, state.phasesByProject[projectId] ?? []);
  }, 2000);
}

function scheduleSyncThemes(projectId: string, get: StoreGet) {
  clearTimeout(themesSyncTimers[projectId]);
  themesSyncTimers[projectId] = setTimeout(async () => {
    const state = get();
    if (!state.userId) return;
    const { upsertRoadmapThemes } = await import("@/lib/supabase/roadmapSync");
    await upsertRoadmapThemes(state.userId, projectId, state.themesByProject[projectId] ?? []);
  }, 2000);
}

function scheduleSyncItems(projectId: string, get: StoreGet) {
  clearTimeout(itemsSyncTimers[projectId]);
  itemsSyncTimers[projectId] = setTimeout(async () => {
    const state = get();
    if (!state.userId) return;
    const { upsertRoadmapItems } = await import("@/lib/supabase/roadmapSync");
    await upsertRoadmapItems(state.userId, projectId, state.itemsByProject[projectId] ?? []);
  }, 2000);
}

// ─── Helper: set + persist ────────────────────────────────────────────────────

function sp(set: StoreSet, get: StoreGet, updater: (s: RoadmapState & RoadmapActions) => Partial<RoadmapState & RoadmapActions>) {
  set(updater);
  const s = get();
  persistRoadmaps(s.roadmapsByProject);
  persistRoadmapPhases(s.phasesByProject);
  persistRoadmapThemes(s.themesByProject);
  persistRoadmapItems(s.itemsByProject);
}

function nextColor(themes: RoadmapTheme[]): ThemeColor {
  return THEME_COLORS[themes.length % THEME_COLORS.length];
}

// ─── Migration: stamp roadmapId on legacy data ────────────────────────────────

function migrateOrphanedData(
  roadmapsByProject: Record<string, Roadmap[]>,
  phasesByProject:  Record<string, RoadmapPhase[]>,
  themesByProject:  Record<string, RoadmapTheme[]>,
  itemsByProject:   Record<string, RoadmapItem[]>,
) {
  const allProjectIds = new Set([
    ...Object.keys(phasesByProject),
    ...Object.keys(themesByProject),
    ...Object.keys(itemsByProject),
  ]);

  for (const projectId of allProjectIds) {
    const phases = phasesByProject[projectId] ?? [];
    const themes = themesByProject[projectId] ?? [];
    const items  = itemsByProject[projectId]  ?? [];

    const hasOrphaned = [...phases, ...themes, ...items].some((x: any) => !x.roadmapId);
    if (!hasOrphaned) continue;

    let defaultRoadmap = (roadmapsByProject[projectId] ?? []).find((r) => r.status === "active");
    if (!defaultRoadmap) {
      defaultRoadmap = {
        id: crypto.randomUUID(),
        projectId,
        name: "Roadmap v1",
        status: "active",
        createdAt: new Date().toISOString(),
      };
      roadmapsByProject[projectId] = [...(roadmapsByProject[projectId] ?? []), defaultRoadmap];
    }

    const rid = defaultRoadmap.id;
    phasesByProject[projectId] = phases.map((p) => (p as any).roadmapId ? p : { ...p, roadmapId: rid });
    themesByProject[projectId] = themes.map((t) => (t as any).roadmapId ? t : { ...t, roadmapId: rid });
    itemsByProject[projectId]  = items.map((i)  => (i as any).roadmapId ? i : { ...i, roadmapId: rid });
  }
}

// ─── Slice ────────────────────────────────────────────────────────────────────

export function createRoadmapSlice(set: StoreSet, get: StoreGet) {
  const roadmapsByProject = loadRoadmaps();
  const phasesByProject   = loadRoadmapPhases();
  const themesByProject   = loadRoadmapThemes();
  const itemsByProject    = loadRoadmapItems();

  migrateOrphanedData(roadmapsByProject, phasesByProject, themesByProject, itemsByProject);
  persistRoadmaps(roadmapsByProject);
  persistRoadmapPhases(phasesByProject);
  persistRoadmapThemes(themesByProject);
  persistRoadmapItems(itemsByProject);

  return {
    roadmapsByProject,
    phasesByProject,
    themesByProject,
    itemsByProject,

    // ── Roadmaps ──────────────────────────────────────────────────────────────

    createRoadmap: (projectId: string, name: string): string => {
      const id  = crypto.randomUUID();
      const now = new Date().toISOString();
      const newRoadmap: Roadmap = { id, projectId, name, status: "active", createdAt: now };
      sp(set, get, (s) => ({
        roadmapsByProject: {
          ...s.roadmapsByProject,
          [projectId]: [...(s.roadmapsByProject[projectId] ?? []), newRoadmap],
        },
      }));
      scheduleSyncRoadmaps(projectId, get);
      return id;
    },

    updateRoadmap: (projectId: string, roadmapId: string, patch: Partial<Pick<Roadmap, "name" | "status">>) => {
      sp(set, get, (s) => ({
        roadmapsByProject: {
          ...s.roadmapsByProject,
          [projectId]: (s.roadmapsByProject[projectId] ?? []).map((r) => r.id === roadmapId ? { ...r, ...patch } : r),
        },
      }));
      scheduleSyncRoadmaps(projectId, get);
    },

    getRoadmaps: (projectId: string): Roadmap[] =>
      [...(get().roadmapsByProject[projectId] ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),

    getActiveRoadmapId: (projectId: string): string | null =>
      (get().roadmapsByProject[projectId] ?? []).find((r) => r.status === "active")?.id ?? null,

    // ── Phases ────────────────────────────────────────────────────────────────

    addRoadmapPhase: (projectId: string, roadmapId: string, name: string, opts?: Partial<Pick<RoadmapPhase, "headerType" | "targetDate" | "isPublic">>): string => {
      const id  = crypto.randomUUID();
      const now = new Date().toISOString();
      const existing = (get().phasesByProject[projectId] ?? []).filter((p) => p.roadmapId === roadmapId);
      const newPhase: RoadmapPhase = {
        id, projectId, roadmapId, name,
        headerType: opts?.headerType ?? "title",
        targetDate: opts?.targetDate,
        status: "planned",
        order: existing.length,
        isPublic: opts?.isPublic ?? true,
        createdAt: now,
      };
      sp(set, get, (s) => ({
        phasesByProject: { ...s.phasesByProject, [projectId]: [...(s.phasesByProject[projectId] ?? []), newPhase] },
      }));
      scheduleSyncPhases(projectId, get);
      return id;
    },

    updateRoadmapPhase: (projectId: string, phaseId: string, patch: Partial<Pick<RoadmapPhase, "name" | "description" | "headerType" | "targetDate" | "status" | "order" | "isPublic">>) => {
      sp(set, get, (s) => ({
        phasesByProject: {
          ...s.phasesByProject,
          [projectId]: (s.phasesByProject[projectId] ?? []).map((p) => p.id === phaseId ? { ...p, ...patch } : p),
        },
      }));
      scheduleSyncPhases(projectId, get);
    },

    deleteRoadmapPhase: (projectId: string, phaseId: string) => {
      sp(set, get, (s) => ({
        phasesByProject: {
          ...s.phasesByProject,
          [projectId]: (s.phasesByProject[projectId] ?? []).filter((p) => p.id !== phaseId),
        },
        itemsByProject: {
          ...s.itemsByProject,
          [projectId]: (s.itemsByProject[projectId] ?? []).filter((i) => i.phaseId !== phaseId),
        },
      }));
      scheduleSyncPhases(projectId, get);
      scheduleSyncItems(projectId, get);
    },

    getRoadmapPhases: (projectId: string, roadmapId: string): RoadmapPhase[] =>
      [...(get().phasesByProject[projectId] ?? []).filter((p) => p.roadmapId === roadmapId)].sort((a, b) => a.order - b.order),

    // ── Themes ────────────────────────────────────────────────────────────────

    addRoadmapTheme: (projectId: string, roadmapId: string, name: string, opts?: Partial<Pick<RoadmapTheme, "color">>): string => {
      const id  = crypto.randomUUID();
      const now = new Date().toISOString();
      const existing = (get().themesByProject[projectId] ?? []).filter((t) => t.roadmapId === roadmapId);
      const newTheme: RoadmapTheme = {
        id, projectId, roadmapId, name,
        color: opts?.color ?? nextColor(existing),
        order: existing.length,
        createdAt: now,
      };
      sp(set, get, (s) => ({
        themesByProject: { ...s.themesByProject, [projectId]: [...(s.themesByProject[projectId] ?? []), newTheme] },
      }));
      scheduleSyncThemes(projectId, get);
      return id;
    },

    updateRoadmapTheme: (projectId: string, themeId: string, patch: Partial<Pick<RoadmapTheme, "name" | "color" | "order">>) => {
      sp(set, get, (s) => ({
        themesByProject: {
          ...s.themesByProject,
          [projectId]: (s.themesByProject[projectId] ?? []).map((t) => t.id === themeId ? { ...t, ...patch } : t),
        },
      }));
      scheduleSyncThemes(projectId, get);
    },

    deleteRoadmapTheme: (projectId: string, themeId: string) => {
      sp(set, get, (s) => ({
        themesByProject: {
          ...s.themesByProject,
          [projectId]: (s.themesByProject[projectId] ?? []).filter((t) => t.id !== themeId),
        },
        itemsByProject: {
          ...s.itemsByProject,
          [projectId]: (s.itemsByProject[projectId] ?? []).filter((i) => i.themeId !== themeId),
        },
      }));
      scheduleSyncThemes(projectId, get);
      scheduleSyncItems(projectId, get);
    },

    getRoadmapThemes: (projectId: string, roadmapId: string): RoadmapTheme[] =>
      [...(get().themesByProject[projectId] ?? []).filter((t) => t.roadmapId === roadmapId)].sort((a, b) => a.order - b.order),

    // ── Items ─────────────────────────────────────────────────────────────────

    addRoadmapItem: (projectId: string, roadmapId: string, phaseId: string, themeId: string, title: string): string => {
      const id  = crypto.randomUUID();
      const now = new Date().toISOString();
      const existing = (get().itemsByProject[projectId] ?? []).filter((i) => i.phaseId === phaseId && i.themeId === themeId);
      const newItem: RoadmapItem = {
        id, projectId, roadmapId, phaseId, themeId, title,
        status: "planned",
        isPublic: true,
        order: existing.length,
        createdAt: now,
      };
      sp(set, get, (s) => ({
        itemsByProject: { ...s.itemsByProject, [projectId]: [...(s.itemsByProject[projectId] ?? []), newItem] },
      }));
      scheduleSyncItems(projectId, get);
      return id;
    },

    updateRoadmapItem: (projectId: string, itemId: string, patch: Partial<Pick<RoadmapItem, "title" | "description" | "status" | "isPublic" | "order" | "phaseId" | "themeId">>) => {
      sp(set, get, (s) => ({
        itemsByProject: {
          ...s.itemsByProject,
          [projectId]: (s.itemsByProject[projectId] ?? []).map((i) => i.id === itemId ? { ...i, ...patch } : i),
        },
      }));
      scheduleSyncItems(projectId, get);
    },

    deleteRoadmapItem: (projectId: string, itemId: string) => {
      sp(set, get, (s) => ({
        itemsByProject: {
          ...s.itemsByProject,
          [projectId]: (s.itemsByProject[projectId] ?? []).filter((i) => i.id !== itemId),
        },
      }));
      scheduleSyncItems(projectId, get);
    },

    getRoadmapItems: (projectId: string, roadmapId: string, phaseId?: string, themeId?: string): RoadmapItem[] => {
      let items = (get().itemsByProject[projectId] ?? []).filter((i) => i.roadmapId === roadmapId);
      if (phaseId) items = items.filter((i) => i.phaseId === phaseId);
      if (themeId) items = items.filter((i) => i.themeId === themeId);
      return [...items].sort((a, b) => a.order - b.order);
    },

    loadRoadmapFromSupabase: async () => {},
  };
}
