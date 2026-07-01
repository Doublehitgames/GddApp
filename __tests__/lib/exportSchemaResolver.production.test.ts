import {
  buildSectionLookup,
  resolveExportSchema,
} from "@/lib/addons/exportSchemaResolver";
import { normalizeSectionAddons } from "@/lib/addons/normalize";
import type {
  ExportSchemaNode,
  ProductionSectionAddon,
  SectionAddon,
} from "@/lib/addons/types";

// ── Fixtures ─────────────────────────────────────────────────────────
//
// A single page with a Production addon in Recipe mode plus two "item" pages
// (wood, plank) whose dataIds the ingredient/output refs resolve to. This
// mirrors the standalone Recipe export the user needs: a recipe exported to
// Remote Config WITHOUT going through a Craft Table.

const SEC_WOOD_ID = "sec-wood";
const SEC_WOOD_DATA_ID = "ITEM_WOOD";
const SEC_PLANK_ID = "sec-plank";
const SEC_PLANK_DATA_ID = "ITEM_PLANK";
const SEC_RECIPE_ID = "sec-recipe";

const ADDON_PROD_ID = "addon-prod";

const productionAddon: ProductionSectionAddon = {
  id: ADDON_PROD_ID,
  type: "production",
  name: "Plank Recipe",
  data: {
    id: ADDON_PROD_ID,
    name: "Plank Recipe",
    mode: "recipe",
    craftTimeSeconds: 30,
    ingredients: [{ itemRef: SEC_WOOD_ID, quantity: 3 }],
    outputs: [{ itemRef: SEC_PLANK_ID, quantity: 2 }],
  },
};

const lookup = buildSectionLookup([
  {
    sections: [
      { id: SEC_WOOD_ID, dataId: SEC_WOOD_DATA_ID, addons: [] },
      { id: SEC_PLANK_ID, dataId: SEC_PLANK_DATA_ID, addons: [] },
      { id: SEC_RECIPE_ID, dataId: "DATA_RECIPE", addons: [productionAddon] },
    ],
  },
]);

// Full recipe object: a scalar (craftTimeSeconds) via productionField, plus the
// ingredients/outputs arrays — all bound directly to the Production addon by id.
const recipeSchema: ExportSchemaNode[] = [
  {
    id: "n-recipe",
    key: "recipe",
    nodeType: "object",
    children: [
      {
        id: "n-time",
        key: "craftTimeSeconds",
        nodeType: "value",
        binding: { source: "productionField", field: "craftTimeSeconds", addonId: ADDON_PROD_ID },
      },
      {
        id: "n-mode",
        key: "mode",
        nodeType: "value",
        binding: { source: "productionField", field: "mode", addonId: ADDON_PROD_ID },
      },
      {
        id: "n-ing",
        key: "ingredients",
        nodeType: "array",
        arraySource: { type: "productionIngredients", addonId: ADDON_PROD_ID },
        itemTemplate: [
          { id: "n-ing-item", key: "item", nodeType: "value", binding: { source: "itemField", field: "itemRef" } },
          { id: "n-ing-qty", key: "qty", nodeType: "value", binding: { source: "itemField", field: "quantity" } },
        ],
      },
      {
        id: "n-out",
        key: "outputs",
        nodeType: "array",
        arraySource: { type: "productionOutputs", addonId: ADDON_PROD_ID },
        itemTemplate: [
          { id: "n-out-item", key: "item", nodeType: "value", binding: { source: "itemField", field: "itemRef" } },
          { id: "n-out-qty", key: "qty", nodeType: "value", binding: { source: "itemField", field: "quantity" } },
        ],
      },
    ],
  },
];

describe("resolveExportSchema — standalone Production (Recipe) export", () => {
  it("exports the full recipe (scalar + ingredients + outputs) without a Craft Table", () => {
    const out = resolveExportSchema(recipeSchema, [productionAddon], "DATA_RECIPE", "rowMajor", lookup);
    expect(out).toEqual({
      recipe: {
        craftTimeSeconds: 30,
        mode: "recipe",
        ingredients: [{ item: SEC_WOOD_DATA_ID, qty: 3 }],
        outputs: [{ item: SEC_PLANK_DATA_ID, qty: 2 }],
      },
    });
  });

  it("survives a normalize round-trip (addonId/addonName preserved)", () => {
    const normalized = normalizeSectionAddons([
      { id: "es", type: "exportSchema", name: "RC", data: { id: "es", name: "RC", nodes: recipeSchema } },
    ] as SectionAddon[]);
    const nodes = (normalized![0].data as { nodes: ExportSchemaNode[] }).nodes;
    const out = resolveExportSchema(nodes, [productionAddon], "DATA_RECIPE", "rowMajor", lookup);
    expect(out).toEqual({
      recipe: {
        craftTimeSeconds: 30,
        mode: "recipe",
        ingredients: [{ item: SEC_WOOD_DATA_ID, qty: 3 }],
        outputs: [{ item: SEC_PLANK_DATA_ID, qty: 2 }],
      },
    });
  });

  it("exposes the first output as flat scalars (outputQuantity / outputItemRef)", () => {
    const flatSchema: ExportSchemaNode[] = [
      { id: "f-time", key: "craftTimeSeconds", nodeType: "value", binding: { source: "productionField", field: "craftTimeSeconds", addonId: ADDON_PROD_ID } },
      { id: "f-out-item", key: "outputItem", nodeType: "value", binding: { source: "productionField", field: "outputItemRef", addonId: ADDON_PROD_ID } },
      { id: "f-out-qty", key: "outputQty", nodeType: "value", binding: { source: "productionField", field: "outputQuantity", addonId: ADDON_PROD_ID } },
    ];
    const out = resolveExportSchema(flatSchema, [productionAddon], "DATA_RECIPE", "rowMajor", lookup);
    expect(out).toEqual({
      craftTimeSeconds: 30,
      outputItem: SEC_PLANK_DATA_ID,
      outputQty: 2,
    });
  });

  it("falls back to zero-ish defaults when the referenced Production addon is missing", () => {
    const out = resolveExportSchema(recipeSchema, [], "DATA_RECIPE", "rowMajor", lookup);
    expect(out).toEqual({
      recipe: { craftTimeSeconds: 0, mode: "", ingredients: [], outputs: [] },
    });
  });
});
