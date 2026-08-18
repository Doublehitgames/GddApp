/**
 * The MCP response projection layer.
 *
 * These tools used to echo the whole REST payload back at the agent: a
 * 150-character description edit on an animal page cost ~78 KB, and listing a
 * 185-page project cost 2.1 MB. The projections below are what keeps a write
 * to a receipt and a listing to an index.
 */

import {
  addonCreated,
  addonMoved,
  addonReceipt,
  addonRow,
  deleted,
  json,
  projectCreated,
  projectFull,
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
    addons: [
      { id: "a1", type: "progressionTable", name: "Balanceamento", data: { rows: Array.from({ length: 100 }, (_, i) => ({ level: i + 1, xp: i * 10 })) } },
      { id: "a2", type: "dataSchema", name: "Stats", group: "Dados", data: { entries: [] } },
    ],
    addonGroupNotes: {},
    flowchartState: { x: 10, y: 20, zoom: 1.5 },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-18T12:00:00Z",
    createdBy: "user-1",
    createdByName: "Julio",
    updatedBy: "user-1",
    updatedByName: "Julio",
    linkedSpreadsheetId: null,
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
    expect(touched({ content: "", linkedSpreadsheetId: null, order: 0 })).toEqual([
      "content",
      "linkedSpreadsheetId",
      "order",
    ]);
  });

  it("returns an empty list when nothing was sent", () => {
    expect(touched({})).toEqual([]);
    expect(touched({ name: undefined })).toEqual([]);
  });
});

describe("sectionRow", () => {
  it("keeps navigation fields and reduces addons to their types", () => {
    expect(sectionRow(makeSection())).toEqual({
      id: "sec-1",
      title: "Galinha",
      parentId: "sec-parent",
      order: 3,
      dataId: "FARM_ANIMAL_CHICKEN",
      hasDescription: true,
      addons: ["progressionTable", "dataSchema"],
    });
  });

  it("omits parentId, dataId, hasDescription and addons when there is nothing to say", () => {
    const bare = sectionRow(makeSection({
      parentId: null,
      dataId: null,
      content: "",
      contentBlocks: [],
      addons: [],
    }));
    expect(bare).toEqual({ id: "sec-1", title: "Galinha", order: 3 });
  });

  it("flags a description that exists only as blocks", () => {
    const row = sectionRow(makeSection({ content: "", contentBlocks: [{ type: "paragraph" }] }));
    expect(row.hasDescription).toBe(true);
  });

  it("reads addonTypes when the API was asked for ?addons=types", () => {
    // The lean REST response has no `addons` key at all.
    const lean = { id: "sec-1", title: "Galinha", order: 3, content: "x", addonTypes: ["progressionTable", "dataSchema"] };
    expect(sectionRow(lean)).toEqual({
      id: "sec-1", title: "Galinha", order: 3, hasDescription: true,
      addons: ["progressionTable", "dataSchema"],
    });
  });

  it("produces the same row from a lean and a full response", () => {
    const full = makeSection();
    const lean = {
      id: full.id, title: full.title, parentId: full.parentId, order: full.order,
      dataId: full.dataId, content: full.content, contentBlocks: full.contentBlocks,
      addonTypes: full.addons.map((a) => a.type),
    };
    expect(sectionRow(lean)).toEqual(sectionRow(full));
  });

  it("drops the 100-level table it would otherwise carry", () => {
    const full = JSON.stringify(makeSection()).length;
    const row = JSON.stringify(sectionRow(makeSection())).length;
    expect(row).toBeLessThan(full / 15);
  });
});

describe("sectionFull", () => {
  it("keeps the addon data — this is the read path", () => {
    const out = sectionFull(makeSection());
    expect((out.addons as unknown[])[0]).toMatchObject({ type: "progressionTable" });
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

  it("costs a couple hundred characters instead of tens of thousands", () => {
    const before = JSON.stringify(makeSection(), null, 2).length;
    const after = JSON.stringify(sectionReceipt(makeSection(), ["content"])).length;
    expect(before).toBeGreaterThan(5000);
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

describe("addon projections", () => {
  const addon = makeSection().addons[0];
  const schema = makeSection().addons[1];

  it("lists addons by identity only", () => {
    expect(addonRow(addon)).toEqual({ id: "a1", type: "progressionTable", name: "Balanceamento" });
    expect(addonRow(schema)).toEqual({ id: "a2", type: "dataSchema", name: "Stats", group: "Dados" });
  });

  it("returns a receipt naming the written fields", () => {
    expect(addonReceipt(addon, "sec-1", ["rows"])).toEqual({
      ok: true,
      id: "a1",
      type: "progressionTable",
      name: "Balanceamento",
      sectionId: "sec-1",
      updated: ["rows"],
    });
  });

  it("keeps a 100-level table out of the write response", () => {
    const receipt = JSON.stringify(addonReceipt(addon, "sec-1", ["rows"]));
    expect(receipt).not.toContain("level");
    expect(receipt.length).toBeLessThan(200);
  });

  it("hands back the new id on create", () => {
    expect(addonCreated(addon, "sec-1")).toEqual({
      ok: true, id: "a1", type: "progressionTable", name: "Balanceamento", sectionId: "sec-1",
    });
  });

  it("unwraps move_addon's { addon, reverseRefsUpdated } envelope", () => {
    expect(addonMoved({ addon, reverseRefsUpdated: 4 }, "sec-2")).toEqual({
      ok: true, id: "a1", type: "progressionTable", name: "Balanceamento", toSectionId: "sec-2", reverseRefsUpdated: 4,
    });
  });

  it("accepts copy_addon's bare addon and reports zero rewrites honestly", () => {
    const out = addonMoved(addon, "sec-2");
    expect(out).toEqual({
      ok: true, id: "a1", type: "progressionTable", name: "Balanceamento", toSectionId: "sec-2",
    });
    expect(out).not.toHaveProperty("reverseRefsUpdated");
  });

  it("keeps reverseRefsUpdated when it is zero", () => {
    expect(addonMoved({ addon, reverseRefsUpdated: 0 }, "sec-2").reverseRefsUpdated).toBe(0);
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
    linkedSpreadsheets: [{ id: "sheet-1", name: "Economia" }],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-08-18T12:00:00Z",
    sections: [makeSection(), makeSection({ id: "sec-2", title: "Vaca", parentId: null, content: "", contentBlocks: [], addons: [] })],
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
    expect(out.linkedSpreadsheets).toHaveLength(1);
    expect(out.sectionCount).toBe(2);
    expect(out.sections).toEqual([sectionRow(project.sections[0]), sectionRow(project.sections[1])]);
    expect(JSON.stringify(out)).not.toContain("flowchartState");
  });

  it("keeps every addon under includeAddons, minus the per-section noise", () => {
    const out = projectFull(project);
    const sections = out.sections as Record<string, unknown>[];
    expect((sections[0].addons as unknown[])[0]).toMatchObject({ type: "progressionTable" });
    expect(sections[0]).not.toHaveProperty("flowchartState");
    expect(out.ownerId).toBe("user-1");
  });

  it("does not mutate the input project", () => {
    projectFull(project);
    expect(project.sections[0]).toHaveProperty("flowchartState");
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

  it("drops the addons that made search results balloon", () => {
    const out = searchProjection({ projects: [], sections: [makeSection()] });
    expect(JSON.stringify(out)).not.toContain("progressionTable");
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
