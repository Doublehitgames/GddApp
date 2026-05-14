export type PhaseStatus = "planned" | "active" | "completed" | "cancelled";

export type ItemStatus = "planned" | "in_progress" | "done" | "cut";

export type PhaseHeaderType = "title" | "month" | "quarter" | "semester" | "year";

export const THEME_COLORS = ["sky", "emerald", "amber", "violet", "rose", "pink", "indigo", "slate"] as const;
export type ThemeColor = typeof THEME_COLORS[number];

export type Roadmap = {
  id: string;
  projectId: string;
  name: string;
  status: "active" | "archived";
  createdAt: string;
};

export type RoadmapPhase = {
  id: string;
  projectId: string;
  roadmapId: string;
  name: string;
  description?: string;
  headerType: PhaseHeaderType;
  /** "YYYY-MM" — used when headerType is date-based */
  targetDate?: string;
  status: PhaseStatus;
  order: number;
  isPublic: boolean;
  createdAt: string;
};

export type RoadmapTheme = {
  id: string;
  projectId: string;
  roadmapId: string;
  name: string;
  color: ThemeColor;
  order: number;
  createdAt: string;
};

export type RoadmapItem = {
  id: string;
  projectId: string;
  roadmapId: string;
  phaseId: string;
  themeId: string;
  title: string;
  description?: string;
  status: ItemStatus;
  isPublic: boolean;
  order: number;
  createdAt: string;
};

export type RoadmapState = {
  /** projectId → Roadmap[] */
  roadmapsByProject: Record<string, Roadmap[]>;
  /** projectId → RoadmapPhase[] */
  phasesByProject: Record<string, RoadmapPhase[]>;
  /** projectId → RoadmapTheme[] */
  themesByProject: Record<string, RoadmapTheme[]>;
  /** projectId → RoadmapItem[] */
  itemsByProject: Record<string, RoadmapItem[]>;
};

export type RoadmapActions = {
  // ── Roadmaps ──────────────────────────────────────────────────────────────
  createRoadmap: (projectId: string, name: string) => string;
  updateRoadmap: (projectId: string, roadmapId: string, patch: Partial<Pick<Roadmap, "name" | "status">>) => void;
  getRoadmaps: (projectId: string) => Roadmap[];
  getActiveRoadmapId: (projectId: string) => string | null;

  // ── Phases ────────────────────────────────────────────────────────────────
  addRoadmapPhase: (projectId: string, roadmapId: string, name: string, opts?: Partial<Pick<RoadmapPhase, "headerType" | "targetDate" | "isPublic">>) => string;
  updateRoadmapPhase: (projectId: string, phaseId: string, patch: Partial<Pick<RoadmapPhase, "name" | "description" | "headerType" | "targetDate" | "status" | "order" | "isPublic">>) => void;
  deleteRoadmapPhase: (projectId: string, phaseId: string) => void;
  getRoadmapPhases: (projectId: string, roadmapId: string) => RoadmapPhase[];

  // ── Themes ────────────────────────────────────────────────────────────────
  addRoadmapTheme: (projectId: string, roadmapId: string, name: string, opts?: Partial<Pick<RoadmapTheme, "color">>) => string;
  updateRoadmapTheme: (projectId: string, themeId: string, patch: Partial<Pick<RoadmapTheme, "name" | "color" | "order">>) => void;
  deleteRoadmapTheme: (projectId: string, themeId: string) => void;
  getRoadmapThemes: (projectId: string, roadmapId: string) => RoadmapTheme[];

  // ── Items ─────────────────────────────────────────────────────────────────
  addRoadmapItem: (projectId: string, roadmapId: string, phaseId: string, themeId: string, title: string) => string;
  updateRoadmapItem: (projectId: string, itemId: string, patch: Partial<Pick<RoadmapItem, "title" | "description" | "status" | "isPublic" | "order" | "phaseId" | "themeId">>) => void;
  deleteRoadmapItem: (projectId: string, itemId: string) => void;
  getRoadmapItems: (projectId: string, roadmapId: string, phaseId?: string, themeId?: string) => RoadmapItem[];

  loadRoadmapFromSupabase: () => Promise<void>;
};
