// store/slices/storageHelpers.ts
// Pure helper functions extracted from store/projectStore.ts (no set/get dependency).

import { normalizeSectionAddons } from "@/lib/addons/normalize";
import type { Project, LastConsistencyAnalysis, LastRelationsAnalysis, DiagramState, PersistenceConfig } from "./types";
import {
  STORAGE_KEY, PERSISTENCE_CONFIG_KEY, LAST_ANALYSES_KEY, LAST_RELATIONS_KEY,
  DIAGRAMS_KEY, MAX_IMAGE_SRC_LENGTH, DATA_IMAGE_URI_RE, DEFAULT_PERSISTENCE_CONFIG,
  SYNC_STATS_HISTORY_LIMIT, SYNC_STATE_KEY,
} from "./types";
import type { PersistedSyncState } from "./types";

// ---------------------------------------------------------------------------
// Module-level env check
// ---------------------------------------------------------------------------

const isProduction = process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

export function logInfo(...args: unknown[]): void {
  if (!isProduction) console.log(...args);
}

export function logWarn(...args: unknown[]): void {
  if (!isProduction) console.warn(...args);
}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

export function sanitizeRichText(value?: string): string | undefined {
  if (!value) return value;

  const withoutDataUris = value.replace(DATA_IMAGE_URI_RE, "[imagem-removida-data-uri]");
  const withoutHeavyImgs = withoutDataUris.replace(/<img\b[^>]*>/gi, (imgTag) => {
    const srcMatch = imgTag.match(/\bsrc\s*=\s*(?:(["'])(.*?)\1|([^\s>]+))/i);
    const src = (srcMatch?.[2] || srcMatch?.[3] || "").trim();
    if (!src) return "";
    if (src.toLowerCase().startsWith("data:image/")) return "";
    if (src.length > MAX_IMAGE_SRC_LENGTH) return "";
    return imgTag;
  });

  return withoutHeavyImgs;
}

export function sanitizeProjectForStorage(project: Project): Project {
  return {
    ...project,
    description: sanitizeRichText(project.description),
    sections: (project.sections || []).map((section) => ({
      ...section,
      content: sanitizeRichText(section.content),
      addons: normalizeSectionAddons(
        section.addons || (section as unknown as { balanceAddons?: unknown }).balanceAddons
      ),
    })),
  };
}

export function sanitizeProjectsForStorage(projects: Project[]): Project[] {
  return projects.map(sanitizeProjectForStorage);
}

// ---------------------------------------------------------------------------
// Parsing / persistence
// ---------------------------------------------------------------------------

export function parseProjectsFromStorage(raw: string): Project[] | null {
  try {
    const preSanitizedRaw = raw.replace(DATA_IMAGE_URI_RE, "[imagem-removida-data-uri]");
    const parsed = JSON.parse(preSanitizedRaw) as Project[];
    if (!Array.isArray(parsed)) return null;
    return sanitizeProjectsForStorage(parsed);
  } catch {
    return null;
  }
}

export function persist(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProjectsForStorage(projects)));
  } catch (e) {
    logWarn("Could not persist projects to localStorage", e);
  }
}

// ---------------------------------------------------------------------------
// Persistence config
// ---------------------------------------------------------------------------

export function loadPersistenceConfig(): PersistenceConfig {
  try {
    const raw = localStorage.getItem(PERSISTENCE_CONFIG_KEY);
    if (!raw) return DEFAULT_PERSISTENCE_CONFIG;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      debounceMs: Number(parsed.debounceMs) || DEFAULT_PERSISTENCE_CONFIG.debounceMs,
      autosaveIntervalMs: Number(parsed.autosaveIntervalMs) || DEFAULT_PERSISTENCE_CONFIG.autosaveIntervalMs,
      syncAutomatic: Boolean(parsed.syncAutomatic),
    };
  } catch {
    return DEFAULT_PERSISTENCE_CONFIG;
  }
}

export function persistPersistenceConfig(config: PersistenceConfig): void {
  try {
    localStorage.setItem(PERSISTENCE_CONFIG_KEY, JSON.stringify(config));
  } catch {}
}

// ---------------------------------------------------------------------------
// Last analyses
// ---------------------------------------------------------------------------

export function loadLastAnalyses(): Record<string, LastConsistencyAnalysis> {
  try {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(LAST_ANALYSES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LastConsistencyAnalysis>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function persistLastAnalyses(data: Record<string, LastConsistencyAnalysis>): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(LAST_ANALYSES_KEY, JSON.stringify(data));
  } catch (e) {
    logWarn("Could not persist last analyses", e);
  }
}

// ---------------------------------------------------------------------------
// Last relations
// ---------------------------------------------------------------------------

export function loadLastRelations(): Record<string, LastRelationsAnalysis> {
  try {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(LAST_RELATIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LastRelationsAnalysis>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function persistLastRelations(data: Record<string, LastRelationsAnalysis>): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(LAST_RELATIONS_KEY, JSON.stringify(data));
  } catch (e) {
    logWarn("Could not persist last relations", e);
  }
}

// ---------------------------------------------------------------------------
// Diagrams
// ---------------------------------------------------------------------------

export function loadDiagrams(): Record<string, DiagramState> {
  try {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(DIAGRAMS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DiagramState>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export function persistDiagrams(data: Record<string, DiagramState>): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(DIAGRAMS_KEY, JSON.stringify(data));
  } catch (e) {
    logWarn("Could not persist diagrams", e);
  }
}

// ---------------------------------------------------------------------------
// Section diagram key builder
// ---------------------------------------------------------------------------

export function buildSectionDiagramKey(projectId: string, sectionId: string): string {
  return `${projectId}:${sectionId}`;
}
