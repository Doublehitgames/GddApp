/**
 * OAuth 2.1 authorization server para o MCP remoto (/api/mcp).
 * Server-only — nunca importar de código client.
 *
 * - Clientes públicos via Dynamic Client Registration (RFC 7591), PKCE S256 obrigatório
 * - Authorization codes de uso único (10 min)
 * - Access/refresh tokens opacos, armazenados como SHA-256 (mesmo padrão de lib/apiKeys.ts)
 * - Refresh com rotação: cada refresh revoga o token anterior
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const ACCESS_PREFIX = "gdd_at_";
const REFRESH_PREFIX = "gdd_rt_";
const CODE_PREFIX = "gdd_ac_";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 min
export const ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 dias
const REFRESH_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 dias

export const OAUTH_SCOPE = "gdd";

function generateSecret(prefix: string): string {
  return prefix + randomBytes(32).toString("hex");
}

function hashSecret(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ── PKCE ──────────────────────────────────────────────────────────────

/** base64url(sha256(verifier)) — método S256 (RFC 7636). */
export function pkceChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  return safeEqualHex(pkceChallengeFromVerifier(codeVerifier), codeChallenge);
}

// ── Clients (DCR) ─────────────────────────────────────────────────────

export type OAuthClient = {
  id: string;
  client_name: string | null;
  redirect_uris: string[];
  client_uri: string | null;
  logo_uri: string | null;
  created_at: string;
};

/** URIs de redirect aceitas: https, ou http só em loopback (dev/clients locais). */
export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") {
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  }
  return false;
}

export async function registerClient(params: {
  clientName?: string;
  redirectUris: string[];
  clientUri?: string;
  logoUri?: string;
}): Promise<OAuthClient | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("oauth_clients")
    .insert({
      client_name: params.clientName ?? null,
      redirect_uris: params.redirectUris,
      client_uri: params.clientUri ?? null,
      logo_uri: params.logoUri ?? null,
    })
    .select("id, client_name, redirect_uris, client_uri, logo_uri, created_at")
    .single();

  if (error || !data) return null;
  return data as OAuthClient;
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("oauth_clients")
    .select("id, client_name, redirect_uris, client_uri, logo_uri, created_at")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) return null;
  return data as OAuthClient;
}

// ── Authorization codes ───────────────────────────────────────────────

export async function createAuthorizationCode(params: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope?: string;
}): Promise<string | null> {
  const rawCode = generateSecret(CODE_PREFIX);
  const supabase = createAdminClient();

  const { error } = await supabase.from("oauth_codes").insert({
    code_hash: hashSecret(rawCode),
    client_id: params.clientId,
    user_id: params.userId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    scope: params.scope ?? OAUTH_SCOPE,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });

  if (error) return null;
  return rawCode;
}

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
};

export type TokenError = { error: string; description: string };

async function issueTokens(
  userId: string,
  clientId: string,
  scope: string
): Promise<TokenSet | null> {
  const accessToken = generateSecret(ACCESS_PREFIX);
  const refreshToken = generateSecret(REFRESH_PREFIX);
  const supabase = createAdminClient();

  const { error } = await supabase.from("oauth_tokens").insert({
    user_id: userId,
    client_id: clientId,
    access_token_hash: hashSecret(accessToken),
    refresh_token_hash: hashSecret(refreshToken),
    scope,
    access_expires_at: new Date(Date.now() + ACCESS_TTL_SECONDS * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + REFRESH_TTL_MS).toISOString(),
  });

  if (error) return null;
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, scope };
}

/** Troca o authorization code por tokens (uso único, valida PKCE + redirect_uri). */
export async function exchangeAuthorizationCode(params: {
  code: string;
  clientId: string;
  redirectUri?: string;
  codeVerifier: string;
}): Promise<TokenSet | TokenError> {
  const supabase = createAdminClient();
  const codeHash = hashSecret(params.code);

  const { data, error } = await supabase
    .from("oauth_codes")
    .select("code_hash, client_id, user_id, redirect_uri, code_challenge, scope, expires_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  // Uso único: apaga imediatamente, mesmo que a validação abaixo falhe.
  if (data) {
    await supabase.from("oauth_codes").delete().eq("code_hash", codeHash);
  }

  if (error || !data) {
    return { error: "invalid_grant", description: "Authorization code inválido ou já utilizado" };
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { error: "invalid_grant", description: "Authorization code expirado" };
  }
  if (data.client_id !== params.clientId) {
    return { error: "invalid_grant", description: "client_id não corresponde ao code" };
  }
  if (params.redirectUri && data.redirect_uri !== params.redirectUri) {
    return { error: "invalid_grant", description: "redirect_uri não corresponde ao code" };
  }
  if (!verifyPkce(params.codeVerifier, data.code_challenge)) {
    return { error: "invalid_grant", description: "code_verifier inválido (PKCE)" };
  }

  const tokens = await issueTokens(data.user_id, data.client_id, data.scope ?? OAUTH_SCOPE);
  if (!tokens) return { error: "server_error", description: "Falha ao emitir tokens" };
  return tokens;
}

/** Refresh com rotação: revoga o registro antigo e emite um novo par. */
export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
}): Promise<TokenSet | TokenError> {
  if (!params.refreshToken.startsWith(REFRESH_PREFIX)) {
    return { error: "invalid_grant", description: "Refresh token inválido" };
  }

  const supabase = createAdminClient();
  const refreshHash = hashSecret(params.refreshToken);

  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("id, user_id, client_id, refresh_token_hash, scope, refresh_expires_at, revoked_at")
    .eq("refresh_token_hash", refreshHash)
    .maybeSingle();

  if (error || !data) {
    return { error: "invalid_grant", description: "Refresh token inválido" };
  }
  if (data.revoked_at) {
    return { error: "invalid_grant", description: "Refresh token revogado" };
  }
  if (data.refresh_expires_at && new Date(data.refresh_expires_at).getTime() < Date.now()) {
    return { error: "invalid_grant", description: "Refresh token expirado" };
  }
  if (data.client_id !== params.clientId) {
    return { error: "invalid_grant", description: "client_id não corresponde ao token" };
  }
  if (!safeEqualHex(data.refresh_token_hash, refreshHash)) {
    return { error: "invalid_grant", description: "Refresh token inválido" };
  }

  const tokens = await issueTokens(data.user_id, data.client_id, data.scope ?? OAUTH_SCOPE);
  if (!tokens) return { error: "server_error", description: "Falha ao emitir tokens" };

  await supabase
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", data.id);

  return tokens;
}

// ── Validação de access token (usada pelo getApiUser) ────────────────

export function isOAuthAccessToken(raw: string): boolean {
  return raw.startsWith(ACCESS_PREFIX);
}

// ── Conexões do usuário (painel de revogação) ────────────────────────

export type OAuthConnection = {
  clientId: string;
  clientName: string | null;
  connectedAt: string;
  lastUsedAt: string | null;
};

/**
 * Lista as conexões OAuth ativas do usuário, agrupadas por cliente.
 * Cada refresh rotaciona o par de tokens, então há vários registros por
 * cliente; aqui colapsamos numa linha por cliente (conexão mais antiga +
 * uso mais recente). Usa admin client porque `oauth_clients` tem RLS fechado.
 */
export async function listUserConnections(userId: string): Promise<OAuthConnection[]> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("client_id, created_at, last_used_at, oauth_clients(client_name)")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .gt("access_expires_at", nowIso)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const byClient = new Map<string, OAuthConnection>();
  for (const row of data as unknown as Array<{
    client_id: string;
    created_at: string;
    last_used_at: string | null;
    oauth_clients: { client_name: string | null } | null;
  }>) {
    const existing = byClient.get(row.client_id);
    if (!existing) {
      byClient.set(row.client_id, {
        clientId: row.client_id,
        clientName: row.oauth_clients?.client_name ?? null,
        connectedAt: row.created_at,
        lastUsedAt: row.last_used_at,
      });
    } else {
      // created_at cresce (order asc) → mantém o primeiro; atualiza último uso
      if (row.last_used_at && (!existing.lastUsedAt || row.last_used_at > existing.lastUsedAt)) {
        existing.lastUsedAt = row.last_used_at;
      }
    }
  }

  return Array.from(byClient.values());
}

/** Revoga todos os tokens ativos do usuário para um cliente específico. */
export async function revokeUserConnection(userId: string, clientId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .is("revoked_at", null);

  return !error;
}

export async function validateOAuthToken(
  rawToken: string
): Promise<{ userId: string; tokenId: string } | null> {
  if (!rawToken.startsWith(ACCESS_PREFIX)) return null;

  const hash = hashSecret(rawToken);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("id, user_id, access_token_hash, access_expires_at, revoked_at")
    .eq("access_token_hash", hash)
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.access_expires_at).getTime() < Date.now()) return null;
  if (!safeEqualHex(data.access_token_hash, hash)) return null;

  // last_used_at em fire-and-forget, como validateApiKey
  supabase
    .from("oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { userId: data.user_id, tokenId: data.id };
}
