import {
  buildSectionLookupFromRows,
  collectSubtree,
  resolveConfigsForSections,
} from "@/lib/api/v1/remoteConfig";
import type { SectionRow } from "@/lib/api/v1/helpers";

// ── Row builder ──────────────────────────────────────────────────────
// Only a handful of SectionRow fields matter to the resolver; fill the
// rest with inert defaults so the fixtures stay readable.

function mkRow(p: {
  id: string;
  parentId?: string | null;
  title?: string;
  order?: number;
  dataId?: string | null;
  addons?: unknown[];
}): SectionRow {
  return {
    id: p.id,
    project_id: "proj-1",
    parent_id: p.parentId ?? null,
    title: p.title ?? p.id,
    content: "",
    sort_order: p.order ?? 0,
    color: null,
    thumb_image_url: null,
    domain_tags: [],
    balance_addons: p.addons ?? [],
    addon_group_notes: null,
    data_id: p.dataId ?? null,
    flowchart_state: null,
    created_at: "",
    updated_at: "",
    created_by: null,
    created_by_name: null,
    updated_by: null,
    updated_by_name: null,
  };
}

// ── collectSubtree ───────────────────────────────────────────────────

describe("collectSubtree", () => {
  const sections = [
    mkRow({ id: "root" }),
    mkRow({ id: "animals", parentId: "root" }),
    mkRow({ id: "farm", parentId: "animals" }),
    mkRow({ id: "chicken", parentId: "farm" }),
    mkRow({ id: "cow", parentId: "farm" }),
    mkRow({ id: "seeds", parentId: "root" }), // unrelated branch
  ];

  it("includes the root plus every descendant", () => {
    expect(collectSubtree("animals", sections)).toEqual(
      new Set(["animals", "farm", "chicken", "cow"])
    );
  });

  it("returns just the node for a leaf", () => {
    expect(collectSubtree("chicken", sections)).toEqual(new Set(["chicken"]));
  });

  it("does not bleed into sibling branches", () => {
    expect(collectSubtree("animals", sections).has("seeds")).toBe(false);
  });
});

// ── resolveConfigsForSections: single section ────────────────────────

describe("resolveConfigsForSections — progressionTable in one section", () => {
  const tableAddon = {
    id: "pt-1",
    type: "progressionTable",
    name: "Levels",
    data: {
      id: "pt-1",
      name: "Levels",
      startLevel: 1,
      endLevel: 2,
      columns: [{ id: "price", name: "price" }],
      rows: [
        { level: 1, values: { price: 100 } },
        { level: 2, values: { price: 200 } },
      ],
    },
  };

  const exportAddon = {
    id: "es-1",
    type: "exportSchema",
    name: "Remote Config",
    data: {
      id: "es-1",
      name: "Remote Config",
      nodes: [
        {
          id: "n1",
          key: "levelSettings",
          nodeType: "array",
          arraySource: { type: "progressionTable", addonId: "pt-1" },
          itemTemplate: [
            { id: "t1", key: "level", nodeType: "value", binding: { source: "rowLevel" } },
            { id: "t2", key: "price", nodeType: "value", binding: { source: "rowColumn", columnId: "price" } },
          ],
        },
      ],
    },
  };

  it("finds the exportSchema addon and resolves its levels", () => {
    const sections = [mkRow({ id: "sec-1", dataId: "SEC_1", addons: [tableAddon, exportAddon] })];
    const lookup = buildSectionLookupFromRows(sections);
    const configs = resolveConfigsForSections(sections, lookup);

    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({
      sectionId: "sec-1",
      addonId: "es-1",
      addonName: "Remote Config",
      arrayFormat: "rowMajor",
      dataId: "SEC_1",
    });
    expect(configs[0].resolved).toEqual({
      levelSettings: [
        { level: 1, price: 100 },
        { level: 2, price: 200 },
      ],
    });
  });

  it("ignores sections without an exportSchema addon", () => {
    const sections = [mkRow({ id: "sec-1", addons: [tableAddon] })];
    const lookup = buildSectionLookupFromRows(sections);
    expect(resolveConfigsForSections(sections, lookup)).toHaveLength(0);
  });
});

// ── resolveConfigsForSections: cross-section `sections` aggregation ───
// Mirrors the Granjita pattern: a category section holds ONE exportSchema
// that iterates its child entity sections, pulling each child's own data.

describe("resolveConfigsForSections — sections aggregation (the real use case)", () => {
  function childDataSchema(unlockLevel: number) {
    return {
      id: "ds", // same addon id across children — matched per child context
      type: "dataSchema",
      name: "Schema",
      data: {
        id: "ds",
        name: "Schema",
        entries: [
          { id: "e-id", key: "id", label: "id", value: "", binding: { source: "pageDataId" } },
          { id: "e-unlock", key: "unlockLevel", label: "unlock", value: unlockLevel },
        ],
      },
    };
  }

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
            { id: "t-lv", key: "unlockLevel", nodeType: "value", binding: { source: "dataSchema", addonId: "ds", entryKey: "unlockLevel" } },
          ],
        },
      ],
    },
  };

  const sections = [
    mkRow({ id: "farm", title: "Animais de Fazenda", addons: [categoryExport] }),
    mkRow({ id: "chicken", parentId: "farm", order: 0, dataId: "FARM_ANIMAL_CHICKEN", addons: [childDataSchema(1)] }),
    mkRow({ id: "cow", parentId: "farm", order: 1, dataId: "FARM_ANIMAL_COW", addons: [childDataSchema(5)] }),
  ];

  it("aggregates each child section into one resolved config", () => {
    const lookup = buildSectionLookupFromRows(sections);
    const configs = resolveConfigsForSections(sections, lookup);

    expect(configs).toHaveLength(1);
    expect(configs[0].resolved).toEqual({
      animals: [
        { id: "FARM_ANIMAL_CHICKEN", unlockLevel: 1 },
        { id: "FARM_ANIMAL_COW", unlockLevel: 5 },
      ],
    });
  });
});
