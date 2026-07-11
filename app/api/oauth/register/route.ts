/**
 * POST /api/oauth/register — Dynamic Client Registration (RFC 7591).
 *
 * Clientes MCP (claude.ai etc.) se registram sozinhos antes do authorize.
 * Só clientes públicos: sem client_secret, PKCE obrigatório no /oauth/authorize.
 */
import { NextRequest } from "next/server";
import { isAllowedRedirectUri, registerClient } from "@/lib/oauth";
import { corsPreflight, oauthError, oauthJson } from "@/lib/oauthMeta";

const MAX_REDIRECT_URIS = 10;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return oauthError("invalid_client_metadata", "Body JSON inválido");
  }

  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return oauthError("invalid_redirect_uri", "redirect_uris é obrigatório");
  }
  if (redirectUris.length > MAX_REDIRECT_URIS) {
    return oauthError("invalid_redirect_uri", `Máximo de ${MAX_REDIRECT_URIS} redirect_uris`);
  }
  for (const uri of redirectUris) {
    if (typeof uri !== "string" || !isAllowedRedirectUri(uri)) {
      return oauthError("invalid_redirect_uri", `redirect_uri não permitida: ${String(uri)}`);
    }
  }

  const client = await registerClient({
    clientName: typeof body.client_name === "string" ? body.client_name.slice(0, 200) : undefined,
    redirectUris: redirectUris as string[],
    clientUri: typeof body.client_uri === "string" ? body.client_uri.slice(0, 500) : undefined,
    logoUri: typeof body.logo_uri === "string" ? body.logo_uri.slice(0, 500) : undefined,
  });

  if (!client) {
    return oauthError("server_error", "Falha ao registrar cliente", 500);
  }

  return oauthJson(
    {
      client_id: client.id,
      client_name: client.client_name ?? undefined,
      redirect_uris: client.redirect_uris,
      client_uri: client.client_uri ?? undefined,
      logo_uri: client.logo_uri ?? undefined,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(new Date(client.created_at).getTime() / 1000),
    },
    201
  );
}

export async function OPTIONS() {
  return corsPreflight();
}
