import type { Project, Section } from "@/store/projectStore";
import type { SectionAddon } from "@/lib/addons/types";
import {
  buildProjectAddonStats,
  buildProjectSpecialTokenMap,
  normalizeSpecialTokenSyntax,
  resolveProjectSpecialTokens,
} from "@/lib/addons/projectSpecialTokens";

function createSection(id: string, addons: SectionAddon[]): Section {
  return {
    id,
    title: `Section ${id}`,
    content: "",
    created_at: "2026-03-20T10:00:00.000Z",
    order: 1,
    addons,
  };
}

function createProject(sections: Section[]): Project {
  return {
    id: "project-1",
    title: "Projeto teste",
    description: "",
    sections,
    createdAt: "2026-03-20T10:00:00.000Z",
    updatedAt: "2026-03-23T12:30:00.000Z",
  };
}

describe("projectSpecialTokens", () => {
  it("builds counts and derived values from addons", () => {
    const project = createProject([
      createSection("sec-1", [
        {
          id: "currency-1",
          type: "currency",
          name: "Currency",
          data: {
            id: "currency-1",
            name: "Currency",
            code: "gold",
            displayName: "Gold",
            kind: "soft",
            decimals: 0,
          },
        },
        {
          id: "currency-2",
          type: "currency",
          name: "Currency",
          data: {
            id: "currency-2",
            name: "Currency",
            code: "GEM",
            displayName: "Gem",
            kind: "premium",
            decimals: 0,
          },
        },
        {
          id: "gvar-1",
          type: "globalVariable",
          name: "Global Variable",
          data: {
            id: "gvar-1",
            name: "Global Variable",
            key: "drop_rate",
            displayName: "Drop Rate",
            valueType: "percent",
            defaultValue: 15,
            scope: "global",
          },
        },
        {
          id: "inv-1",
          type: "inventory",
          name: "Inventory",
          data: {
            id: "inv-1",
            name: "Inventory",
            weight: 1,
            stackable: true,
            maxStack: 99,
            inventoryCategory: "consumable",
            slotSize: 1,
            hasDurabilityConfig: false,
            durability: 0,
            bindType: "none",
            showInShop: true,
            consumable: true,
            discardable: true,
          },
        },
      ]),
      createSection("sec-2", [
        {
          id: "prod-1",
          type: "production",
          name: "Production",
          data: {
            id: "prod-1",
            name: "Production",
            mode: "passive",
            outputRef: "sec-1",
            minOutput: 1,
            maxOutput: 3,
            intervalSeconds: 60,
            ingredients: [],
            outputs: [],
          },
        },
        {
          id: "prod-2",
          type: "production",
          name: "Production",
          data: {
            id: "prod-2",
            name: "Production",
            mode: "recipe",
            ingredients: [{ itemRef: "sec-1", quantity: 1 }],
            outputs: [
              { itemRef: "sec-1", quantity: 2 },
              { itemRef: "sec-3", quantity: 1 },
            ],
            craftTimeSeconds: 120,
          },
        },
        {
          id: "eco-1",
          type: "economyLink",
          name: "Economy Link",
          data: {
            id: "eco-1",
            name: "Economy Link",
            buyCurrencyRef: "sec-1",
            buyValue: 100,
            minBuyValue: 50,
            buyModifiers: [],
            sellCurrencyRef: "sec-1",
            sellValue: 70,
            maxSellValue: 120,
            sellModifiers: [],
            unlockRef: "sec-3",
            unlockValue: 10,
            hasBuyConfig: true,
            hasSellConfig: true,
            hasUnlockConfig: true,
          },
        },
        {
          id: "prog-1",
          type: "progressionTable",
          name: "Tabela",
          data: {
            id: "prog-1",
            name: "Tabela",
            startLevel: 1,
            endLevel: 50,
            columns: [{ id: "value", name: "Value", generator: { mode: "manual" }, decimals: 0 }],
            rows: [],
          },
        },
        {
          id: "xp-1",
          type: "xpBalance",
          name: "XP",
          data: {
            id: "xp-1",
            name: "XP",
            mode: "preset",
            preset: "linear",
            expression: "",
            startLevel: 1,
            endLevel: 60,
            decimals: 0,
            params: {
              base: 1,
              growth: 1,
              offset: 0,
              tierStep: 1,
              tierMultiplier: 1,
              capValue: 0,
              capStrength: 0,
              plateauStartLevel: 1,
              plateauFactor: 1,
            },
          },
        },
      ]),
    ]);

    const stats = buildProjectAddonStats(project);
    expect(stats.projectSectionCount).toBe(2);
    expect(stats.projectAddonCount).toBe(9);
    expect(stats.currencyCount).toBe(2);
    expect(stats.currencySoftCount).toBe(1);
    expect(stats.currencyPremiumCount).toBe(1);
    expect(stats.productionCount).toBe(2);
    expect(stats.productionPassiveCount).toBe(1);
    expect(stats.productionRecipeCount).toBe(1);
    expect(stats.productionOutputItemCount).toBe(2);
    expect(stats.progressionMaxLevel).toBe(50);
    expect(stats.xpMaxLevel).toBe(60);
  });

  it("resolves known tokens and preserves unknown tokens", () => {
    const project = createProject([
      createSection("sec-1", [
        {
          id: "currency-1",
          type: "currency",
          name: "Currency",
          data: {
            id: "currency-1",
            name: "Currency",
            code: "gem",
            displayName: "Gem",
            kind: "event",
            decimals: 0,
          },
        },
        {
          id: "gvar-1",
          type: "globalVariable",
          name: "Global Variable",
          data: {
            id: "gvar-1",
            name: "Global Variable",
            key: "boost",
            displayName: "Boost",
            valueType: "flat",
            defaultValue: 10,
            scope: "event",
          },
        },
      ]),
    ]);

    const output = resolveProjectSpecialTokens(
      "Moedas: @[currency_count] (@[currency_codes]) | Chaves: @[global_variable_keys] | @[token_desconhecido]",
      project
    );

    expect(output).toContain("Moedas: 1 (GEM)");
    expect(output).toContain("Chaves: boost");
    expect(output).toContain("@[token_desconhecido]");
  });

  it("supports token filters for kind, scope, mode and config", () => {
    const project = createProject([
      createSection("sec-1", [
        {
          id: "currency-1",
          type: "currency",
          name: "Currency",
          data: {
            id: "currency-1",
            name: "Currency",
            code: "gold",
            displayName: "Gold",
            kind: "soft",
            decimals: 0,
          },
        },
        {
          id: "currency-2",
          type: "currency",
          name: "Currency",
          data: {
            id: "currency-2",
            name: "Currency",
            code: "gem",
            displayName: "Gem",
            kind: "premium",
            decimals: 0,
          },
        },
        {
          id: "gvar-1",
          type: "globalVariable",
          name: "Global Variable",
          data: {
            id: "gvar-1",
            name: "Global Variable",
            key: "event_boost",
            displayName: "Event Boost",
            valueType: "percent",
            defaultValue: 20,
            scope: "event",
          },
        },
        {
          id: "prod-1",
          type: "production",
          name: "Production",
          data: {
            id: "prod-1",
            name: "Production",
            mode: "passive",
            outputRef: "sec-1",
            minOutput: 1,
            maxOutput: 2,
            intervalSeconds: 60,
            ingredients: [],
            outputs: [],
          },
        },
        {
          id: "eco-1",
          type: "economyLink",
          name: "Economy Link",
          data: {
            id: "eco-1",
            name: "Economy Link",
            hasBuyConfig: true,
            buyModifiers: [],
            hasSellConfig: false,
            sellModifiers: [],
            hasUnlockConfig: false,
          },
        },
      ]),
    ]);

    const output = resolveProjectSpecialTokens(
      [
        "soft=@[currency_count(kind=soft)]",
        "premiumCodes=@[currency_codes(kind=premium)]",
        "eventGvars=@[global_variable_count(scope=event)]",
        "passiveProd=@[production_count(mode=passive)]",
        "buyLinks=@[economy_link_count(config=buy)]",
      ].join(" | "),
      project
    );

    expect(output).toContain("soft=1");
    expect(output).toContain("premiumCodes=GEM");
    expect(
      resolveProjectSpecialTokens("@[currency_titles] | @[currency_Titles(kind=soft)]", project)
    ).toContain("Gold | Gold");
    expect(output).toContain("eventGvars=1");
    expect(output).toContain("passiveProd=1");
    expect(output).toContain("buyLinks=1");
  });

  it("returns safe fallbacks for empty project data", () => {
    const tokenMap = buildProjectSpecialTokenMap({
      updatedAt: "",
      sections: [],
    });

    expect(tokenMap.currency_count).toBe(0);
    expect(tokenMap.currency_codes).toBe("-");
    expect(tokenMap.global_variable_keys).toBe("-");
    expect(tokenMap.project_last_updated_at).toBe("-");
  });

  it("normalizes escaped underscore inside special tokens", () => {
    const normalized = normalizeSpecialTokenSyntax("Valor: @[currency\\_count]");
    expect(normalized).toBe("Valor: @[currency_count]");
  });

  it("resolves page-scoped production time tokens for the current section", () => {
    const project = createProject([
      createSection("sec-passive", [
        {
          id: "prod-passive",
          type: "production",
          name: "Passive Production",
          data: {
            id: "prod-passive",
            name: "Passive Production",
            mode: "passive",
            outputRef: "sec-other",
            minOutput: 1,
            maxOutput: 1,
            intervalSeconds: 45,
            ingredients: [],
            outputs: [],
          },
        },
      ]),
      createSection("sec-recipe", [
        {
          id: "prod-recipe",
          type: "production",
          name: "Recipe Production",
          data: {
            id: "prod-recipe",
            name: "Recipe Production",
            mode: "recipe",
            ingredients: [{ itemRef: "sec-other", quantity: 1 }],
            outputs: [{ itemRef: "sec-other", quantity: 1 }],
            craftTimeSeconds: 180,
          },
        },
      ]),
      createSection("sec-no-prod", []),
    ]);

    // Same content resolves to different values depending on the section context.
    const passiveOutput = resolveProjectSpecialTokens(
      "Interval: @[production_interval_seconds]s",
      project,
      "sec-passive"
    );
    expect(passiveOutput).toBe("Interval: 45s");

    const recipeOutput = resolveProjectSpecialTokens(
      "Craft: @[production_craft_time_seconds]s",
      project,
      "sec-recipe"
    );
    expect(recipeOutput).toBe("Craft: 180s");

    // Without a section context the token is left untouched.
    const noContextOutput = resolveProjectSpecialTokens(
      "Interval: @[production_interval_seconds]",
      project
    );
    expect(noContextOutput).toContain("@[production_interval_seconds]");

    // Section without a production addon: token is left untouched.
    const noProdOutput = resolveProjectSpecialTokens(
      "Interval: @[production_interval_seconds]",
      project,
      "sec-no-prod"
    );
    expect(noProdOutput).toContain("@[production_interval_seconds]");
  });
});

