import {
  resolveExportSchema,
  buildSectionLookup,
  getChildSections,
} from "@/lib/addons/exportSchemaResolver";
import type {
  ExportSchemaNode,
  DataSchemaSectionAddon,
} from "@/lib/addons/types";

// ── Fixtures ─────────────────────────────────────────────────────────
// A parent section "Sementes" with two seed children (Nabo, Cenoura). Each
// child carries a DataSchema addon with the SAME name ("Stats") and SAME entry
// keys, but a DIFFERENT addon id — mirroring template-created pages. The export
// template binds via the addon-name + entry-key fallbacks so one template
// resolves across every sibling.

function dataSchema(id: string, unlock: number, harvestXp: number, buyPrice: number): DataSchemaSectionAddon {
  return {
    id,
    type: "dataSchema",
    name: "Stats",
    data: {
      id,
      name: "Stats",
      entries: [
        { id: `${id}-id`, key: "id", label: "ID", valueType: "string", value: "", binding: { source: "pageDataId" } },
        { id: `${id}-unlock`, key: "unlockLevel", label: "Unlock", valueType: "int", value: unlock },
        { id: `${id}-hxp`, key: "harvestXp", label: "Harvest XP", valueType: "int", value: harvestXp },
        { id: `${id}-buy`, key: "buyPrice", label: "Buy Price", valueType: "int", value: buyPrice },
      ],
    },
  } as DataSchemaSectionAddon;
}

const projects = [
  {
    id: "proj-1",
    sections: [
      { id: "sec-parent", title: "Sementes", order: 0, parentId: null, dataId: null, addons: [] },
      // Intentionally out of order to prove `order` sorting:
      { id: "sec-carrot", title: "Cenoura", order: 1, parentId: "sec-parent", dataId: "SEED_CARROT", addons: [dataSchema("ds-carrot", 2, 10, 56)] },
      { id: "sec-nabo", title: "Nabo", order: 0, parentId: "sec-parent", dataId: "SEED_TURNIP", addons: [dataSchema("ds-nabo", 1, 9, 50)] },
      // A non-seed sibling elsewhere in the tree must NOT leak in:
      { id: "sec-other", title: "Outra", order: 0, parentId: "sec-root", dataId: "OTHER", addons: [dataSchema("ds-other", 99, 99, 99)] },
    ],
  },
];

// Aggregator schema: { seedSettings: [ { id, unlockLevel, harvestXp, buyPrice } ] }
// Bindings carry the Nabo page's addon id, but rely on name+key fallback to
// resolve against each child.
const schemaNodes: ExportSchemaNode[] = [
  {
    id: "n-root",
    key: "seedSettings",
    nodeType: "array",
    arraySource: { type: "sections", parentSectionId: "sec-parent" },
    itemTemplate: [
      { id: "t-id", key: "id", nodeType: "value", binding: { source: "dataSchema", addonId: "ds-nabo", addonName: "Stats", entryKey: "id" } },
      { id: "t-unlock", key: "unlockLevel", nodeType: "value", binding: { source: "dataSchema", addonId: "ds-nabo", addonName: "Stats", entryKey: "unlockLevel" } },
      { id: "t-hxp", key: "harvestXp", nodeType: "value", binding: { source: "dataSchema", addonId: "ds-nabo", addonName: "Stats", entryKey: "harvestXp" } },
      { id: "t-buy", key: "buyPrice", nodeType: "value", binding: { source: "dataSchema", addonId: "ds-nabo", addonName: "Stats", entryKey: "buyPrice" } },
    ],
  },
];

describe("getChildSections", () => {
  it("returns only direct children, sorted by tree order", () => {
    const lookup = buildSectionLookup(projects);
    const children = getChildSections("sec-parent", lookup);
    expect(children.map((c) => c.id)).toEqual(["sec-nabo", "sec-carrot"]);
  });

  it("returns [] for a parent with no children", () => {
    const lookup = buildSectionLookup(projects);
    expect(getChildSections("sec-nabo", lookup)).toEqual([]);
  });
});

describe("resolveExportSchema — sections array source", () => {
  it("produces one object per child page, in tree order, resolved against each child", () => {
    const lookup = buildSectionLookup(projects);
    const out = resolveExportSchema(schemaNodes, [], undefined, "rowMajor", lookup);
    expect(out).toEqual({
      seedSettings: [
        { id: "SEED_TURNIP", unlockLevel: 1, harvestXp: 9, buyPrice: 50 },
        { id: "SEED_CARROT", unlockLevel: 2, harvestXp: 10, buyPrice: 56 },
      ],
    });
  });

  it("returns an empty array when the parent has no children or no lookup", () => {
    const lookup = buildSectionLookup(projects);
    const emptyParent: ExportSchemaNode[] = [
      { ...schemaNodes[0], arraySource: { type: "sections", parentSectionId: "sec-nabo" } },
    ];
    expect(resolveExportSchema(emptyParent, [], undefined, "rowMajor", lookup)).toEqual({ seedSettings: [] });
    // No lookup at all → empty.
    expect(resolveExportSchema(schemaNodes, [])).toEqual({ seedSettings: [] });
  });
});
