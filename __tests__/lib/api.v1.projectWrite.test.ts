/**
 * The project PATCH's write logic. The rule that bites is the same one as in
 * sectionWrite: markdown is only auto-converted to blocks when the caller did
 * NOT send blocks — otherwise an agent writing prose through the MCP would
 * silently overwrite the blocks a human just edited in the app.
 */

import { buildProjectUpdates } from "@/lib/api/v1/projectWrite";

const CTX = { now: "2026-09-05T12:00:00Z" };

describe("buildProjectUpdates", () => {
  it("always stamps when it was written", () => {
    expect(buildProjectUpdates({ title: "Granjita Alegre" }, CTX)).toMatchObject({
      updated_at: CTX.now,
      title: "Granjita Alegre",
    });
  });

  it("maps the API names onto column names", () => {
    const updates = buildProjectUpdates(
      { coverImageUrl: null, mindmapSettings: { zoom: 2 }, aiInstructions: "Use $[...]" },
      CTX,
    );
    expect(updates).toMatchObject({
      cover_image_url: null,
      mindmap_settings: { zoom: 2 },
      ai_instructions: "Use $[...]",
    });
  });

  it("touches only the fields the caller sent", () => {
    expect(Object.keys(buildProjectUpdates({ title: "P" }, CTX)).sort()).toEqual([
      "title",
      "updated_at",
    ]);
  });

  it("derives blocks from the markdown when the caller sends no blocks", () => {
    const updates = buildProjectUpdates({ description: "# Visão geral\n\nUm jogo de fazenda." }, CTX);
    expect(updates.description).toBe("# Visão geral\n\nUm jogo de fazenda.");
    expect(Array.isArray(updates.content_blocks)).toBe(true);
    expect((updates.content_blocks as unknown[]).length).toBeGreaterThan(0);
  });

  it("keeps the caller's blocks instead of re-deriving them from markdown", () => {
    const blocks = [{ type: "paragraph", content: [{ type: "text", text: "Da mão do editor" }] }];
    const updates = buildProjectUpdates({ description: "Espelho divergente", contentBlocks: blocks }, CTX);
    expect(updates.content_blocks).toBe(blocks);
  });

  it("stores an emptied description as null blocks, not an empty array", () => {
    expect(buildProjectUpdates({ description: "" }, CTX).content_blocks).toBeNull();
    expect(buildProjectUpdates({ contentBlocks: [] }, CTX).content_blocks).toBeNull();
  });

  it("merges a vision patch into the current vision", () => {
    const updates = buildProjectUpdates(
      { vision: { pillars: ["Colheita", "Troca"] } },
      { ...CTX, currentVision: { logline: "Uma fazenda que conversa", pillars: ["Velho"] } },
    );
    expect(updates.vision).toEqual({ logline: "Uma fazenda que conversa", pillars: ["Colheita", "Troca"] });
  });

  it("writes a vision even when the project had none", () => {
    expect(buildProjectUpdates({ vision: { genre: "Simulação" } }, CTX).vision).toEqual({ genre: "Simulação" });
  });

  it("clears the vision with null", () => {
    const updates = buildProjectUpdates({ vision: null }, { ...CTX, currentVision: { genre: "Simulação" } });
    expect(updates.vision).toBeNull();
  });

  it("leaves the vision alone when the caller does not send it", () => {
    expect("vision" in buildProjectUpdates({ title: "P" }, { ...CTX, currentVision: { genre: "X" } })).toBe(false);
  });

  it("leaves blocks alone when only unrelated fields change", () => {
    const updates = buildProjectUpdates({ title: "Outro nome" }, CTX);
    expect("content_blocks" in updates).toBe(false);
  });
});

/**
 * The technical sheet lives inside mindmap_settings, beside the mind map's
 * layout, the document theme and the public share link. Writing the sheet
 * must not touch any of those.
 */
describe("buildProjectUpdates — sheet", () => {
  const current = {
    layout: "radial",
    sharing: { isPublic: true, shareToken: "tok" },
    documentView: { theme: "paper", spotlight: { features: ["Old"], technicalDetails: ["Engine: Unity"], storeLinks: [] } },
  };

  it("writes only the sheet, merging key by key", () => {
    const updates = buildProjectUpdates({ sheet: { features: ["Co-op local"] } }, { ...CTX, currentMindmapSettings: current });
    expect(updates.mindmap_settings).toEqual({
      layout: "radial",
      sharing: { isPublic: true, shareToken: "tok" },
      documentView: {
        theme: "paper",
        spotlight: { features: ["Co-op local"], technicalDetails: ["Engine: Unity"], storeLinks: [], titleIconUrl: undefined },
      },
    });
  });

  it("null clears the sheet and keeps the rest", () => {
    const updates = buildProjectUpdates({ sheet: null }, { ...CTX, currentMindmapSettings: current });
    expect(updates.mindmap_settings).toEqual({ layout: "radial", sharing: current.sharing, documentView: { theme: "paper" } });
  });

  it("starts a sheet on a project that has no settings yet", () => {
    const updates = buildProjectUpdates({ sheet: { technicalDetails: ["Tags: Casual, 2D"] } }, CTX);
    expect(updates.mindmap_settings).toMatchObject({ documentView: { spotlight: { technicalDetails: ["Tags: Casual, 2D"] } } });
  });
});

describe("vision.genre in the API", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { updateProjectSchema } = require("@/lib/api/v1/schemas") as typeof import("@/lib/api/v1/schemas");

  it("is stored as the genre id, whether the id or a label was sent", () => {
    expect(updateProjectSchema.parse({ vision: { genre: "simulation" } }).vision?.genre).toBe("simulation");
    expect(updateProjectSchema.parse({ vision: { genre: "RPG de ação" } }).vision?.genre).toBe("action-rpg");
    expect(updateProjectSchema.parse({ vision: { genre: "Fazendinha" } }).vision?.genre).toBe("Fazendinha");
  });
});
