import { collectIntraSectionDeps, clearIntraSectionRefs } from "@/lib/addons/refs";
import { moveAddon } from "@/lib/addons/move";
import type {
  DataSchemaSectionAddon,
  ExportSchemaSectionAddon,
  ProductionSectionAddon,
  SectionAddon,
} from "@/lib/addons/types";

describe("collectIntraSectionDeps", () => {
  it("returns productionRef from DataSchema entries", () => {
    const addon: DataSchemaSectionAddon = {
      id: "ds-1",
      type: "dataSchema",
      name: "x",
      data: {
        id: "ds-1",
        name: "x",
        entries: [
          { id: "e1", key: "a", label: "A", valueType: "int", value: 0, productionRef: "prod-1" },
          { id: "e2", key: "b", label: "B", valueType: "int", value: 0, productionRef: "prod-2" },
          { id: "e3", key: "c", label: "C", valueType: "int", value: 0 },
        ],
      },
    };
    expect(collectIntraSectionDeps(addon).sort()).toEqual(["prod-1", "prod-2"]);
  });

  it("returns all progression links from Production", () => {
    const addon: ProductionSectionAddon = {
      id: "prod-1",
      type: "production",
      name: "P",
      data: {
        id: "prod-1",
        name: "P",
        mode: "passive",
        ingredients: [],
        outputs: [],
        minOutputProgressionLink: { progressionAddonId: "pt-a", columnId: "c", columnName: "C" },
        maxOutputProgressionLink: { progressionAddonId: "pt-a", columnId: "c", columnName: "C" },
        craftTimeSecondsProgressionLink: { progressionAddonId: "pt-b", columnId: "c", columnName: "C" },
      },
    };
    const deps = collectIntraSectionDeps(addon).sort();
    expect(deps).toEqual(["pt-a", "pt-b"]);
  });

  it("walks ExportSchema nodes recursively", () => {
    const addon: ExportSchemaSectionAddon = {
      id: "es-1",
      type: "exportSchema",
      name: "E",
      data: {
        id: "es-1",
        name: "E",
        nodes: [
          {
            id: "n1",
            key: "arr",
            nodeType: "array",
            arraySource: { type: "progressionTable", addonId: "pt-1" },
            itemTemplate: [
              {
                id: "n1a",
                key: "v",
                nodeType: "value",
                binding: { source: "dataSchema", addonId: "ds-1", entryKey: "x" },
              },
            ],
          },
          {
            id: "n2",
            key: "obj",
            nodeType: "object",
            children: [
              {
                id: "n2a",
                key: "nested",
                nodeType: "value",
                binding: { source: "dataSchema", addonId: "ds-2", entryKey: "y" },
              },
            ],
          },
        ],
      },
    };
    expect(collectIntraSectionDeps(addon).sort()).toEqual(["ds-1", "ds-2", "pt-1"]);
  });

  it("returns empty for addons without deps (e.g. currency)", () => {
    const addon: SectionAddon = {
      id: "c-1",
      type: "currency",
      name: "GLD",
      data: { id: "c-1", name: "GLD", code: "GLD", displayName: "Gold", kind: "soft", decimals: 0 },
    };
    expect(collectIntraSectionDeps(addon)).toEqual([]);
  });
});

describe("clearIntraSectionRefs with preserveIds", () => {
  it("preserves DataSchema productionRef when in preserve set", () => {
    const data = {
      id: "ds-1",
      name: "x",
      entries: [
        { id: "e1", key: "a", label: "A", valueType: "int", value: 0, productionRef: "keep-me" },
        { id: "e2", key: "b", label: "B", valueType: "int", value: 0, productionRef: "drop-me" },
      ],
    } as Record<string, unknown>;
    clearIntraSectionRefs(data, "dataSchema", new Set(["keep-me"]));
    const entries = data.entries as Array<{ productionRef?: string }>;
    expect(entries[0].productionRef).toBe("keep-me");
    expect(entries[1].productionRef).toBeUndefined();
  });

  it("preserves Production progression link when its id is in preserve set", () => {
    const data = {
      id: "p-1",
      name: "P",
      mode: "passive",
      ingredients: [],
      outputs: [],
      minOutputProgressionLink: { progressionAddonId: "keep", columnId: "c", columnName: "C" },
      maxOutputProgressionLink: { progressionAddonId: "drop", columnId: "c", columnName: "C" },
    } as Record<string, unknown>;
    clearIntraSectionRefs(data, "production", new Set(["keep"]));
    expect((data as { minOutputProgressionLink?: unknown }).minOutputProgressionLink).toEqual({
      progressionAddonId: "keep",
      columnId: "c",
      columnName: "C",
    });
    expect((data as { maxOutputProgressionLink?: unknown }).maxOutputProgressionLink).toBeUndefined();
  });

  it("preserves ExportSchema binding addonId when in preserve set", () => {
    const data = {
      id: "e-1",
      name: "E",
      nodes: [
        {
          id: "n1",
          key: "v",
          nodeType: "value",
          binding: { source: "dataSchema", addonId: "keep", entryKey: "k" },
        },
        {
          id: "n2",
          key: "v2",
          nodeType: "value",
          binding: { source: "dataSchema", addonId: "drop", entryKey: "k" },
        },
      ],
    } as Record<string, unknown>;
    clearIntraSectionRefs(data, "exportSchema", new Set(["keep"]));
    const nodes = data.nodes as Array<{ binding?: { addonId?: string } }>;
    expect(nodes[0].binding?.addonId).toBe("keep");
    expect(nodes[1].binding?.addonId).toBeUndefined();
  });
});

describe("moveAddon with preserveIds", () => {
  it("preserves refs pointing to addons in the preserve set", () => {
    const addon: ProductionSectionAddon = {
      id: "p-1",
      type: "production",
      name: "P",
      data: {
        id: "p-1",
        name: "P",
        mode: "passive",
        ingredients: [],
        outputs: [],
        minOutputProgressionLink: { progressionAddonId: "pt-1", columnId: "c", columnName: "C" },
        maxOutputProgressionLink: { progressionAddonId: "pt-2", columnId: "c", columnName: "C" },
      },
    };
    const moved = moveAddon(addon, new Set(["pt-1"])) as ProductionSectionAddon;
    expect(moved.data.minOutputProgressionLink?.progressionAddonId).toBe("pt-1");
    expect(moved.data.maxOutputProgressionLink).toBeUndefined();
  });
});
