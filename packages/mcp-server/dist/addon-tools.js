/**
 * Type-specific MCP tools for each addon type.
 *
 * 12 types × 2 (create + update) = 24 tools.
 * Each tool fixes the addon `type` and provides a typed schema for `data`,
 * then delegates to the generic addon API endpoint.
 */
import { z } from "zod/v3";
import { GddApiError } from "./client.js";
import { addonCreated, addonReceipt, json, touched } from "./project.js";
/** A caller mistake, not a transport failure — say what is missing and stop. */
function fail(message) {
    return { content: [{ type: "text", text: message }], isError: true };
}
function err(e) {
    if (e instanceof GddApiError) {
        return { content: [{ type: "text", text: `Error (${e.code}): ${e.message}` }], isError: true };
    }
    return { content: [{ type: "text", text: String(e) }], isError: true };
}
/** Escape hatch on every write: opt back into the whole saved addon. */
const returning = z
    .enum(["minimal", "full"])
    .optional()
    .describe('"full" echoes the whole saved addon instead of a receipt (default "minimal")');
// Shared params present in every create/update tool
const projSec = {
    projectId: z.string(),
    sectionId: z.string(),
};
export function registerAddonTools(server, client) {
    // ── Helper to register a create + update pair ──────────────────
    /**
     * One tool per addon type instead of a create/update pair.
     *
     * The two schemas were near-identical — update was just the optional version
     * of create — and each one is sent to the model in every request. Merging
     * them halves that. The exposed schema is the all-optional one; create still
     * gets its required fields and zod defaults, applied in the handler.
     */
    function upsert(typeName, addonType, description, createFields, updateFields) {
        const createSchema = z.object(createFields);
        server.tool(`upsert_${typeName}_addon`, `Create or update a ${description} addon. Pass addonId to update an existing addon — only the fields you send change. Omit addonId to create a new one, in which case name and the type's required fields must be present. Returns a receipt; read the stored values back with get_section.`, {
            ...projSec,
            addonId: z.string().optional().describe("Update this addon; omit to create a new one"),
            name: z.string().optional().describe("Display name (required when creating)"),
            group: z.string().optional(),
            ...updateFields,
            returning,
        }, async ({ projectId, sectionId, addonId, name, group, returning: returnMode, ...data }) => {
            try {
                if (addonId) {
                    const fields = {};
                    if (name !== undefined)
                        fields.name = name;
                    if (group !== undefined)
                        fields.group = group;
                    if (Object.keys(data).length > 0)
                        fields.data = data;
                    const saved = await client.updateAddon(projectId, sectionId, addonId, fields);
                    return json(returnMode === "full" ? saved : addonReceipt(saved, sectionId, [...touched({ name, group }), ...Object.keys(data)]));
                }
                if (!name)
                    return fail(`name is required when creating a ${addonType} addon (pass addonId to update an existing one instead)`);
                // Re-parse through the create schema so defaults land and missing
                // required fields are reported rather than written as undefined.
                const parsed = createSchema.safeParse(data);
                if (!parsed.success) {
                    const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
                    return fail(`cannot create a ${addonType} addon — ${problems}`);
                }
                const created = await client.createAddon(projectId, sectionId, {
                    type: addonType,
                    name,
                    ...(group ? { group } : {}),
                    data: parsed.data,
                });
                return json(returnMode === "full" ? created : addonCreated(created, sectionId));
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
    // Reusable Google Sheets binding for a scalar field (boolean or numeric). The in-app
    // "Sincronizar tudo" reads the cell and overwrites the scalar (booleans: TRUE/1/YES/SIM
    // → true). cellRef is the fallback position; use rowLock "auto" to anchor the row to the
    // page DataID so many items can bind to the same column at once. Setting it via MCP only
    // defines the binding — value resolution stays client-side.
    const sheetsBinding = z.object({
        source: z.literal("sheets"),
        ref: z.object({
            sheetName: z.string().describe("Sheet/tab name"),
            cellRef: z.string().describe('Fallback position, e.g. "C2". Required even with locks.'),
            columnLock: z.string().optional().describe("Column header name (resolves the column by name)."),
            rowLock: z.string().optional().describe('"auto" = page DataID; or a fixed value matched in column A.'),
        }),
    }).optional();
    // Reusable binding for a numeric value field. Accepts three sources:
    //  • sheets           — a Google Sheets cell (same shape as sheetsBinding)
    //  • progressionColumn — a ProgressionTable column (level-scaled), intra-section
    //  • library          — a Field Library entry (best for key/label fields; on a numeric
    //                        field its resolved value is the entry, so prefer sheets/progression)
    const valueBinding = z.union([
        z.object({
            source: z.literal("sheets"),
            ref: z.object({
                sheetName: z.string(),
                cellRef: z.string().describe('Fallback position, e.g. "C2". Required even with locks.'),
                columnLock: z.string().optional().describe("Column header name."),
                rowLock: z.string().optional().describe('"auto" = page DataID; or a fixed value in column A.'),
            }),
        }),
        z.object({
            source: z.literal("progressionColumn"),
            progressionAddonId: z.string().describe("Outer ID of the ProgressionTable addon"),
            columnId: z.string().describe("Column ID inside that table"),
            columnName: z.string().describe("Cached column name for display"),
        }),
        z.object({
            source: z.literal("library"),
            libraryAddonId: z.string().describe("Outer ID of the Field Library addon"),
            entryId: z.string().describe("Entry ID inside the Field Library"),
        }),
    ]).optional();
    // ── 1. Currency ─────────────────────────────────────────────────
    const currencyFields = {
        code: z.string().describe("Currency code (e.g. GLD, DIA)"),
        displayName: z.string().describe("Display name shown in-game"),
        kind: z.enum(["soft", "premium", "event", "other"]).describe("Currency category"),
        decimals: z.number().default(0).describe("Decimal places (0 for integer currencies)"),
        notes: z.string().optional().describe("Design notes"),
    };
    upsert("currency", "currency", "currency (in-game money)", currencyFields, optional(currencyFields));
    // ── 2. Inventory ────────────────────────────────────────────────
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
        showInShopBinding: sheetsBinding.describe("Optional Google Sheets binding for showInShop."),
        consumable: z.boolean().default(false).describe("Is consumable?"),
        consumableBinding: sheetsBinding.describe("Optional Google Sheets binding for consumable."),
        discardable: z.boolean().default(true).describe("Can be discarded?"),
        discardableBinding: sheetsBinding.describe("Optional Google Sheets binding for discardable."),
        notes: z.string().optional().describe("Design notes"),
    };
    upsert("inventory", "inventory", "inventory item", inventoryFields, optional(inventoryFields));
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
        buyValueBinding: valueBinding.describe("Optional binding for buyValue (sheets | progressionColumn)."),
        buyValueProgressionLink: progressionLinkSchema.describe("Link buyValue to a progression table column (resolved by unlockValue)"),
        minBuyValue: z.number().optional().describe("Minimum buy price"),
        minBuyValueProgressionLink: progressionLinkSchema.describe("Link minBuyValue to a progression table column"),
        maxBuyValue: z.number().optional().describe("Maximum buy price"),
        maxBuyValueProgressionLink: progressionLinkSchema.describe("Link maxBuyValue to a progression table column"),
        hasSellConfig: z.boolean().optional().default(true).describe("Enable sell configuration"),
        sellCurrencyRef: z.string().optional().describe("Currency section ID for sell price"),
        sellValue: z.number().optional().describe("Sell price"),
        sellValueBinding: valueBinding.describe("Optional binding for sellValue (sheets | progressionColumn)."),
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
        unlockValueBinding: valueBinding.describe("Optional binding for unlockValue (sheets | progressionColumn)."),
        unlockValueMin: z.number().optional().describe("Minimum unlock cost"),
        unlockValueMax: z.number().optional().describe("Maximum unlock cost"),
        notes: z.string().optional().describe("Design notes"),
    };
    upsert("economy_link", "economyLink", "economy link (buy/sell prices)", economyLinkFields, optional(economyLinkFields));
    // ── 4. Global Variable ──────────────────────────────────────────
    const globalVariableFields = {
        key: z.string().describe("Variable key (e.g. drop_rate_bonus)"),
        displayName: z.string().describe("Display name"),
        valueType: z.enum(["percent", "multiplier", "flat", "boolean"]).describe("Value type"),
        defaultValue: z.union([z.number(), z.boolean()]).describe("Default value"),
        scope: z.enum(["global", "mode", "event", "season"]).default("global").describe("Variable scope"),
        notes: z.string().optional().describe("Design notes"),
    };
    upsert("global_variable", "globalVariable", "global variable", globalVariableFields, optional(globalVariableFields));
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
    upsert("progression_table", "progressionTable", "progression/balance table", progressionTableFields, optional(progressionTableFields));
    // ── 6. XP Balance ───────────────────────────────────────────────
    const xpBalanceFields = {
        mode: z.enum(["preset", "advanced"]).default("preset").describe("Formula mode"),
        preset: z.enum(["linear", "exponential", "tiered", "softCap", "hardCap", "diminishingReturns", "piecewise"]).default("exponential").describe("Curve preset"),
        expression: z.string().default("").describe("Custom expression (advanced mode)"),
        startLevel: z.number().default(1).describe("First level"),
        endLevel: z.number().default(100).describe("Last level"),
        decimals: z.number().default(0).describe("Decimal places"),
        clampMin: z.number().optional().describe("Minimum value clamp"),
        clampMax: z.number().optional().describe("Maximum value clamp"),
        startAtZero: z.boolean().optional().describe("When true, the first level costs 0 XP and the curve shifts one step (value = XP to reach this level from the previous). Default false."),
        base: z.number().default(100).describe("Base XP value"),
        growth: z.number().default(1.15).describe("Growth factor"),
        offset: z.number().default(0).describe("Offset"),
        tierStep: z.number().default(10).describe("Tier step size (tiered preset)"),
        tierMultiplier: z.number().default(1.5).describe("Tier multiplier (tiered preset)"),
        capValue: z.number().default(5000).describe("Cap value (softCap/hardCap/diminishingReturns presets)"),
        capStrength: z.number().default(0.08).describe("Cap strength (softCap preset)"),
        plateauStartLevel: z.number().default(60).describe("Plateau start level (piecewise preset)"),
        plateauFactor: z.number().default(0.35).describe("Plateau factor (piecewise preset)"),
    };
    // xpBalance is the one type whose curve params live nested under `params`,
    // so it gets its own upsert instead of going through the generic helper.
    const XP_PARAM_KEYS = ["base", "growth", "offset", "tierStep", "tierMultiplier", "capValue", "capStrength", "plateauStartLevel", "plateauFactor"];
    const xpCreateSchema = z.object(xpBalanceFields);
    server.tool("upsert_xp_balance_addon", "Create or update an XP balance curve addon. Pass addonId to update an existing addon — only the fields you send change. Omit addonId to create a new one, in which case name must be present. Returns a receipt; read the stored curve back with get_section.", {
        ...projSec,
        addonId: z.string().optional().describe("Update this addon; omit to create a new one"),
        name: z.string().optional().describe("Display name (required when creating)"),
        group: z.string().optional(),
        ...optional(xpBalanceFields),
        returning,
    }, async ({ projectId, sectionId, addonId, name, group, returning: returnMode, ...raw }) => {
        try {
            /** Splits the flat args into the addon's own fields and its nested curve params. */
            function split(source, keepUndefined) {
                const data = {};
                const params = {};
                for (const [k, v] of Object.entries(source)) {
                    if (!keepUndefined && v === undefined)
                        continue;
                    (XP_PARAM_KEYS.includes(k) ? params : data)[k] = v;
                }
                return { data, params };
            }
            if (addonId) {
                const fields = {};
                if (name !== undefined)
                    fields.name = name;
                if (group !== undefined)
                    fields.group = group;
                const { data, params } = split(raw, false);
                if (Object.keys(params).length > 0)
                    data.params = params;
                if (Object.keys(data).length > 0)
                    fields.data = data;
                const saved = await client.updateAddon(projectId, sectionId, addonId, fields);
                return json(returnMode === "full" ? saved : addonReceipt(saved, sectionId, [...touched({ name, group }), ...Object.keys(data)]));
            }
            if (!name)
                return fail("name is required when creating an xpBalance addon (pass addonId to update an existing one instead)");
            // Defaults matter more here than anywhere else — a curve with holes in
            // its params does not render.
            const parsed = xpCreateSchema.safeParse(raw);
            if (!parsed.success) {
                const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
                return fail(`cannot create an xpBalance addon — ${problems}`);
            }
            const { data, params } = split(parsed.data, true);
            const created = await client.createAddon(projectId, sectionId, {
                type: "xpBalance",
                name,
                ...(group ? { group } : {}),
                data: { ...data, params },
            });
            return json(returnMode === "full" ? created : addonCreated(created, sectionId));
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
        minOutputBinding: valueBinding.describe("Optional binding for minOutput (sheets | progressionColumn)."),
        minOutputProgressionLink: productionProgressionLinkSchema.optional().describe("Link minOutput to a progression table column (level-scaled)."),
        maxOutput: z.number().optional().default(1).describe("Maximum output quantity"),
        maxOutputBinding: valueBinding.describe("Optional binding for maxOutput (sheets | progressionColumn)."),
        maxOutputProgressionLink: productionProgressionLinkSchema.optional().describe("Link maxOutput to a progression table column (level-scaled)."),
        intervalSeconds: z.number().optional().default(60).describe("Production interval in seconds"),
        intervalSecondsBinding: valueBinding.describe("Optional binding for intervalSeconds (sheets | progressionColumn)."),
        intervalSecondsProgressionLink: productionProgressionLinkSchema.optional().describe("Link intervalSeconds to a progression table column (level-scaled)."),
        requiresCollection: z.boolean().optional().default(false).describe("Requires manual collection?"),
        capacity: z.number().optional().describe("Storage capacity"),
        capacityBinding: valueBinding.describe("Optional binding for capacity (sheets | progressionColumn)."),
        ingredients: z.array(ingredientSchema).optional().default([]).describe("Recipe ingredients"),
        outputs: z.array(outputSchema).optional().default([]).describe("Recipe outputs"),
        craftTimeSeconds: z.number().optional().default(60).describe("Craft time in seconds"),
        craftTimeSecondsBinding: valueBinding.describe("Optional binding for craftTimeSeconds (sheets | progressionColumn)."),
        craftTimeSecondsProgressionLink: productionProgressionLinkSchema.optional().describe("Link craftTimeSeconds to a progression table column (level-scaled)."),
        notes: z.string().optional().describe("Design notes"),
    };
    upsert("production", "production", "production (passive or recipe)", productionFields, optional(productionFields));
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
    upsert("craft_table", "craftTable", "craft table (station aggregating Production recipes with unlock conditions)", craftTableFields, optional(craftTableFields));
    // ── 7c. Crop (Plantar e Colher) ─────────────────────────────────
    const cropXpEventSchema = z.object({
        xpAddonRef: z.string().optional().describe("Section ID of the XP Balance addon that tracks this XP pool"),
        xp: z.number().optional().describe("XP amount awarded"),
        xpBinding: valueBinding.describe("Optional binding for the XP amount (sheets | progressionColumn)."),
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
        quantityBinding: valueBinding.describe("Optional binding for the yield (sheets | progressionColumn)."),
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
        growthSecondsBinding: valueBinding.describe("Optional binding for growthSeconds (sheets | progressionColumn)."),
        growthSecondsMin: z.number().optional().describe("Minimum growth time (lower bound)"),
        growthSecondsMax: z.number().optional().describe("Maximum growth time (upper bound)"),
        totalHarvest: z.number().optional().describe("Number of harvest cycles (progressive mode only)"),
        totalHarvestBinding: valueBinding.describe("Optional binding for totalHarvest (sheets | progressionColumn)."),
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
        seedQuantityBinding: valueBinding.describe("Optional binding for seedQuantity (sheets | progressionColumn)."),
        seedQuantityMin: z.number().optional().describe("Minimum seed cost"),
        seedQuantityMax: z.number().optional().describe("Maximum seed cost"),
        plantEnergy: z.number().optional().describe("Energy consumed when planting"),
        plantEnergyBinding: valueBinding.describe("Optional binding for plantEnergy (sheets | progressionColumn)."),
        plantEnergyMin: z.number().optional().describe("Minimum energy cost"),
        plantEnergyMax: z.number().optional().describe("Maximum energy cost"),
        fertilizers: z.array(cropItemInputSchema).default([]).describe("Fertilizer items accepted by this crop"),
        amendments: z.array(cropItemInputSchema).default([]).describe("Soil amendment items accepted by this crop"),
        seasons: z.array(z.enum(["spring", "summer", "fall", "winter", "greenhouse"])).optional().describe("Seasons in which this crop can be planted"),
        notes: z.string().optional().describe("Design notes"),
    };
    upsert("crop", "crop", "crop / plant-and-harvest mechanic", cropFields, optional(cropFields));
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
    upsert("data_schema", "dataSchema", "data schema (key-value stats)", dataSchemaFields, optional(dataSchemaFields));
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
    upsert("attribute_definitions", "attributeDefinitions", "attribute definitions (STR, DEX, etc.)", attrDefsFields, optional(attrDefsFields));
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
    upsert("attribute_profile", "attributeProfile", "attribute profile (character stats)", attrProfileFields, optional(attrProfileFields));
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
    upsert("attribute_modifiers", "attributeModifiers", "attribute modifiers (+10 STR, x1.5 DEX)", attrModsFields, optional(attrModsFields));
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
    upsert("field_library", "fieldLibrary", "field library (reusable field definitions for progression tables and data schemas)", fieldLibraryFields, optional(fieldLibraryFields));
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
            "'productionField' reads a scalar from a Production addon: inside a craftTable array it " +
            "follows entry.productionRef (no addonId); standalone, set addonId to a Production addon " +
            "on the page to export a recipe directly without a Craft Table. " +
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
            "productionField: name|mode|craftTimeSeconds|outputItemRef|outputQuantity (first output row, " +
            "for flat single-output recipes)|minOutput|maxOutput|intervalSeconds|" +
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
            "xpBalance",
            "craftTable",
            "productionIngredients",
            "productionOutputs",
            "skills",
            "skillCosts",
            "skillEffects",
            "sections",
        ]).describe("'progressionTable', 'xpBalance', 'craftTable' and 'skills' require addonId. " +
            "'xpBalance' iterates the computed level→value curve of an XP Balance addon " +
            "(use rowLevel for the level and rowColumn with columnId 'value' for the XP). " +
            "'productionIngredients' and 'productionOutputs' iterate a Production addon's ingredient/" +
            "output rows. With addonId set they read that Production addon directly (standalone Recipe " +
            "export — no Craft Table needed); without addonId they follow the current craftTable entry's " +
            "production (must then be nested inside a craftTable array node). " +
            "'skillCosts' and 'skillEffects' follow the current skills entry and do not take an " +
            "addonId (must be nested inside a skills array node). " +
            "'sections' iterates the child sections of parentSectionId, resolving the itemTemplate " +
            "against each child's own addons (one object per child page — e.g. aggregate every seed " +
            "page under a parent into a single array). Bindings resolve via addonName + entryKey " +
            "fallback, so a template authored against one child resolves across all siblings."),
        addonId: z.string().optional().describe("Section ID of the target addon (progressionTable, xpBalance, craftTable, skills, or a Production addon for standalone productionIngredients/productionOutputs)"),
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
    upsert("export_schema", "exportSchema", "export/remote config schema", exportSchemaFields, optional(exportSchemaFields));
    // ── 14. Rich Doc ────────────────────────────────────────────────
    const richDocFields = {
        blocks: z
            .array(z.record(z.string(), z.unknown()))
            .describe("BlockNote document blocks (each block is an object with id/type/props/content/children). Opaque — forwarded as-is."),
        schemaVersion: z.literal(1).optional().describe("Schema version, always 1"),
    };
    upsert("rich_doc", "richDoc", "rich document (Notion-style blocks: headings, lists, images, embeds, columns)", richDocFields, optional(richDocFields));
    // ── 15. Currency Exchange ───────────────────────────────────────
    const currencyExchangeEntrySchema = z.object({
        id: z.string().optional().describe("Entry ID (auto-generated if omitted)"),
        fromCurrencyRef: z.string().optional().describe("Section ID of the currency spent"),
        fromAmount: z.number().describe("Amount of the source currency required"),
        toCurrencyRef: z.string().optional().describe("Section ID of the currency received"),
        toAmount: z.number().describe("Amount of the target currency received"),
        direction: z.enum(["oneWay", "bidirectional"]).describe("'oneWay' = from→to only; 'bidirectional' = also reversible"),
        notes: z.string().optional().describe("Designer notes (limits, conditions)"),
    });
    const currencyExchangeFields = {
        entries: z.array(currencyExchangeEntrySchema).describe("Exchange rates offered"),
    };
    upsert("currency_exchange", "currencyExchange", "currency exchange (convert one currency into another)", currencyExchangeFields, optional(currencyExchangeFields));
    // ── 16. Skills ──────────────────────────────────────────────────
    const skillCostSchema = z.object({
        id: z.string().optional().describe("Cost ID (auto-generated if omitted)"),
        type: z.enum(["currency", "attribute", "charges"]).describe("What is spent to use the skill"),
        amount: z.number().describe("Amount spent"),
        currencyRef: z.string().optional().describe("Required when type='currency': Section ID of a Currency addon"),
        definitionsRef: z.string().optional().describe("Required when type='attribute': Section ID of the AttributeDefinitions page"),
        attributeKey: z.string().optional().describe("Required when type='attribute': attribute key from the linked definitions"),
    });
    const skillEffectSchema = z.object({
        id: z.string().optional().describe("Effect ID (auto-generated if omitted)"),
        attributeModifiersSectionId: z.string().describe("Section ID hosting the source attributeModifiers addon"),
        attributeModifiersAddonId: z.string().describe("Addon ID inside that section"),
        modifierEntryId: z.string().describe("ID of the modifier entry inside that addon"),
    });
    const skillEntrySchema = z.object({
        id: z.string().optional().describe("Skill ID (auto-generated if omitted)"),
        name: z.string().describe("Skill name"),
        description: z.string().optional().describe("Skill description"),
        kind: z.enum(["active", "passive"]).describe("'active' = triggered (has cooldown); 'passive' = always on"),
        cooldownSeconds: z.number().optional().describe("Cooldown in seconds (active skills only)"),
        costs: z.array(skillCostSchema).optional().describe("What the skill costs to use"),
        effects: z.array(skillEffectSchema).optional().describe("References to attributeModifiers entries applied by this skill"),
        unlock: craftTableUnlockSchema.optional().describe("Unlock conditions (level + currency + item; same structure as Craft Table)"),
        tags: z.array(z.string()).optional().describe("Free-form tags (e.g. 'fire', 'single-target')"),
    });
    const skillsFields = {
        entries: z.array(skillEntrySchema).describe("Skills defined on this page"),
    };
    upsert("skills", "skills", "skills (active/passive abilities with costs, effects, and unlock conditions)", skillsFields, optional(skillsFields));
}
//# sourceMappingURL=addon-tools.js.map