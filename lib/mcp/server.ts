/**
 * Creates an McpServer with all GDD Manager tools registered.
 * Used by the remote HTTP endpoint (app/api/mcp/route.ts).
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type ApiFetcher, McpApiError } from "./api";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(e: unknown) {
  if (e instanceof McpApiError) {
    return { content: [{ type: "text" as const, text: `Error (${e.code}): ${e.message}` }], isError: true };
  }
  return { content: [{ type: "text" as const, text: String(e) }], isError: true };
}

// ── Generic tools (15) ────────────────────────────────────────────

function registerGenericTools(server: McpServer, api: ApiFetcher) {
  server.tool("list_projects", "List all GDD projects you have access to", {},
    async () => { try { return json(await api.listProjects()); } catch (e) { return err(e); } });

  server.tool("get_project", "Get a project with all its sections and addons",
    { projectId: z.string().describe("Project UUID") },
    async ({ projectId }) => { try { return json(await api.getProject(projectId)); } catch (e) { return err(e); } });

  server.tool("create_project", "Create a new GDD project",
    { title: z.string().describe("Project title"), description: z.string().optional().describe("Project description") },
    async (params) => { try { return json(await api.createProject(params)); } catch (e) { return err(e); } });

  server.tool("update_project", "Update project metadata",
    { projectId: z.string().describe("Project UUID"), title: z.string().optional(), description: z.string().optional(), coverImageUrl: z.string().optional(), aiInstructions: z.string().optional().describe("AI instructions for this project") },
    async ({ projectId, ...f }) => { try { return json(await api.updateProject(projectId, f)); } catch (e) { return err(e); } });

  server.tool("delete_project", "Delete a project (owner only, irreversible)",
    { projectId: z.string().describe("Project UUID") },
    async ({ projectId }) => { try { return json(await api.deleteProject(projectId)); } catch (e) { return err(e); } });

  server.tool("list_sections", "List all sections of a project",
    { projectId: z.string().describe("Project UUID") },
    async ({ projectId }) => { try { return json(await api.listSections(projectId)); } catch (e) { return err(e); } });

  server.tool("get_section", "Get a single section with its addons",
    { projectId: z.string().describe("Project UUID"), sectionId: z.string().describe("Section UUID") },
    async ({ projectId, sectionId }) => { try { return json(await api.getSection(projectId, sectionId)); } catch (e) { return err(e); } });

  server.tool("create_section", "Create a new section in a project",
    { projectId: z.string(), title: z.string(), content: z.string().optional(), parentId: z.string().optional(), order: z.number().optional(), color: z.string().optional(), domainTags: z.array(z.string()).optional(), dataId: z.string().optional() },
    async ({ projectId, ...p }) => { try { return json(await api.createSection(projectId, p)); } catch (e) { return err(e); } });

  server.tool("update_section", "Update a section's fields",
    { projectId: z.string(), sectionId: z.string(), title: z.string().optional(), content: z.string().optional(), parentId: z.string().optional(), order: z.number().optional(), color: z.string().optional(), domainTags: z.array(z.string()).optional(), dataId: z.string().optional() },
    async ({ projectId, sectionId, ...f }) => { try { return json(await api.updateSection(projectId, sectionId, f)); } catch (e) { return err(e); } });

  server.tool("delete_section", "Delete a section and all sub-sections (irreversible)",
    { projectId: z.string(), sectionId: z.string() },
    async ({ projectId, sectionId }) => { try { return json(await api.deleteSection(projectId, sectionId)); } catch (e) { return err(e); } });

  server.tool("list_addons", "List all addons of a section",
    { projectId: z.string(), sectionId: z.string() },
    async ({ projectId, sectionId }) => { try { return json(await api.listAddons(projectId, sectionId)); } catch (e) { return err(e); } });

  server.tool("create_addon", "Add an addon to a section",
    { projectId: z.string(), sectionId: z.string(), type: z.string().describe("Addon type"), name: z.string(), group: z.string().optional(), data: z.record(z.string(), z.unknown()).optional() },
    async ({ projectId, sectionId, ...p }) => { try { return json(await api.createAddon(projectId, sectionId, p)); } catch (e) { return err(e); } });

  server.tool("update_addon", "Update an addon",
    { projectId: z.string(), sectionId: z.string(), addonId: z.string(), name: z.string().optional(), group: z.string().optional(), data: z.record(z.string(), z.unknown()).optional() },
    async ({ projectId, sectionId, addonId, ...f }) => { try { return json(await api.updateAddon(projectId, sectionId, addonId, f)); } catch (e) { return err(e); } });

  server.tool("delete_addon", "Remove an addon from a section",
    { projectId: z.string(), sectionId: z.string(), addonId: z.string() },
    async ({ projectId, sectionId, addonId }) => { try { return json(await api.deleteAddon(projectId, sectionId, addonId)); } catch (e) { return err(e); } });

  server.tool("search", "Search across all projects and sections",
    { query: z.string(), type: z.enum(["all", "projects", "sections"]).optional(), limit: z.number().optional() },
    async ({ query, type, limit }) => { try { return json(await api.search(query, type, limit)); } catch (e) { return err(e); } });
}

// ── Typed addon tools ─────────────────────────────────────────────

function registerAddonTools(server: McpServer, api: ApiFetcher) {
  const ps = { projectId: z.string(), sectionId: z.string() };
  const psa = { ...ps, addonId: z.string() };

  function pair(
    typeName: string, addonType: string, desc: string,
    createFields: Record<string, z.ZodTypeAny>,
    updateFields: Record<string, z.ZodTypeAny>,
  ) {
    server.tool(`create_${typeName}_addon`, `Create a ${desc} addon`, {
      ...ps, name: z.string(), group: z.string().optional(), ...createFields,
    }, async ({ projectId, sectionId, name, group, ...data }) => {
      try {
        return json(await api.createAddon(projectId, sectionId, {
          type: addonType, name, ...(group ? { group } : {}), data,
        }));
      } catch (e) { return err(e); }
    });

    server.tool(`update_${typeName}_addon`, `Update a ${desc} addon`, {
      ...psa, name: z.string().optional(), group: z.string().optional(), ...updateFields,
    }, async ({ projectId, sectionId, addonId, name, group, ...data }) => {
      try {
        const fields: Record<string, unknown> = {};
        if (name !== undefined) fields.name = name;
        if (group !== undefined) fields.group = group;
        if (Object.keys(data).length > 0) fields.data = data;
        return json(await api.updateAddon(projectId, sectionId, addonId, fields));
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
  pair("currency", "currency", "currency", cur, opt(cur));

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
  pair("inventory", "inventory", "inventory item", inv, opt(inv));

  // 3. Economy Link
  const eco = { hasBuyConfig: z.boolean().optional(), buyCurrencyRef: z.string().optional(), buyValue: z.number().optional(), buyValueBinding: valueBind, hasSellConfig: z.boolean().optional(), sellCurrencyRef: z.string().optional(), sellValue: z.number().optional(), sellValueBinding: valueBind, hasProductionConfig: z.boolean().optional(), hasUnlockConfig: z.boolean().optional(), notes: z.string().optional() };
  pair("economy_link", "economyLink", "economy link (buy/sell)", eco, opt(eco));

  // 4. Global Variable
  const gv = { key: z.string(), displayName: z.string(), valueType: z.enum(["percent", "multiplier", "flat", "boolean"]), defaultValue: z.union([z.number(), z.boolean()]), scope: z.enum(["global", "mode", "event", "season"]).optional(), notes: z.string().optional() };
  pair("global_variable", "globalVariable", "global variable", gv, opt(gv));

  // 5. Progression Table
  const col = z.object({ id: z.string(), name: z.string(), decimals: z.number().optional(), generator: z.object({ mode: z.enum(["manual", "linear", "exponential", "formula"]), base: z.number().optional(), step: z.number().optional(), growth: z.number().optional(), expression: z.string().optional() }).optional() });
  const row = z.object({ level: z.number(), values: z.record(z.string(), z.union([z.number(), z.string()])) });
  const pt = { startLevel: z.number().optional(), endLevel: z.number().optional(), columns: z.array(col), rows: z.array(row).optional() };
  pair("progression_table", "progressionTable", "progression table", pt, opt(pt));

  // 6. XP Balance (special: params nested)
  server.tool("create_xp_balance_addon", "Create an XP balance curve addon", {
    ...ps, name: z.string(), group: z.string().optional(),
    mode: z.enum(["preset", "advanced"]).optional(), preset: z.enum(["linear", "exponential", "tiered", "softCap", "hardCap"]).optional(),
    expression: z.string().optional(), startLevel: z.number().optional(), endLevel: z.number().optional(), decimals: z.number().optional(),
    base: z.number().optional(), growth: z.number().optional(), offset: z.number().optional(), tierStep: z.number().optional(), tierMultiplier: z.number().optional(),
  }, async ({ projectId, sectionId, name, group, base, growth, offset, tierStep, tierMultiplier, ...rest }) => {
    try {
      return json(await api.createAddon(projectId, sectionId, {
        type: "xpBalance", name, ...(group ? { group } : {}),
        data: { ...rest, params: { base: base ?? 100, growth: growth ?? 1.15, offset: offset ?? 0, tierStep: tierStep ?? 10, tierMultiplier: tierMultiplier ?? 1.5 } },
      }));
    } catch (e) { return err(e); }
  });

  server.tool("update_xp_balance_addon", "Update an XP balance curve addon", {
    ...psa, name: z.string().optional(), group: z.string().optional(),
    mode: z.enum(["preset", "advanced"]).optional(), preset: z.enum(["linear", "exponential", "tiered", "softCap", "hardCap"]).optional(),
    expression: z.string().optional(), startLevel: z.number().optional(), endLevel: z.number().optional(), decimals: z.number().optional(),
    base: z.number().optional(), growth: z.number().optional(), offset: z.number().optional(), tierStep: z.number().optional(), tierMultiplier: z.number().optional(),
  }, async ({ projectId, sectionId, addonId, name, group, base, growth, offset, tierStep, tierMultiplier, ...rest }) => {
    try {
      const fields: Record<string, unknown> = {};
      if (name !== undefined) fields.name = name;
      if (group !== undefined) fields.group = group;
      const data: Record<string, unknown> = { ...rest };
      const params: Record<string, unknown> = {};
      if (base !== undefined) params.base = base;
      if (growth !== undefined) params.growth = growth;
      if (offset !== undefined) params.offset = offset;
      if (tierStep !== undefined) params.tierStep = tierStep;
      if (tierMultiplier !== undefined) params.tierMultiplier = tierMultiplier;
      if (Object.keys(params).length > 0) data.params = params;
      if (Object.keys(data).length > 0) fields.data = data;
      return json(await api.updateAddon(projectId, sectionId, addonId, fields));
    } catch (e) { return err(e); }
  });

  // 7. Production
  const ing = z.object({ itemRef: z.string(), quantity: z.number() });
  const out = z.object({ itemRef: z.string(), quantity: z.number() });
  const prod = { mode: z.enum(["passive", "recipe"]).optional(), outputRef: z.string().optional(), minOutput: z.number().optional(), minOutputBinding: valueBind, maxOutput: z.number().optional(), maxOutputBinding: valueBind, intervalSeconds: z.number().optional(), intervalSecondsBinding: valueBind, capacity: z.number().optional(), capacityBinding: valueBind, ingredients: z.array(ing).optional(), outputs: z.array(out).optional(), craftTimeSeconds: z.number().optional(), craftTimeSecondsBinding: valueBind, notes: z.string().optional() };
  pair("production", "production", "production", prod, opt(prod));

  // 8. Data Schema
  const dsEntry = z.object({ id: z.string().optional(), key: z.string(), label: z.string(), valueType: z.enum(["int", "float", "seconds", "percent", "boolean", "string"]), value: z.union([z.number(), z.boolean(), z.string()]), min: z.number().optional(), max: z.number().optional(), notes: z.string().optional() });
  const ds = { entries: z.array(dsEntry) };
  pair("data_schema", "dataSchema", "data schema", ds, opt(ds));

  // 9. Attribute Definitions
  const adEntry = z.object({ id: z.string().optional(), key: z.string(), label: z.string(), valueType: z.enum(["int", "float", "percent", "boolean"]), defaultValue: z.union([z.number(), z.boolean()]), min: z.number().optional(), max: z.number().optional() });
  pair("attribute_definitions", "attributeDefinitions", "attribute definitions", { attributes: z.array(adEntry) }, { attributes: z.array(adEntry).optional() });

  // 10. Attribute Profile
  const apVal = z.object({ id: z.string().optional(), attributeKey: z.string(), value: z.union([z.number(), z.boolean()]) });
  pair("attribute_profile", "attributeProfile", "attribute profile", { definitionsRef: z.string().optional(), values: z.array(apVal) }, { definitionsRef: z.string().optional(), values: z.array(apVal).optional() });

  // 11. Attribute Modifiers
  const amEntry = z.object({ id: z.string().optional(), attributeKey: z.string(), mode: z.enum(["add", "mult", "set"]), value: z.union([z.number(), z.boolean()]) });
  pair("attribute_modifiers", "attributeModifiers", "attribute modifiers", { definitionsRef: z.string().optional(), modifiers: z.array(amEntry) }, { definitionsRef: z.string().optional(), modifiers: z.array(amEntry).optional() });

  // 12. Export Schema
  const esBinding = z.object({ source: z.enum(["manual", "dataSchema", "rowLevel", "rowColumn", "entryField", "productionField", "itemField", "skillField", "skillCostField", "skillEffectField"]), value: z.union([z.string(), z.number(), z.boolean()]).optional(), valueType: z.enum(["string", "number", "boolean"]).optional(), addonId: z.string().optional(), addonName: z.string().optional(), entryKey: z.string().optional(), entryId: z.string().optional(), columnId: z.string().optional(), field: z.string().optional() });
  const esArraySource = z.object({ type: z.enum(["progressionTable", "xpBalance", "craftTable", "productionIngredients", "productionOutputs", "skills", "skillCosts", "skillEffects", "sections"]), addonId: z.string().optional(), addonName: z.string().optional(), parentSectionId: z.string().optional(), parentSectionName: z.string().optional() });
  const esNode: z.ZodTypeAny = z.lazy(() => z.object({ id: z.string().optional(), key: z.string(), nodeType: z.enum(["object", "array", "value"]), children: z.array(esNode).optional(), arraySource: esArraySource.optional(), itemTemplate: z.array(esNode).optional(), binding: esBinding.optional(), abs: z.boolean().optional(), multiplier: z.number().optional() }));
  pair("export_schema", "exportSchema", "export schema", { nodes: z.array(esNode), arrayFormat: z.enum(["rowMajor", "columnMajor", "keyedByLevel", "matrix"]).optional() }, { nodes: z.array(esNode).optional(), arrayFormat: z.enum(["rowMajor", "columnMajor", "keyedByLevel", "matrix"]).optional() });

  // 13. Craft Table
  const ctUnlock = z.object({
    level: z.object({ enabled: z.boolean(), xpAddonRef: z.string().optional(), level: z.number().optional() }).optional(),
    currency: z.object({ enabled: z.boolean(), currencyAddonRef: z.string().optional(), amount: z.number().optional() }).optional(),
    item: z.object({ enabled: z.boolean(), itemRef: z.string().optional(), quantity: z.number().optional() }).optional(),
  });
  const ctEntry = z.object({ id: z.string().optional(), productionRef: z.string().optional(), category: z.string().optional(), order: z.number(), unlock: ctUnlock.optional(), hidden: z.boolean().optional() });
  const craft = { entries: z.array(ctEntry) };
  pair("craft_table", "craftTable", "craft table (aggregates Production recipes with unlock conditions)", craft, opt(craft));

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
  pair("crop", "crop", "crop / plant-and-harvest mechanic", crop, opt(crop));

  // 15. Field Library
  const flEntry = z.object({ id: z.string().optional(), key: z.string(), label: z.string(), description: z.string().optional() });
  const fieldLib = { entries: z.array(flEntry) };
  pair("field_library", "fieldLibrary", "field library (reusable field definitions)", fieldLib, opt(fieldLib));

  // 16. Rich Doc
  const richDoc = { blocks: z.array(z.record(z.string(), z.unknown())), schemaVersion: z.literal(1).optional() };
  pair("rich_doc", "richDoc", "rich document (Notion-style blocks)", richDoc, opt(richDoc));
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
