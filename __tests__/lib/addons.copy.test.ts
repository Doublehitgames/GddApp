import { copyAddon } from "@/lib/addons/copy";
import { relinkExportSchemaRefsToSection } from "@/lib/addons/refs";
import type {
  AttributeProfileSectionAddon,
  DataSchemaSectionAddon,
  EconomyLinkSectionAddon,
  ExportSchemaSectionAddon,
  ProductionSectionAddon,
  ProgressionTableSectionAddon,
  SectionAddon,
} from "@/lib/addons/types";

describe("copyAddon", () => {
  it("assigns a new wrapper ID and mirrors it on data.id", () => {
    const original: ProgressionTableSectionAddon = {
      id: "progression-orig",
      type: "progressionTable",
      name: "Tabela",
      group: "A",
      data: {
        id: "progression-orig",
        name: "Tabela",
        startLevel: 1,
        endLevel: 10,
        columns: [{ id: "col-1", name: "Valor", generator: { mode: "manual" }, decimals: 0 }],
        rows: [],
      },
    };

    const copy = copyAddon(original);

    expect(copy.id).not.toBe(original.id);
    expect(copy.id.startsWith("progression-")).toBe(true);
    expect(copy.data.id).toBe(copy.id);
    expect(copy.type).toBe("progressionTable");
  });

  it("resets group to undefined", () => {
    const original: ProgressionTableSectionAddon = {
      id: "progression-orig",
      type: "progressionTable",
      name: "Tabela",
      group: "B",
      data: {
        id: "progression-orig",
        name: "Tabela",
        startLevel: 1,
        endLevel: 5,
        columns: [],
        rows: [],
      },
    };
    const copy = copyAddon(original);
    expect(copy.group).toBeUndefined();
  });

  it("preserves section-ID refs (definitionsRef)", () => {
    const original: AttributeProfileSectionAddon = {
      id: "attr-profile-orig",
      type: "attributeProfile",
      name: "Perfil",
      data: {
        id: "attr-profile-orig",
        name: "Perfil",
        definitionsRef: "section-defs-elsewhere",
        values: [{ id: "v1", attributeKey: "strength", value: 10 }],
      },
    };
    const copy = copyAddon(original) as AttributeProfileSectionAddon;
    expect(copy.data.definitionsRef).toBe("section-defs-elsewhere");
    expect(copy.data.values).toHaveLength(1);
    expect(copy.data.values[0].value).toBe(10);
  });

  it("clears production binding on DataSchema entries", () => {
    const original: DataSchemaSectionAddon = {
      id: "data-schema-orig",
      type: "dataSchema",
      name: "Stats",
      data: {
        id: "data-schema-orig",
        name: "Stats",
        entries: [
          {
            id: "e1",
            key: "rate",
            label: "Rate",
            valueType: "int",
            value: 0,
            binding: { source: "production", addonId: "production-same-section", field: "minOutput" },
          },
          {
            id: "e2",
            key: "price",
            label: "Price",
            valueType: "int",
            value: 0,
            binding: { source: "economyLink", sectionId: "section-economy-elsewhere", field: "buyValue" },
          },
        ],
      },
    };

    const copy = copyAddon(original) as DataSchemaSectionAddon;
    expect(copy.data.entries[0].binding).toBeUndefined();
    // cross-section economyLink binding preserved
    expect((copy.data.entries[1].binding as { sectionId?: string })?.sectionId).toBe("section-economy-elsewhere");
  });

  it("clears progression bindings on Production addon", () => {
    const original: ProductionSectionAddon = {
      id: "production-orig",
      type: "production",
      name: "Prod",
      data: {
        id: "production-orig",
        name: "Prod",
        mode: "passive",
        outputRef: "section-item-elsewhere",
        minOutput: 1,
        maxOutput: 5,
        intervalSeconds: 60,
        ingredients: [],
        outputs: [],
        minOutputBinding: {
          source: "progressionColumn",
          progressionAddonId: "progression-same-section",
          columnId: "col-1",
          columnName: "Min",
        },
        craftTimeSecondsBinding: {
          source: "progressionColumn",
          progressionAddonId: "progression-same-section",
          columnId: "col-2",
          columnName: "Craft",
        },
      },
    };

    const copy = copyAddon(original) as ProductionSectionAddon;
    expect(copy.data.minOutputBinding).toBeUndefined();
    expect(copy.data.craftTimeSecondsBinding).toBeUndefined();
    expect(copy.data.maxOutputBinding).toBeUndefined();
    expect(copy.data.intervalSecondsBinding).toBeUndefined();
    // cross-section outputRef preserved
    expect(copy.data.outputRef).toBe("section-item-elsewhere");
  });

  it("clears ExportSchema addon-id refs recursively in children and itemTemplate", () => {
    const original: ExportSchemaSectionAddon = {
      id: "export-schema-orig",
      type: "exportSchema",
      name: "Remote Config",
      data: {
        id: "export-schema-orig",
        name: "Remote Config",
        nodes: [
          {
            id: "n1",
            key: "levels",
            nodeType: "array",
            arraySource: { type: "progressionTable", addonId: "progression-same-section" },
            itemTemplate: [
              {
                id: "n1a",
                key: "value",
                nodeType: "value",
                binding: {
                  source: "dataSchema",
                  addonId: "data-schema-same-section",
                  entryKey: "rate",
                },
              },
            ],
          },
          {
            id: "n2",
            key: "group",
            nodeType: "object",
            children: [
              {
                id: "n2a",
                key: "nested",
                nodeType: "value",
                binding: {
                  source: "dataSchema",
                  addonId: "data-schema-nested",
                  entryKey: "price",
                },
              },
              {
                id: "n2b",
                key: "literal",
                nodeType: "value",
                binding: { source: "manual", value: "foo", valueType: "string" },
              },
            ],
          },
        ],
      },
    };

    const copy = copyAddon(original) as ExportSchemaSectionAddon;
    const [arrNode, objNode] = copy.data.nodes;
    expect(
      arrNode.arraySource && (arrNode.arraySource.type === "progressionTable" || arrNode.arraySource.type === "craftTable")
        ? arrNode.arraySource.addonId
        : undefined
    ).toBeUndefined();
    expect(arrNode.itemTemplate?.[0].binding?.source).toBe("dataSchema");
    if (arrNode.itemTemplate?.[0].binding?.source === "dataSchema") {
      expect(arrNode.itemTemplate?.[0].binding.addonId).toBeUndefined();
    }
    expect(objNode.children?.[0].binding?.source).toBe("dataSchema");
    if (objNode.children?.[0].binding?.source === "dataSchema") {
      expect(objNode.children?.[0].binding.addonId).toBeUndefined();
    }
    // manual binding untouched
    expect(objNode.children?.[1].binding?.source).toBe("manual");
  });

  it("clears progressionColumn bindings on EconomyLink addon", () => {
    const original: EconomyLinkSectionAddon = {
      id: "economy-orig",
      type: "economyLink",
      name: "Economia",
      data: {
        id: "economy-orig",
        name: "Economia",
        buyModifiers: [],
        sellModifiers: [],
        hasBuyConfig: true,
        buyCurrencyRef: "section-currency-elsewhere",
        buyValueBinding: {
          source: "progressionColumn",
          progressionAddonId: "progression-same-section",
          columnId: "col-buy",
          columnName: "Buy",
        },
        minBuyValueBinding: {
          source: "progressionColumn",
          progressionAddonId: "progression-same-section",
          columnId: "col-min-buy",
          columnName: "Min Buy",
        },
        hasSellConfig: true,
        sellCurrencyRef: "section-currency-elsewhere",
        sellValueBinding: {
          source: "progressionColumn",
          progressionAddonId: "progression-same-section",
          columnId: "col-sell",
          columnName: "Sell",
        },
        hasUnlockConfig: true,
        unlockRef: "section-xp-elsewhere",
        unlockValueBinding: {
          source: "progressionColumn",
          progressionAddonId: "progression-same-section",
          columnId: "col-unlock",
          columnName: "Unlock",
        },
      },
    };

    const copy = copyAddon(original) as EconomyLinkSectionAddon;
    expect(copy.data.buyValueBinding).toBeUndefined();
    expect(copy.data.minBuyValueBinding).toBeUndefined();
    expect(copy.data.sellValueBinding).toBeUndefined();
    expect(copy.data.unlockValueBinding).toBeUndefined();
    // cross-section refs preserved
    expect(copy.data.buyCurrencyRef).toBe("section-currency-elsewhere");
    expect(copy.data.sellCurrencyRef).toBe("section-currency-elsewhere");
    expect(copy.data.unlockRef).toBe("section-xp-elsewhere");
  });

  it("preserves non-progressionColumn bindings on EconomyLink addon", () => {
    const original: EconomyLinkSectionAddon = {
      id: "economy-orig",
      type: "economyLink",
      name: "Economia",
      data: {
        id: "economy-orig",
        name: "Economia",
        buyModifiers: [],
        sellModifiers: [],
        hasBuyConfig: true,
        buyValueBinding: { source: "sheets", ref: { sheetName: "Sheet1", cellRef: "B2", cachedValue: 10, syncedAt: null } },
        hasSellConfig: true,
        sellValueBinding: { source: "manual" },
      },
    };

    const copy = copyAddon(original) as EconomyLinkSectionAddon;
    expect(copy.data.buyValueBinding?.source).toBe("sheets");
    expect(copy.data.sellValueBinding?.source).toBe("manual");
  });

  it("deep clones data — mutations on the copy do not affect the original", () => {
    const original: DataSchemaSectionAddon = {
      id: "data-schema-orig",
      type: "dataSchema",
      name: "Stats",
      data: {
        id: "data-schema-orig",
        name: "Stats",
        entries: [
          { id: "e1", key: "hp", label: "HP", valueType: "int", value: 100 },
        ],
      },
    };
    const copy = copyAddon(original) as DataSchemaSectionAddon;
    copy.data.entries[0].value = 999;
    expect(original.data.entries[0].value).toBe(100);
  });

  it("produces correct ID prefix for every addon type", () => {
    const expectedPrefixes: Array<[SectionAddon["type"], string]> = [
      ["xpBalance", "balance-"],
      ["progressionTable", "progression-"],
      ["economyLink", "economy-"],
      ["currency", "currency-"],
      ["globalVariable", "gvar-"],
      ["inventory", "inventory-"],
      ["production", "production-"],
      ["dataSchema", "data-schema-"],
      ["attributeDefinitions", "attr-defs-"],
      ["attributeProfile", "attr-profile-"],
      ["attributeModifiers", "attr-modifiers-"],
      ["exportSchema", "export-schema-"],
    ];
    for (const [type, prefix] of expectedPrefixes) {
      const stub = {
        id: `${type}-orig`,
        type,
        name: "x",
        data: { id: `${type}-orig`, name: "x" },
      } as unknown as SectionAddon;
      const copy = copyAddon(stub);
      expect(copy.id.startsWith(prefix)).toBe(true);
    }
  });
});

describe("relinkExportSchemaRefsToSection", () => {
  const makeExportData = () => ({
    id: "export-schema-1",
    name: "Remote Config",
    nodes: [
      {
        id: "n1",
        key: "levelSettings",
        nodeType: "array",
        // addonId vazio (simula estado após o clear do copy)
        arraySource: { type: "progressionTable", addonId: undefined },
        itemTemplate: [
          {
            id: "n1a",
            key: "upgrade_price",
            nodeType: "value",
            binding: { source: "dataSchema", addonId: undefined, entryKey: "price" },
          },
        ],
      },
      {
        id: "n2",
        key: "baseSettings",
        nodeType: "object",
        children: [
          {
            id: "n2a",
            key: "id",
            nodeType: "value",
            binding: { source: "dataSchema", addonId: undefined, entryKey: "id" },
          },
        ],
      },
    ],
  });

  it("re-aponta arraySource e dataSchema binding para os addons do destino", () => {
    const data = makeExportData() as unknown as Record<string, unknown>;
    relinkExportSchemaRefsToSection(data, [
      { id: "prog-dest", type: "progressionTable" },
      { id: "schema-dest", type: "dataSchema" },
    ]);
    const nodes = (data as any).nodes;
    expect(nodes[0].arraySource.addonId).toBe("prog-dest");
    expect(nodes[0].itemTemplate[0].binding.addonId).toBe("schema-dest");
    expect(nodes[1].children[0].binding.addonId).toBe("schema-dest");
  });

  it("resolve dataSchema também quando o destino usa genericStats", () => {
    const data = makeExportData() as unknown as Record<string, unknown>;
    relinkExportSchemaRefsToSection(data, [{ id: "legacy-schema", type: "genericStats" }]);
    const nodes = (data as any).nodes;
    expect(nodes[0].itemTemplate[0].binding.addonId).toBe("legacy-schema");
  });

  it("deixa a ref vazia quando o destino não tem o tipo necessário", () => {
    const data = makeExportData() as unknown as Record<string, unknown>;
    relinkExportSchemaRefsToSection(data, [{ id: "schema-dest", type: "dataSchema" }]);
    const nodes = (data as any).nodes;
    // sem progressionTable no destino → arraySource continua vazio
    expect(nodes[0].arraySource.addonId).toBeUndefined();
    // dataSchema existe → binding religado
    expect(nodes[0].itemTemplate[0].binding.addonId).toBe("schema-dest");
  });

  it("re-aponta sempre para o addon do destino, mesmo se a ref já tinha um id (origem)", () => {
    const data = makeExportData() as unknown as Record<string, unknown>;
    (data as any).nodes[0].arraySource.addonId = "prog-origem"; // id da origem
    relinkExportSchemaRefsToSection(data, [{ id: "prog-dest", type: "progressionTable" }]);
    expect((data as any).nodes[0].arraySource.addonId).toBe("prog-dest");
  });

  it("em cascade o irmão migra com o id original e o relink resolve para ele mesmo", () => {
    const data = makeExportData() as unknown as Record<string, unknown>;
    (data as any).nodes[0].arraySource.addonId = "prog-cascade";
    // O irmão veio junto no move (id preservado) → está no targetAddons.
    relinkExportSchemaRefsToSection(data, [{ id: "prog-cascade", type: "progressionTable" }]);
    expect((data as any).nodes[0].arraySource.addonId).toBe("prog-cascade");
  });
});
