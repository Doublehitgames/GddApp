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

  it("leaves blocks alone when only unrelated fields change", () => {
    const updates = buildProjectUpdates({ title: "Outro nome" }, CTX);
    expect("content_blocks" in updates).toBe(false);
  });
});
