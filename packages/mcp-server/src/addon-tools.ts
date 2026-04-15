/**
 * Type-specific MCP tools for each addon type.
 *
 * 12 types × 2 (create + update) = 24 tools.
 * Each tool fixes the addon `type` and provides a typed schema for `data`,
 * then delegates to the generic addon API endpoint.
 */

import { z } from "zod/v3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GddApiClient, GddApiError } from "./client.js";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(e: unknown) {
  if (e instanceof GddApiError) {
    return { content: [{ type: "text" as const, text: `Error (${e.code}): ${e.message}` }], isError: true };
  }
  return { content: [{ type: "text" as const, text: String(e) }], isError: true };
}

// Shared params present in every create/update tool
const projSec = {
  projectId: z.string().describe("Project UUID"),
  sectionId: z.string().describe("Section UUID"),
};

const projSecAddon = {
  ...projSec,
  addonId: z.string().describe("Addon UUID"),
};

export function registerAddonTools(server: McpServer, client: GddApiClient) {
  // ── Helper to register a create + update pair ──────────────────

  function pair(
    typeName: string,
    addonType: string,
    description: string,
    createFields: Record<string, z.ZodTypeAny>,
    updateFields: Record<string, z.ZodTypeAny>,
  ) {
    // CREATE
    server.tool(
      `create_${typeName}_addon`,
      `Create a ${description} addon`,
      {
        ...projSec,
        name: z.string().describe("Display name for the addon"),
        group: z.string().optional().describe("Optional group name"),
        ...createFields,
      },
      async ({ projectId, sectionId, name, group, ...data }) => {
        try {
          return json(await client.createAddon(projectId, sectionId, {
            type: addonType,
            name,
            ...(group ? { group } : {}),
            data,
          }));
        } catch (e) { return err(e); }
      },
    );

    // UPDATE
    server.tool(
      `update_${typeName}_addon`,
      `Update a ${description} addon`,
      {
        ...projSecAddon,
        name: z.string().optional().describe("New display name"),
        group: z.string().optional().describe("New group name"),
        ...updateFields,
      },
      async ({ projectId, sectionId, addonId, name, group, ...data }) => {
        try {
          const fields: Record<string, unknown> = {};
          if (name !== undefined) fields.name = name;
          if (group !== undefined) fields.group = group;
          if (Object.keys(data).length > 0) fields.data = data;
          return json(await client.updateAddon(projectId, sectionId, addonId, fields));
        } catch (e) { return err(e); }
      },
    );
  }

  // Helper to make all fields in a record optional
  function optional(fields: Record<string, z.ZodTypeAny>): Record<string, z.ZodTypeAny> {
    const result: Record<string, z.ZodTypeAny> = {};
    for (const [k, v] of Object.entries(fields)) {
      result[k] = v instanceof z.ZodOptional ? v : v.optional();
    }
    return result;
  }

  // ── 1. Currency ─────────────────────────────────────────────────

  const currencyFields = {
    code: z.string().describe("Currency code (e.g. GLD, DIA)"),
    displayName: z.string().describe("Display name shown in-game"),
    kind: z.enum(["soft", "premium", "event", "other"]).describe("Currency category"),
    decimals: z.number().default(0).describe("Decimal places (0 for integer currencies)"),
    notes: z.string().optional().describe("Design notes"),
  };
  pair("currency", "currency", "currency (in-game money)", currencyFields, optional(currencyFields));

  // ── 2. Inventory ────────────────────────────────────────────────

  const inventoryFields = {
    weight: z.number().default(0).describe("Item weight"),
    stackable: z.boolean().default(true).describe("Can items stack?"),
    maxStack: z.number().default(99).describe("Max stack size"),
    inventoryCategory: z.string().default("").describe("Category (e.g. weapon, food, material)"),
    slotSize: z.number().default(1).describe("Inventory slots occupied"),
    durability: z.number().default(0).describe("Base durability (0 = no durability)"),
    bindType: z.enum(["none", "onPickup", "onEquip"]).default("none").describe("Bind on pickup/equip"),
    showInShop: z.boolean().default(true).describe("Visible in shop?"),
    consumable: z.boolean().default(false).describe("Is consumable?"),
    discardable: z.boolean().default(true).describe("Can be discarded?"),
    notes: z.string().optional().describe("Design notes"),
  };
  pair("inventory", "inventory", "inventory item", inventoryFields, optional(inventoryFields));

  // ── 3. Economy Link ─────────────────────────────────────────────

  const economyLinkFields = {
    hasBuyConfig: z.boolean().optional().default(true).describe("Enable buy configuration"),
    buyCurrencyRef: z.string().optional().describe("Currency section ID for buy price"),
    buyValue: z.number().optional().describe("Buy price"),
    minBuyValue: z.number().optional().describe("Minimum buy price"),
    hasSellConfig: z.boolean().optional().default(true).describe("Enable sell configuration"),
    sellCurrencyRef: z.string().optional().describe("Currency section ID for sell price"),
    sellValue: z.number().optional().describe("Sell price"),
    maxSellValue: z.number().optional().describe("Maximum sell price"),
    hasProductionConfig: z.boolean().optional().default(false).describe("Enable production config"),
    hasUnlockConfig: z.boolean().optional().default(false).describe("Enable unlock config"),
    unlockRef: z.string().optional().describe("Reference to unlock requirement"),
    unlockValue: z.number().optional().describe("Unlock cost"),
    notes: z.string().optional().describe("Design notes"),
  };
  pair("economy_link", "economyLink", "economy link (buy/sell prices)", economyLinkFields, optional(economyLinkFields));

  // ── 4. Global Variable ──────────────────────────────────────────

  const globalVariableFields = {
    key: z.string().describe("Variable key (e.g. drop_rate_bonus)"),
    displayName: z.string().describe("Display name"),
    valueType: z.enum(["percent", "multiplier", "flat", "boolean"]).describe("Value type"),
    defaultValue: z.union([z.number(), z.boolean()]).describe("Default value"),
    scope: z.enum(["global", "mode", "event", "season"]).default("global").describe("Variable scope"),
    notes: z.string().optional().describe("Design notes"),
  };
  pair("global_variable", "globalVariable", "global variable", globalVariableFields, optional(globalVariableFields));

  // ── 5. Progression Table ────────────────────────────────────────

  const progressionColumnSchema = z.object({
    id: z.string().describe("Column ID"),
    name: z.string().describe("Column name"),
    decimals: z.number().optional().default(0),
    isPercentage: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    generator: z.object({
      mode: z.enum(["manual", "linear", "exponential", "formula"]),
      base: z.number().optional(),
      step: z.number().optional(),
      growth: z.number().optional(),
      bias: z.number().optional().describe("Linear and exponential only — curve shape. 1.0 = pure linear/exponential, >1 slow early/fast late, <1 fast early/flat late. Endpoints are always preserved."),
      expression: z.string().optional(),
      baseColumnId: z.string().optional(),
    }).optional().describe("Auto-generation config"),
  });

  const progressionRowSchema = z.object({
    level: z.number(),
    values: z.record(z.union([z.number(), z.string()])),
  });

  const progressionTableFields = {
    startLevel: z.number().default(1).describe("First level"),
    endLevel: z.number().default(20).describe("Last level"),
    columns: z.array(progressionColumnSchema).describe("Table columns"),
    rows: z.array(progressionRowSchema).optional().describe("Row data (auto-generated if omitted)"),
  };
  pair("progression_table", "progressionTable", "progression/balance table", progressionTableFields, optional(progressionTableFields));

  // ── 6. XP Balance ───────────────────────────────────────────────

  const xpBalanceFields = {
    mode: z.enum(["preset", "advanced"]).default("preset").describe("Formula mode"),
    preset: z.enum(["linear", "exponential", "tiered", "softCap", "hardCap"]).default("exponential").describe("Curve preset"),
    expression: z.string().default("").describe("Custom expression (advanced mode)"),
    startLevel: z.number().default(1).describe("First level"),
    endLevel: z.number().default(100).describe("Last level"),
    decimals: z.number().default(0).describe("Decimal places"),
    clampMin: z.number().optional().describe("Minimum value clamp"),
    clampMax: z.number().optional().describe("Maximum value clamp"),
    base: z.number().default(100).describe("Base XP value"),
    growth: z.number().default(1.15).describe("Growth factor"),
    offset: z.number().default(0).describe("Offset"),
    tierStep: z.number().default(10).describe("Tier step size"),
    tierMultiplier: z.number().default(1.5).describe("Tier multiplier"),
  };
  // For xpBalance, the params are nested under a `params` object in the API
  server.tool(
    "create_xp_balance_addon",
    "Create an XP balance curve addon",
    {
      ...projSec,
      name: z.string().describe("Display name"),
      group: z.string().optional().describe("Optional group name"),
      ...xpBalanceFields,
    },
    async ({ projectId, sectionId, name, group, base, growth, offset, tierStep, tierMultiplier, ...rest }) => {
      try {
        return json(await client.createAddon(projectId, sectionId, {
          type: "xpBalance",
          name,
          ...(group ? { group } : {}),
          data: {
            ...rest,
            params: { base, growth, offset, tierStep, tierMultiplier },
          },
        }));
      } catch (e) { return err(e); }
    },
  );

  server.tool(
    "update_xp_balance_addon",
    "Update an XP balance curve addon",
    {
      ...projSecAddon,
      name: z.string().optional().describe("New display name"),
      group: z.string().optional().describe("New group name"),
      mode: z.enum(["preset", "advanced"]).optional().describe("Formula mode"),
      preset: z.enum(["linear", "exponential", "tiered", "softCap", "hardCap"]).optional().describe("Curve preset"),
      expression: z.string().optional().describe("Custom expression (advanced mode)"),
      startLevel: z.number().optional().describe("First level"),
      endLevel: z.number().optional().describe("Last level"),
      decimals: z.number().optional().describe("Decimal places"),
      clampMin: z.number().optional().describe("Minimum value clamp"),
      clampMax: z.number().optional().describe("Maximum value clamp"),
      base: z.number().optional().describe("Base XP value"),
      growth: z.number().optional().describe("Growth factor"),
      offset: z.number().optional().describe("Offset"),
      tierStep: z.number().optional().describe("Tier step size"),
      tierMultiplier: z.number().optional().describe("Tier multiplier"),
    },
    async ({ projectId, sectionId, addonId, name, group, base, growth, offset, tierStep, tierMultiplier, ...rest }) => {
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
        return json(await client.updateAddon(projectId, sectionId, addonId, fields));
      } catch (e) { return err(e); }
    },
  );

  // ── 7. Production ───────────────────────────────────────────────

  const ingredientSchema = z.object({
    itemRef: z.string().describe("Section ID of the item"),
    quantity: z.number().describe("Required quantity"),
  });

  const outputSchema = z.object({
    itemRef: z.string().describe("Section ID of the output item"),
    quantity: z.number().describe("Output quantity"),
  });

  const productionFields = {
    mode: z.enum(["passive", "recipe"]).default("passive").describe("Production mode"),
    outputRef: z.string().optional().describe("Output item section ID (passive mode)"),
    minOutput: z.number().optional().default(1).describe("Minimum output quantity"),
    maxOutput: z.number().optional().default(1).describe("Maximum output quantity"),
    intervalSeconds: z.number().optional().default(60).describe("Production interval in seconds"),
    requiresCollection: z.boolean().optional().default(false).describe("Requires manual collection?"),
    capacity: z.number().optional().describe("Storage capacity"),
    ingredients: z.array(ingredientSchema).optional().default([]).describe("Recipe ingredients"),
    outputs: z.array(outputSchema).optional().default([]).describe("Recipe outputs"),
    craftTimeSeconds: z.number().optional().default(60).describe("Craft time in seconds"),
    notes: z.string().optional().describe("Design notes"),
  };
  pair("production", "production", "production (passive or recipe)", productionFields, optional(productionFields));

  // ── 8. Data Schema ──────────────────────────────────────────────

  const dataSchemaEntrySchema = z.object({
    id: z.string().optional().describe("Entry ID (auto-generated if omitted)"),
    key: z.string().describe("Data key (e.g. max_hp)"),
    label: z.string().describe("Display label"),
    valueType: z.enum(["int", "float", "seconds", "percent", "boolean", "string"]).describe("Value type"),
    value: z.union([z.number(), z.boolean(), z.string()]).describe("Default value"),
    min: z.number().optional().describe("Minimum value"),
    max: z.number().optional().describe("Maximum value"),
    unit: z.string().optional().describe("Display unit (e.g. 'hp', 's')"),
    notes: z.string().optional().describe("Design notes"),
  });

  const dataSchemaFields = {
    entries: z.array(dataSchemaEntrySchema).describe("Data entries"),
  };
  pair("data_schema", "dataSchema", "data schema (key-value stats)", dataSchemaFields, optional(dataSchemaFields));

  // ── 9. Attribute Definitions ────────────────────────────────────

  const attrDefEntrySchema = z.object({
    id: z.string().optional().describe("Attribute ID (auto-generated if omitted)"),
    key: z.string().describe("Attribute key (e.g. strength)"),
    label: z.string().describe("Display label"),
    valueType: z.enum(["int", "float", "percent", "boolean"]).describe("Value type"),
    defaultValue: z.union([z.number(), z.boolean()]).describe("Default value"),
    min: z.number().optional().describe("Minimum value"),
    max: z.number().optional().describe("Maximum value"),
    unit: z.string().optional().describe("Display unit"),
  });

  const attrDefsFields = {
    attributes: z.array(attrDefEntrySchema).describe("Attribute definitions"),
  };
  pair("attribute_definitions", "attributeDefinitions", "attribute definitions (STR, DEX, etc.)", attrDefsFields, optional(attrDefsFields));

  // ── 10. Attribute Profile ───────────────────────────────────────

  const attrProfileValueSchema = z.object({
    id: z.string().optional().describe("Value entry ID"),
    attributeKey: z.string().describe("Attribute key from definitions"),
    value: z.union([z.number(), z.boolean()]).describe("Attribute value"),
  });

  const attrProfileFields = {
    definitionsRef: z.string().optional().describe("Section ID of the attribute definitions addon"),
    values: z.array(attrProfileValueSchema).describe("Attribute values"),
  };
  pair("attribute_profile", "attributeProfile", "attribute profile (character stats)", attrProfileFields, optional(attrProfileFields));

  // ── 11. Attribute Modifiers ─────────────────────────────────────

  const attrModEntrySchema = z.object({
    id: z.string().optional().describe("Modifier ID"),
    attributeKey: z.string().describe("Attribute key to modify"),
    mode: z.enum(["add", "mult", "set"]).describe("Modifier mode (add, multiply, or set)"),
    value: z.union([z.number(), z.boolean()]).describe("Modifier value"),
  });

  const attrModsFields = {
    definitionsRef: z.string().optional().describe("Section ID of the attribute definitions addon"),
    modifiers: z.array(attrModEntrySchema).describe("Attribute modifiers"),
  };
  pair("attribute_modifiers", "attributeModifiers", "attribute modifiers (+10 STR, x1.5 DEX)", attrModsFields, optional(attrModsFields));

  // ── 12. Export Schema ───────────────────────────────────────────

  const exportSchemaNodeSchema: z.ZodTypeAny = z.lazy(() =>
    z.object({
      id: z.string().optional().describe("Node ID"),
      key: z.string().describe("JSON key"),
      nodeType: z.enum(["object", "array", "value"]).describe("Node type"),
      children: z.array(exportSchemaNodeSchema).optional().describe("Child nodes (for object type)"),
      binding: z.object({
        source: z.enum(["manual", "dataSchema", "rowLevel", "rowColumn"]),
        value: z.union([z.string(), z.number(), z.boolean()]).optional(),
        valueType: z.enum(["string", "number", "boolean"]).optional(),
        addonId: z.string().optional(),
        entryKey: z.string().optional(),
        columnId: z.string().optional(),
      }).optional().describe("Value binding"),
    }),
  );

  const exportSchemaFields = {
    nodes: z.array(exportSchemaNodeSchema).describe("Export schema tree nodes"),
    arrayFormat: z.enum(["rowMajor", "columnMajor", "keyedByLevel", "matrix"]).optional().describe("Array output format"),
  };
  pair("export_schema", "exportSchema", "export/remote config schema", exportSchemaFields, optional(exportSchemaFields));
}
