import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getApiUser } from "@/lib/auth/getApiUser";
import { createApiFetcher } from "@/lib/mcp/api";
import { createMcpServer } from "@/lib/mcp/server";

/**
 * POST /api/mcp — Remote MCP endpoint (Streamable HTTP, stateless).
 *
 * Accepts JSON-RPC messages from MCP clients (Claude, etc.).
 * Auth: Bearer gdd_sk_... in Authorization header.
 */
export async function POST(request: NextRequest) {
  // Authenticate
  const auth = await getApiUser(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Resolve base URL for internal API calls
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "gdd-app.vercel.app";
  const baseUrl = `${proto}://${host}`;

  // Extract raw API key from header for internal calls
  const rawKey = request.headers.get("authorization")?.slice("Bearer ".length) ?? "";

  // Create server + transport per request (stateless / serverless)
  const api = createApiFetcher(rawKey, baseUrl);
  const server = createMcpServer(api);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,      // no SSE, JSON-RPC response directly
  });

  await server.connect(transport);

  try {
    const body = await request.json();
    const response = await transport.handleRequest(
      request,
      { parsedBody: body }
    );

    return new NextResponse(response.body, {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    });
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null },
      { status: 500 }
    );
  } finally {
    await server.close();
  }
}

/**
 * GET /api/mcp — Server info / health check.
 */
export async function GET() {
  return NextResponse.json({
    name: "gdd-manager",
    version: "0.1.0",
    protocol: "MCP Streamable HTTP",
    docs: "https://gdd-app.vercel.app/settings/api-keys",
  });
}

/**
 * DELETE /api/mcp — No-op for stateless mode.
 */
export async function DELETE() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
