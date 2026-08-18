/**
 * MCP tool definitions for GDD Manager.
 *
 * Each tool maps to a REST API endpoint. The McpServer.tool() method
 * takes (name, description, zodSchema, callback).
 */

import { z } from "zod/v3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GddApiClient, GddApiError } from "./client.js";
import {
  addonCreated,
  addonMoved,
  addonReceipt,
  addonRow,
  deleted,
  json,
  projectCreated,
  projectFull,
  projectIndex,
  projectReceipt,
  projectRow,
  searchProjection,
  sectionCreated,
  sectionFull,
  sectionReceipt,
  sectionRow,
  touched,
} from "./project.js";

function err(e: unknown) {
  if (e instanceof GddApiError) {
    return { content: [{ type: "text" as const, text: `Error (${e.code}): ${e.message}` }], isError: true };
  }
  return { content: [{ type: "text" as const, text: String(e) }], isError: true };
}

/** Escape hatch on every write: opt back into the whole saved record. */
const returning = z
  .enum(["minimal", "full"])
  .optional()
  .describe('"full" echoes the whole saved record instead of a receipt (default "minimal")');

export function registerTools(server: McpServer, client: GddApiClient) {
  // ── Projects ────────────────────────────────────────────────────

  server.tool(
    "list_projects",
    "List all GDD projects you have access to (owned and shared). Returns one index row per project (id, title, description, updatedAt); settings like aiInstructions and mindmap live in get_project.",
    {},
    async () => {
      try { return json(((await client.listProjects()) as unknown[]).map(projectRow)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_project",
    "Get a project's settings plus a lightweight index of every section (id, title, parentId, order, dataId, whether it has a description, and which addon types it carries). This is the map of the document — use it to find the section you need, then get_section for its contents. Pass includeAddons=true only when you genuinely need every addon's data at once; on a large project that response can exceed a megabyte.",
    {
      projectId: z.string().describe("Project UUID"),
      includeAddons: z.boolean().optional().describe("Return every section's full addon data instead of the index (very large)"),
    },
    async ({ projectId, includeAddons }) => {
      try {
        const project = await client.getProject(projectId);
        return json(includeAddons ? projectFull(project) : projectIndex(project));
      }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "create_project",
    "Create a new GDD project",
    {
      title: z.string().describe("Project title"),
      description: z.string().optional().describe("Project description"),
      returning,
    },
    async ({ returning: returnMode, ...params }) => {
      try {
        const created = await client.createProject(params);
        return json(returnMode === "full" ? created : projectCreated(created));
      }
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
      returning,
    },
    async ({ projectId, returning: returnMode, ...fields }) => {
      try {
        const saved = await client.updateProject(projectId, fields);
        return json(returnMode === "full" ? saved : projectReceipt(saved, touched(fields)));
      }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "delete_project",
    "Delete a project and all its sections (owner only, irreversible)",
    { projectId: z.string().describe("Project UUID") },
    async ({ projectId }) => {
      try { await client.deleteProject(projectId); return json(deleted("project", projectId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "list_linked_spreadsheets",
    "List the Google Spreadsheets registered in a project's settings (Linked Spreadsheets). Returns each spreadsheet's id (the UUID to set as a section's linkedSpreadsheetId), name, url, spreadsheetId, sheets (tab names), and columnsBySheet (header row per tab). Use this to discover the UUID and the exact sheet/column names needed to build field bindings. Leaner than get_project when you only need spreadsheet metadata. " +
      "NOTES on columnsBySheet: (1) It is keyed by tab name and each value is the tab's row-1 headers as an array that is POSITION-ALIGNED to the column index — array index 0 = column A, 1 = B, 2 = C, etc. Leading empty columns appear as empty strings (e.g. ['','','Name'] means the 'Name' header is in column C). (2) A tab is OMITTED from columnsBySheet when its row 1 is entirely empty, so columnsBySheet may have FEWER keys than `sheets` — never assume every tab in `sheets` has a columnsBySheet entry. (3) columnsBySheet is a SNAPSHOT captured when the spreadsheet was registered/refreshed, not live — added columns won't appear until refreshed. (4) The field is optional: spreadsheets registered before this feature (or never refreshed) may lack columnsBySheet entirely. When columns are missing or stale, ask the user to open Project Settings → Linked Spreadsheets and click 'Atualizar abas' (refresh) on that spreadsheet.",
    { projectId: z.string().describe("Project UUID") },
    async ({ projectId }) => {
      try { return json(await client.listLinkedSpreadsheets(projectId)); }
      catch (e) { return err(e); }
    },
  );

  // ── Sections ────────────────────────────────────────────────────

  server.tool(
    "list_sections",
    "List a project's sections as an index, sorted by order: id, title, parentId, order, dataId, hasDescription, and the addon TYPES each one carries. Descriptions and addon data are omitted — fetch a specific page with get_section. Pass includeAddons=true for the full dump only when you really need it (on a 185-page project that is over 2 MB).",
    {
      projectId: z.string().describe("Project UUID"),
      includeAddons: z.boolean().optional().describe("Return each section's full fields and addon data instead of the index (very large)"),
    },
    async ({ projectId, includeAddons }) => {
      try {
        const sections = (await client.listSections(projectId)) as unknown[];
        return json(sections.map(includeAddons ? sectionFull : sectionRow));
      }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "get_section",
    "Get a single section in full — description, contentBlocks, and every addon's data. This is the right place to read a page's contents; the write tools deliberately do not echo it back.",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
    },
    async ({ projectId, sectionId }) => {
      try { return json(sectionFull(await client.getSection(projectId, sectionId))); }
      catch (e) { return err(e); }
    },
  );

  const CONTENT_BLOCKS_DESC =
    "Rich BlockNote JSON blocks for the section description. " +
    "Takes priority over auto-generating from `content`. " +
    "Always also provide `content` as a plain-text/markdown mirror used for search and fallback. " +
    "\n\nEach block: { type, props?, content, children }. " +
    "\n\nSUPPORTED BLOCK TYPES:" +
    "\n• paragraph — { type:'paragraph', content:[...inline], children:[] }" +
    "\n• heading — { type:'heading', props:{level:1|2|3}, content:[...inline], children:[] }" +
    "\n• bulletListItem — { type:'bulletListItem', content:[...inline], children:[] }" +
    "\n• numberedListItem — { type:'numberedListItem', content:[...inline], children:[] }" +
    "\n• checkListItem — { type:'checkListItem', props:{checked:false}, content:[...inline], children:[] }" +
    "\n• quote — { type:'quote', content:[...inline], children:[] }" +
    "\n• codeBlock — { type:'codeBlock', props:{language:'javascript'}, content:[{type:'text',text:'...'}], children:[] }" +
    "\n• callout — { type:'callout', props:{emoji:'💡',variant:'info'|'warning'|'error'|'success'}, content:[...inline], children:[] }" +
    "\n• image — { type:'image', props:{url:'https://...',caption:'',width:512}, content:[], children:[] }" +
    "\n• table — { type:'table', content:{type:'tableContent',rows:[{cells:[[...inline],[...inline]]}]}, children:[] }" +
    "\n\nINLINE CONTENT (used in `content` arrays of most blocks):" +
    "\n• Text node: { type:'text', text:'Hello', styles:{bold?:true, italic?:true, underline?:true, strikethrough?:true, code?:true, textColor?:'blue'|'red'|'green'|'yellow'|'orange'|'purple'|'pink'|'gray'|'brown', backgroundColor?:same palette} }" +
    "\n• Link: { type:'link', href:'https://...', content:[text nodes] }" +
    "\n• Section cross-reference: write $[Section Name] as plain text inside a text node — it renders as a clickable link to that section." +
    "\n\nEXAMPLE — a section with heading, paragraph, callout, and table:" +
    '\n[{"type":"heading","props":{"level":2},"content":[{"type":"text","text":"Overview","styles":{}}],"children":[]},{"type":"paragraph","content":[{"type":"text","text":"This section covers "},{"type":"text","text":"core mechanics","styles":{"bold":true}},{"type":"text","text":" of the game.","styles":{}}],"children":[]},{"type":"callout","props":{"emoji":"⚠️","variant":"warning"},"content":[{"type":"text","text":"Balance values are subject to change.","styles":{}}],"children":[]},{"type":"table","content":{"type":"tableContent","rows":[{"cells":[[{"type":"text","text":"Attribute","styles":{"bold":true}}],[{"type":"text","text":"Value","styles":{"bold":true}}]]},{"cells":[[{"type":"text","text":"Speed"}],[{"type":"text","text":"5.0"}]]}]},"children":[]}]';

  server.tool(
    "create_section",
    "Create a new section in a project. Use `contentBlocks` for rich formatted descriptions (headings, callouts, tables, lists, etc.). Always pair it with a plain-text `content` for search. Returns a receipt carrying the new section's id — read the page back with get_section if you need its full contents.",
    {
      projectId: z.string().describe("Project UUID"),
      title: z.string().describe("Section title"),
      content: z.string().optional().describe("Plain-text / markdown version of the description — used for search and as fallback when blocks are unavailable. If omitted and contentBlocks is provided, leave empty."),
      contentBlocks: z.array(z.record(z.unknown())).optional().describe(CONTENT_BLOCKS_DESC),
      parentId: z.string().optional().describe("Parent section UUID for sub-sections"),
      order: z.number().optional().describe("Sort order (0-based)"),
      color: z.string().optional().describe("Hex color (#rrggbb)"),
      domainTags: z.array(z.string()).optional().describe("Game design domain tags (e.g. combat, economy)"),
      dataId: z.string().optional().describe("User-defined data identifier (e.g. FARM_ANIMAL_CHICKEN)"),
      returning,
    },
    async ({ projectId, returning: returnMode, ...params }) => {
      try {
        const created = await client.createSection(projectId, params);
        return json(returnMode === "full" ? sectionFull(created) : sectionCreated(created));
      }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_section",
    "Update a section's fields (title, content, color, tags, etc.). Use `contentBlocks` to replace the description with rich formatted content. Returns a receipt — {ok, id, title, updated, updatedAt} — not the section: echoing a page that carries a 100-level progression table costs ~78 KB. Call get_section when you actually need to read the result back.",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
      title: z.string().optional().describe("New title"),
      content: z.string().optional().describe("Plain-text / markdown version of the description"),
      contentBlocks: z.array(z.record(z.unknown())).optional().describe(CONTENT_BLOCKS_DESC),
      parentId: z.string().optional().describe("New parent section UUID"),
      order: z.number().optional().describe("New sort order"),
      color: z.string().optional().describe("New hex color"),
      domainTags: z.array(z.string()).optional().describe("New domain tags"),
      dataId: z.string().optional().describe("New data identifier"),
      linkedSpreadsheetId: z.string().nullable().optional().describe("UUID of the linked Google Spreadsheet (from project.linkedSpreadsheets)"),
      returning,
    },
    async ({ projectId, sectionId, returning: returnMode, ...fields }) => {
      try {
        const saved = await client.updateSection(projectId, sectionId, fields);
        return json(returnMode === "full" ? sectionFull(saved) : sectionReceipt(saved, touched(fields)));
      }
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
      try { await client.deleteSection(projectId, sectionId); return json(deleted("section", sectionId)); }
      catch (e) { return err(e); }
    },
  );

  // ── Addons ──────────────────────────────────────────────────────

  server.tool(
    "list_addons",
    "List a section's addons by identity only — id, type, name, group. Their data is omitted; get_section returns the whole page including every addon's values. Pass includeData=true to inline the data anyway (a progression table alone is ~54 KB).",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
      includeData: z.boolean().optional().describe("Inline each addon's full data instead of just its identity"),
    },
    async ({ projectId, sectionId, includeData }) => {
      try {
        const addons = (await client.listAddons(projectId, sectionId)) as unknown[];
        return json(includeData ? addons : addons.map(addonRow));
      }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "create_addon",
    "Add an addon to a section. Types: xpBalance, progressionTable, economyLink, currency, globalVariable, inventory, production, craftTable, crop, dataSchema, attributeDefinitions, attributeProfile, attributeModifiers, fieldLibrary, exportSchema, richDoc",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
      type: z.string().describe("Addon type (e.g. currency, inventory, progressionTable)"),
      name: z.string().describe("Display name for the addon"),
      group: z.string().optional().describe("Optional group name"),
      data: z.record(z.unknown()).optional().describe("Type-specific addon data"),
      returning,
    },
    async ({ projectId, sectionId, returning: returnMode, ...params }) => {
      try {
        const created = await client.createAddon(projectId, sectionId, params);
        return json(returnMode === "full" ? created : addonCreated(created, sectionId));
      }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_addon",
    "Update an addon's name, group, or data. Returns a receipt — {ok, id, type, name, sectionId, updated} — not the addon: a progression table would echo back ~54 KB. Read it back with get_section when you need the saved values.",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID"),
      addonId: z.string().describe("Addon UUID"),
      name: z.string().optional().describe("New display name"),
      group: z.string().optional().describe("New group name"),
      data: z.record(z.unknown()).optional().describe("Updated addon data (merged with existing)"),
      returning,
    },
    async ({ projectId, sectionId, addonId, returning: returnMode, ...fields }) => {
      try {
        const saved = await client.updateAddon(projectId, sectionId, addonId, fields);
        const changed = Object.keys((fields.data ?? {}) as Record<string, unknown>);
        return json(returnMode === "full" ? saved : addonReceipt(saved, sectionId, [...touched({ name: fields.name, group: fields.group }), ...changed]));
      }
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
      try { await client.deleteAddon(projectId, sectionId, addonId); return json(deleted("addon", addonId)); }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "copy_addon",
    "Copy an addon from one section to another. Generates a new addon ID, deep-clones the data, and re-links intra-section refs (production/progression/economyLink bindings, exportSchema addonIds) to the destination's equivalent addons so value bindings keep working when the target page already has the needed addons (cross-section refs are preserved). Singleton addon types (one-per-page: dataSchema, production, economyLink, currency, progressionTable, etc.) already present in the destination cause a 409 unless overwrite=true, which replaces the existing addon in place (keeping its id/group/name). TIP: to copy a RemoteConfig (exportSchema) into a page that lacks the addons it references (e.g. its DataSchema or ProgressionTable), copy those dependency addons FIRST, then copy the RemoteConfig — its bindings will re-link to them in the destination. Returns a receipt identifying the inserted (or overwritten) addon; read the destination page with get_section to inspect it.",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID where the source addon lives"),
      addonId: z.string().describe("Addon UUID to copy"),
      toSectionId: z.string().describe("Destination section UUID"),
      overwrite: z.boolean().optional().describe("If the destination already has a singleton addon of the same type, replace its values in place instead of failing with 409."),
      returning,
    },
    async ({ projectId, sectionId, addonId, toSectionId, overwrite, returning: returnMode }) => {
      try {
        const result = await client.copyAddon(projectId, sectionId, addonId, toSectionId, overwrite);
        return json(returnMode === "full" ? result : addonMoved(result, toSectionId));
      }
      catch (e) { return err(e); }
    },
  );

  server.tool(
    "move_addon",
    "Move an addon from one section to another, keeping its ID. Re-links intra-section refs in the moved addon to the destination's equivalent addons, and when the source section is left without another addon of the same type, rewrites reverse-refs across the project to point at the destination. Singleton addon types already present in the destination cause a 409 unless overwrite=true, which replaces the existing addon in place (keeping its id/group/name). Returns a receipt: { ok, id, type, name, toSectionId, reverseRefsUpdated }.",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().describe("Section UUID where the source addon lives"),
      addonId: z.string().describe("Addon UUID to move"),
      toSectionId: z.string().describe("Destination section UUID (must differ from origin)"),
      overwrite: z.boolean().optional().describe("If the destination already has a singleton addon of the same type, replace it in place instead of failing with 409."),
      returning,
    },
    async ({ projectId, sectionId, addonId, toSectionId, overwrite, returning: returnMode }) => {
      try {
        const result = await client.moveAddon(projectId, sectionId, addonId, toSectionId, overwrite);
        return json(returnMode === "full" ? result : addonMoved(result, toSectionId));
      }
      catch (e) { return err(e); }
    },
  );

  // ── Search ──────────────────────────────────────────────────────

  server.tool(
    "search",
    "Search across all accessible projects and sections by keyword. Each section hit comes back as a pointer — id, projectId, title, dataId, and a 200-character excerpt — because the match itself is what you asked for, not the page. Follow up with get_section on the hits that matter.",
    {
      query: z.string().describe("Search term"),
      type: z.enum(["all", "projects", "sections"]).optional().describe("Filter results by type"),
      limit: z.number().optional().describe("Max results (1–50, default 20)"),
    },
    async ({ query, type, limit }) => {
      try { return json(searchProjection(await client.search(query, type, limit))); }
      catch (e) { return err(e); }
    },
  );

  // ── Remote Config ───────────────────────────────────────────────

  server.tool(
    "get_remote_config",
    "Resolve Remote Config (exportSchema) addons and return the RESOLVED economy JSON (actual values, not the blueprint). Scope: no sectionId/addonId → every config in the project; sectionId → every config in that section's subtree; addonId → a single config. Use this to get all balancing data in one call.",
    {
      projectId: z.string().describe("Project UUID"),
      sectionId: z.string().optional().describe("Limit to this section's subtree"),
      addonId: z.string().optional().describe("Resolve a single exportSchema addon by its id"),
    },
    async ({ projectId, sectionId, addonId }) => {
      try { return json(await client.getRemoteConfig(projectId, { sectionId, addonId })); }
      catch (e) { return err(e); }
    },
  );
}
