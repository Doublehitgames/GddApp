import { createAdminClient } from "./supabase/admin";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

type ConfigCache = { values: Record<string, string>; fetchedAt: number };
let _cache: ConfigCache | null = null;

async function fetchFromDb(): Promise<Record<string, string>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("app_config").select("key, value");
    if (error || !data) return {};
    return Object.fromEntries(data.map(({ key, value }: { key: string; value: string }) => [key, value]));
  } catch {
    return {};
  }
}

async function getConfig(): Promise<Record<string, string>> {
  const now = Date.now();
  if (_cache && now - _cache.fetchedAt < CACHE_TTL_MS) return _cache.values;
  const values = await fetchFromDb();
  _cache = { values, fetchedAt: now };
  return values;
}

function toInt(config: Record<string, string>, key: string, fallback: number): number {
  const raw = config[key];
  const n = Number(raw);
  return raw !== undefined && Number.isFinite(n) ? n : fallback;
}

export async function getRemoteConfig() {
  const c = await getConfig();
  return {
    FREE_MAX_PROJECTS: toInt(c, "FREE_MAX_PROJECTS", 2),
    FREE_MAX_SECTIONS_PER_PROJECT: toInt(c, "FREE_MAX_SECTIONS_PER_PROJECT", 300),
    FREE_MAX_SECTIONS_TOTAL: toInt(c, "FREE_MAX_SECTIONS_TOTAL", 200),
    SYNC_REQUESTS_PER_MINUTE: toInt(c, "SYNC_REQUESTS_PER_MINUTE", 30),
  };
}

export type RemoteConfig = Awaited<ReturnType<typeof getRemoteConfig>>;
