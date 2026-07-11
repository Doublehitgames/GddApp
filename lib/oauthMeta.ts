/**
 * Helpers compartilhados pelos endpoints OAuth/discovery.
 */
import { NextRequest, NextResponse } from "next/server";

/** Origin público visto pelo cliente (atrás do proxy da Vercel). */
export function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "gdd-app.vercel.app";
  return `${proto}://${host}`;
}

/** CORS aberto — necessário para clients MCP baseados em browser (ex.: MCP Inspector). */
export const OAUTH_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};

export function oauthJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: OAUTH_CORS_HEADERS });
}

export function oauthError(error: string, description: string, status = 400): NextResponse {
  return oauthJson({ error, error_description: description }, status);
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS_HEADERS });
}

/** Metadata do Authorization Server (RFC 8414). */
export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    scopes_supported: ["gdd"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  };
}

/** Metadata do Protected Resource (RFC 9728). */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: ["gdd"],
    bearer_methods_supported: ["header"],
  };
}

/** Header WWW-Authenticate para 401 do resource (aponta o discovery). */
export function wwwAuthenticateHeader(origin: string): string {
  return `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
}
