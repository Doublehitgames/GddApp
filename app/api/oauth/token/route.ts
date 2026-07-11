/**
 * POST /api/oauth/token — Token endpoint (RFC 6749 + PKCE).
 *
 * grant_type=authorization_code: troca o code (uso único) por access+refresh.
 * grant_type=refresh_token: rotaciona o par de tokens.
 * Clientes públicos (auth method "none") — a prova de posse é o PKCE.
 */
import { NextRequest } from "next/server";
import { exchangeAuthorizationCode, refreshAccessToken, type TokenSet } from "@/lib/oauth";
import { corsPreflight, oauthError, oauthJson } from "@/lib/oauthMeta";

async function readParams(request: NextRequest): Promise<Record<string, string> | null> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
    const form = await request.formData();
    const out: Record<string, string> = {};
    form.forEach((v, k) => {
      if (typeof v === "string") out[k] = v;
    });
    return out;
  } catch {
    return null;
  }
}

function tokenResponse(tokens: TokenSet) {
  return oauthJson({
    access_token: tokens.accessToken,
    token_type: "bearer",
    expires_in: tokens.expiresIn,
    refresh_token: tokens.refreshToken,
    scope: tokens.scope,
  });
}

export async function POST(request: NextRequest) {
  const params = await readParams(request);
  if (!params) {
    return oauthError("invalid_request", "Body inválido (esperado form-urlencoded ou JSON)");
  }

  const grantType = params.grant_type;

  if (grantType === "authorization_code") {
    const { code, client_id: clientId, code_verifier: codeVerifier, redirect_uri: redirectUri } = params;
    if (!code || !clientId || !codeVerifier) {
      return oauthError("invalid_request", "code, client_id e code_verifier são obrigatórios");
    }
    const result = await exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier });
    if ("error" in result) {
      return oauthError(result.error, result.description, result.error === "server_error" ? 500 : 400);
    }
    return tokenResponse(result);
  }

  if (grantType === "refresh_token") {
    const { refresh_token: refreshToken, client_id: clientId } = params;
    if (!refreshToken || !clientId) {
      return oauthError("invalid_request", "refresh_token e client_id são obrigatórios");
    }
    const result = await refreshAccessToken({ refreshToken, clientId });
    if ("error" in result) {
      return oauthError(result.error, result.description, result.error === "server_error" ? 500 : 400);
    }
    return tokenResponse(result);
  }

  return oauthError("unsupported_grant_type", `grant_type não suportado: ${String(grantType)}`);
}

export async function OPTIONS() {
  return corsPreflight();
}
