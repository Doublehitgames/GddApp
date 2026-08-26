/**
 * How an agent learns the GDD's conventions.
 *
 * Cross-references are the case that matters: nothing about writing a plain
 * description suggests `$[Page]` exists, so an agent that is never told writes
 * flat prose and the links are lost. The hint has to be somewhere the agent
 * sees without asking — server instructions, and the content field itself.
 *
 * @jest-environment node
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFetcher } from "@/lib/mcp/api";
import { SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { registerGenericTools } from "@/lib/mcp/server";

const WRITE_TOOLS = ["create_section", "update_section", "batch_update_sections"];

function registered() {
  const schemas = new Map<string, Record<string, unknown>>();
  const server = {
    tool(name: string, _d: string, schema: Record<string, unknown>) { schemas.set(name, schema); },
  } as unknown as McpServer;
  registerGenericTools(server, new Proxy({} as ApiFetcher, {
    get: () => () => Promise.resolve({}),
  }));
  return schemas;
}

/** The describe() text of a field, wherever it sits in the schema. */
function describeOf(schema: Record<string, unknown>, field: string): string {
  const direct = schema[field] as { description?: string } | undefined;
  if (direct?.description) return direct.description;
  // batch_update_sections nests the fields inside an array of objects
  for (const value of Object.values(schema)) {
    const inner = (value as { element?: { shape?: Record<string, { description?: string }> } })?.element?.shape;
    if (inner?.[field]?.description) return inner[field].description;
  }
  return "";
}

describe("server instructions", () => {
  it("teach the cross-reference syntax", () => {
    expect(SERVER_INSTRUCTIONS).toContain("$[Exact Page Title]");
    expect(SERVER_INSTRUCTIONS.toLowerCase()).toContain("cross-reference");
  });

  it("warn that matching is by exact title, emoji included", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/exact title/i);
    expect(SERVER_INSTRUCTIONS).toMatch(/emoji/i);
  });

  it("say a description is prose, not a spec sheet", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/not a spec sheet/i);
  });

  it("point at the project's own aiInstructions as the higher authority", () => {
    expect(SERVER_INSTRUCTIONS).toContain("aiInstructions");
    expect(SERVER_INSTRUCTIONS).toMatch(/follow them over these defaults/i);
  });

  it("carry the cost habits too", () => {
    expect(SERVER_INSTRUCTIONS).toContain("batch_update_sections");
    expect(SERVER_INSTRUCTIONS).toContain("get_section");
  });

  it("stay short enough to send every session", () => {
    expect(SERVER_INSTRUCTIONS.length).toBeLessThan(2600);
  });
});

describe("the content field carries the hint on its own", () => {
  // Belt and braces: a client that ignores `instructions` still sees this,
  // and it sits exactly where an agent looks while filling the field.
  it.each(WRITE_TOOLS)("%s describes $[...] on its content field", (tool) => {
    const text = describeOf(registered().get(tool) ?? {}, "content");
    expect(text).toContain("$[Exact Page Title]");
  });

  it("explains why sending content alone is safe", () => {
    const text = describeOf(registered().get("update_section") ?? {}, "content");
    expect(text).toMatch(/derives contentBlocks/i);
  });
});

describe("get_project no longer ships UI state", () => {
  it("mindmapSettings is not something an agent can act on", async () => {
    const { projectIndex } = await import("@/lib/mcp/project");
    const out = projectIndex({
      id: "p1", title: "Granjita", aiInstructions: "convenções",
      mindmapSettings: { levels: [{ edge: { color: "#94a3b8" } }] },
      imageCount: 117, sections: [],
    });
    expect(out).not.toHaveProperty("mindmapSettings");
    expect(out.aiInstructions).toBe("convenções");
    expect(out.imageCount).toBe(117);
  });
});
