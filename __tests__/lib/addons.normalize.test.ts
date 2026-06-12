import { normalizeSectionAddons } from "@/lib/addons/normalize";

describe("normalizeSectionAddons economyLink", () => {
  it("normalizes economy link refs, migrates legacy production and clears production fields from economy", () => {
    const input = [
      {
        id: "eco-1",
        type: "economyLink",
        name: "Economy Link",
        data: {
          id: "eco-1",
          name: "Economy Link",
          buyCurrencyRef: " currency-coins ",
          buyValue: "120",
          minBuyValue: "25",
          buyModifiers: [" var-buy-discount ", { refId: "var-event-price" }],
          sellCurrencyRef: "currency-coins",
          sellValue: "90",
          maxSellValue: "180",
          sellModifiers: [{ refId: " var-sell-bonus " }],
          producedItemRef: " item-corn ",
          produceMin: "5",
          produceMax: "3",
          productionTimeSeconds: "300",
          unlockRef: " progression-farm-level ",
          unlockValue: "12",
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    expect(normalized?.length).toBe(2);
    const economy = normalized?.find((item) => item.type === "economyLink");
    const production = normalized?.find((item) => item.type === "production");

    expect(economy?.type).toBe("economyLink");
    expect(production?.type).toBe("production");

    if (economy?.type === "economyLink") {
      expect(economy.data.hasBuyConfig).toBe(true);
      expect(economy.data.buyCurrencyRef).toBe("currency-coins");
      expect(economy.data.buyValue).toBe(120);
      expect(economy.data.minBuyValue).toBe(25);
      expect(economy.data.buyModifiers.map((item) => item.refId)).toEqual([
        "var-buy-discount",
        "var-event-price",
      ]);
      expect(economy.data.maxSellValue).toBe(180);
      expect(economy.data.hasProductionConfig).toBe(false);
      expect(economy.data.producedItemRef).toBeUndefined();
      expect(economy.data.produceMin).toBeUndefined();
      expect(economy.data.produceMax).toBeUndefined();
      expect(economy.data.productionTimeSeconds).toBeUndefined();
      expect(economy.data.unlockRef).toBe("progression-farm-level");
      expect(economy.data.unlockValue).toBe(12);
    }

    if (production?.type === "production") {
      expect(production.data.mode).toBe("passive");
      expect(production.data.outputRef).toBe("item-corn");
      expect(production.data.minOutput).toBe(5);
      expect(production.data.maxOutput).toBe(5);
      expect(production.data.intervalSeconds).toBe(300);
    }
  });

  it("does not duplicate production when section already has production addon", () => {
    const input = [
      {
        id: "eco-1",
        type: "economyLink",
        name: "Economy Link",
        data: {
          id: "eco-1",
          name: "Economy Link",
          hasProductionConfig: true,
          producedItemRef: "item-corn",
          produceMin: 2,
          produceMax: 3,
          productionTimeSeconds: 50,
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
          outputRef: "item-egg",
          minOutput: 1,
          maxOutput: 1,
          intervalSeconds: 10,
          ingredients: [],
          outputs: [],
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    const productionAddons = (normalized || []).filter((item) => item.type === "production");
    expect(productionAddons).toHaveLength(1);
    expect(productionAddons[0].id).toBe("prod-1");
  });

  it("keeps empty recipe rows while editing production addon", () => {
    const input = [
      {
        id: "prod-2",
        type: "production",
        name: "Production",
        data: {
          id: "prod-2",
          name: "Production",
          mode: "recipe",
          ingredients: [{ itemRef: "", quantity: 1 }],
          outputs: [{ itemRef: "", quantity: 2 }],
          craftTimeSeconds: 45,
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    expect(normalized?.length).toBe(1);
    expect(normalized?.[0].type).toBe("production");
    if (normalized?.[0].type === "production") {
      expect(normalized[0].data.mode).toBe("recipe");
      expect(normalized[0].data.ingredients).toEqual([{ itemRef: "", quantity: 1 }]);
      expect(normalized[0].data.outputs).toEqual([{ itemRef: "", quantity: 2 }]);
    }
  });

  it("normalizes production progression links for passive and recipe times", () => {
    const input = [
      {
        id: "prod-3",
        type: "production",
        name: "Production",
        data: {
          id: "prod-3",
          name: "Production",
          mode: "recipe",
          intervalSecondsProgressionLink: {
            progressionAddonId: " prog-a ",
            columnId: " col-time ",
            columnName: " Tempo ",
          },
          craftTimeSecondsProgressionLink: {
            progressionAddonId: " prog-b ",
            columnId: " col-craft ",
            columnName: " Tempo Receita ",
          },
          ingredients: [{ itemRef: "", quantity: 1 }],
          outputs: [{ itemRef: "", quantity: 2 }],
          craftTimeSeconds: 45,
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    expect(normalized?.length).toBe(1);
    expect(normalized?.[0].type).toBe("production");
    if (normalized?.[0].type === "production") {
      expect(normalized[0].data.intervalSecondsBinding).toEqual({
        source: "progressionColumn",
        progressionAddonId: "prog-a",
        columnId: "col-time",
        columnName: "Tempo",
      });
      expect(normalized[0].data.craftTimeSecondsBinding).toEqual({
        source: "progressionColumn",
        progressionAddonId: "prog-b",
        columnId: "col-craft",
        columnName: "Tempo Receita",
      });
    }
  });

  it("normalizes currency and global variable addons", () => {
    const input = [
      {
        id: "currency-1",
        type: "currency",
        name: "Currency",
        data: {
          id: "currency-1",
          name: "Currency",
          code: " coins ",
          displayName: " Coins ",
          kind: "soft",
          decimals: "0",
        },
      },
      {
        id: "gvar-1",
        type: "globalVariable",
        name: "Global Variable",
        data: {
          id: "gvar-1",
          name: "Global Variable",
          key: " Sell Bonus % ",
          displayName: "Sell Bonus",
          valueType: "percent",
          defaultValue: "25",
          scope: "global",
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    expect(normalized?.length).toBe(2);
    expect(normalized?.[0].type).toBe("currency");
    if (normalized?.[0].type === "currency") {
      expect(normalized[0].data.code).toBe("COINS");
      expect(normalized[0].data.decimals).toBe(0);
    }

    expect(normalized?.[1].type).toBe("globalVariable");
    if (normalized?.[1].type === "globalVariable") {
      expect(normalized[1].data.key).toBe("sell_bonus_");
      expect(normalized[1].data.defaultValue).toBe(25);
      expect(normalized[1].data.scope).toBe("global");
    }
  });

  it("normalizes inventory addon and enforces stack rules", () => {
    const input = [
      {
        id: "inv-1",
        type: "inventory",
        name: "Inventory",
        data: {
          id: "inv-1",
          name: "Inventory",
          weight: "-2",
          stackable: false,
          maxStack: "99",
          inventoryCategory: " Consumivel ",
          slotSize: "2",
          durability: "10",
          volume: "-1",
          maxDurability: "100",
          bindType: "onPickup",
          showInShop: "false",
          consumable: true,
          discardable: false,
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    expect(normalized?.length).toBe(1);
    expect(normalized?.[0].type).toBe("inventory");
    if (normalized?.[0].type === "inventory") {
      expect(normalized[0].data.weight).toBe(0);
      expect(normalized[0].data.stackable).toBe(false);
      expect(normalized[0].data.maxStack).toBe(1);
      expect(normalized[0].data.inventoryCategory).toBe(" Consumivel ");
      expect(normalized[0].data.slotSize).toBe(2);
      expect(normalized[0].data.hasDurabilityConfig).toBe(true);
      expect(normalized[0].data.hasVolumeConfig).toBe(false);
      expect(normalized[0].data.volume).toBeUndefined();
      expect(normalized[0].data.bindType).toBe("onPickup");
      expect(normalized[0].data.showInShop).toBe(false);
    }
  });

  it("normalizes progression table percentage flag", () => {
    const input = [
      {
        id: "prog-1",
        type: "progressionTable",
        name: "Tabela",
        data: {
          id: "prog-1",
          name: "Tabela",
          startLevel: 1,
          endLevel: 2,
          columns: [
            { id: "xp", name: "XP", decimals: 0, isPercentage: "true", generator: { mode: "manual" } },
          ],
          rows: [
            { level: 1, values: { xp: 10 } },
            { level: 2, values: { xp: 20 } },
          ],
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    expect(normalized?.[0].type).toBe("progressionTable");
    if (normalized?.[0].type === "progressionTable") {
      expect(normalized[0].data.columns[0].isPercentage).toBe(true);
    }
  });
});

describe("normalizeSectionAddons fieldLibrary", () => {
  it("normalizes fieldLibrary entries (trims key, derives label fallback, dedupes keys)", () => {
    const input = [
      {
        id: "lib-1",
        type: "fieldLibrary",
        name: "Biblioteca",
        data: {
          id: "lib-1",
          name: "Biblioteca",
          entries: [
            { id: "e1", key: "  Sell Price ", label: "Preço de Venda", description: "Valor de venda" },
            { id: "e2", key: "buy_price", label: "" },
            { id: "e3", key: "sell_price", label: "Duplicate" },
            { id: "e4", key: "", label: "Ignored (no key)" },
          ],
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    expect(normalized?.length).toBe(1);
    const lib = normalized?.[0];
    expect(lib?.type).toBe("fieldLibrary");
    if (lib?.type === "fieldLibrary") {
      expect(lib.data.entries).toHaveLength(2);
      expect(lib.data.entries[0]).toEqual({
        id: "e1",
        key: "sell_price",
        label: "Preço de Venda",
        description: "Valor de venda",
      });
      expect(lib.data.entries[1]).toEqual({
        id: "e2",
        key: "buy_price",
        label: "buy_price",
        description: undefined,
      });
    }
  });

  it("normalizes richDoc with tolerant block passthrough", () => {
    const input = [
      {
        id: "rd-1",
        type: "richDoc",
        name: "My Doc",
        data: {
          id: "rd-1",
          name: "My Doc",
          blocks: [
            { id: "b1", type: "paragraph", props: {}, content: [{ type: "text", text: "hi" }] },
            { id: "b2", type: "future-unknown-type", props: { foo: 1 }, content: "opaque" },
            "garbage",
            null,
            { id: "b3", type: "heading", props: { level: 2 }, content: [] },
          ],
          schemaVersion: 1,
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    expect(normalized?.length).toBe(1);
    const doc = normalized?.[0];
    expect(doc?.type).toBe("richDoc");
    if (doc?.type === "richDoc") {
      expect(doc.data.blocks).toHaveLength(3);
      expect(doc.data.blocks[1].type).toBe("future-unknown-type");
      expect(doc.data.schemaVersion).toBe(1);
    }
  });

  it("defaults richDoc to empty blocks when missing", () => {
    const input = [
      {
        id: "rd-2",
        type: "richDoc",
        name: "Empty",
        data: { id: "rd-2", name: "Empty" },
      },
    ];
    const normalized = normalizeSectionAddons(input);
    const doc = normalized?.[0];
    expect(doc?.type).toBe("richDoc");
    if (doc?.type === "richDoc") {
      expect(doc.data.blocks).toEqual([]);
    }
  });

  it("migrates legacy columnLibrary type to fieldLibrary on load", () => {
    const input = [
      {
        id: "lib-legacy",
        type: "columnLibrary",
        name: "Old Library",
        data: {
          id: "lib-legacy",
          name: "Old Library",
          entries: [{ id: "x", key: "damage", label: "Dano" }],
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    expect(normalized?.length).toBe(1);
    expect(normalized?.[0].type).toBe("fieldLibrary");
    if (normalized?.[0].type === "fieldLibrary") {
      expect(normalized[0].data.entries).toEqual([{ id: "x", key: "damage", label: "Dano", description: undefined }]);
    }
  });

  it("preserves libraryRef on DataSchemaEntry when valid", () => {
    const input = [
      {
        id: "ds-1",
        type: "dataSchema",
        name: "Schema",
        data: {
          id: "ds-1",
          name: "Schema",
          entries: [
            {
              id: "entry-1",
              key: "sell_price",
              label: "Preço de Venda",
              libraryRef: { libraryAddonId: "lib-1", entryId: "e1" },
              valueType: "int",
              value: 100,
            },
            {
              id: "entry-2",
              key: "manual_field",
              label: "Manual",
              valueType: "int",
              value: 50,
            },
            {
              id: "entry-3",
              key: "broken_ref",
              label: "Broken",
              libraryRef: { libraryAddonId: "", entryId: "" }, // invalid → dropped
              valueType: "int",
              value: 0,
            },
          ],
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    const ds = normalized?.[0];
    expect(ds?.type).toBe("dataSchema");
    if (ds?.type === "dataSchema") {
      expect(ds.data.entries[0].libraryRef).toEqual({ libraryAddonId: "lib-1", entryId: "e1" });
      expect(ds.data.entries[1].libraryRef).toBeUndefined();
      expect(ds.data.entries[2].libraryRef).toBeUndefined();
    }
  });

  it("preserves libraryRef on ProgressionTableColumn when valid", () => {
    const input = [
      {
        id: "pt-1",
        type: "progressionTable",
        name: "Tabela",
        data: {
          id: "pt-1",
          name: "Tabela",
          startLevel: 1,
          endLevel: 2,
          columns: [
            {
              id: "c1",
              name: "Sell Price",
              libraryRef: { libraryAddonId: "lib-1", entryId: "e1" },
              generator: { mode: "manual" },
            },
          ],
          rows: [
            { level: 1, values: { c1: 0 } },
            { level: 2, values: { c1: 0 } },
          ],
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    const pt = normalized?.[0];
    expect(pt?.type).toBe("progressionTable");
    if (pt?.type === "progressionTable") {
      expect(pt.data.columns[0].libraryRef).toEqual({ libraryAddonId: "lib-1", entryId: "e1" });
    }
  });
});

describe("normalizeSectionAddons xpBalance", () => {
  it("fills missing params/expression with defaults (regression: editor crash)", () => {
    // Malformed draft persisted without params/expression (e.g. created via MCP/AI).
    const input = [
      {
        id: "balance-1",
        type: "xpBalance",
        name: "XP",
        data: {
          id: "balance-1",
          name: "XP",
          mode: "preset",
          preset: "exponential",
          startLevel: 1,
          endLevel: 50,
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    const balance = normalized?.[0];
    expect(balance?.type).toBe("xpBalance");
    if (balance?.type === "xpBalance") {
      // params must be a complete object so `addon.params[key]` never throws
      expect(typeof balance.data.params).toBe("object");
      expect(typeof balance.data.params.base).toBe("number");
      expect(typeof balance.data.params.growth).toBe("number");
      expect(typeof balance.data.params.plateauFactor).toBe("number");
      // expression must be a string so `addon.expression.match(...)` never throws
      expect(typeof balance.data.expression).toBe("string");
      expect(balance.data.expression.length).toBeGreaterThan(0);
      // preserved fields stay intact
      expect(balance.data.startLevel).toBe(1);
      expect(balance.data.endLevel).toBe(50);
    }
  });

  it("preserves valid params instead of overwriting with defaults", () => {
    const input = [
      {
        id: "balance-1",
        type: "xpBalance",
        name: "XP",
        data: {
          id: "balance-1",
          name: "XP",
          mode: "advanced",
          preset: "linear",
          expression: "base + level * growth",
          startLevel: 1,
          endLevel: 30,
          decimals: 2,
          params: { base: 42, growth: 2.5 },
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    const balance = normalized?.[0];
    if (balance?.type === "xpBalance") {
      expect(balance.data.mode).toBe("advanced");
      expect(balance.data.expression).toBe("base + level * growth");
      expect(balance.data.params.base).toBe(42);
      expect(balance.data.params.growth).toBe(2.5);
      // missing param keys still backfilled
      expect(typeof balance.data.params.offset).toBe("number");
    }
  });
});

describe("normalizeSectionAddons crop", () => {
  it("keeps crop addons (regression: would be dropped as unknown type) and coerces fields", () => {
    const input = [
      {
        id: "crop-1",
        type: "crop",
        name: "Semente de Nabo",
        data: {
          id: "crop-1",
          name: "Semente de Nabo",
          harvestMode: "progressive",
          growthSeconds: "3600",
          totalHarvest: "100",
          stages: [
            { id: "s1", label: "Broto 1", secondsFromPlanting: "0" },
            { label: "Planta 2", secondsFromPlanting: 720 },
          ],
          outputs: [{ id: "o1", itemRef: " item-nabo ", quantity: "15", quantityMin: "5" }],
          plantXp: { xpAddonRef: " sec-xp ", xp: "25" },
          harvestXp: { xp: 5 },
          spawnWitheredPlant: true,
          fertilizers: [{ id: "f1", itemRef: "item-npk" }, "garbage"],
          amendments: [],
          seasons: ["summer", "bogus"],
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    const crop = normalized?.find((a) => a.type === "crop");
    expect(crop?.type).toBe("crop");
    if (crop?.type === "crop") {
      expect(crop.data.harvestMode).toBe("progressive");
      expect(crop.data.growthSeconds).toBe(3600);
      expect(crop.data.totalHarvest).toBe(100);
      expect(crop.data.stages).toHaveLength(2);
      expect(crop.data.stages[1].id).toBeTruthy(); // id backfilled when missing
      expect(crop.data.outputs[0].itemRef).toBe("item-nabo"); // trimmed
      expect(crop.data.outputs[0].quantity).toBe(15);
      expect(crop.data.outputs[0].quantityMin).toBe(5);
      expect(crop.data.plantXp.xpAddonRef).toBe("sec-xp"); // trimmed
      expect(crop.data.plantXp.xp).toBe(25);
      expect(crop.data.harvestXp.xp).toBe(5);
      expect(crop.data.spawnWitheredPlant).toBe(true);
      expect(crop.data.fertilizers).toHaveLength(1); // "garbage" dropped
      expect(crop.data.seasons).toEqual(["summer"]); // "bogus" dropped
    }
  });

  it("backfills array fields for a minimal crop draft", () => {
    const input = [
      {
        id: "crop-2",
        type: "crop",
        name: "Tomate",
        data: { id: "crop-2", name: "Tomate" },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    const crop = normalized?.[0];
    if (crop?.type === "crop") {
      expect(crop.data.harvestMode).toBe("instant");
      expect(Array.isArray(crop.data.stages)).toBe(true);
      expect(Array.isArray(crop.data.outputs)).toBe(true);
      expect(Array.isArray(crop.data.fertilizers)).toBe(true);
      expect(Array.isArray(crop.data.amendments)).toBe(true);
      expect(crop.data.plantXp).toEqual({});
      expect(crop.data.spawnWitheredPlant).toBe(false);
    }
  });
});

describe("normalizeSectionAddons crop FieldBinding", () => {
  it("preserves a crop binding on a DataSchema entry and drops invalid fields (regression: allowlist)", () => {
    const input = [
      {
        id: "ds-1",
        type: "dataSchema",
        name: "Stats",
        data: {
          id: "ds-1",
          name: "Stats",
          entries: [
            {
              id: "e1",
              key: "grow",
              label: "Grow",
              valueType: "int",
              value: 180,
              binding: { source: "crop", addonId: "crop-1", field: "growthSeconds" },
            },
            {
              id: "e2",
              key: "yield",
              label: "Yield",
              valueType: "int",
              value: 15,
              binding: { source: "crop", addonId: "crop-1", field: "outputQuantity", outputId: "o1" },
            },
            {
              id: "e3",
              key: "bad",
              label: "Bad",
              valueType: "int",
              value: 0,
              binding: { source: "crop", addonId: "crop-1", field: "notAField" },
            },
          ],
        },
      },
    ];

    const normalized = normalizeSectionAddons(input);
    const ds = normalized?.[0];
    expect(ds?.type).toBe("dataSchema");
    if (ds?.type === "dataSchema") {
      expect(ds.data.entries[0].binding).toEqual({
        source: "crop",
        addonId: "crop-1",
        field: "growthSeconds",
      });
      expect(ds.data.entries[1].binding).toEqual({
        source: "crop",
        addonId: "crop-1",
        field: "outputQuantity",
        outputId: "o1",
      });
      // invalid field → binding rejected by the allowlist → dropped
      expect(ds.data.entries[2].binding).toBeUndefined();
    }
  });
});
