import type { RoadmapPhase, RoadmapItem } from "@/lib/roadmap/types";

import type { RoadmapTheme } from "@/lib/roadmap/types";

// Stub — implementação completa no Estágio 7
export async function fetchRoadmapPhases(_userId: string, _projectId: string): Promise<RoadmapPhase[] | null> {
  return null;
}

export async function upsertRoadmapPhases(_userId: string, _projectId: string, _phases: RoadmapPhase[]): Promise<boolean> {
  return false;
}

export async function fetchRoadmapThemes(_userId: string, _projectId: string): Promise<RoadmapTheme[] | null> {
  return null;
}

export async function upsertRoadmapThemes(_userId: string, _projectId: string, _themes: RoadmapTheme[]): Promise<boolean> {
  return false;
}

export async function fetchRoadmapItems(_userId: string, _projectId: string): Promise<RoadmapItem[] | null> {
  return null;
}

export async function upsertRoadmapItems(_userId: string, _projectId: string, _items: RoadmapItem[]): Promise<boolean> {
  return false;
}
