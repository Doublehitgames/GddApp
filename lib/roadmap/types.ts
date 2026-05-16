export type PhaseStatus = "planned" | "active" | "completed" | "cancelled";

export type ItemStatus = "planned" | "in_progress" | "done" | "cut";

export type PhaseHeaderType = "title" | "month" | "quarter" | "semester" | "year";

export const THEME_COLORS = ["sky", "emerald", "amber", "violet", "rose", "pink", "indigo", "slate"] as const;
export type ThemeColor = typeof THEME_COLORS[number];

// ─── Item tag ─────────────────────────────────────────────────────────────────

export const ITEM_TAGS = ["new", "fix", "refact", "add", "remove", "chore"] as const;
export type RoadmapItemTag = typeof ITEM_TAGS[number];

export const ITEM_TAG_CONFIG: Record<RoadmapItemTag, {
  label: string;
  /** Full bordered style — for standalone badges (popover picker, detail modal) */
  style: string;
  /** Borderless dark pill — for inside dark chips (editor grid) */
  chipStyle: string;
  /** Light pill — for inside light chips (doc view) */
  docStyle: string;
}> = {
  new:    { label: "NEW",  style: "border-emerald-700/60 bg-emerald-950/50 text-emerald-300", chipStyle: "bg-emerald-900/70 text-emerald-300",  docStyle: "bg-emerald-100 text-emerald-700"  },
  fix:    { label: "FIX",  style: "border-rose-700/60    bg-rose-950/50    text-rose-300",    chipStyle: "bg-rose-900/70    text-rose-300",    docStyle: "bg-rose-100    text-rose-700"    },
  refact: { label: "RFCT", style: "border-amber-700/60   bg-amber-950/50   text-amber-300",   chipStyle: "bg-amber-900/70   text-amber-300",   docStyle: "bg-amber-100   text-amber-700"   },
  add:    { label: "+",    style: "border-sky-700/60     bg-sky-950/50     text-sky-300",     chipStyle: "bg-sky-900/70     text-sky-300",     docStyle: "bg-sky-100     text-sky-700"     },
  remove: { label: "−",    style: "border-pink-700/60    bg-pink-950/50    text-pink-300",    chipStyle: "bg-pink-900/70    text-pink-300",    docStyle: "bg-pink-100    text-pink-700"    },
  chore:  { label: "~",    style: "border-slate-700/60   bg-slate-800/50   text-slate-400",   chipStyle: "bg-slate-800/70   text-slate-400",   docStyle: "bg-slate-100   text-slate-600"   },
};

// ─── Entities ────────────────────────────────────────────────────────────────

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
  thumbUrl?: string;
  tag?: RoadmapItemTag;
  status: ItemStatus;
  isPublic: boolean;
  order: number;
  createdAt: string;
};

// ─── State & Actions ─────────────────────────────────────────────────────────

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
  reorderRoadmapPhases: (projectId: string, roadmapId: string, orderedIds: string[]) => void;

  // ── Themes ────────────────────────────────────────────────────────────────
  addRoadmapTheme: (projectId: string, roadmapId: string, name: string, opts?: Partial<Pick<RoadmapTheme, "color">>) => string;
  updateRoadmapTheme: (projectId: string, themeId: string, patch: Partial<Pick<RoadmapTheme, "name" | "color" | "order">>) => void;
  deleteRoadmapTheme: (projectId: string, themeId: string) => void;
  getRoadmapThemes: (projectId: string, roadmapId: string) => RoadmapTheme[];
  reorderRoadmapThemes: (projectId: string, roadmapId: string, orderedIds: string[]) => void;

  // ── Items ─────────────────────────────────────────────────────────────────
  addRoadmapItem: (projectId: string, roadmapId: string, phaseId: string, themeId: string, title: string) => string;
  updateRoadmapItem: (projectId: string, itemId: string, patch: Partial<Pick<RoadmapItem, "title" | "description" | "tag" | "status" | "isPublic" | "order" | "phaseId" | "themeId">>) => void;
  deleteRoadmapItem: (projectId: string, itemId: string) => void;
  getRoadmapItems: (projectId: string, roadmapId: string, phaseId?: string, themeId?: string) => RoadmapItem[];
  reorderRoadmapItems: (projectId: string, phaseId: string, themeId: string, orderedIds: string[]) => void;

  loadRoadmapFromSupabase: () => Promise<void>;
};
