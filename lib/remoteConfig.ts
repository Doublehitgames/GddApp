import { createAdminClient } from "./supabase/admin";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

type ConfigCache = { values: Record<string, string>; fetchedAt: number };
let _cache: ConfigCache | null = null;

/** Valores padrão de cada chave quando não há linha em app_config. */
const DEFAULTS = {
  FREE_MAX_PROJECTS: 2,
  FREE_MAX_SECTIONS_PER_PROJECT: 300,
  SYNC_REQUESTS_PER_MINUTE: 30,
} as const;

type ConfigKey = keyof typeof DEFAULTS;

/**
 * Chave de override por usuário: `<CHAVE>:<user_id>`.
 * Ex.: ('FREE_MAX_SECTIONS_PER_PROJECT:8f3c…', '500') levanta o limite só daquele
 * usuário, sem mexer no valor global. Sem linha de override, vale o global.
 */
export function userConfigKey(key: ConfigKey, userId: string): string {
  return `${key}:${userId}`;
}

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

/**
 * Limites efetivos. Passe o userId do DONO do projeto para aplicar overrides
 * individuais; sem userId, devolve só os valores globais.
 */
export async function getRemoteConfig(userId?: string | null) {
  const c = await getConfig();
  const resolve = (key: ConfigKey) => {
    const global = toInt(c, key, DEFAULTS[key]);
    return userId ? toInt(c, userConfigKey(key, userId), global) : global;
  };
  return {
    FREE_MAX_PROJECTS: resolve("FREE_MAX_PROJECTS"),
    FREE_MAX_SECTIONS_PER_PROJECT: resolve("FREE_MAX_SECTIONS_PER_PROJECT"),
    SYNC_REQUESTS_PER_MINUTE: resolve("SYNC_REQUESTS_PER_MINUTE"),
  };
}

export type RemoteConfig = Awaited<ReturnType<typeof getRemoteConfig>>;
