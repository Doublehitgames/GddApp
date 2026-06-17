/**
 * Type-specific MCP tools for each addon type.
 *
 * 12 types × 2 (create + update) = 24 tools.
 * Each tool fixes the addon `type` and provides a typed schema for `data`,
 * then delegates to the generic addon API endpoint.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GddApiClient } from "./client.js";
export declare function registerAddonTools(server: McpServer, client: GddApiClient): void;
