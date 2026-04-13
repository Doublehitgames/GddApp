#!/usr/bin/env node

/**
 * GDD Manager MCP Server
 *
 * Exposes GDD Manager projects, sections, and addons as MCP tools.
 * Communicates via stdio transport.
 *
 * Required env:
 *   GDD_API_KEY  — your personal API key (gdd_sk_...)
 *
 * Optional env:
 *   GDD_API_URL  — API base URL (default: https://gdd-app.vercel.app)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GddApiClient } from "./client.js";
import { registerTools } from "./tools.js";
import { registerAddonTools } from "./addon-tools.js";

async function main() {
  if (!process.env.GDD_API_KEY) {
    console.error("Error: GDD_API_KEY environment variable is required.");
    console.error("Get your API key at: https://gdd-app.vercel.app/settings/api-keys");
    process.exit(1);
  }

  const client = new GddApiClient();

  const server = new McpServer({
    name: "gdd-manager",
    version: "0.1.0",
  });

  registerTools(server, client);
  registerAddonTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
