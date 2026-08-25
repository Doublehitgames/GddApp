/**
 * The MCP response projection layer.
 *
 * These tools used to echo the whole REST payload back at the agent. The
 * projections below are what keeps a write to a receipt and a listing to an
 * index.
 */

import {
  deleted,
  json,
  projectCreated,
  projectIndex,
  projectReceipt,
  projectRow,
  searchProjection,
  sectionCreated,
  sectionFull,
  sectionReceipt,
  sectionRow,
  touched,
} from "@/lib/mcp/project";

// A stand-in for the "Galinha" page: description, a 100-level progression
// table, and the UI/audit columns the REST API always sends along.
function makeSection(overrides: Record<string, unknown> = {}) {
  return {
    id: "sec-1",
    projectId: "proj-1",
    parentId: "sec-parent",
    title: "Galinha",
    content: "A galinha bota ovos.",
    contentBlocks: [{ type: "paragraph", content: [] }],
    order: 3,
    color: "#ffcc00",
    thumbImageUrl: null,
    domainTags: ["economy"],
    dataId: "FARM_ANIMAL_CHICKEN",
    flowchartState: { x: 10, y: 20, zoom: 1.5 },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-18T12:00:00Z",
    createdBy: "user-1",
    createdByName: "Julio",
    updatedBy: "user-1",
    updatedByName: "Julio",
    ...overrides,
  };
}

describe("json", () => {
  it("emits compact JSON — pretty-printing is pure token cost", () => {
    const out = json({ a: 1, b: [2, 3] });
    expect(out.content[0].text).toBe('{"a":1,"b":[2,3]}');
    expect(out.content[0].text).not.toContain("\n");
  });
});

describe("touched", () => {
  it("names only the fields the caller actually sent", () => {
    expect(touched({ title: "x", content: undefined, dataId: "Y" })).toEqual(["title", "dataId"]);
  });

  it("keeps falsy-but-intentional values like empty string and null", () => {
    expect(touched({ content: "", dataId: null, order: 0 })).toEqual([
      "content",
      "dataId",
      "order",
    ]);
  });

  it("returns an empty list when nothing was sent", () => {
    expect(touched({})).toEqual([]);
    expect(touched({ name: undefined })).toEqual([]);
  });
});

describe("sectionRow", () => {
  it("keeps the navigation fields", () => {
    expect(sectionRow(makeSection())).toEqual({
      id: "sec-1",
      title: "Galinha",
      parentId: "sec-parent",
      order: 3,
      dataId: "FARM_ANIMAL_CHICKEN",
      hasDescription: true,
    });
  });

  it("omits parentId, dataId and hasDescription when there is nothing to say", () => {
    const bare = sectionRow(makeSection({
      parentId: null,
      dataId: null,
      content: "",
      contentBlocks: [],
    }));
    expect(bare).toEqual({ id: "sec-1", title: "Galinha", order: 3 });
  });

  it("flags a description that exists only as blocks", () => {
    const row = sectionRow(makeSection({ content: "", contentBlocks: [{ type: "paragraph" }] }));
    expect(row.hasDescription).toBe(true);
  });

  it("drops the audit and UI columns the full row carries", () => {
    const full = JSON.stringify(makeSection()).length;
    const row = JSON.stringify(sectionRow(makeSection())).length;
    expect(row).toBeLessThan(full / 2);
  });
});

describe("sectionFull", () => {
  it("keeps the description — this is the read path", () => {
    const out = sectionFull(makeSection());
    expect(out.content).toBe("A galinha bota ovos.");
    expect(out.contentBlocks).toHaveLength(1);
  });

  it("strips the UI and audit columns an agent cannot use", () => {
    const out = sectionFull(makeSection());
    for (const k of ["flowchartState", "createdBy", "createdByName", "updatedBy", "updatedByName"]) {
      expect(out).not.toHaveProperty(k);
    }
  });

  it("does not mutate the input", () => {
    const input = makeSection();
    sectionFull(input);
    expect(input).toHaveProperty("flowchartState");
  });
});

describe("section write receipts", () => {
  it("proves the write and names what changed", () => {
    expect(sectionReceipt(makeSection(), ["content", "contentBlocks"])).toEqual({
      ok: true,
      id: "sec-1",
      title: "Galinha",
      updated: ["content", "contentBlocks"],
      updatedAt: "2026-08-18T12:00:00Z",
    });
  });

  it("costs a couple hundred characters instead of the whole row", () => {
    const before = JSON.stringify(makeSection(), null, 2).length;
    const after = JSON.stringify(sectionReceipt(makeSection(), ["content"])).length;
    expect(after).toBeLessThan(before / 3);
    expect(after).toBeLessThan(200);
  });

  it("hands back the new id on create", () => {
    expect(sectionCreated(makeSection())).toEqual({
      ok: true,
      id: "sec-1",
      title: "Galinha",
      parentId: "sec-parent",
      order: 3,
      dataId: "FARM_ANIMAL_CHICKEN",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("project projections", () => {
  const project = {
    id: "proj-1",
    ownerId: "user-1",
    title: "Granjita Alegre",
    description: "Jogo de fazenda",
    coverImageUrl: "https://example.test/cover.png",
    mindmapSettings: { layout: "tree" },
    aiInstructions: "Use SCREAMING_SNAKE for dataIds",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-18T12:00:00Z",
    sections: [makeSection(), makeSection({ id: "sec-2", title: "Vaca", parentId: null, content: "", contentBlocks: [] })],
  };

  it("lists projects without their settings", () => {
    expect(projectRow(project)).toEqual({
      id: "proj-1",
      title: "Granjita Alegre",
      description: "Jogo de fazenda",
      updatedAt: "2026-08-18T12:00:00Z",
    });
  });

  it("returns settings plus a section index by default", () => {
    const out = projectIndex(project);
    expect(out.aiInstructions).toBe("Use SCREAMING_SNAKE for dataIds");
    expect(out.sectionCount).toBe(2);
    expect(out.sections).toEqual([sectionRow(project.sections[0]), sectionRow(project.sections[1])]);
    expect(JSON.stringify(out)).not.toContain("flowchartState");
  });

  it("announces the image library by count, never by listing it", () => {
    const withImages = { ...project, imageCount: 42 };
    const out = projectIndex(withImages);
    expect(out.imageCount).toBe(42);
    // The files themselves belong to list_project_images.
    expect(JSON.stringify(out)).not.toContain("SEED_");
  });

  it("says nothing about images when the project has no library", () => {
    expect(projectIndex(project)).not.toHaveProperty("imageCount");
  });

  it("receipts a metadata write", () => {
    expect(projectReceipt(project, ["aiInstructions"])).toEqual({
      ok: true, id: "proj-1", title: "Granjita Alegre", updated: ["aiInstructions"], updatedAt: "2026-08-18T12:00:00Z",
    });
    expect(projectCreated(project)).toEqual({
      ok: true, id: "proj-1", title: "Granjita Alegre", createdAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("searchProjection", () => {
  it("turns section hits into pointers with a short excerpt", () => {
    const long = "x".repeat(500);
    const out = searchProjection({
      projects: [{ id: "proj-1", title: "Granjita Alegre", updatedAt: "2026-08-18T12:00:00Z", ownerId: "user-1" }],
      sections: [makeSection({ content: long })],
    });
    expect(out.projects).toEqual([{ id: "proj-1", title: "Granjita Alegre", updatedAt: "2026-08-18T12:00:00Z" }]);
    const hit = (out.sections as Record<string, unknown>[])[0];
    expect(hit).toEqual({
      id: "sec-1",
      projectId: "proj-1",
      title: "Galinha",
      dataId: "FARM_ANIMAL_CHICKEN",
      excerpt: "x".repeat(200),
    });
  });

  it("drops the columns that made search results balloon", () => {
    const out = searchProjection({ projects: [], sections: [makeSection()] });
    expect(JSON.stringify(out)).not.toContain("flowchartState");
  });

  it("survives a result set with no hits", () => {
    expect(searchProjection({ projects: [], sections: [] })).toEqual({ projects: [], sections: [] });
    expect(searchProjection({})).toEqual({ projects: [], sections: [] });
  });
});

describe("deleted", () => {
  it("says what went away, which the bare { deleted: true } did not", () => {
    expect(deleted("section", "sec-1")).toEqual({ ok: true, deleted: "section", id: "sec-1" });
  });
});
