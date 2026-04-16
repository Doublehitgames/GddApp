import { copyAddon } from "@/lib/addons/copy";
import type {
  AttributeProfileSectionAddon,
  DataSchemaSectionAddon,
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

  it("clears productionRef on DataSchema entries", () => {
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
            productionRef: "production-same-section",
          },
          {
            id: "e2",
            key: "price",
            label: "Price",
            valueType: "int",
            value: 0,
            economyLinkRef: "section-economy-elsewhere",
          },
        ],
      },
    };

    const copy = copyAddon(original) as DataSchemaSectionAddon;
    expect(copy.data.entries[0].productionRef).toBeUndefined();
    // section-ID ref preserved
    expect(copy.data.entries[1].economyLinkRef).toBe("section-economy-elsewhere");
  });

  it("clears progression links on Production addon", () => {
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
        minOutputProgressionLink: {
          progressionAddonId: "progression-same-section",
          columnId: "col-1",
          columnName: "Min",
        },
        craftTimeSecondsProgressionLink: {
          progressionAddonId: "progression-same-section",
          columnId: "col-2",
          columnName: "Craft",
        },
      },
    };

    const copy = copyAddon(original) as ProductionSectionAddon;
    expect(copy.data.minOutputProgressionLink).toBeUndefined();
    expect(copy.data.craftTimeSecondsProgressionLink).toBeUndefined();
    expect(copy.data.maxOutputProgressionLink).toBeUndefined();
    expect(copy.data.intervalSecondsProgressionLink).toBeUndefined();
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
    expect(arrNode.arraySource?.addonId).toBeUndefined();
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
