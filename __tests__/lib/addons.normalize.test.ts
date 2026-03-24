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
      expect(normalized[0].data.intervalSecondsProgressionLink).toEqual({
        progressionAddonId: "prog-a",
        columnId: "col-time",
        columnName: "Tempo",
      });
      expect(normalized[0].data.craftTimeSecondsProgressionLink).toEqual({
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
