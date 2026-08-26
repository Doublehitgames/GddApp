/**
 * MCP tool definitions for GDD Manager.
 *
 * Each tool maps to a REST API endpoint. The McpServer.tool() method
 * takes (name, description, zodSchema, callback).
 */
import { z } from "zod/v3";
import { GddApiError } from "./client.js";
import { batchReceipt, deleted, filterSections, json, projectCreated, projectIndex, projectReceipt, projectRow, sectionFull, searchProjection, sectionCreated, sectionReceipt, sectionRow, text, touched, } from "./project.js";
function err(e) {
    if (e instanceof GddApiError) {
        return { content: [{ type: "text", text: `Error (${e.code}): ${e.message}` }], isError: true };
    }
    return { content: [{ type: "text", text: String(e) }], isError: true };
}
/** Escape hatch on every write: opt back into the whole saved record. */
const returning = z
    .enum(["minimal", "full"])
    .optional()
    .describe('"full" echoes the whole saved record instead of a receipt (default "minimal")');
export function registerTools(server, client) {
    // ── Projects ────────────────────────────────────────────────────
    server.tool("list_projects", "List all GDD projects you have access to (owned and shared). Returns one index row per project (id, title, description, updatedAt); settings like aiInstructions and mindmap live in get_project.", {}, async () => {
        try {
            return json((await client.listProjects()).map(projectRow));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("get_project", "Get a project's settings plus a lightweight index of every section (id, title, parentId, order, dataId, and whether it has a description). This is the map of the document — use it to find the section you need, then get_section for its contents.", {
        projectId: z.string(),
    }, async ({ projectId }) => {
        try {
            return json(projectIndex(await client.getProject(projectId)));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("create_project", "Create a new GDD project", {
        title: z.string().describe("Project title"),
        description: z.string().optional().describe("Project description"),
        returning,
    }, async ({ returning: returnMode, ...params }) => {
        try {
            const created = await client.createProject(params);
            return json(returnMode === "full" ? created : projectCreated(created));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("update_project", "Update project metadata (title, description, cover image, or mindmap settings)", {
        projectId: z.string(),
        title: z.string().optional().describe("New title"),
        description: z.string().optional().describe("New description"),
        coverImageUrl: z.string().optional().describe("Cover image URL"),
        aiInstructions: z.string().optional().describe("AI instructions — conventions for how AI should structure data in this project"),
        returning,
    }, async ({ projectId, returning: returnMode, ...fields }) => {
        try {
            const saved = await client.updateProject(projectId, fields);
            return json(returnMode === "full" ? saved : projectReceipt(saved, touched(fields)));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("delete_project", "Delete a project and all its sections (owner only, irreversible)", { projectId: z.string() }, async ({ projectId }) => {
        try {
            await client.deleteProject(projectId);
            return json(deleted("project", projectId));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("list_project_images", "The project's Google Drive image library: each file's name plus the ready-to-write URL for a page icon (thumbImageUrl on create_section / update_section / batch_update_sections). File names are the handle — match them against a page's dataId or title. Files inside subfolders also carry `path`. Pass `match` to filter by name or subfolder instead of pulling the whole library; responses cap at 200 files and say `truncated` when they do.", {
        projectId: z.string(),
        match: z.string().optional().describe("Only files whose name contains this (case-insensitive)"),
    }, async ({ projectId, match }) => {
        try {
            return json(await client.listProjectImages(projectId, match));
        }
        catch (e) {
            return err(e);
        }
    });
    // ── Sections ────────────────────────────────────────────────────
    server.tool("list_sections", "List a project's sections as an index, sorted by order: id, title, parentId, order, dataId and hasDescription. The descriptions themselves are omitted — fetch a specific page with get_section. Narrow the result with subtreeOf / withoutDescription instead of listing everything and filtering yourself.", {
        projectId: z.string(),
        subtreeOf: z.string().optional().describe("Only this section and its descendants"),
        withoutDescription: z.boolean().optional().describe("Only sections with no description yet — useful for finding what still needs writing"),
    }, async ({ projectId, ...filters }) => {
        try {
            const sections = (await client.listSections(projectId));
            return json(filterSections(sections, filters).map(sectionRow));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("get_section", "Get a single section in full — description and contentBlocks. This is the right place to read a page's contents; the write tools deliberately do not echo it back.", {
        projectId: z.string(),
        sectionId: z.string(),
    }, async ({ projectId, sectionId }) => {
        try {
            return json(sectionFull(await client.getSection(projectId, sectionId)));
        }
        catch (e) {
            return err(e);
        }
    });
    // Reference material, not schema. It used to be inlined in both
    // create_section and update_section — 8.5 KB shipped to the model on every
    // request, whether or not the turn had anything to do with rich text.
    const CONTENT_BLOCKS_GUIDE = "Rich BlockNote JSON blocks for a section description. " +
        "`contentBlocks` takes priority over auto-generating from `content`. " +
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
    const CONTENT_BLOCKS_FIELD = z
        .array(z.record(z.unknown()))
        .optional()
        .describe("Rich BlockNote JSON blocks for the description. Call get_content_blocks_guide once for the block types, inline styles and a worked example. Always pair it with a plain-text `content` for search.");
    const THUMB_FIELD = z
        .string()
        .nullable()
        .optional()
        .describe("Page icon URL — get one from list_project_images. null clears it.");
    server.tool("get_content_blocks_guide", "Reference for building `contentBlocks`: every supported block type, inline content and styles, section cross-references, and a worked example. Call it once before writing rich descriptions with create_section or update_section.", {}, async () => text(CONTENT_BLOCKS_GUIDE));
    server.tool("create_section", "Create a new section in a project. Use `contentBlocks` for rich formatted descriptions (headings, callouts, tables, lists, etc.). Always pair it with a plain-text `content` for search. Returns a receipt carrying the new section's id — read the page back with get_section if you need its full contents.", {
        projectId: z.string(),
        title: z.string().describe("Section title"),
        content: z.string().optional().describe("Plain-text / markdown version of the description — used for search and as fallback when blocks are unavailable. If omitted and contentBlocks is provided, leave empty."),
        contentBlocks: CONTENT_BLOCKS_FIELD,
        parentId: z.string().optional().describe("Parent section for sub-sections"),
        order: z.number().optional().describe("Sort order (0-based)"),
        color: z.string().optional().describe("Hex color (#rrggbb)"),
        domainTags: z.array(z.string()).optional().describe("Game design domain tags (e.g. combat, economy)"),
        dataId: z.string().optional().describe("User-defined data identifier (e.g. FARM_ANIMAL_CHICKEN)"),
        thumbImageUrl: THUMB_FIELD,
        returning,
    }, async ({ projectId, returning: returnMode, ...params }) => {
        try {
            const created = await client.createSection(projectId, params);
            return json(returnMode === "full" ? sectionFull(created) : sectionCreated(created));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("update_section", "Update a section's fields (title, content, color, tags, etc.). Use `contentBlocks` to replace the description with rich formatted content. Returns a receipt — {ok, id, title, updated, updatedAt} — not the section. Call get_section when you actually need to read the result back.", {
        projectId: z.string(),
        sectionId: z.string(),
        title: z.string().optional().describe("New title"),
        content: z.string().optional().describe("Plain-text / markdown version of the description"),
        contentBlocks: CONTENT_BLOCKS_FIELD,
        parentId: z.string().optional().describe("New parent section"),
        order: z.number().optional().describe("New sort order"),
        color: z.string().optional().describe("New hex color"),
        domainTags: z.array(z.string()).optional().describe("New domain tags"),
        dataId: z.string().optional().describe("New data identifier"),
        thumbImageUrl: THUMB_FIELD,
        returning,
    }, async ({ projectId, sectionId, returning: returnMode, ...fields }) => {
        try {
            const saved = await client.updateSection(projectId, sectionId, fields);
            return json(returnMode === "full" ? sectionFull(saved) : sectionReceipt(saved, touched(fields)));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("batch_update_sections", "Update many sections in ONE request. Strongly preferred over calling update_section in a loop: a sweep of 96 pages is 96 round-trips that way, versus one here. Each entry needs a sectionId plus the fields to change; entries are independent, so a bad id fails on its own without discarding the rest. Returns {ok, updated, failed} plus a failures list when something did not land. Max 50 sections per call — split larger sweeps.", {
        projectId: z.string(),
        sections: z
            .array(z.object({
            sectionId: z.string(),
            title: z.string().optional(),
            content: z.string().optional().describe("Plain-text / markdown description"),
            contentBlocks: CONTENT_BLOCKS_FIELD,
            parentId: z.string().nullable().optional(),
            order: z.number().optional(),
            color: z.string().optional(),
            domainTags: z.array(z.string()).optional(),
            dataId: z.string().optional(),
            thumbImageUrl: THUMB_FIELD,
        }))
            .describe("One entry per section to update (max 50)"),
    }, async ({ projectId, sections }) => {
        try {
            return json(batchReceipt(await client.batchUpdateSections(projectId, sections)));
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("delete_section", "Delete a section and all its sub-sections (irreversible)", {
        projectId: z.string(),
        sectionId: z.string(),
    }, async ({ projectId, sectionId }) => {
        try {
            await client.deleteSection(projectId, sectionId);
            return json(deleted("section", sectionId));
        }
        catch (e) {
            return err(e);
        }
    });
    // ── Search ──────────────────────────────────────────────────────
    server.tool("search", "Search across all accessible projects and sections by keyword. Each section hit comes back as a pointer — id, projectId, title, dataId, and a 200-character excerpt — because the match itself is what you asked for, not the page. Follow up with get_section on the hits that matter.", {
        query: z.string().describe("Search term"),
        type: z.enum(["all", "projects", "sections"]).optional().describe("Filter results by type"),
        limit: z.number().optional().describe("Max results (1–50, default 20)"),
    }, async ({ query, type, limit }) => {
        try {
            return json(searchProjection(await client.search(query, type, limit)));
        }
        catch (e) {
            return err(e);
        }
    });
}
//# sourceMappingURL=tools.js.map