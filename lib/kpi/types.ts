export type GameGenre = "farm" | "casual" | "rpg" | "puzzle" | "idle" | "shooter";

export type MonetizationType = "iap" | "ads" | "iap_ads" | "premium" | "none";
export type LoopType = "levels" | "sandbox" | "pvp" | "progression";

export type KpiGameProfile = {
  hasTutorial: boolean;
  monetization: MonetizationType;
  loopType: LoopType;
};

export type KpiCustomBenchmarks = {
  d1?: { good: number; ok: number };
  d7?: { good: number; ok: number };
  d30?: { good: number; ok: number };
  sessionsPerDay?: { good: number; ok: number };
  sessionDuration?: { good: number; ok: number };
  conversionRate?: { good: number; ok: number };
};

export type KpiMetrics = {
  d1?: number;
  d7?: number;
  d30?: number;
  sessionsPerDay?: number;
  sessionDuration?: number; // avg minutes
  conversionRate?: number;  // % converting to payer
};

export type KpiEntry = {
  id: string;
  projectId: string;
  date: string;          // ISO "YYYY-MM-DD"
  genre: GameGenre;
  metrics: KpiMetrics;
  hypothesis?: string;
  hypothesisArea?: "tutorial" | "loop" | "midgame" | "monetization" | "other";
  outcome?: "confirmed" | "refuted" | "inconclusive";
  learning?: string;
  createdAt: string;
};

export type KpiProjectConfig = {
  genre: GameGenre;
  profile?: KpiGameProfile;
  customBenchmarks?: KpiCustomBenchmarks;
};

export type KpiState = {
  kpiEntriesByProject: Record<string, KpiEntry[]>;
  kpiConfigByProject: Record<string, KpiProjectConfig>;
};

export type KpiActions = {
  setKpiGenre: (projectId: string, genre: GameGenre) => void;
  updateKpiConfig: (projectId: string, patch: Partial<Omit<KpiProjectConfig, "genre">>) => void;
  addKpiEntry: (projectId: string, entry: Omit<KpiEntry, "id" | "createdAt">) => string;
  updateKpiEntry: (projectId: string, entryId: string, patch: Partial<Pick<KpiEntry, "hypothesis" | "hypothesisArea" | "outcome" | "learning" | "metrics">>) => void;
  deleteKpiEntry: (projectId: string, entryId: string) => void;
};
