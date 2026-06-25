/**
 * Type-specific MCP tools for each addon type.
 *
 * 12 types × 2 (create + update) = 24 tools.
 * Each tool fixes the addon `type` and provides a typed schema for `data`,
 * then delegates to the generic addon API endpoint.
 */
import { z } from "zod/v3";
import { GddApiError } from "./client.js";
function json(data) {
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function err(e) {
    if (e instanceof GddApiError) {
        return { content: [{ type: "text", text: `Error (${e.code}): ${e.message}` }], isError: true };
    }
    return { content: [{ type: "text", text: String(e) }], isError: true };
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
export function registerAddonTools(server, client) {
    // ── Helper to register a create + update pair ──────────────────
    function pair(typeName, addonType, description, createFields, updateFields) {
        // CREATE
        server.tool(`create_${typeName}_addon`, `Create a ${description} addon`, {
            ...projSec,
            name: z.string().describe("Display name for the addon"),
            group: z.string().optional().describe("Optional group name"),
            ...createFields,
        }, async ({ projectId, sectionId, name, group, ...data }) => {
            try {
                return json(await client.createAddon(projectId, sectionId, {
                    type: addonType,
                    name,
                    ...(group ? { group } : {}),
                    data,
                }));
            }
            catch (e) {
                return err(e);
            }
        });
        // UPDATE
        server.tool(`update_${typeName}_addon`, `Update a ${description} addon`, {
            ...projSecAddon,
            name: z.string().optional().describe("New display name"),
            group: z.string().optional().describe("New group name"),
            ...updateFields,
        }, async ({ projectId, sectionId, addonId, name, group, ...data }) => {
            try {
                const fields = {};
                if (name !== undefined)
                    fields.name = name;
                if (group !== undefined)
                    fields.group = group;
                if (Object.keys(data).length > 0)
                    fields.data = data;
                return json(await client.updateAddon(projectId, sectionId, addonId, fields));
            }
            catch (e) {
                return err(e);
            }
        });
    }
    // Helper to make all fields in a record optional
    function optional(fields) {
        const result = {};
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
    // Optional Google Sheets binding for a boolean field. The in-app "Sincronizar tudo"
    // reads the cell and overwrites the scalar (TRUE/1/YES/SIM → true). cellRef is the
    // fallback position; use rowLock "auto" to anchor the row to the page DataID so many
    // items can bind to one column at once.
    const sheetsBoolBinding = z.object({
        source: z.literal("sheets"),
        ref: z.object({
            sheetName: z.string().describe("Sheet/tab name"),
            cellRef: z.string().describe('Fallback position, e.g. "C2". Required even with locks.'),
            columnLock: z.string().optional().describe("Column header name (resolves the column by name)."),
            rowLock: z.string().optional().describe('"auto" = page DataID; or a fixed value matched in column A.'),
        }),
    }).optional();
    const inventoryFields = {
        weight: z.number().default(0).describe("Item weight"),
        stackable: z.boolean().default(true).describe("Can items stack?"),
        maxStack: z.number().default(99).describe("Max stack size"),
        inventoryCategory: z.string().default("").describe("Category (e.g. weapon, food, material). Ignored when categoryLibraryRef is set — the Library entry's label takes precedence."),
        categoryLibraryRef: z.object({
            libraryAddonId: z.string().describe("Outer ID of the Field Library addon"),
            entryId: z.string().describe("Entry ID inside the Field Library"),
        }).optional().describe("Bind the category to a Field Library entry — keeps category names consistent across items."),
        slotSize: z.number().default(1).describe("Inventory slots occupied"),
        hasDurabilityConfig: z.boolean().optional().describe("Toggle: show/hide the durability config. When false, durability/maxDurability are ignored by the UI."),
        durability: z.number().default(0).describe("Base durability (0 = no durability)"),
        maxDurability: z.number().optional().describe("Maximum durability; present only when hasDurabilityConfig is true."),
        hasVolumeConfig: z.boolean().optional().describe("Toggle: show/hide the volume config."),
        volume: z.number().optional().describe("Item volume; present only when hasVolumeConfig is true."),
        bindType: z.enum(["none", "onPickup", "onEquip"]).default("none").describe("Bind on pickup/equip"),
        showInShop: z.boolean().default(true).describe("Visible in shop?"),
        showInShopBinding: sheetsBoolBinding.describe("Optional Google Sheets binding for showInShop."),
        consumable: z.boolean().default(false).describe("Is consumable?"),
        consumableBinding: sheetsBoolBinding.describe("Optional Google Sheets binding for consumable."),
        discardable: z.boolean().default(true).describe("Can be discarded?"),
        discardableBinding: sheetsBoolBinding.describe("Optional Google Sheets binding for discardable."),
        notes: z.string().optional().describe("Design notes"),
    };
    pair("inventory", "inventory", "inventory item", inventoryFields, optional(inventoryFields));
    // ── 3. Economy Link ─────────────────────────────────────────────
    const progressionLinkSchema = z.object({
        progressionAddonId: z.string(),
        columnId: z.string(),
        columnName: z.string(),
    }).optional();
    const economyLinkFields = {
        hasBuyConfig: z.boolean().optional().default(true).describe("Enable buy configuration"),
        buyCurrencyRef: z.string().optional().describe("Currency section ID for buy price"),
        buyValue: z.number().optional().describe("Buy price"),
        buyValueProgressionLink: progressionLinkSchema.describe("Link buyValue to a progression table column (resolved by unlockValue)"),
        minBuyValue: z.number().optional().describe("Minimum buy price"),
        minBuyValueProgressionLink: progressionLinkSchema.describe("Link minBuyValue to a progression table column"),
        maxBuyValue: z.number().optional().describe("Maximum buy price"),
        maxBuyValueProgressionLink: progressionLinkSchema.describe("Link maxBuyValue to a progression table column"),
        hasSellConfig: z.boolean().optional().default(true).describe("Enable sell configuration"),
        sellCurrencyRef: z.string().optional().describe("Currency section ID for sell price"),
        sellValue: z.number().optional().describe("Sell price"),
        sellValueProgressionLink: progressionLinkSchema.describe("Link sellValue to a progression table column"),
        minSellValue: z.number().optional().describe("Minimum sell price"),
        minSellValueProgressionLink: progressionLinkSchema.describe("Link minSellValue to a progression table column"),
        maxSellValue: z.number().optional().describe("Maximum sell price"),
        maxSellValueProgressionLink: progressionLinkSchema.describe("Link maxSellValue to a progression table column"),
        priceMultiplier: z.number().optional().describe("Multiplier applied to all buy/sell values (table or fixed). Default 1."),
        hasProductionConfig: z.boolean().optional().default(false).describe("Enable production config"),
        hasUnlockConfig: z.boolean().optional().default(false).describe("Enable unlock config"),
        unlockRef: z.string().optional().describe("Reference to unlock requirement"),
        unlockValue: z.number().optional().describe("Unlock cost"),
        unlockValueMin: z.number().optional().describe("Minimum unlock cost"),
        unlockValueMax: z.number().optional().describe("Maximum unlock cost"),
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
        name: z.string().describe("Column name. Ignored when libraryRef is set — the Library entry's label takes precedence."),
        libraryRef: z.object({
            libraryAddonId: z.string().describe("Outer ID of the Field Library addon"),
            entryId: z.string().describe("Entry ID inside the Field Library"),
        }).optional().describe("Bind the column name to a Field Library entry — keeps column names consistent across tables (and with Attribute Definitions / Data Schema)."),
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
            expression: z.string().optional().describe("Formula mode only — expression evaluated per level."),
            baseColumnId: z.string().optional().describe("Formula mode only — column whose values drive the expression variables."),
            baseManualValue: z.number().optional().describe("Formula mode only — fallback constant used when baseColumnId resolves to empty."),
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
        overrides: z.record(z.record(z.number())).optional().describe("Manual cell overrides: overrides[levelString][columnId] = value. Cells with overrides are preserved when regenerating."),
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
    server.tool("create_xp_balance_addon", "Create an XP balance curve addon", {
        ...projSec,
        name: z.string().describe("Display name"),
        group: z.string().optional().describe("Optional group name"),
        ...xpBalanceFields,
    }, async ({ projectId, sectionId, name, group, base, growth, offset, tierStep, tierMultiplier, ...rest }) => {
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
        }
        catch (e) {
            return err(e);
        }
    });
    server.tool("update_xp_balance_addon", "Update an XP balance curve addon", {
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
    }, async ({ projectId, sectionId, addonId, name, group, base, growth, offset, tierStep, tierMultiplier, ...rest }) => {
        try {
            const fields = {};
            if (name !== undefined)
                fields.name = name;
            if (group !== undefined)
                fields.group = group;
            const data = { ...rest };
            const params = {};
            if (base !== undefined)
                params.base = base;
            if (growth !== undefined)
                params.growth = growth;
            if (offset !== undefined)
                params.offset = offset;
            if (tierStep !== undefined)
                params.tierStep = tierStep;
            if (tierMultiplier !== undefined)
                params.tierMultiplier = tierMultiplier;
            if (Object.keys(params).length > 0)
                data.params = params;
            if (Object.keys(data).length > 0)
                fields.data = data;
            return json(await client.updateAddon(projectId, sectionId, addonId, fields));
        }
        catch (e) {
            return err(e);
        }
    });
    // ── 7. Production ───────────────────────────────────────────────
    const ingredientSchema = z.object({
        itemRef: z.string().describe("Section ID of the item"),
        quantity: z.number().describe("Required quantity"),
    });
    const outputSchema = z.object({
        itemRef: z.string().describe("Section ID of the output item"),
        quantity: z.number().describe("Output quantity"),
    });
    // Production values (min/max output, interval, craft time) can optionally
    // be scaled per-level by linking to a progression table column. When linked,
    // the scalar field is populated from the progression row at runtime.
    const productionProgressionLinkSchema = z.object({
        progressionAddonId: z.string().describe("Outer ID of the progressionTable addon supplying values"),
        columnId: z.string().describe("Column ID inside that progression table"),
        columnName: z.string().describe("Cached column name for display"),
    });
    const productionFields = {
        mode: z.enum(["passive", "recipe"]).default("passive").describe("Production mode"),
        outputRef: z.string().optional().describe("Output item section ID (passive mode)"),
        minOutput: z.number().optional().default(1).describe("Minimum output quantity"),
        minOutputProgressionLink: productionProgressionLinkSchema.optional().describe("Link minOutput to a progression table column (level-scaled)."),
        maxOutput: z.number().optional().default(1).describe("Maximum output quantity"),
        maxOutputProgressionLink: productionProgressionLinkSchema.optional().describe("Link maxOutput to a progression table column (level-scaled)."),
        intervalSeconds: z.number().optional().default(60).describe("Production interval in seconds"),
        intervalSecondsProgressionLink: productionProgressionLinkSchema.optional().describe("Link intervalSeconds to a progression table column (level-scaled)."),
        requiresCollection: z.boolean().optional().default(false).describe("Requires manual collection?"),
        capacity: z.number().optional().describe("Storage capacity"),
        ingredients: z.array(ingredientSchema).optional().default([]).describe("Recipe ingredients"),
        outputs: z.array(outputSchema).optional().default([]).describe("Recipe outputs"),
        craftTimeSeconds: z.number().optional().default(60).describe("Craft time in seconds"),
        craftTimeSecondsProgressionLink: productionProgressionLinkSchema.optional().describe("Link craftTimeSeconds to a progression table column (level-scaled)."),
        notes: z.string().optional().describe("Design notes"),
    };
    pair("production", "production", "production (passive or recipe)", productionFields, optional(productionFields));
    // ── 7b. Craft Table ─────────────────────────────────────────────
    const craftTableUnlockSchema = z.object({
        level: z.object({
            enabled: z.boolean(),
            xpAddonRef: z.string().optional().describe("Section ID of the XP Balance addon"),
            level: z.number().optional().describe("Required level"),
        }).optional(),
        currency: z.object({
            enabled: z.boolean(),
            currencyAddonRef: z.string().optional().describe("Section ID of the Currency addon"),
            amount: z.number().optional().describe("Required amount"),
        }).optional(),
        item: z.object({
            enabled: z.boolean(),
            itemRef: z.string().optional().describe("Section ID of the item (Inventory addon)"),
            quantity: z.number().optional().describe("Required quantity"),
        }).optional(),
    });
    const craftTableEntrySchema = z.object({
        id: z.string().optional().describe("Entry ID (auto-generated if omitted)"),
        productionRef: z.string().optional().describe("Section ID of the Production addon (recipe)"),
        category: z.string().optional().describe("Category label (free text; shared across entries in this table)"),
        order: z.number().describe("Display order"),
        unlock: craftTableUnlockSchema.optional().describe("Unlock conditions (AND of enabled slots; none enabled = always unlocked)"),
        hidden: z.boolean().optional().describe("Hide entry without deleting"),
    });
    const craftTableFields = {
        entries: z.array(craftTableEntrySchema).default([]).describe("Recipes available on this table"),
    };
    pair("craft_table", "craftTable", "craft table (station aggregating Production recipes with unlock conditions)", craftTableFields, optional(craftTableFields));
    // ── 7c. Crop (Plantar e Colher) ─────────────────────────────────
    const cropXpEventSchema = z.object({
        xpAddonRef: z.string().optional().describe("Section ID of the XP Balance addon that tracks this XP pool"),
        xp: z.number().optional().describe("XP amount awarded"),
    }).describe("XP event (plant or harvest)");
    const cropStageSchema = z.object({
        id: z.string().optional().describe("Stage ID (auto-generated if omitted)"),
        label: z.string().describe("Stage label (e.g. 'Broto', 'Crescendo', 'Maduro')"),
        secondsFromPlanting: z.number().describe("Seconds after planting when this stage begins"),
    });
    const cropOutputSchema = z.object({
        id: z.string().optional().describe("Output row ID (auto-generated if omitted)"),
        itemRef: z.string().optional().describe("Section ID of the harvested item"),
        quantity: z.number().optional().describe("Base yield per harvest"),
        quantityMin: z.number().optional().describe("Minimum yield"),
        quantityMax: z.number().optional().describe("Maximum yield"),
    });
    const cropItemInputSchema = z.object({
        id: z.string().optional().describe("Input row ID (auto-generated if omitted)"),
        itemRef: z.string().optional().describe("Section ID of the consumable item"),
    });
    const cropFields = {
        harvestMode: z.enum(["instant", "progressive"]).default("instant").describe("'instant' = single harvest, plant dies. 'progressive' = multiple harvest cycles over the same planting."),
        growthSeconds: z.number().optional().describe("Base growth time in seconds"),
        growthSecondsMin: z.number().optional().describe("Minimum growth time (lower bound)"),
        growthSecondsMax: z.number().optional().describe("Maximum growth time (upper bound)"),
        totalHarvest: z.number().optional().describe("Number of harvest cycles (progressive mode only)"),
        totalHarvestMin: z.number().optional().describe("Minimum harvest cycles (progressive only)"),
        totalHarvestMax: z.number().optional().describe("Maximum harvest cycles (progressive only)"),
        stages: z.array(cropStageSchema).default([]).describe("Visual growth stages (progressive mode)"),
        outputs: z.array(cropOutputSchema).default([]).describe("Items produced on each harvest"),
        plantXp: cropXpEventSchema.optional().describe("XP awarded when planting"),
        harvestXp: cropXpEventSchema.optional().describe("XP awarded when harvesting"),
        spawnWitheredPlant: z.boolean().default(false).describe("Spawn a post-harvest page when the plant expires"),
        witheredPlantRef: z.string().optional().describe("Section ID of the page to spawn after expiry"),
        seedRef: z.string().optional().describe("Section ID of the seed item, or '__self__' to use this page as its own seed"),
        seedQuantity: z.number().optional().describe("Base seed cost"),
        seedQuantityMin: z.number().optional().describe("Minimum seed cost"),
        seedQuantityMax: z.number().optional().describe("Maximum seed cost"),
        plantEnergy: z.number().optional().describe("Energy consumed when planting"),
        plantEnergyMin: z.number().optional().describe("Minimum energy cost"),
        plantEnergyMax: z.number().optional().describe("Maximum energy cost"),
        fertilizers: z.array(cropItemInputSchema).default([]).describe("Fertilizer items accepted by this crop"),
        amendments: z.array(cropItemInputSchema).default([]).describe("Soil amendment items accepted by this crop"),
        seasons: z.array(z.enum(["spring", "summer", "fall", "winter", "greenhouse"])).optional().describe("Seasons in which this crop can be planted"),
        notes: z.string().optional().describe("Design notes"),
    };
    pair("crop", "crop", "crop / plant-and-harvest mechanic", cropFields, optional(cropFields));
    // ── 8. Data Schema ──────────────────────────────────────────────
    // Data schema entries can SOURCE their value from several places instead
    // of storing it directly. At most one source should be set at a time.
    const economyLinkFieldEnum = z.enum([
        "buyValue",
        "minBuyValue",
        "maxBuyValue",
        "sellValue",
        "minSellValue",
        "maxSellValue",
        "unlockValue",
        "unlockValueMin",
        "unlockValueMax",
        "buyCurrencyRef",
        "sellCurrencyRef",
        "buyCurrencyKey",
        "sellCurrencyKey",
    ]);
    const productionFieldEnum = z.enum([
        "minOutput",
        "maxOutput",
        "intervalSeconds",
        "intervalSecondsMin",
        "intervalSecondsMax",
        "craftTimeSeconds",
        "craftTimeSecondsMin",
        "craftTimeSecondsMax",
        "capacity",
        "capacityMin",
        "capacityMax",
        "outputBuyEffective",
        "outputMinBuyValue",
        "outputSellEffective",
        "outputMaxSellValue",
        "outputUnlockValue",
    ]);
    const dataSchemaEntrySchema = z.object({
        id: z.string().optional().describe("Entry ID (auto-generated if omitted)"),
        key: z.string().describe("Data key (e.g. max_hp). Ignored when libraryRef is set — the Library entry's key takes precedence."),
        label: z.string().describe("Display label. Ignored when libraryRef is set."),
        libraryRef: z.object({
            libraryAddonId: z.string().describe("Outer ID of the Field Library addon"),
            entryId: z.string().describe("Entry ID inside the Field Library"),
        }).optional().describe("Bind key/label to a Field Library entry — keeps names consistent across schemas."),
        valueType: z.enum(["int", "float", "seconds", "percent", "boolean", "string"]).describe("Value type"),
        value: z.union([z.number(), z.boolean(), z.string()]).describe("Default value (ignored when a source ref is set)"),
        min: z.number().optional().describe("Minimum value"),
        max: z.number().optional().describe("Maximum value"),
        unit: z.string().optional().describe("Display unit (e.g. 'hp', 's')"),
        unitXpRef: z.string().optional().describe("Section ID of an xpBalance addon — shows unit as XP per level."),
        economyLinkRef: z.string().optional().describe("Section ID that has an economyLink addon — sources the value from it."),
        economyLinkField: economyLinkFieldEnum.optional().describe("Which field from the Economy Link addon to pull."),
        productionRef: z.string().optional().describe("Addon ID of a Production addon in the same section — sources the value from it."),
        productionField: productionFieldEnum.optional().describe("Which field from the Production addon to pull."),
        usePageDataId: z.boolean().optional().describe("When true, value is derived from the section's dataId field."),
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
        name: z.string().optional().describe("Optional display name (e.g. 'Fireball impact'). Falls back to auto-formatted label when empty."),
        attributeKey: z.string().describe("Attribute key to modify"),
        mode: z.enum(["add", "mult", "set"]).describe("Modifier mode (add, multiply, or set)"),
        value: z.union([z.number(), z.boolean()]).describe("Modifier value"),
    });
    const attrModsFields = {
        definitionsRef: z.string().optional().describe("Section ID of the attribute definitions addon"),
        modifiers: z.array(attrModEntrySchema).describe("Attribute modifiers"),
    };
    pair("attribute_modifiers", "attributeModifiers", "attribute modifiers (+10 STR, x1.5 DEX)", attrModsFields, optional(attrModsFields));
    // ── 12. Field Library ───────────────────────────────────────────
    const fieldLibraryEntrySchema = z.object({
        id: z.string().optional().describe("Entry ID (auto-generated if omitted)"),
        key: z.string().describe("Field key (e.g. sell_price). Used in the exported JSON."),
        label: z.string().describe("Display name for the field"),
        description: z.string().optional().describe("Optional description of what this field means"),
    });
    const fieldLibraryFields = {
        entries: z.array(fieldLibraryEntrySchema).describe("Reusable field definitions"),
    };
    pair("field_library", "fieldLibrary", "field library (reusable field definitions for progression tables and data schemas)", fieldLibraryFields, optional(fieldLibraryFields));
    // ── 13. Export Schema ───────────────────────────────────────────
    const exportSchemaBindingSchema = z.object({
        source: z.enum([
            "manual",
            "dataSchema",
            "rowLevel",
            "rowColumn",
            // craftTable-scoped
            "entryField",
            "productionField",
            "itemField",
            // skills-scoped
            "skillField",
            "skillCostField",
            "skillEffectField",
        ]).describe("Binding source. 'rowLevel' / 'rowColumn' are valid only inside a " +
            "progressionTable array. 'entryField' is valid inside a craftTable array. " +
            "'productionField' is valid inside a craftTable array (follows entry.productionRef). " +
            "'itemField' is valid inside productionIngredients/productionOutputs arrays. " +
            "'skillField' is valid inside a skills array (or any descendant of one). " +
            "'skillCostField' is valid inside a skillCosts array. " +
            "'skillEffectField' is valid inside a skillEffects array."),
        // source: manual
        value: z.union([z.string(), z.number(), z.boolean()]).optional(),
        valueType: z.enum(["string", "number", "boolean"]).optional(),
        // source: dataSchema
        addonId: z.string().optional(),
        addonName: z.string().optional(),
        entryKey: z.string().optional(),
        entryId: z.string().optional(),
        // source: rowColumn
        columnId: z.string().optional(),
        // source: entryField | productionField | itemField | skill*Field
        field: z.string().optional().describe("entryField: order|productionRef|category|hidden|unlockLevelEnabled|unlockLevel|" +
            "unlockLevelXpRef|unlockCurrencyEnabled|unlockCurrencyAmount|unlockCurrencyRef|" +
            "unlockItemEnabled|unlockItemQuantity|unlockItemRef. " +
            "productionField: name|mode|craftTimeSeconds|minOutput|maxOutput|intervalSeconds|" +
            "capacity|requiresCollection|outputRef. " +
            "itemField: itemRef|quantity. " +
            "skillField: id|name|kind|description|cooldownSeconds|tagsCsv|unlockLevelEnabled|" +
            "unlockLevel|unlockLevelXpRef|unlockCurrencyEnabled|unlockCurrencyAmount|" +
            "unlockCurrencyRef|unlockItemEnabled|unlockItemQuantity|unlockItemRef. " +
            "skillCostField: id|type|amount|currencyRef|definitionsRef|attributeKey. " +
            "skillEffectField: id|attributeModifiersSectionId|attributeModifiersAddonId|" +
            "modifierEntryId|resolvedName|resolvedMode|resolvedAttributeKey|resolvedDefinitionsRef|" +
            "resolvedValue|resolvedTemporary|resolvedDurationSeconds|resolvedTickIntervalSeconds|" +
            "resolvedStacking|resolvedCategory."),
    }).describe("Value binding");
    const exportSchemaArraySourceSchema = z.object({
        type: z.enum([
            "progressionTable",
            "craftTable",
            "productionIngredients",
            "productionOutputs",
            "skills",
            "skillCosts",
            "skillEffects",
            "sections",
        ]).describe("'progressionTable', 'craftTable' and 'skills' require addonId. " +
            "'productionIngredients' and 'productionOutputs' follow the current craftTable entry's " +
            "production and do not take an addonId (must be nested inside a craftTable array node). " +
            "'skillCosts' and 'skillEffects' follow the current skills entry and do not take an " +
            "addonId (must be nested inside a skills array node). " +
            "'sections' iterates the child sections of parentSectionId, resolving the itemTemplate " +
            "against each child's own addons (one object per child page — e.g. aggregate every seed " +
            "page under a parent into a single array). Bindings resolve via addonName + entryKey " +
            "fallback, so a template authored against one child resolves across all siblings."),
        addonId: z.string().optional().describe("Section ID of the target addon (progressionTable, craftTable or skills)"),
        addonName: z.string().optional().describe("Fallback match by name when used in templates"),
        parentSectionId: z.string().optional().describe("Parent section ID whose child sections are iterated (required for type 'sections')"),
        parentSectionName: z.string().optional().describe("Display name of the parent section (optional, for readability)"),
    }).describe("Array iteration source");
    const exportSchemaNodeSchema = z.lazy(() => z.object({
        id: z.string().optional().describe("Node ID"),
        key: z.string().describe("JSON key"),
        nodeType: z.enum(["object", "array", "value"]).describe("Node type"),
        children: z.array(exportSchemaNodeSchema).optional().describe("Child nodes (for object type)"),
        // array node
        arraySource: exportSchemaArraySourceSchema.optional().describe("Iteration source (for array type)"),
        itemTemplate: z.array(exportSchemaNodeSchema).optional().describe("Template applied per iteration (for array type)"),
        // value node
        binding: exportSchemaBindingSchema.optional(),
        abs: z.boolean().optional().describe("Apply Math.abs to the resolved numeric value"),
        multiplier: z.number().optional().describe("Multiply the resolved numeric value by this factor"),
    }));
    const exportSchemaFields = {
        nodes: z.array(exportSchemaNodeSchema).describe("Export schema tree nodes"),
        arrayFormat: z.enum(["rowMajor", "columnMajor", "keyedByLevel", "matrix"]).optional().describe("Array output format (only applies to progressionTable arrays; craftTable and production " +
            "arrays are always rowMajor)."),
    };
    pair("export_schema", "exportSchema", "export/remote config schema", exportSchemaFields, optional(exportSchemaFields));
    // ── 14. Rich Doc ────────────────────────────────────────────────
    const richDocFields = {
        blocks: z
            .array(z.record(z.string(), z.unknown()))
            .describe("BlockNote document blocks (each block is an object with id/type/props/content/children). Opaque — forwarded as-is."),
        schemaVersion: z.literal(1).optional().describe("Schema version, always 1"),
    };
    pair("rich_doc", "richDoc", "rich document (Notion-style blocks: headings, lists, images, embeds, columns)", richDocFields, optional(richDocFields));
}
//# sourceMappingURL=addon-tools.js.map