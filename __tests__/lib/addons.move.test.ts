import { moveAddon } from "@/lib/addons/move";
import type {
  AttributeProfileSectionAddon,
  DataSchemaSectionAddon,
  ExportSchemaSectionAddon,
  ProductionSectionAddon,
  ProgressionTableSectionAddon,
} from "@/lib/addons/types";

describe("moveAddon", () => {
  it("preserves wrapper and data IDs (same entity migrating)", () => {
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
    const moved = moveAddon(original);
    expect(moved.id).toBe("progression-orig");
    expect(moved.data.id).toBe("progression-orig");
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
    expect(moveAddon(original).group).toBeUndefined();
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
    const moved = moveAddon(original) as AttributeProfileSectionAddon;
    expect(moved.data.definitionsRef).toBe("section-defs-elsewhere");
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
            economyLinkRef: "section-economy-elsewhere",
          },
        ],
      },
    };
    const moved = moveAddon(original) as DataSchemaSectionAddon;
    expect(moved.data.entries[0].productionRef).toBeUndefined();
    expect(moved.data.entries[0].economyLinkRef).toBe("section-economy-elsewhere");
  });

  it("clears all progression links on Production", () => {
    const original: ProductionSectionAddon = {
      id: "production-orig",
      type: "production",
      name: "Prod",
      data: {
        id: "production-orig",
        name: "Prod",
        mode: "passive",
        minOutput: 1,
        maxOutput: 1,
        intervalSeconds: 60,
        ingredients: [],
        outputs: [],
        minOutputProgressionLink: {
          progressionAddonId: "p-1",
          columnId: "c",
          columnName: "C",
        },
      },
    };
    const moved = moveAddon(original) as ProductionSectionAddon;
    expect(moved.data.minOutputProgressionLink).toBeUndefined();
    expect(moved.data.maxOutputProgressionLink).toBeUndefined();
  });

  it("clears ExportSchema addon-id refs recursively", () => {
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
            arraySource: { type: "progressionTable", addonId: "p-1" },
            itemTemplate: [
              {
                id: "n1a",
                key: "value",
                nodeType: "value",
                binding: { source: "dataSchema", addonId: "d-1", entryKey: "x" },
              },
            ],
          },
        ],
      },
    };
    const moved = moveAddon(original) as ExportSchemaSectionAddon;
    expect(moved.data.nodes[0].arraySource?.addonId).toBeUndefined();
    const binding = moved.data.nodes[0].itemTemplate?.[0].binding;
    if (binding?.source === "dataSchema") {
      expect(binding.addonId).toBeUndefined();
    }
  });

  it("deep clones data", () => {
    const original: DataSchemaSectionAddon = {
      id: "data-schema-orig",
      type: "dataSchema",
      name: "x",
      data: {
        id: "data-schema-orig",
        name: "x",
        entries: [{ id: "e1", key: "k", label: "L", valueType: "int", value: 1 }],
      },
    };
    const moved = moveAddon(original) as DataSchemaSectionAddon;
    moved.data.entries[0].value = 999;
    expect(original.data.entries[0].value).toBe(1);
  });
});
