/**
 * MCP tool definitions for GDD Manager.
 *
 * Each tool maps to a REST API endpoint. The McpServer.tool() method
 * takes (name, description, zodSchema, callback).
 */

import { z } from "zod/v3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GddApiClient, GddApiError } from "./client.js";

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function json(data: unknown) {
  return text(JSON.stringify(data, null, 2));
}

function err(e: unknown) {
  if (e instanceof GddApiError) {
    return { content: [{ type: "text" as const, text: `Error (${e.code}): ${e.message}` }], isError: true };
  }
  return { content: [{ type: "text" as const, text: String(e) }], isError: true };
}

export function registerTools(server: McpServer, client: GddApiClient) {
  // ── Projects ────────────────────────────────────────────────────

  server.tool(
    "list_projects",
    "List all GDD projects you have access to (owned and shared)",
    {},
    async () => {
      try { return json(await client.listProjects()); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_project",
    "Get a project with all its sections and addons",
    { projectId: z.string().describe("Project UUID") },
    async ({ projectId }) => {
      try { return json(await client.getProject(projectId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "create_project",
    "Create a new GDD project",
    {
      title: z.string().describe("Project title"),
      description: z.string().optional().describe("Project description"),
    },
    async (params) => {
      try { return json(await client.createProject(params)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_project",
    "Update project metadata (title, description, cover image, or mindmap settings)",
    {
      projectId: z.string().describe("Project UUID"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      coverImageUrl: z.string().optional().describe("Cover image URL"),
      aiInstructions: z.string().optional().describe("AI instructions — conventions for how AI should structure data in this project"),
    },
    async ({ projectId, ...fields }) => {
      try { return json(await client.updateProject(projectId, fields)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "delete_project",
    "Delete a project and all its sections (owner only, irreversible)",
    { projectId: z.string().describe("Project UUID") },
    async ({ projectId }) => {
      try { return json(await client.deleteProject(projectId)); }
      catch (e) { return err(e); }
    },
  );

  // ── Sections ────────────────────────────────────────────────────

  server.tool(
    "list_sections",
    "List all sections of a project, sorted by order",
    { projectId: z.string().describe("Project UUID") },
    async ({ projectId }) => {
      try { return json(await client.listSections(projectId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_section",
    "Get a single section with its addons",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
    },
    async ({ projectId, sectionId }) => {
      try { return json(await client.getSection(projectId, sectionId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "create_section",
    "Create a new section in a project",
    {
      projectId: z.string().describe("Project UUID"),
      title: z.string().describe("Section title"),
      content: z.string().optional().describe("Section content (text/markdown)"),
      parentId: z.string().optional().describe("Parent section UUID for sub-sections"),
      order: z.number().optional().describe("Sort order (0-based)"),
      color: z.string().optional().describe("Hex color (#rrggbb)"),
      domainTags: z.array(z.string()).optional().describe("Game design domain tags (e.g. combat, economy)"),
      dataId: z.string().optional().describe("User-defined data identifier (e.g. FARM_ANIMAL_CHICKEN)"),
    },
    async ({ projectId, ...params }) => {
      try { return json(await client.createSection(projectId, params)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_section",
    "Update a section's fields (title, content, color, tags, etc.)",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("New content"),
      parentId: z.string().optional().describe("New parent section UUID"),
      order: z.number().optional().describe("New sort order"),
      color: z.string().optional().describe("New hex color"),
      domainTags: z.array(z.string()).optional().describe("New domain tags"),
      dataId: z.string().optional().describe("New data identifier"),
    },
    async ({ projectId, sectionId, ...fields }) => {
      try { return json(await client.updateSection(projectId, sectionId, fields)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "delete_section",
    "Delete a section and all its sub-sections (irreversible)",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
    },
    async ({ projectId, sectionId }) => {
      try { return json(await client.deleteSection(projectId, sectionId)); }
      catch (e) { return err(e); }
    },
  );

  // ── Addons ──────────────────────────────────────────────────────

  server.tool(
    "list_addons",
    "List all addons of a section (balance tables, currencies, inventory, etc.)",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
    },
    async ({ projectId, sectionId }) => {
      try { return json(await client.listAddons(projectId, sectionId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "create_addon",
    "Add an addon to a section. Types: xpBalance, progressionTable, economyLink, currency, globalVariable, inventory, production, dataSchema, attributeDefinitions, attributeProfile, attributeModifiers, fieldLibrary, exportSchema",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
      type: z.string().describe("Addon type (e.g. currency, inventory, progressionTable)"),
      name: z.string().describe("Display name for the addon"),
      group: z.string().optional().describe("Optional group name"),
      data: z.record(z.unknown()).optional().describe("Type-specific addon data"),
    },
    async ({ projectId, sectionId, ...params }) => {
      try { return json(await client.createAddon(projectId, sectionId, params)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_addon",
    "Update an addon's name, group, or data",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
      addonId: z.string().describe("Addon UUID"),
      name: z.string().optional().describe("New display name"),
      group: z.string().optional().describe("New group name"),
      data: z.record(z.unknown()).optional().describe("Updated addon data (merged with existing)"),
    },
    async ({ projectId, sectionId, addonId, ...fields }) => {
      try { return json(await client.updateAddon(projectId, sectionId, addonId, fields)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "delete_addon",
    "Remove an addon from a section",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
      addonId: z.string().describe("Addon UUID"),
    },
    async ({ projectId, sectionId, addonId }) => {
      try { return json(await client.deleteAddon(projectId, sectionId, addonId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "copy_addon",
    "Copy an addon from one section to another. Generates a new addon ID, deep-clones the data, and clears intra-section refs (productionRef, progression links, exportSchema addonIds). Cross-section refs are preserved. Returns the newly inserted addon.",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID where the source addon lives"),
      addonId: z.string().describe("Addon UUID to copy"),
      toSectionId: z.string().describe("Destination section UUID"),
    },
    async ({ projectId, sectionId, addonId, toSectionId }) => {
      try { return json(await client.copyAddon(projectId, sectionId, addonId, toSectionId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "move_addon",
    "Move an addon from one section to another, keeping its ID. Clears intra-section refs in the moved addon, and when the source section is left without another addon of the same type, rewrites reverse-refs across the project to point at the destination. Returns { addon, reverseRefsUpdated }.",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID where the source addon lives"),
      addonId: z.string().describe("Addon UUID to move"),
      toSectionId: z.string().describe("Destination section UUID (must differ from origin)"),
    },
    async ({ projectId, sectionId, addonId, toSectionId }) => {
      try { return json(await client.moveAddon(projectId, sectionId, addonId, toSectionId)); }
      catch (e) { return err(e); }
    },
  );

  // ── Search ──────────────────────────────────────────────────────

  server.tool(
    "search",
    "Search across all accessible projects and sections by keyword",
    {
      query: z.string().describe("Search term"),
      type: z.enum(["all", "projects", "sections"]).optional().describe("Filter results by type"),
      limit: z.number().optional().describe("Max results (1–50, default 20)"),
    },
    async ({ query, type, limit }) => {
      try { return json(await client.search(query, type, limit)); }
      catch (e) { return err(e); }
    },
  );
}
