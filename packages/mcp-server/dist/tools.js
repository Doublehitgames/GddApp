/**
 * MCP tool definitions for GDD Manager.
 *
 * Each tool maps to a REST API endpoint. The McpServer.tool() method
 * takes (name, description, zodSchema, callback).
 */
import { z } from "zod/v3";
import { GddApiError } from "./client.js";
function text(content) {
    return { content: [{ type: "text", text: content }] };
}
function json(data) {
    return text(JSON.stringify(data, null, 2));
}
function err(e) {
    if (e instanceof GddApiError) {
        return { content: [{ type: "text", text: `Error (${e.code}): ${e.message}` }], isError: true };
    }
    return { content: [{ type: "text", text: String(e) }], isError: true };
}
export function registerTools(server, client) {
    // ── Projects ────────────────────────────────────────────────────
    server.tool("list_projects", "List all GDD projects you have access to (owned and shared)", {}, async () => {
        try {
            return json(await client.listProjects());
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("get_project", "Get a project with all its sections and addons", { projectId: z.string().describe("Project UUID") }, async ({ projectId }) => {
        try {
            return json(await client.getProject(projectId));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("create_project", "Create a new GDD project", {
        title: z.string().describe("Project title"),
        description: z.string().optional().describe("Project description"),
    }, async (params) => {
        try {
            return json(await client.createProject(params));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("update_project", "Update project metadata (title, description, cover image, or mindmap settings)", {
        projectId: z.string().describe("Project UUID"),
        title: z.string().optional().describe("New title"),
        description: z.string().optional().describe("New description"),
        coverImageUrl: z.string().optional().describe("Cover image URL"),
        aiInstructions: z.string().optional().describe("AI instructions — conventions for how AI should structure data in this project"),
    }, async ({ projectId, ...fields }) => {
        try {
            return json(await client.updateProject(projectId, fields));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("delete_project", "Delete a project and all its sections (owner only, irreversible)", { projectId: z.string().describe("Project UUID") }, async ({ projectId }) => {
        try {
            return json(await client.deleteProject(projectId));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("list_linked_spreadsheets", "List the Google Spreadsheets registered in a project's settings (Linked Spreadsheets). Returns each spreadsheet's id (the UUID to set as a section's linkedSpreadsheetId), name, url, spreadsheetId, sheets (tab names), and columnsBySheet (header row per tab). Use this to discover the UUID and the exact sheet/column names needed to build field bindings. Leaner than get_project when you only need spreadsheet metadata. " +
        "NOTES on columnsBySheet: (1) It is keyed by tab name and each value is the tab's row-1 headers as an array that is POSITION-ALIGNED to the column index — array index 0 = column A, 1 = B, 2 = C, etc. Leading empty columns appear as empty strings (e.g. ['','','Name'] means the 'Name' header is in column C). (2) A tab is OMITTED from columnsBySheet when its row 1 is entirely empty, so columnsBySheet may have FEWER keys than `sheets` — never assume every tab in `sheets` has a columnsBySheet entry. (3) columnsBySheet is a SNAPSHOT captured when the spreadsheet was registered/refreshed, not live — added columns won't appear until refreshed. (4) The field is optional: spreadsheets registered before this feature (or never refreshed) may lack columnsBySheet entirely. When columns are missing or stale, ask the user to open Project Settings → Linked Spreadsheets and click 'Atualizar abas' (refresh) on that spreadsheet.", { projectId: z.string().describe("Project UUID") }, async ({ projectId }) => {
        try {
            return json(await client.listLinkedSpreadsheets(projectId));
        }
        catch (e) {
            return err(e);
        }
    });
    // ── Sections ────────────────────────────────────────────────────
    server.tool("list_sections", "List all sections of a project, sorted by order", { projectId: z.string().describe("Project UUID") }, async ({ projectId }) => {
        try {
            return json(await client.listSections(projectId));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("get_section", "Get a single section with its addons", {
        projectId: z.string().describe("Project UUID"),
        sectionId: z.string().describe("Section UUID"),
    }, async ({ projectId, sectionId }) => {
        try {
            return json(await client.getSection(projectId, sectionId));
        }
        catch (e) {
            return err(e);
        }
    });
    const CONTENT_BLOCKS_DESC = "Rich BlockNote JSON blocks for the section description. " +
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
    server.tool("create_section", "Create a new section in a project. Use `contentBlocks` for rich formatted descriptions (headings, callouts, tables, lists, etc.). Always pair it with a plain-text `content` for search.", {
        projectId: z.string().describe("Project UUID"),
        title: z.string().describe("Section title"),
        content: z.string().optional().describe("Plain-text / markdown version of the description — used for search and as fallback when blocks are unavailable. If omitted and contentBlocks is provided, leave empty."),
        contentBlocks: z.array(z.record(z.unknown())).optional().describe(CONTENT_BLOCKS_DESC),
        parentId: z.string().optional().describe("Parent section UUID for sub-sections"),
        order: z.number().optional().describe("Sort order (0-based)"),
        color: z.string().optional().describe("Hex color (#rrggbb)"),
        domainTags: z.array(z.string()).optional().describe("Game design domain tags (e.g. combat, economy)"),
        dataId: z.string().optional().describe("User-defined data identifier (e.g. FARM_ANIMAL_CHICKEN)"),
    }, async ({ projectId, ...params }) => {
        try {
            return json(await client.createSection(projectId, params));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("update_section", "Update a section's fields (title, content, color, tags, etc.). Use `contentBlocks` to replace the description with rich formatted content.", {
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
    }, async ({ projectId, sectionId, ...fields }) => {
        try {
            return json(await client.updateSection(projectId, sectionId, fields));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("delete_section", "Delete a section and all its sub-sections (irreversible)", {
        projectId: z.string().describe("Project UUID"),
        sectionId: z.string().describe("Section UUID"),
    }, async ({ projectId, sectionId }) => {
        try {
            return json(await client.deleteSection(projectId, sectionId));
        }
        catch (e) {
            return err(e);
        }
    });
    // ── Addons ──────────────────────────────────────────────────────
    server.tool("list_addons", "List all addons of a section (balance tables, currencies, inventory, etc.)", {
        projectId: z.string().describe("Project UUID"),
        sectionId: z.string().describe("Section UUID"),
    }, async ({ projectId, sectionId }) => {
        try {
            return json(await client.listAddons(projectId, sectionId));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("create_addon", "Add an addon to a section. Types: xpBalance, progressionTable, economyLink, currency, globalVariable, inventory, production, craftTable, crop, dataSchema, attributeDefinitions, attributeProfile, attributeModifiers, fieldLibrary, exportSchema, richDoc", {
        projectId: z.string().describe("Project UUID"),
        sectionId: z.string().describe("Section UUID"),
        type: z.string().describe("Addon type (e.g. currency, inventory, progressionTable)"),
        name: z.string().describe("Display name for the addon"),
        group: z.string().optional().describe("Optional group name"),
        data: z.record(z.unknown()).optional().describe("Type-specific addon data"),
    }, async ({ projectId, sectionId, ...params }) => {
        try {
            return json(await client.createAddon(projectId, sectionId, params));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("update_addon", "Update an addon's name, group, or data", {
        projectId: z.string().describe("Project UUID"),
        sectionId: z.string().describe("Section UUID"),
        addonId: z.string().describe("Addon UUID"),
        name: z.string().optional().describe("New display name"),
        group: z.string().optional().describe("New group name"),
        data: z.record(z.unknown()).optional().describe("Updated addon data (merged with existing)"),
    }, async ({ projectId, sectionId, addonId, ...fields }) => {
        try {
            return json(await client.updateAddon(projectId, sectionId, addonId, fields));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("delete_addon", "Remove an addon from a section", {
        projectId: z.string().describe("Project UUID"),
        sectionId: z.string().describe("Section UUID"),
        addonId: z.string().describe("Addon UUID"),
    }, async ({ projectId, sectionId, addonId }) => {
        try {
            return json(await client.deleteAddon(projectId, sectionId, addonId));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("copy_addon", "Copy an addon from one section to another. Generates a new addon ID, deep-clones the data, and re-links intra-section refs (production/progression/economyLink bindings, exportSchema addonIds) to the destination's equivalent addons so value bindings keep working when the target page already has the needed addons (cross-section refs are preserved). Singleton addon types (one-per-page: dataSchema, production, economyLink, currency, progressionTable, etc.) already present in the destination cause a 409 unless overwrite=true, which replaces the existing addon in place (keeping its id/group/name). TIP: to copy a RemoteConfig (exportSchema) into a page that lacks the addons it references (e.g. its DataSchema or ProgressionTable), copy those dependency addons FIRST, then copy the RemoteConfig — its bindings will re-link to them in the destination. Returns the inserted (or overwritten) addon.", {
        projectId: z.string().describe("Project UUID"),
        sectionId: z.string().describe("Section UUID where the source addon lives"),
        addonId: z.string().describe("Addon UUID to copy"),
        toSectionId: z.string().describe("Destination section UUID"),
        overwrite: z.boolean().optional().describe("If the destination already has a singleton addon of the same type, replace its values in place instead of failing with 409."),
    }, async ({ projectId, sectionId, addonId, toSectionId, overwrite }) => {
        try {
            return json(await client.copyAddon(projectId, sectionId, addonId, toSectionId, overwrite));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("move_addon", "Move an addon from one section to another, keeping its ID. Re-links intra-section refs in the moved addon to the destination's equivalent addons, and when the source section is left without another addon of the same type, rewrites reverse-refs across the project to point at the destination. Singleton addon types already present in the destination cause a 409 unless overwrite=true, which replaces the existing addon in place (keeping its id/group/name). Returns { addon, reverseRefsUpdated }.", {
        projectId: z.string().describe("Project UUID"),
        sectionId: z.string().describe("Section UUID where the source addon lives"),
        addonId: z.string().describe("Addon UUID to move"),
        toSectionId: z.string().describe("Destination section UUID (must differ from origin)"),
        overwrite: z.boolean().optional().describe("If the destination already has a singleton addon of the same type, replace it in place instead of failing with 409."),
    }, async ({ projectId, sectionId, addonId, toSectionId, overwrite }) => {
        try {
            return json(await client.moveAddon(projectId, sectionId, addonId, toSectionId, overwrite));
        }
        catch (e) {
            return err(e);
        }
    });
    // ── Search ──────────────────────────────────────────────────────
    server.tool("search", "Search across all accessible projects and sections by keyword", {
        query: z.string().describe("Search term"),
        type: z.enum(["all", "projects", "sections"]).optional().describe("Filter results by type"),
        limit: z.number().optional().describe("Max results (1–50, default 20)"),
    }, async ({ query, type, limit }) => {
        try {
            return json(await client.search(query, type, limit));
        }
        catch (e) {
            return err(e);
        }
    });
}
//# sourceMappingURL=tools.js.map