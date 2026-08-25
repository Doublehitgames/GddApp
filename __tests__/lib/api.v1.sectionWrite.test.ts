/**
 * The write logic shared by the single-section PATCH and the batch PATCH.
 *
 * These two paths must not drift. The rule that bites is content_blocks:
 * markdown is only auto-converted when the caller did NOT send blocks.
 */

import {
  BATCH_SECTION_LIMIT,
  batchSectionsSchema,
  buildSectionUpdates,
  mapWithConcurrency,
} from "@/lib/api/v1/sectionWrite";

const CTX = { userId: "user-1", now: "2026-08-18T12:00:00Z" };
// A real section id from the Granjita project — zod v4 validates the UUID
// version and variant nibbles, so a made-up 1111-2222 string is rejected.
const SECTION_ID = "95ef7ef6-9d0a-46f6-99ce-199a94b49019";

describe("buildSectionUpdates", () => {
  it("always stamps who wrote it and when", () => {
    const { updates } = buildSectionUpdates({ title: "Galinha" }, CTX);
    expect(updates).toMatchObject({ updated_at: CTX.now, updated_by: "user-1", title: "Galinha" });
  });

  it("maps the API names onto column names", () => {
    const { updates } = buildSectionUpdates({
      order: 4, dataId: "FARM_ANIMAL_CHICKEN", parentId: null,
      thumbImageUrl: null, domainTags: ["economy"],
    }, CTX);
    expect(updates).toMatchObject({
      sort_order: 4,
      data_id: "FARM_ANIMAL_CHICKEN",
      parent_id: null,
      thumb_image_url: null,
      domain_tags: ["economy"],
    });
  });

  it("touches only the fields the caller sent", () => {
    const { touched } = buildSectionUpdates({ content: "texto", color: "#ffcc00" }, CTX);
    expect(touched.sort()).toEqual(["color", "content"]);
  });

  it("derives blocks from markdown when no blocks were given", () => {
    const { updates } = buildSectionUpdates({ content: "# Titulo\n\nUm paragrafo." }, CTX);
    expect(Array.isArray(updates.content_blocks)).toBe(true);
    expect((updates.content_blocks as unknown[]).length).toBeGreaterThan(0);
    expect(updates.content).toBe("# Titulo\n\nUm paragrafo.");
  });

  it("does NOT derive blocks when the caller supplied them", () => {
    const blocks = [{ type: "paragraph", content: [{ type: "text", text: "explicito" }] }];
    const { updates } = buildSectionUpdates({ content: "# Ignorado", contentBlocks: blocks }, CTX);
    expect(updates.content_blocks).toBe(blocks);
    // the plain-text mirror is still written, for search
    expect(updates.content).toBe("# Ignorado");
  });

  it("stores an empty blocks array as null, not []", () => {
    const { updates } = buildSectionUpdates({ contentBlocks: [] }, CTX);
    expect(updates.content_blocks).toBeNull();
  });

  it("clearing the description clears the blocks too", () => {
    const { updates } = buildSectionUpdates({ content: "" }, CTX);
    expect(updates.content).toBe("");
    expect(updates.content_blocks).toBeNull();
  });

  it("leaves content_blocks alone when neither field was sent", () => {
    const { updates } = buildSectionUpdates({ color: "#000000" }, CTX);
    expect(updates).not.toHaveProperty("content_blocks");
    expect(updates).not.toHaveProperty("content");
  });
});

describe("batchSectionsSchema", () => {
  const item = (over = {}) => ({ sectionId: SECTION_ID, content: "x", ...over });

  it("accepts a batch up to the limit", () => {
    const sections = Array.from({ length: BATCH_SECTION_LIMIT }, () => item());
    expect(batchSectionsSchema.safeParse({ sections }).success).toBe(true);
  });

  it("rejects one over the limit rather than truncating", () => {
    const sections = Array.from({ length: BATCH_SECTION_LIMIT + 1 }, () => item());
    expect(batchSectionsSchema.safeParse({ sections }).success).toBe(false);
  });

  it("rejects an empty batch", () => {
    expect(batchSectionsSchema.safeParse({ sections: [] }).success).toBe(false);
  });

  it("requires a uuid sectionId on every entry", () => {
    expect(batchSectionsSchema.safeParse({ sections: [item({ sectionId: "not-a-uuid" })] }).success).toBe(false);
    expect(batchSectionsSchema.safeParse({ sections: [{ content: "x" }] }).success).toBe(false);
  });

  it("still enforces the per-field rules of a single update", () => {
    expect(batchSectionsSchema.safeParse({ sections: [item({ color: "red" })] }).success).toBe(false);
    expect(batchSectionsSchema.safeParse({ sections: [item({ color: "#ff0000" })] }).success).toBe(true);
    expect(batchSectionsSchema.safeParse({ sections: [item({ order: -1 })] }).success).toBe(false);
  });
});

describe("mapWithConcurrency", () => {
  it("keeps results in input order regardless of completion order", async () => {
    const out = await mapWithConcurrency([30, 10, 20, 0], 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return `${i}:${ms}`;
    });
    expect(out).toEqual(["0:30", "1:10", "2:20", "3:0"]);
  });

  it("never exceeds the limit in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("handles an empty list without spawning workers", async () => {
    expect(await mapWithConcurrency([], 8, async () => "never")).toEqual([]);
  });

  it("does not spawn more workers than there are items", async () => {
    let peak = 0;
    let inFlight = 0;
    await mapWithConcurrency([1, 2], 8, async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });
});
