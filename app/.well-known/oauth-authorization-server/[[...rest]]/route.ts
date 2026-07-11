/**
 * GET /.well-known/oauth-authorization-server[/api/mcp]
 *
 * Metadata do authorization server (RFC 8414): onde autorizar, trocar tokens
 * e registrar clientes (DCR).
 */
import { NextRequest } from "next/server";
import { authorizationServerMetadata, corsPreflight, oauthJson, requestOrigin } from "@/lib/oauthMeta";

export async function GET(request: NextRequest) {
  return oauthJson(authorizationServerMetadata(requestOrigin(request)));
}

export async function OPTIONS() {
  return corsPreflight();
}
