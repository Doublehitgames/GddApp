/**
 * Creates an McpServer with all GDD Manager tools registered.
 * Used by the remote HTTP endpoint (app/api/mcp/route.ts).
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type ApiFetcher, McpApiError } from "./api";
import {
  addonCreated,
  addonMoved,
  addonReceipt,
  addonRow,
  batchReceipt,
  deleted,
  filterSections,
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
  text,
  touched,
} from "./project";

/** Escape hatch on every write: opt back into the whole saved record. */
const returning = z
  .enum(["minimal", "full"])
  .optional()
  .describe('"full" echoes the whole saved record instead of a receipt (default "minimal")');

/**
 * Reference material, not schema — served by get_content_blocks_guide instead of
 * riding along in every tool definition. Verbatim twin of the string in
 * packages/mcp-server/src/tools.ts.
 */
const CONTENT_BLOCKS_GUIDE =
  "Rich BlockNote JSON blocks for a section description. " +
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
  .array(z.record(z.string(), z.unknown()))
  .optional()
  .describe("Rich BlockNote JSON blocks for the description. Call get_content_blocks_guide once for the block types, inline styles and a worked example. Always pair it with a plain-text `content` for search.");

/** Section icon. Same field the web app sets from the Drive picker. */
const THUMB_FIELD = z
  .string()
  .nullable()
  .optional()
  .describe("Page icon URL — get one from list_project_images. null clears it.");

function err(e: unknown) {
  if (e instanceof McpApiError) {
    return { content: [{ type: "text" as const, text: `Error (${e.code}): ${e.message}` }], isError: true };
  }
  return { content: [{ type: "text" as const, text: String(e) }], isError: true };
}

/** A caller mistake, not a transport failure — say what is missing and stop. */
function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

// ── Generic tools ─────────────────────────────────────────────────

export function registerGenericTools(server: McpServer, api: ApiFetcher) {
  server.tool("list_projects", "List all GDD projects you have access to. Returns one index row per project (id, title, description, updatedAt); settings like aiInstructions live in get_project.", {},
    async () => { try { return json(((await api.listProjects()) as unknown[]).map(projectRow)); } catch (e) { return err(e); } });

  server.tool("get_project", "Get a project's settings plus a lightweight index of every section (id, title, parentId, order, dataId, whether it has a description, and which addon types it carries). This is the map of the document — use it to find the section you need, then get_section for its contents. Pass includeAddons=true only when you genuinely need every addon's data at once; on a large project that response can exceed a megabyte.",
    { projectId: z.string().describe("Project UUID"), includeAddons: z.boolean().optional().describe("Return every section's full addon data instead of the index (very large)") },
    async ({ projectId, includeAddons }) => {
      try {
        // Ask the API to leave the addon payload behind unless it is wanted.
        const project = await api.getProject(projectId, includeAddons ? undefined : "types");
        return json(includeAddons ? projectFull(project) : projectIndex(project));
      } catch (e) { return err(e); }
    });

  server.tool("create_project", "Create a new GDD project. Returns a receipt with the new project's id.",
    { title: z.string().describe("Project title"), description: z.string().optional().describe("Project description"), returning },
    async ({ returning: returnMode, ...params }) => {
      try {
        const created = await api.createProject(params);
        return json(returnMode === "full" ? created : projectCreated(created));
      } catch (e) { return err(e); }
    });

  server.tool("update_project", "Update project metadata. Returns a receipt naming the fields that were written.",
    { projectId: z.string().describe("Project UUID"), title: z.string().optional(), description: z.string().optional(), coverImageUrl: z.string().optional(), aiInstructions: z.string().optional().describe("AI instructions for this project"), returning },
    async ({ projectId, returning: returnMode, ...f }) => {
      try {
        const saved = await api.updateProject(projectId, f);
        return json(returnMode === "full" ? saved : projectReceipt(saved, touched(f)));
      } catch (e) { return err(e); }
    });

  server.tool("delete_project", "Delete a project (owner only, irreversible)",
    { projectId: z.string().describe("Project UUID") },
    async ({ projectId }) => { try { await api.deleteProject(projectId); return json(deleted("project", projectId)); } catch (e) { return err(e); } });

  server.tool("list_sections", "List a project's sections as an index, sorted by order: id, title, parentId, order, dataId, hasDescription, and the addon TYPES each one carries. Descriptions and addon data are omitted — fetch a specific page with get_section. Narrow the result with subtreeOf / withoutDescription / hasAddonType instead of listing everything and filtering yourself. Pass includeAddons=true for the full dump only when you really need it (on a 185-page project that is over 2 MB).",
    {
      projectId: z.string(),
      subtreeOf: z.string().optional().describe("Only this section and its descendants"),
      withoutDescription: z.boolean().optional().describe("Only sections with no description yet — useful for finding what still needs writing"),
      hasAddonType: z.string().optional().describe("Only sections carrying this addon type (e.g. progressionTable)"),
      includeAddons: z.boolean().optional().describe("Return each section's full fields and addon data instead of the index (very large)"),
    },
    async ({ projectId, includeAddons, ...filters }) => {
      try {
        const sections = (await api.listSections(projectId, includeAddons ? undefined : "types")) as unknown[];
        return json(filterSections(sections, filters).map(includeAddons ? sectionFull : sectionRow));
      } catch (e) { return err(e); }
    });

  server.tool("get_section", "Get a single section in full — description, contentBlocks, and every addon's data. This is the right place to read a page's contents; the write tools deliberately do not echo it back.",
    { projectId: z.string().describe("Project UUID"), sectionId: z.string().describe("Section UUID") },
    async ({ projectId, sectionId }) => { try { return json(sectionFull(await api.getSection(projectId, sectionId))); } catch (e) { return err(e); } });

  server.tool("get_content_blocks_guide",
    "Reference for building `contentBlocks`: every supported block type, inline content and styles, section cross-references, and a worked example. Call it once before writing rich descriptions with create_section or update_section.",
    {},
    async () => text(CONTENT_BLOCKS_GUIDE));

  server.tool("create_section", "Create a new section in a project. Use `contentBlocks` for rich formatted descriptions (headings, callouts, tables, images). Always pair it with a plain-text `content` for search. Returns a receipt carrying the new section's id — read the page back with get_section if you need its full contents.",
    { projectId: z.string(), title: z.string(), content: z.string().optional(), contentBlocks: CONTENT_BLOCKS_FIELD, parentId: z.string().optional(), order: z.number().optional(), color: z.string().optional(), domainTags: z.array(z.string()).optional(), dataId: z.string().optional(), thumbImageUrl: THUMB_FIELD, returning },
    async ({ projectId, returning: returnMode, ...p }) => {
      try {
        const created = await api.createSection(projectId, p);
        return json(returnMode === "full" ? sectionFull(created) : sectionCreated(created));
      } catch (e) { return err(e); }
    });

  server.tool("update_section", "Update a section's fields. Use `contentBlocks` to replace the description with rich formatted content. Returns a receipt — {ok, id, title, updated, updatedAt} — not the section: echoing a page that carries a 100-level progression table costs ~78 KB. Call get_section when you actually need to read the result back.",
    { projectId: z.string(), sectionId: z.string(), title: z.string().optional(), content: z.string().optional(), contentBlocks: CONTENT_BLOCKS_FIELD, parentId: z.string().optional(), order: z.number().optional(), color: z.string().optional(), domainTags: z.array(z.string()).optional(), dataId: z.string().optional(), thumbImageUrl: THUMB_FIELD, returning },
    async ({ projectId, sectionId, returning: returnMode, ...f }) => {
      try {
        const full = returnMode === "full";
        const saved = await api.updateSection(projectId, sectionId, f, full ? undefined : "none");
        return json(full ? sectionFull(saved) : sectionReceipt(saved, touched(f)));
      } catch (e) { return err(e); }
    });

  server.tool("batch_update_sections",
    "Update many sections in ONE request. Strongly preferred over calling update_section in a loop: a sweep of 96 pages is 96 round-trips that way, versus one here. Each entry needs a sectionId plus the fields to change; entries are independent, so a bad id fails on its own without discarding the rest. Returns {ok, updated, failed} plus a failures list when something did not land. Max 50 sections per call — split larger sweeps.",
    {
      projectId: z.string(),
      sections: z.array(z.object({
        sectionId: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        contentBlocks: CONTENT_BLOCKS_FIELD,
        parentId: z.string().nullable().optional(),
        order: z.number().optional(),
        color: z.string().optional(),
        domainTags: z.array(z.string()).optional(),
        dataId: z.string().optional(),
        thumbImageUrl: THUMB_FIELD,
      })).describe("One entry per section to update (max 50)"),
    },
    async ({ projectId, sections }) => {
      try { return json(batchReceipt(await api.batchUpdateSections(projectId, sections))); }
      catch (e) { return err(e); }
    });

  server.tool("delete_section", "Delete a section and all sub-sections (irreversible)",
    { projectId: z.string(), sectionId: z.string() },
    async ({ projectId, sectionId }) => { try { await api.deleteSection(projectId, sectionId); return json(deleted("section", sectionId)); } catch (e) { return err(e); } });

  server.tool("list_addons", "List a section's addons by identity only — id, type, name, group. Their data is omitted; get_section returns the whole page including every addon's values. Pass includeData=true to inline the data anyway (a progression table alone is ~54 KB).",
    { projectId: z.string(), sectionId: z.string(), includeData: z.boolean().optional().describe("Inline each addon's full data instead of just its identity") },
    async ({ projectId, sectionId, includeData }) => {
      try {
        const addons = (await api.listAddons(projectId, sectionId)) as unknown[];
        return json(includeData ? addons : addons.map(addonRow));
      } catch (e) { return err(e); }
    });

  server.tool("create_addon", "Add an addon to a section. Returns a receipt with the new addon's id; read the page back with get_section to see the stored values.",
    { projectId: z.string(), sectionId: z.string(), type: z.string().describe("Addon type"), name: z.string(), group: z.string().optional(), data: z.record(z.string(), z.unknown()).optional(), returning },
    async ({ projectId, sectionId, returning: returnMode, ...p }) => {
      try {
        const created = await api.createAddon(projectId, sectionId, p);
        return json(returnMode === "full" ? created : addonCreated(created, sectionId));
      } catch (e) { return err(e); }
    });

  server.tool("update_addon", "Update an addon. Returns a receipt — {ok, id, type, name, sectionId, updated} — not the addon: a progression table would echo back ~54 KB. Read it back with get_section when you need the saved values.",
    { projectId: z.string(), sectionId: z.string(), addonId: z.string(), name: z.string().optional(), group: z.string().optional(), data: z.record(z.string(), z.unknown()).optional(), returning },
    async ({ projectId, sectionId, addonId, returning: returnMode, ...f }) => {
      try {
        const saved = await api.updateAddon(projectId, sectionId, addonId, f);
        const changed = Object.keys((f.data ?? {}) as Record<string, unknown>);
        return json(returnMode === "full" ? saved : addonReceipt(saved, sectionId, [...touched({ name: f.name, group: f.group }), ...changed]));
      } catch (e) { return err(e); }
    });

  server.tool("delete_addon", "Remove an addon from a section",
    { projectId: z.string(), sectionId: z.string(), addonId: z.string() },
    async ({ projectId, sectionId, addonId }) => { try { await api.deleteAddon(projectId, sectionId, addonId); return json(deleted("addon", addonId)); } catch (e) { return err(e); } });

  server.tool("copy_addon", "Copy an addon to another section. Generates a new addon ID, deep-clones the data, and re-links intra-section refs to the destination's equivalent addons. Singleton types already present in the destination cause a 409 unless overwrite=true (replaces in place). Returns a receipt identifying the inserted addon; read the destination page with get_section to inspect it.",
    { projectId: z.string(), sectionId: z.string().describe("Source section UUID"), addonId: z.string().describe("Addon UUID to copy"), toSectionId: z.string().describe("Destination section UUID"), overwrite: z.boolean().optional().describe("Replace an existing singleton addon in place instead of failing with 409"), returning },
    async ({ projectId, sectionId, addonId, toSectionId, overwrite, returning: returnMode }) => {
      try {
        const result = await api.copyAddon(projectId, sectionId, addonId, toSectionId, overwrite);
        return json(returnMode === "full" ? result : addonMoved(result, toSectionId));
      } catch (e) { return err(e); }
    });

  server.tool("move_addon", "Move an addon to another section, keeping its ID. Re-links intra-section refs to the destination and rewrites reverse-refs across the project when the source is left without another addon of the same type. Singleton types already present in the destination cause a 409 unless overwrite=true. Returns a receipt: { ok, id, type, name, toSectionId, reverseRefsUpdated }.",
    { projectId: z.string(), sectionId: z.string().describe("Source section UUID"), addonId: z.string().describe("Addon UUID to move"), toSectionId: z.string().describe("Destination section UUID (must differ from origin)"), overwrite: z.boolean().optional().describe("Replace an existing singleton addon in place instead of failing with 409"), returning },
    async ({ projectId, sectionId, addonId, toSectionId, overwrite, returning: returnMode }) => {
      try {
        const result = await api.moveAddon(projectId, sectionId, addonId, toSectionId, overwrite);
        return json(returnMode === "full" ? result : addonMoved(result, toSectionId));
      } catch (e) { return err(e); }
    });

  server.tool("list_linked_spreadsheets", "List the Google Spreadsheets registered in a project's settings. Returns each spreadsheet's id (UUID to set as a section's linkedSpreadsheetId), name, url, spreadsheetId, sheets (tab names), and columnsBySheet (header row per tab, position-aligned to column index). Use to discover the sheet/column names needed for field bindings.",
    { projectId: z.string() },
    async ({ projectId }) => { try { return json(await api.listLinkedSpreadsheets(projectId)); } catch (e) { return err(e); } });

  server.tool("list_project_images", "The project's Google Drive image library: each file's name plus the ready-to-write URL for a page icon (thumbImageUrl on create_section / update_section / batch_update_sections). File names are the handle — match them against a page's dataId or title. Files inside subfolders also carry `path`. Pass `match` to filter by name or subfolder instead of pulling the whole library; responses cap at 200 files and say `truncated` when they do.",
    { projectId: z.string(), match: z.string().optional().describe("Only files whose name contains this (case-insensitive)") },
    async ({ projectId, match }) => { try { return json(await api.listProjectImages(projectId, match)); } catch (e) { return err(e); } });

  server.tool("get_remote_config", "Resolve Remote Config (exportSchema) addons and return the RESOLVED economy JSON (actual values, not the blueprint). Scope: no sectionId/addonId → every config in the project; sectionId → configs in that section's subtree; addonId → a single config.",
    { projectId: z.string(), sectionId: z.string().optional().describe("Limit to this section's subtree"), addonId: z.string().optional().describe("Resolve a single exportSchema addon by its id") },
    async ({ projectId, sectionId, addonId }) => { try { return json(await api.getRemoteConfig(projectId, { sectionId, addonId })); } catch (e) { return err(e); } });

  server.tool("search", "Search across all projects and sections. Each section hit comes back as a pointer — id, projectId, title, dataId, and a 200-character excerpt — because the match itself is what you asked for, not the page. Follow up with get_section on the hits that matter.",
    { query: z.string(), type: z.enum(["all", "projects", "sections"]).optional(), limit: z.number().optional() },
    async ({ query, type, limit }) => { try { return json(searchProjection(await api.search(query, type, limit))); } catch (e) { return err(e); } });
}

// ── Typed addon tools ─────────────────────────────────────────────

export function registerAddonTools(server: McpServer, api: ApiFetcher) {
  const ps = { projectId: z.string(), sectionId: z.string() };

  /**
   * One tool per addon type instead of a create/update pair. The two schemas
   * were near-identical — update was just the optional version of create — and
   * each is sent to the model in every request. The exposed schema is the
   * all-optional one; create still gets its required fields and zod defaults,
   * applied in the handler.
   */
  function upsert(
    typeName: string, addonType: string, desc: string,
    createFields: Record<string, z.ZodTypeAny>,
    updateFields: Record<string, z.ZodTypeAny>,
  ) {
    const createSchema = z.object(createFields);

    server.tool(`upsert_${typeName}_addon`, `Create or update a ${desc} addon. Pass addonId to update an existing addon — only the fields you send change. Omit addonId to create a new one, in which case name and the type's required fields must be present. Returns a receipt; read the stored values back with get_section.`, {
      ...ps,
      addonId: z.string().optional().describe("Update this addon; omit to create a new one"),
      name: z.string().optional().describe("Display name (required when creating)"),
      group: z.string().optional(),
      ...updateFields,
      returning,
    }, async ({ projectId, sectionId, addonId, name, group, returning: returnMode, ...data }) => {
      try {
        if (addonId) {
          const fields: Record<string, unknown> = {};
          if (name !== undefined) fields.name = name;
          if (group !== undefined) fields.group = group;
          if (Object.keys(data).length > 0) fields.data = data;
          const saved = await api.updateAddon(projectId, sectionId, addonId, fields);
          return json(returnMode === "full" ? saved : addonReceipt(saved, sectionId, [...touched({ name, group }), ...Object.keys(data)]));
        }

        if (!name) return fail(`name is required when creating a ${addonType} addon (pass addonId to update an existing one instead)`);

        const parsed = createSchema.safeParse(data);
        if (!parsed.success) {
          const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
          return fail(`cannot create a ${addonType} addon — ${problems}`);
        }

        const created = await api.createAddon(projectId, sectionId, {
          type: addonType, name, ...(group ? { group } : {}), data: parsed.data,
        });
        return json(returnMode === "full" ? created : addonCreated(created, sectionId));
      } catch (e) { return err(e); }
    });
  }

  function opt(fields: Record<string, z.ZodTypeAny>): Record<string, z.ZodTypeAny> {
    const r: Record<string, z.ZodTypeAny> = {};
    for (const [k, v] of Object.entries(fields)) r[k] = v.optional();
    return r;
  }

  // 1. Currency
  const cur = { code: z.string(), displayName: z.string(), kind: z.enum(["soft", "premium", "event", "other"]), decimals: z.number().optional(), notes: z.string().optional() };
  upsert("currency", "currency", "currency", cur, opt(cur));

  // Binding Google Sheets reutilizável (campo escalar boolean/numérico). O sync in-app
  // ("Sincronizar tudo") lê a célula e sobrescreve o escalar (bool: TRUE/1/YES/SIM → true).
  // cellRef é a posição-fallback; rowLock "auto" ancora a linha no DataID da página, útil
  // pra vincular muitos itens à mesma coluna. Via MCP define-se só o vínculo (sync é client-side).
  const sheetsBind = z.object({
    source: z.literal("sheets"),
    ref: z.object({
      sheetName: z.string(),
      cellRef: z.string().describe('Posição-fallback, ex. "C2". Obrigatória mesmo com locks.'),
      columnLock: z.string().optional().describe("Nome do header da coluna (resolve por nome)."),
      rowLock: z.string().optional().describe('"auto" = DataID da página; ou valor fixo da coluna A.'),
    }),
  }).optional();

  // Binding de campo numérico: sheets | progressionColumn | library. (library resolve para
  // a entrada da Biblioteca — ideal pra campos chave/label; em campo numérico prefira os outros.)
  const valueBind = z.union([
    z.object({ source: z.literal("sheets"), ref: z.object({ sheetName: z.string(), cellRef: z.string(), columnLock: z.string().optional(), rowLock: z.string().optional() }) }),
    z.object({ source: z.literal("progressionColumn"), progressionAddonId: z.string(), columnId: z.string(), columnName: z.string() }),
    z.object({ source: z.literal("library"), libraryAddonId: z.string(), entryId: z.string() }),
  ]).optional();

  // 2. Inventory
  const inv = { weight: z.number().optional(), stackable: z.boolean().optional(), maxStack: z.number().optional(), inventoryCategory: z.string().optional(), slotSize: z.number().optional(), durability: z.number().optional(), bindType: z.enum(["none", "onPickup", "onEquip"]).optional(), showInShop: z.boolean().optional(), showInShopBinding: sheetsBind, consumable: z.boolean().optional(), consumableBinding: sheetsBind, discardable: z.boolean().optional(), discardableBinding: sheetsBind, notes: z.string().optional() };
  upsert("inventory", "inventory", "inventory item", inv, opt(inv));

  // 3. Economy Link
  const eco = { hasBuyConfig: z.boolean().optional(), buyCurrencyRef: z.string().optional(), buyValue: z.number().optional(), buyValueBinding: valueBind, hasSellConfig: z.boolean().optional(), sellCurrencyRef: z.string().optional(), sellValue: z.number().optional(), sellValueBinding: valueBind, hasProductionConfig: z.boolean().optional(), hasUnlockConfig: z.boolean().optional(), notes: z.string().optional() };
  upsert("economy_link", "economyLink", "economy link (buy/sell)", eco, opt(eco));

  // 4. Global Variable
  const gv = { key: z.string(), displayName: z.string(), valueType: z.enum(["percent", "multiplier", "flat", "boolean"]), defaultValue: z.union([z.number(), z.boolean()]), scope: z.enum(["global", "mode", "event", "season"]).optional(), notes: z.string().optional() };
  upsert("global_variable", "globalVariable", "global variable", gv, opt(gv));

  // 5. Progression Table
  const col = z.object({ id: z.string(), name: z.string(), decimals: z.number().optional(), generator: z.object({ mode: z.enum(["manual", "linear", "exponential", "formula"]), base: z.number().optional(), step: z.number().optional(), growth: z.number().optional(), expression: z.string().optional() }).optional() });
  const row = z.object({ level: z.number(), values: z.record(z.string(), z.union([z.number(), z.string()])) });
  const pt = { startLevel: z.number().optional(), endLevel: z.number().optional(), columns: z.array(col), rows: z.array(row).optional() };
  upsert("progression_table", "progressionTable", "progression table", pt, opt(pt));

  // 6. XP Balance — the one type whose curve params live nested under `params`,
  // so it gets its own upsert instead of going through the generic helper.
  const XP_PARAMS = ["base", "growth", "offset", "tierStep", "tierMultiplier"] as const;
  const XP_DEFAULTS: Record<string, number> = { base: 100, growth: 1.15, offset: 0, tierStep: 10, tierMultiplier: 1.5 };

  server.tool("upsert_xp_balance_addon", "Create or update an XP balance curve addon. Pass addonId to update an existing addon — only the fields you send change. Omit addonId to create a new one, in which case name must be present. Returns a receipt; read the stored curve back with get_section.", {
    ...ps,
    addonId: z.string().optional().describe("Update this addon; omit to create a new one"),
    name: z.string().optional().describe("Display name (required when creating)"),
    group: z.string().optional(), returning,
    mode: z.enum(["preset", "advanced"]).optional(), preset: z.enum(["linear", "exponential", "tiered", "softCap", "hardCap"]).optional(),
    expression: z.string().optional(), startLevel: z.number().optional(), endLevel: z.number().optional(), decimals: z.number().optional(),
    base: z.number().optional(), growth: z.number().optional(), offset: z.number().optional(), tierStep: z.number().optional(), tierMultiplier: z.number().optional(),
  }, async ({ projectId, sectionId, addonId, name, group, returning: returnMode, ...raw }) => {
    try {
      const args = raw as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      const params: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v === undefined) continue;
        (XP_PARAMS.includes(k as (typeof XP_PARAMS)[number]) ? params : data)[k] = v;
      }

      if (addonId) {
        const fields: Record<string, unknown> = {};
        if (name !== undefined) fields.name = name;
        if (group !== undefined) fields.group = group;
        if (Object.keys(params).length > 0) data.params = params;
        if (Object.keys(data).length > 0) fields.data = data;
        const saved = await api.updateAddon(projectId, sectionId, addonId, fields);
        return json(returnMode === "full" ? saved : addonReceipt(saved, sectionId, [...touched({ name, group }), ...Object.keys(data)]));
      }

      if (!name) return fail("name is required when creating an xpBalance addon (pass addonId to update an existing one instead)");

      // A curve with holes in its params does not render, so fill them.
      const created = await api.createAddon(projectId, sectionId, {
        type: "xpBalance", name, ...(group ? { group } : {}),
        data: { ...data, params: { ...XP_DEFAULTS, ...params } },
      });
      return json(returnMode === "full" ? created : addonCreated(created, sectionId));
    } catch (e) { return err(e); }
  });

  // 7. Production
  const ing = z.object({ itemRef: z.string(), quantity: z.number() });
  const out = z.object({ itemRef: z.string(), quantity: z.number() });
  const prod = { mode: z.enum(["passive", "recipe"]).optional(), outputRef: z.string().optional(), minOutput: z.number().optional(), minOutputBinding: valueBind, maxOutput: z.number().optional(), maxOutputBinding: valueBind, intervalSeconds: z.number().optional(), intervalSecondsBinding: valueBind, capacity: z.number().optional(), capacityBinding: valueBind, ingredients: z.array(ing).optional(), outputs: z.array(out).optional(), craftTimeSeconds: z.number().optional(), craftTimeSecondsBinding: valueBind, notes: z.string().optional() };
  upsert("production", "production", "production", prod, opt(prod));

  // 8. Data Schema
  const dsEntry = z.object({ id: z.string().optional(), key: z.string(), label: z.string(), valueType: z.enum(["int", "float", "seconds", "percent", "boolean", "string"]), value: z.union([z.number(), z.boolean(), z.string()]), min: z.number().optional(), max: z.number().optional(), notes: z.string().optional() });
  const ds = { entries: z.array(dsEntry) };
  upsert("data_schema", "dataSchema", "data schema", ds, opt(ds));

  // 9. Attribute Definitions
  const adEntry = z.object({ id: z.string().optional(), key: z.string(), label: z.string(), valueType: z.enum(["int", "float", "percent", "boolean"]), defaultValue: z.union([z.number(), z.boolean()]), min: z.number().optional(), max: z.number().optional() });
  upsert("attribute_definitions", "attributeDefinitions", "attribute definitions", { attributes: z.array(adEntry) }, { attributes: z.array(adEntry).optional() });

  // 10. Attribute Profile
  const apVal = z.object({ id: z.string().optional(), attributeKey: z.string(), value: z.union([z.number(), z.boolean()]) });
  upsert("attribute_profile", "attributeProfile", "attribute profile", { definitionsRef: z.string().optional(), values: z.array(apVal) }, { definitionsRef: z.string().optional(), values: z.array(apVal).optional() });

  // 11. Attribute Modifiers
  const amEntry = z.object({ id: z.string().optional(), attributeKey: z.string(), mode: z.enum(["add", "mult", "set"]), value: z.union([z.number(), z.boolean()]) });
  upsert("attribute_modifiers", "attributeModifiers", "attribute modifiers", { definitionsRef: z.string().optional(), modifiers: z.array(amEntry) }, { definitionsRef: z.string().optional(), modifiers: z.array(amEntry).optional() });

  // 12. Export Schema
  const esBinding = z.object({ source: z.enum(["manual", "dataSchema", "rowLevel", "rowColumn", "entryField", "productionField", "itemField", "skillField", "skillCostField", "skillEffectField"]), value: z.union([z.string(), z.number(), z.boolean()]).optional(), valueType: z.enum(["string", "number", "boolean"]).optional(), addonId: z.string().optional(), addonName: z.string().optional(), entryKey: z.string().optional(), entryId: z.string().optional(), columnId: z.string().optional(), field: z.string().optional() });
  const esArraySource = z.object({ type: z.enum(["progressionTable", "xpBalance", "craftTable", "productionIngredients", "productionOutputs", "skills", "skillCosts", "skillEffects", "sections"]), addonId: z.string().optional(), addonName: z.string().optional(), parentSectionId: z.string().optional(), parentSectionName: z.string().optional() });
  const esNode: z.ZodTypeAny = z.lazy(() => z.object({ id: z.string().optional(), key: z.string(), nodeType: z.enum(["object", "array", "value"]), children: z.array(esNode).optional(), arraySource: esArraySource.optional(), itemTemplate: z.array(esNode).optional(), binding: esBinding.optional(), abs: z.boolean().optional(), multiplier: z.number().optional() }));
  upsert("export_schema", "exportSchema", "export schema", { nodes: z.array(esNode), arrayFormat: z.enum(["rowMajor", "columnMajor", "keyedByLevel", "matrix"]).optional() }, { nodes: z.array(esNode).optional(), arrayFormat: z.enum(["rowMajor", "columnMajor", "keyedByLevel", "matrix"]).optional() });

  // 13. Craft Table
  const ctUnlock = z.object({
    level: z.object({ enabled: z.boolean(), xpAddonRef: z.string().optional(), level: z.number().optional() }).optional(),
    currency: z.object({ enabled: z.boolean(), currencyAddonRef: z.string().optional(), amount: z.number().optional() }).optional(),
    item: z.object({ enabled: z.boolean(), itemRef: z.string().optional(), quantity: z.number().optional() }).optional(),
  });
  const ctEntry = z.object({ id: z.string().optional(), productionRef: z.string().optional(), category: z.string().optional(), order: z.number(), unlock: ctUnlock.optional(), hidden: z.boolean().optional() });
  const craft = { entries: z.array(ctEntry) };
  upsert("craft_table", "craftTable", "craft table (aggregates Production recipes with unlock conditions)", craft, opt(craft));

  // 14. Crop (plant & harvest)
  const cropXpEvent = z.object({ xpAddonRef: z.string().optional(), xp: z.number().optional(), xpBinding: valueBind });
  const cropStage = z.object({ id: z.string().optional(), label: z.string(), secondsFromPlanting: z.number() });
  const cropOutput = z.object({ id: z.string().optional(), itemRef: z.string().optional(), quantity: z.number().optional(), quantityBinding: valueBind, quantityMin: z.number().optional(), quantityMax: z.number().optional() });
  const cropItemInput = z.object({ id: z.string().optional(), itemRef: z.string().optional() });
  const crop = {
    harvestMode: z.enum(["instant", "progressive"]).optional(),
    growthSeconds: z.number().optional(), growthSecondsBinding: valueBind, growthSecondsMin: z.number().optional(), growthSecondsMax: z.number().optional(),
    totalHarvest: z.number().optional(), totalHarvestBinding: valueBind, totalHarvestMin: z.number().optional(), totalHarvestMax: z.number().optional(),
    stages: z.array(cropStage).optional(), outputs: z.array(cropOutput).optional(),
    plantXp: cropXpEvent.optional(), harvestXp: cropXpEvent.optional(),
    spawnWitheredPlant: z.boolean().optional(), witheredPlantRef: z.string().optional(),
    seedRef: z.string().optional(), seedQuantity: z.number().optional(), seedQuantityBinding: valueBind, seedQuantityMin: z.number().optional(), seedQuantityMax: z.number().optional(),
    plantEnergy: z.number().optional(), plantEnergyBinding: valueBind, plantEnergyMin: z.number().optional(), plantEnergyMax: z.number().optional(),
    fertilizers: z.array(cropItemInput).optional(), amendments: z.array(cropItemInput).optional(),
    seasons: z.array(z.enum(["spring", "summer", "fall", "winter", "greenhouse"])).optional(),
    notes: z.string().optional(),
  };
  upsert("crop", "crop", "crop / plant-and-harvest mechanic", crop, opt(crop));

  // 15. Field Library
  const flEntry = z.object({ id: z.string().optional(), key: z.string(), label: z.string(), description: z.string().optional() });
  const fieldLib = { entries: z.array(flEntry) };
  upsert("field_library", "fieldLibrary", "field library (reusable field definitions)", fieldLib, opt(fieldLib));

  // 16. Rich Doc
  const richDoc = { blocks: z.array(z.record(z.string(), z.unknown())), schemaVersion: z.literal(1).optional() };
  upsert("rich_doc", "richDoc", "rich document (Notion-style blocks)", richDoc, opt(richDoc));

  // 17. Currency Exchange
  const ceEntry = z.object({ id: z.string().optional(), fromCurrencyRef: z.string().optional(), fromAmount: z.number(), toCurrencyRef: z.string().optional(), toAmount: z.number(), direction: z.enum(["oneWay", "bidirectional"]), notes: z.string().optional() });
  const currencyExchange = { entries: z.array(ceEntry) };
  upsert("currency_exchange", "currencyExchange", "currency exchange (convert one currency into another)", currencyExchange, opt(currencyExchange));

  // 18. Skills
  const skillCost = z.object({ id: z.string().optional(), type: z.enum(["currency", "attribute", "charges"]), amount: z.number(), currencyRef: z.string().optional(), definitionsRef: z.string().optional(), attributeKey: z.string().optional() });
  const skillEffect = z.object({ id: z.string().optional(), attributeModifiersSectionId: z.string(), attributeModifiersAddonId: z.string(), modifierEntryId: z.string() });
  const skillEntry = z.object({ id: z.string().optional(), name: z.string(), description: z.string().optional(), kind: z.enum(["active", "passive"]), cooldownSeconds: z.number().optional(), costs: z.array(skillCost).optional(), effects: z.array(skillEffect).optional(), unlock: ctUnlock.optional(), tags: z.array(z.string()).optional() });
  const skills = { entries: z.array(skillEntry) };
  upsert("skills", "skills", "skills (active/passive abilities with costs, effects, unlocks)", skills, opt(skills));
}

// ── Factory ───────────────────────────────────────────────────────

// ── Prompts (7) ───────────────────────────────────────────────────

function userMsg(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

function registerPrompts(server: McpServer) {
  server.prompt("meus_projetos", "Lista todos os seus projetos com resumo de seções e addons",
    async () => userMsg(
      `Use a tool list_projects para listar meus projetos do GDD Manager. Para cada projeto, mostre:
- Nome do projeto
- Quantidade de seções
- Descrição resumida (primeiras 2 linhas)

Apresente de forma limpa e organizada.`));

  server.prompt("ver_projeto", "Mostra um projeto completo com todas as seções e addons",
    { projectName: z.string().describe("Nome ou parte do nome do projeto") },
    async ({ projectName }) => userMsg(
      `Quero ver o projeto "${projectName}" do meu GDD Manager.

1. Use list_projects para encontrar o projeto pelo nome
2. Use get_project com o ID encontrado
3. Mostre uma visão organizada:
   - Título e descrição
   - Árvore de seções (com indentação para sub-seções)
   - Para cada seção, liste os addons (tipo e nome)
   - Destaque seções sem conteúdo ou vazias`));

  server.prompt("nova_secao", "Guia a criação de uma nova seção no projeto",
    { projectName: z.string().describe("Nome do projeto"), sectionTitle: z.string().describe("Título da nova seção") },
    async ({ projectName, sectionTitle }) => userMsg(
      `Crie uma nova seção chamada "${sectionTitle}" no projeto "${projectName}".

1. Use list_projects para encontrar o ID do projeto
2. Use create_section para criar a seção com:
   - Título: "${sectionTitle}"
   - Sugira domain tags apropriadas baseadas no título
   - Sugira um conteúdo inicial com template de GDD (visão geral, mecânicas, regras)
3. Mostre a seção criada e pergunte se quer adicionar addons`));

  server.prompt("novo_addon", "Adiciona um addon a uma seção existente",
    { projectName: z.string().describe("Nome do projeto"), sectionName: z.string().describe("Nome da seção"), addonType: z.string().describe("Tipo do addon (currency, inventory, progressionTable, etc.)") },
    async ({ projectName, sectionName, addonType }) => userMsg(
      `Adicione um addon do tipo "${addonType}" na seção "${sectionName}" do projeto "${projectName}".

1. Use list_projects para encontrar o projeto
2. Use list_sections para encontrar a seção pelo nome
3. Crie o addon usando a tool tipada ou create_addon com type="${addonType}"
4. Preencha os campos com valores padrão inteligentes baseados no contexto da seção
5. Mostre o addon criado`));

  server.prompt("buscar", "Busca por palavra-chave em todos os projetos e seções",
    { query: z.string().describe("Termo de busca") },
    async ({ query }) => userMsg(
      `Busque por "${query}" nos meus GDDs usando a tool search.
Mostre os resultados organizados por projeto, com o nome da seção e um trecho do conteúdo onde o termo aparece.`));

  server.prompt("resumo_projeto", "Gera um resumo executivo completo do projeto",
    { projectName: z.string().describe("Nome do projeto") },
    async ({ projectName }) => userMsg(
      `Gere um resumo executivo do projeto "${projectName}" do GDD Manager.

1. Use list_projects para encontrar o projeto
2. Use get_project para carregar todas as seções e addons
3. Crie um resumo executivo com:
   - Visão geral do jogo (baseada na descrição e seções)
   - Estrutura do documento (árvore de seções)
   - Sistemas de jogo identificados (baseado nos addons: economia, inventário, progressão, etc.)
   - Estatísticas: total de seções, addons por tipo, seções vazias
   - Pontos que merecem atenção (seções sem conteúdo, addons incompletos)`));

  server.prompt("analisar_gdd", "Analisa o GDD em busca de inconsistências e melhorias",
    { projectName: z.string().describe("Nome do projeto") },
    async ({ projectName }) => userMsg(
      `Analise o GDD do projeto "${projectName}" em busca de problemas e oportunidades de melhoria.

1. Use list_projects para encontrar o projeto
2. Use get_project para carregar tudo
3. Analise:
   - Seções vazias ou com pouco conteúdo
   - Addons de currency/economy sem valores definidos
   - Tabelas de progressão com poucos níveis
   - Seções que mencionam conceitos sem seção própria
   - Inconsistências entre addons (ex: item referencia currency que não existe)
   - Sugestões de novas seções ou addons que fariam sentido
4. Apresente como um relatório com prioridades (crítico, importante, sugestão)`));
}

// ── Factory ───────────────────────────────────────────────────────

export function createMcpServer(api: ApiFetcher): McpServer {
  const server = new McpServer({
    name: "gdd-manager",
    version: "0.1.0",
  });

  registerGenericTools(server, api);
  registerAddonTools(server, api);
  registerPrompts(server);

  return server;
}
