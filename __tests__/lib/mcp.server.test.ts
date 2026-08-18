/**
 * The remote MCP server's tool handlers (lib/mcp/server.ts).
 *
 * Registers the real tools against a stub McpServer + ApiFetcher so we can call
 * a handler and inspect both what it sent to the REST API and what it returned
 * to the agent.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFetcher } from "@/lib/mcp/api";
import { registerAddonTools, registerGenericTools } from "@/lib/mcp/server";

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;

interface Harness {
  call: (tool: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** For results that are not JSON — a refusal, or reference text. */
  callRaw: (tool: string, args: Record<string, unknown>) => Promise<{ text: string; isError: boolean }>;
  sent: { method: string; args: unknown[] }[];
  names: string[];
  descriptionOf: (tool: string) => string;
  schemaOf: (tool: string) => Record<string, unknown>;
}

/**
 * Registers the real tools against a stub server that just records what each
 * one declared, so a handler can be invoked directly.
 */
function harness(responses: Partial<Record<keyof ApiFetcher, unknown>> = {}): Harness {
  const handlers = new Map<string, Handler>();
  const descriptions = new Map<string, string>();
  const schemas = new Map<string, Record<string, unknown>>();
  const sent: { method: string; args: unknown[] }[] = [];

  const server = {
    tool(name: string, description: string, schema: Record<string, unknown>, cb: Handler) {
      handlers.set(name, cb);
      descriptions.set(name, description);
      schemas.set(name, schema);
    },
  } as unknown as McpServer;

  // Every fetcher method records its call and returns a canned payload.
  const api = new Proxy({} as ApiFetcher, {
    get: (_t, method: string) => (...args: unknown[]) => {
      sent.push({ method, args });
      return Promise.resolve(responses[method as keyof ApiFetcher] ?? { id: "unknown" });
    },
  });

  registerGenericTools(server, api);
  registerAddonTools(server, api);

  function invoke(tool: string, args: Record<string, unknown>) {
    const handler = handlers.get(tool);
    if (!handler) throw new Error(`tool not registered: ${tool}`);
    return handler(args);
  }

  return {
    sent,
    names: [...handlers.keys()],
    descriptionOf: (tool) => descriptions.get(tool) ?? "",
    schemaOf: (tool) => schemas.get(tool) ?? {},
    call: async (tool, args) => JSON.parse((await invoke(tool, args)).content[0].text) as Record<string, unknown>,
    callRaw: async (tool, args) => {
      const out = await invoke(tool, args);
      return { text: out.content[0].text, isError: out.isError === true };
    },
  };
}

const SECTION = {
  id: "sec-1",
  title: "Galinha",
  updatedAt: "2026-08-18T12:00:00Z",
  content: "A galinha bota ovos.",
  addons: [{ id: "a1", type: "progressionTable", name: "Balanceamento", data: { rows: [{ level: 1 }] } }],
  flowchartState: { zoom: 2 },
  updatedByName: "Julio",
};

const ADDON = { id: "a1", type: "progressionTable", name: "Balanceamento", data: { rows: [{ level: 1 }] } };

describe("write tools return receipts, not records", () => {
  it("update_section answers with {ok, id, title, updated, updatedAt}", async () => {
    const h = harness({ updateSection: SECTION });
    const out = await h.call("update_section", {
      projectId: "p1", sectionId: "sec-1", content: "novo texto",
    });
    expect(out).toEqual({
      ok: true, id: "sec-1", title: "Galinha", updated: ["content"], updatedAt: "2026-08-18T12:00:00Z",
    });
    // The addon data never reaches the agent.
    expect(JSON.stringify(out)).not.toContain("progressionTable");
  });

  it("update_section does not list fields the caller left out", async () => {
    const h = harness({ updateSection: SECTION });
    const out = await h.call("update_section", { projectId: "p1", sectionId: "sec-1", title: "Galinha Poedeira" });
    expect(out.updated).toEqual(["title"]);
  });

  it("returning:'full' opts back into the whole section", async () => {
    const h = harness({ updateSection: SECTION });
    const out = await h.call("update_section", {
      projectId: "p1", sectionId: "sec-1", content: "novo", returning: "full",
    });
    expect(out.addons).toHaveLength(1);
    // ...still without the UI/audit columns.
    expect(out).not.toHaveProperty("flowchartState");
    expect(out).not.toHaveProperty("updatedByName");
  });

  it("does not forward `returning` to the REST API as a section field", async () => {
    const h = harness({ updateSection: SECTION });
    await h.call("update_section", { projectId: "p1", sectionId: "sec-1", content: "x", returning: "minimal" });
    const [, , fields] = h.sent[0].args as [string, string, Record<string, unknown>];
    expect(fields).toEqual({ content: "x" });
  });

  it("upsert_progression_table_addon receipts the data keys it wrote", async () => {
    const h = harness({ updateAddon: ADDON });
    const out = await h.call("upsert_progression_table_addon", {
      projectId: "p1", sectionId: "sec-1", addonId: "a1", rows: [{ level: 1 }],
    });
    expect(out).toEqual({
      ok: true, id: "a1", type: "progressionTable", name: "Balanceamento", sectionId: "sec-1", updated: ["rows"],
    });
  });

  it("create_section hands back the new id", async () => {
    const h = harness({ createSection: { ...SECTION, id: "sec-new", createdAt: "2026-08-18T12:00:00Z", order: 7 } });
    const out = await h.call("create_section", { projectId: "p1", title: "Pato" });
    expect(out).toMatchObject({ ok: true, id: "sec-new", order: 7 });
  });

  it("move_addon reports how many reverse-refs it rewrote", async () => {
    const h = harness({ moveAddon: { addon: ADDON, reverseRefsUpdated: 3 } });
    const out = await h.call("move_addon", {
      projectId: "p1", sectionId: "sec-1", addonId: "a1", toSectionId: "sec-2",
    });
    expect(out).toEqual({
      ok: true, id: "a1", type: "progressionTable", name: "Balanceamento", toSectionId: "sec-2", reverseRefsUpdated: 3,
    });
  });
});

describe("`mode` is an addon field, not the returning flag", () => {
  // progressionTable, production, attributeModifiers and xpBalance all take a
  // `mode`. Destructuring the returning flag as `mode` would swallow it.
  it.each([
    ["upsert_progression_table_addon", "linear"],
    ["upsert_production_addon", "recipe"],
    ["upsert_attribute_modifiers_addon", "mult"],
  ])("%s forwards mode=%s to the API", async (tool, value) => {
    const h = harness({ updateAddon: ADDON });
    await h.call(tool, { projectId: "p1", sectionId: "sec-1", addonId: "a1", mode: value });
    const [, , , fields] = h.sent[0].args as [string, string, string, { data?: Record<string, unknown> }];
    expect(fields.data?.mode).toBe(value);
  });

  it("upsert_xp_balance_addon forwards mode and still nests params", async () => {
    const h = harness({ updateAddon: { ...ADDON, type: "xpBalance" } });
    await h.call("upsert_xp_balance_addon", {
      projectId: "p1", sectionId: "sec-1", addonId: "a1", mode: "advanced", base: 250,
    });
    const [, , , fields] = h.sent[0].args as [string, string, string, { data?: Record<string, unknown> }];
    expect(fields.data?.mode).toBe("advanced");
    expect(fields.data?.params).toEqual({ base: 250 });
  });

  it("upsert_xp_balance_addon forwards mode", async () => {
    const h = harness({ createAddon: { ...ADDON, type: "xpBalance" } });
    await h.call("upsert_xp_balance_addon", {
      projectId: "p1", sectionId: "sec-1", name: "Curva", mode: "advanced", expression: "n^2",
    });
    const [, , payload] = h.sent[0].args as [string, string, { data: Record<string, unknown> }];
    expect(payload.data.mode).toBe("advanced");
    expect(payload.data.expression).toBe("n^2");
  });
});

describe("one upsert tool per addon type", () => {
  it("routes to createAddon when addonId is absent", async () => {
    const h = harness({ createAddon: ADDON });
    const out = await h.call("upsert_currency_addon", {
      projectId: "p1", sectionId: "sec-1", name: "Moedas",
      code: "GOLD", displayName: "Ouro", kind: "soft",
    });
    expect(h.sent[0].method).toBe("createAddon");
    expect(out).toMatchObject({ ok: true, id: "a1", sectionId: "sec-1" });
  });

  it("a partial create is refused rather than written half-formed", async () => {
    const h = harness();
    // currency needs code + displayName + kind
    const raw = await h.callRaw("upsert_currency_addon", {
      projectId: "p1", sectionId: "sec-1", name: "Moedas", code: "GOLD",
    });
    expect(raw.isError).toBe(true);
    expect(raw.text).toContain("displayName");
    expect(raw.text).toContain("kind");
    expect(h.sent).toHaveLength(0);
  });

  it("routes to updateAddon when addonId is present", async () => {
    const h = harness({ updateAddon: ADDON });
    await h.call("upsert_currency_addon", {
      projectId: "p1", sectionId: "sec-1", addonId: "a1", code: "GEM",
    });
    expect(h.sent[0].method).toBe("updateAddon");
  });

  it("refuses to create without a name, and does not call the API", async () => {
    const h = harness();
    const raw = await h.callRaw("upsert_currency_addon", { projectId: "p1", sectionId: "sec-1", code: "GOLD" });
    expect(raw.isError).toBe(true);
    expect(raw.text).toContain("name is required");
    expect(h.sent).toHaveLength(0);
  });

  it("names the type's missing required fields instead of writing undefined", async () => {
    const h = harness();
    // attributeDefinitions requires `attributes`
    const raw = await h.callRaw("upsert_attribute_definitions_addon", {
      projectId: "p1", sectionId: "sec-1", name: "Atributos",
    });
    expect(raw.isError).toBe(true);
    expect(raw.text).toContain("attributes");
    expect(h.sent).toHaveLength(0);
  });

  it("an update stays partial — no defaults leak in", async () => {
    const h = harness({ updateAddon: ADDON });
    await h.call("upsert_production_addon", {
      projectId: "p1", sectionId: "sec-1", addonId: "a1", capacity: 12,
    });
    const [, , , fields] = h.sent[0].args as [string, string, string, { data: Record<string, unknown> }];
    expect(fields.data).toEqual({ capacity: 12 });
  });

  it("the old create_/update_ pairs are gone", () => {
    const h = harness();
    for (const gone of ["create_currency_addon", "update_currency_addon", "create_xp_balance_addon", "update_crop_addon"]) {
      expect(h.names).not.toContain(gone);
    }
    for (const kept of ["upsert_currency_addon", "upsert_xp_balance_addon", "upsert_crop_addon"]) {
      expect(h.names).toContain(kept);
    }
  });

  it("halves the addon tool count", () => {
    const h = harness();
    expect(h.names.filter((n) => n.endsWith("_addon") && /^(create|update)_/.test(n)))
      .toEqual(["create_addon", "update_addon", "delete_addon", "copy_addon", "move_addon"].filter((n) => /^(create|update)_/.test(n)));
    expect(h.names.filter((n) => n.startsWith("upsert_"))).toHaveLength(18);
  });
});

describe("list_sections filters", () => {
  const tree = [
    { id: "root", title: "Animais", order: 0, content: "x", addons: [] },
    { id: "kid1", parentId: "root", title: "Galinha", order: 1, content: "tem texto", addons: [{ type: "progressionTable" }] },
    { id: "kid2", parentId: "root", title: "Vaca", order: 2, content: "", contentBlocks: [], addons: [] },
    { id: "grand", parentId: "kid2", title: "Leite", order: 3, content: "", contentBlocks: [], addons: [] },
    { id: "other", title: "Economia", order: 4, content: "y", addons: [{ type: "currency" }] },
  ];
  const ids = (rows: unknown) => (rows as unknown as Record<string, unknown>[]).map((r) => r.id);

  it("subtreeOf keeps the root and every descendant, however deep", async () => {
    const h = harness({ listSections: tree });
    expect(ids(await h.call("list_sections", { projectId: "p1", subtreeOf: "root" })))
      .toEqual(["root", "kid1", "kid2", "grand"]);
  });

  it("withoutDescription finds the pages that still need writing", async () => {
    const h = harness({ listSections: tree });
    expect(ids(await h.call("list_sections", { projectId: "p1", withoutDescription: true })))
      .toEqual(["kid2", "grand"]);
  });

  it("hasAddonType narrows to pages carrying that addon", async () => {
    const h = harness({ listSections: tree });
    expect(ids(await h.call("list_sections", { projectId: "p1", hasAddonType: "progressionTable" })))
      .toEqual(["kid1"]);
  });

  it("filters compose", async () => {
    const h = harness({ listSections: tree });
    expect(ids(await h.call("list_sections", { projectId: "p1", subtreeOf: "root", withoutDescription: true })))
      .toEqual(["kid2", "grand"]);
  });

  it("no filters means everything, as before", async () => {
    const h = harness({ listSections: tree });
    expect(ids(await h.call("list_sections", { projectId: "p1" }))).toHaveLength(5);
  });

  it("hasAddonType works on the lean shape the API now returns", async () => {
    const lean = [
      { id: "a", title: "A", order: 0, content: "x", addonTypes: ["progressionTable"] },
      { id: "b", title: "B", order: 1, content: "x", addonTypes: ["currency"] },
    ];
    const h = harness({ listSections: lean });
    expect(ids(await h.call("list_sections", { projectId: "p1", hasAddonType: "currency" }))).toEqual(["b"]);
  });
});

describe("the API is asked to leave the addon payload behind", () => {
  it("list_sections requests addons=types by default", async () => {
    const h = harness({ listSections: [] });
    await h.call("list_sections", { projectId: "p1" });
    expect(h.sent[0]).toEqual({ method: "listSections", args: ["p1", "types"] });
  });

  it("list_sections asks for the full payload under includeAddons", async () => {
    const h = harness({ listSections: [] });
    await h.call("list_sections", { projectId: "p1", includeAddons: true });
    expect(h.sent[0].args).toEqual(["p1", undefined]);
  });

  it("get_project does the same", async () => {
    const lean = harness({ getProject: { id: "p1", sections: [] } });
    await lean.call("get_project", { projectId: "p1" });
    expect(lean.sent[0].args).toEqual(["p1", "types"]);

    const fat = harness({ getProject: { id: "p1", sections: [] } });
    await fat.call("get_project", { projectId: "p1", includeAddons: true });
    expect(fat.sent[0].args).toEqual(["p1", undefined]);
  });
});

describe("listings return index rows", () => {
  it("list_sections omits descriptions and addon data by default", async () => {
    const h = harness({ listSections: [SECTION] });
    const out = (await h.call("list_sections", { projectId: "p1" })) as unknown as Record<string, unknown>[];
    expect(out[0]).toEqual({
      id: "sec-1", title: "Galinha", order: undefined, hasDescription: true, addons: ["progressionTable"],
    });
    expect(JSON.stringify(out)).not.toContain("bota ovos");
  });

  it("list_sections restores the full dump under includeAddons", async () => {
    const h = harness({ listSections: [SECTION] });
    const out = (await h.call("list_sections", { projectId: "p1", includeAddons: true })) as unknown as Record<string, unknown>[];
    expect((out[0].addons as Record<string, unknown>[])[0].data).toEqual({ rows: [{ level: 1 }] });
  });

  it("list_addons returns identity only, and data under includeData", async () => {
    const h = harness({ listAddons: [ADDON] });
    const lean = (await h.call("list_addons", { projectId: "p1", sectionId: "sec-1" })) as unknown as Record<string, unknown>[];
    expect(lean[0]).toEqual({ id: "a1", type: "progressionTable", name: "Balanceamento" });

    const fat = (await h.call("list_addons", { projectId: "p1", sectionId: "sec-1", includeData: true })) as unknown as Record<string, unknown>[];
    expect(fat[0].data).toEqual({ rows: [{ level: 1 }] });
  });

  it("get_project returns the index, get_project(includeAddons) the territory", async () => {
    const project = { id: "p1", title: "Granjita", updatedAt: "2026-08-18T12:00:00Z", sections: [SECTION] };
    const h = harness({ getProject: project });

    const index = await h.call("get_project", { projectId: "p1" });
    expect(index.sectionCount).toBe(1);
    expect(JSON.stringify(index)).not.toContain("rows");

    const full = await h.call("get_project", { projectId: "p1", includeAddons: true });
    expect(((full.sections as Record<string, unknown>[])[0].addons as Record<string, unknown>[])[0].data)
      .toEqual({ rows: [{ level: 1 }] });
  });
});

describe("deletes confirm what went away", () => {
  it.each([
    ["delete_section", { projectId: "p1", sectionId: "sec-1" }, "section", "sec-1"],
    ["delete_addon", { projectId: "p1", sectionId: "sec-1", addonId: "a1" }, "addon", "a1"],
    ["delete_project", { projectId: "p1" }, "project", "p1"],
  ])("%s → { ok, deleted, id }", async (tool, args, kind, id) => {
    const h = harness();
    expect(await h.call(tool, args as Record<string, unknown>)).toEqual({ ok: true, deleted: kind, id });
  });
});

describe("responses are compact", () => {
  it("get_section stays full but loses the pretty-print and the audit columns", async () => {
    const handlers = harness({ getSection: SECTION });
    const out = await handlers.call("get_section", { projectId: "p1", sectionId: "sec-1" });
    expect((out.addons as Record<string, unknown>[])[0].data).toEqual({ rows: [{ level: 1 }] });
    expect(out).not.toHaveProperty("flowchartState");
    expect(out).not.toHaveProperty("updatedByName");
  });
});

describe("tool descriptions teach the new defaults", () => {
  it("the write tools say they return a receipt", () => {
    const h = harness();
    for (const tool of ["update_section", "update_addon", "upsert_progression_table_addon", "create_section"]) {
      expect(h.descriptionOf(tool).toLowerCase()).toContain("receipt");
    }
  });

  it("the listings point at the tool that carries the payload", () => {
    const h = harness();
    expect(h.descriptionOf("list_sections")).toContain("get_section");
    expect(h.descriptionOf("list_addons")).toContain("get_section");
    expect(h.descriptionOf("search")).toContain("get_section");
  });

  it("every write exposes the returning escape hatch", () => {
    const h = harness();
    for (const tool of [
      "update_section", "create_section", "update_project", "create_project",
      "update_addon", "create_addon", "copy_addon", "move_addon",
      "upsert_currency_addon",
      "upsert_xp_balance_addon",
    ]) {
      expect(Object.keys(h.schemaOf(tool))).toContain("returning");
    }
  });

  it("the read tools do not, because they already return everything", () => {
    const h = harness();
    for (const tool of ["get_section", "get_project", "get_remote_config", "list_sections"]) {
      expect(Object.keys(h.schemaOf(tool))).not.toContain("returning");
    }
  });
});
