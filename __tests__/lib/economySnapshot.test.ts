import {
  collectEconomyConfigs,
  economyScopeOptions,
  listEconomyConfigs,
} from "@/lib/addons/economySnapshot";
import type { SectionAddon } from "@/lib/addons/types";

// Structural project/section shape accepted by the helper.
type Sec = {
  id: string;
  title: string;
  dataId?: string | null;
  parentId?: string | null;
  order?: number;
  addons?: SectionAddon[];
};
function project(sections: Sec[]) {
  return [{ id: "proj-1", title: "Granjita", sections }];
}

// A category exportSchema that iterates its child sections (the real pattern).
const categoryExport = {
  id: "es-farm",
  type: "exportSchema",
  name: "RemoteConfig Animais de Fazenda",
  data: {
    id: "es-farm",
    name: "RemoteConfig Animais de Fazenda",
    nodes: [
      {
        id: "n-animals",
        key: "animals",
        nodeType: "array",
        arraySource: { type: "sections", parentSectionId: "farm" },
        itemTemplate: [
          { id: "t-id", key: "id", nodeType: "value", binding: { source: "dataSchema", addonId: "ds", entryKey: "id" } },
        ],
      },
    ],
  },
} as unknown as SectionAddon;

function childDataSchema(): SectionAddon {
  return {
    id: "ds",
    type: "dataSchema",
    name: "Schema",
    data: {
      id: "ds",
      name: "Schema",
      entries: [{ id: "e-id", key: "id", label: "id", value: "", binding: { source: "pageDataId" } }],
    },
  } as unknown as SectionAddon;
}

const sections: Sec[] = [
  { id: "animais", title: "Animais" },
  { id: "farm", title: "Animais de Fazenda", parentId: "animais", addons: [categoryExport] },
  { id: "chicken", title: "Galinha", parentId: "farm", order: 0, dataId: "FARM_ANIMAL_CHICKEN", addons: [childDataSchema()] },
  { id: "cow", title: "Vaca", parentId: "farm", order: 1, dataId: "FARM_ANIMAL_COW", addons: [childDataSchema()] },
  { id: "lore", title: "História", parentId: "animais" }, // no economy → excluded from scopes
];

describe("collectEconomyConfigs", () => {
  it("resolves the category config aggregating both child sections", () => {
    const configs = collectEconomyConfigs(project(sections), "proj-1");
    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({ sectionId: "farm", addonName: "RemoteConfig Animais de Fazenda" });
    expect(configs[0].resolved).toEqual({
      animals: [{ id: "FARM_ANIMAL_CHICKEN" }, { id: "FARM_ANIMAL_COW" }],
    });
  });

  it("scoping to a subtree keeps configs under that root", () => {
    expect(collectEconomyConfigs(project(sections), "proj-1", { rootSectionId: "animais" })).toHaveLength(1);
  });

  it("scoping to an unrelated subtree yields nothing", () => {
    expect(collectEconomyConfigs(project(sections), "proj-1", { rootSectionId: "lore" })).toHaveLength(0);
  });
});

describe("economyScopeOptions", () => {
  it("lists only sections whose subtree has a config, with counts and depth", () => {
    const scopes = economyScopeOptions(project(sections), "proj-1");
    // "Animais" (depth 0, count 1) and "Animais de Fazenda" (depth 1, count 1).
    expect(scopes).toEqual([
      { id: "animais", title: "Animais", depth: 0, count: 1 },
      { id: "farm", title: "Animais de Fazenda", depth: 1, count: 1 },
    ]);
    // "História" (no economy) and leaf animal sections are not offered as scopes.
    expect(scopes.some((s) => s.id === "lore")).toBe(false);
  });
});

// A second, independent config so we can test listing and à-la-carte filtering.
const seedsExport = {
  id: "es-seeds",
  type: "exportSchema",
  name: "RemoteConfig Sementes",
  data: {
    id: "es-seeds",
    name: "RemoteConfig Sementes",
    nodes: [{ id: "n-x", key: "x", nodeType: "value", binding: { source: "manual", value: 7 } }],
  },
} as unknown as SectionAddon;

const twoConfigSections: Sec[] = [
  ...sections,
  { id: "sementes", title: "Sementes", addons: [seedsExport] },
];

describe("listEconomyConfigs", () => {
  it("lists every Remote Config with host section + depth (no resolution)", () => {
    const list = listEconomyConfigs(project(twoConfigSections), "proj-1");
    expect(list).toEqual([
      { addonId: "es-farm", sectionId: "farm", sectionTitle: "Animais de Fazenda", addonName: "RemoteConfig Animais de Fazenda", depth: 1 },
      { addonId: "es-seeds", sectionId: "sementes", sectionTitle: "Sementes", addonName: "RemoteConfig Sementes", depth: 0 },
    ]);
  });
});

describe("collectEconomyConfigs — à-la-carte addonIds filter", () => {
  it("returns only the selected configs", () => {
    const configs = collectEconomyConfigs(project(twoConfigSections), "proj-1", { addonIds: ["es-seeds"] });
    expect(configs).toHaveLength(1);
    expect(configs[0].addonId).toBe("es-seeds");
    expect(configs[0].resolved).toEqual({ x: 7 });
  });

  it("an empty addonIds selection yields nothing", () => {
    expect(collectEconomyConfigs(project(twoConfigSections), "proj-1", { addonIds: [] })).toHaveLength(0);
  });
});
