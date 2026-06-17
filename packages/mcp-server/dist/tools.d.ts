/**
 * MCP tool definitions for GDD Manager.
 *
 * Each tool maps to a REST API endpoint. The McpServer.tool() method
 * takes (name, description, zodSchema, callback).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GddApiClient } from "./client.js";
export declare function registerTools(server: McpServer, client: GddApiClient): void;
