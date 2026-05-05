export type GameGenre = "farm" | "casual" | "rpg" | "puzzle" | "idle" | "shooter";

export type KpiMetrics = {
  d1?: number;           // D1 retention %
  d7?: number;           // D7 retention %
  d30?: number;          // D30 retention %
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
  hypothesis?: string;   // "vou mudar X porque Y"
  hypothesisArea?: "tutorial" | "loop" | "midgame" | "monetization" | "other";
  outcome?: "confirmed" | "refuted" | "inconclusive";
  learning?: string;
  createdAt: string;
};

export type KpiProjectConfig = {
  genre: GameGenre;
};

export type KpiState = {
  kpiEntriesByProject: Record<string, KpiEntry[]>;
  kpiConfigByProject: Record<string, KpiProjectConfig>;
};

export type KpiActions = {
  setKpiGenre: (projectId: string, genre: GameGenre) => void;
  addKpiEntry: (projectId: string, entry: Omit<KpiEntry, "id" | "createdAt">) => string;
  updateKpiEntry: (projectId: string, entryId: string, patch: Partial<Pick<KpiEntry, "hypothesis" | "hypothesisArea" | "outcome" | "learning" | "metrics">>) => void;
  deleteKpiEntry: (projectId: string, entryId: string) => void;
};
