/**
 * GET /.well-known/oauth-protected-resource[/api/mcp]
 *
 * Metadata do recurso protegido (RFC 9728). Clientes MCP chegam aqui a partir
 * do header WWW-Authenticate do 401 de /api/mcp. O catch-all opcional cobre a
 * variante com sufixo de path que alguns clientes usam.
 */
import { NextRequest } from "next/server";
import { corsPreflight, oauthJson, protectedResourceMetadata, requestOrigin } from "@/lib/oauthMeta";

export async function GET(request: NextRequest) {
  return oauthJson(protectedResourceMetadata(requestOrigin(request)));
}

export async function OPTIONS() {
  return corsPreflight();
}
