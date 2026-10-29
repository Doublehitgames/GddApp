#!/usr/bin/env node
/**
 * GDD Manager MCP Server
 *
 * Exposes GDD Manager projects and sections as MCP tools.
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
import { registerPrompts } from "./prompts.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import { createRequire } from "node:module";
// Lida do package.json publicado (fica um nível acima de dist/). Escrita à mão
// aqui, ficou em 0.7.0 por quatro versões: o cliente via um número que não
// dizia qual servidor estava rodando.
const { version } = createRequire(import.meta.url)("../package.json");
async function main() {
    if (!process.env.GDD_API_KEY) {
        console.error("Error: GDD_API_KEY environment variable is required.");
        console.error("Get your API key at: https://gdd-app.vercel.app/settings/api-keys");
        process.exit(1);
    }
    const client = new GddApiClient();
    const server = new McpServer({ name: "gdd-manager", version }, 
    // Sent once in the initialize response: conventions that apply to every
    // write but belong in no single tool's schema.
    { instructions: SERVER_INSTRUCTIONS });
    registerTools(server, client);
    registerPrompts(server);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map