/**
 * Creates an McpServer with all GDD Manager tools registered.
 * Used by the remote HTTP endpoint (app/api/mcp/route.ts).
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type ApiFetcher, McpApiError } from "./api";
import {
  batchReceipt,
  deleted,
  filterSections,
  json,
  projectCreated,
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

  server.tool("get_project", "Get a project's settings plus a lightweight index of every section (id, title, parentId, order, dataId, and whether it has a description). This is the map of the document — use it to find the section you need, then get_section for its contents.",
    { projectId: z.string().describe("Project UUID") },
    async ({ projectId }) => {
      try {
        return json(projectIndex(await api.getProject(projectId)));
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

  server.tool("list_sections", "List a project's sections as an index, sorted by order: id, title, parentId, order, dataId and hasDescription. The descriptions themselves are omitted — fetch a specific page with get_section. Narrow the result with subtreeOf / withoutDescription instead of listing everything and filtering yourself.",
    {
      projectId: z.string(),
      subtreeOf: z.string().optional().describe("Only this section and its descendants"),
      withoutDescription: z.boolean().optional().describe("Only sections with no description yet — useful for finding what still needs writing"),
    },
    async ({ projectId, ...filters }) => {
      try {
        const sections = (await api.listSections(projectId)) as unknown[];
        return json(filterSections(sections, filters).map(sectionRow));
      } catch (e) { return err(e); }
    });

  server.tool("get_section", "Get a single section in full — description and contentBlocks. This is the right place to read a page's contents; the write tools deliberately do not echo it back.",
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

  server.tool("update_section", "Update a section's fields. Use `contentBlocks` to replace the description with rich formatted content. Returns a receipt — {ok, id, title, updated, updatedAt} — not the section. Call get_section when you actually need to read the result back.",
    { projectId: z.string(), sectionId: z.string(), title: z.string().optional(), content: z.string().optional(), contentBlocks: CONTENT_BLOCKS_FIELD, parentId: z.string().optional(), order: z.number().optional(), color: z.string().optional(), domainTags: z.array(z.string()).optional(), dataId: z.string().optional(), thumbImageUrl: THUMB_FIELD, returning },
    async ({ projectId, sectionId, returning: returnMode, ...f }) => {
      try {
        const saved = await api.updateSection(projectId, sectionId, f);
        return json(returnMode === "full" ? sectionFull(saved) : sectionReceipt(saved, touched(f)));
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

  server.tool("list_project_images", "The project's Google Drive image library: each file's name plus the ready-to-write URL for a page icon (thumbImageUrl on create_section / update_section / batch_update_sections). File names are the handle — match them against a page's dataId or title. Files inside subfolders also carry `path`. Pass `match` to filter by name or subfolder instead of pulling the whole library; responses cap at 200 files and say `truncated` when they do.",
    { projectId: z.string(), match: z.string().optional().describe("Only files whose name contains this (case-insensitive)") },
    async ({ projectId, match }) => { try { return json(await api.listProjectImages(projectId, match)); } catch (e) { return err(e); } });

  server.tool("search", "Search across all projects and sections. Each section hit comes back as a pointer — id, projectId, title, dataId, and a 200-character excerpt — because the match itself is what you asked for, not the page. Follow up with get_section on the hits that matter.",
    { query: z.string(), type: z.enum(["all", "projects", "sections"]).optional(), limit: z.number().optional() },
    async ({ query, type, limit }) => { try { return json(searchProjection(await api.search(query, type, limit))); } catch (e) { return err(e); } });
}


// ── Prompts (7) ───────────────────────────────────────────────────

function userMsg(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

function registerPrompts(server: McpServer) {
  server.prompt("meus_projetos", "Lista todos os seus projetos com resumo de seções",
    async () => userMsg(
      `Use a tool list_projects para listar meus projetos do GDD Manager. Para cada projeto, mostre:
- Nome do projeto
- Quantidade de seções
- Descrição resumida (primeiras 2 linhas)

Apresente de forma limpa e organizada.`));

  server.prompt("ver_projeto", "Mostra um projeto completo com todas as seções",
    { projectName: z.string().describe("Nome ou parte do nome do projeto") },
    async ({ projectName }) => userMsg(
      `Quero ver o projeto "${projectName}" do meu GDD Manager.

1. Use list_projects para encontrar o projeto pelo nome
2. Use get_project com o ID encontrado
3. Mostre uma visão organizada:
   - Título e descrição
   - Árvore de seções (com indentação para sub-seções)
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
3. Mostre a seção criada e pergunte se o texto ficou do jeito esperado`));

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
2. Use get_project para carregar todas as seções
3. Crie um resumo executivo com:
   - Visão geral do jogo (baseada na descrição e seções)
   - Estrutura do documento (árvore de seções)
   - Sistemas de jogo identificados a partir do texto das páginas
   - Estatísticas: total de seções, seções vazias
   - Pontos que merecem atenção (seções sem conteúdo, ramos rasos)`));

  server.prompt("analisar_gdd", "Analisa o GDD em busca de inconsistências e melhorias",
    { projectName: z.string().describe("Nome do projeto") },
    async ({ projectName }) => userMsg(
      `Analise o GDD do projeto "${projectName}" em busca de problemas e oportunidades de melhoria.

1. Use list_projects para encontrar o projeto
2. Use get_project para carregar tudo
3. Analise:
   - Seções vazias ou com pouco conteúdo
   - Seções que mencionam conceitos sem seção própria
   - Referências $[...] quebradas
   - Sugestões de novas seções que fariam sentido
4. Apresente como um relatório com prioridades (crítico, importante, sugestão)`));
}

// ── Factory ───────────────────────────────────────────────────────

export function createMcpServer(api: ApiFetcher): McpServer {
  const server = new McpServer({
    name: "gdd-manager",
    version: "0.1.0",
  });

  registerGenericTools(server, api);
  registerPrompts(server);

  return server;
}
