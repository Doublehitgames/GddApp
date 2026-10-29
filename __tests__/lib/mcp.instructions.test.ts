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

function descriptionsByName() {
  const out = new Map<string, string>();
  const server = {
    tool(name: string, description: string) { out.set(name, description); },
  } as unknown as McpServer;
  registerGenericTools(server, new Proxy({} as ApiFetcher, { get: () => () => Promise.resolve({}) }));
  return out;
}

/** [name, description] for every registered tool. */
function registeredDescriptions(): [string, string][] {
  return [...descriptionsByName()];
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

  it("say that a project may belong to someone else", () => {
    // The one collaboration fact that fits in no single tool's schema: the
    // account may reach documents it did not create, and a page it is about to
    // rewrite may have been rewritten by a person minutes ago.
    expect(SERVER_INSTRUCTIONS).toContain("whoami");
    expect(SERVER_INSTRUCTIONS).toContain("list_recent_activity");
    expect(SERVER_INSTRUCTIONS).toMatch(/viewer/i);
  });

  it("stay short enough to send every session", () => {
    // Raised from 2600 when the paragraph above was added: shared projects are
    // worth the ~130 characters, since the alternative is an agent planning a
    // rewrite it has no permission to save.
    //
    // Raised again from 2800 for FLOWCHARTS. Same reasoning: a page's diagram
    // is invisible from the description, and an agent that is not told it
    // exists reports back that the server cannot draw one.
    //
    // Raised from 3300 for the sentence about the shape of a page. Agents were
    // writing every description as one column of prose — correctly, since the
    // only thing said about form was "markdown", and the tools claimed a table
    // needed hand-built blocks when markdown gives one for free.
    //
    // Raised from 3700 for TABLE RULES. The rule on a collection's parent page
    // is the canonical list of its tables; an agent that never reads it types
    // the headings by hand, and one typo there is the phantom table the rule
    // exists to prevent.
    expect(SERVER_INSTRUCTIONS.length).toBeLessThan(4100);
  });

  it("say that a page can carry a flowchart, and how to read it first", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/flowchart/i);
    expect(SERVER_INSTRUCTIONS).toContain("includeFlowchart");
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

describe("descriptions do not promise what the schema cannot do", () => {
  // A description that names a field the tool does not accept is worse than no
  // description: the agent plans around it and the call quietly does nothing.
  // This is how "update project mindmap settings" survived for months.
  const FIELD_WORDS: [RegExp, string][] = [
    [/\bmindmap\b/i, "mindmapSettings"],
    [/\bcover image\b/i, "coverImageUrl"],
    [/\baiInstructions\b/, "aiInstructions"],
    [/\bthumb(nail)? image\b|\bpage icon\b/i, "thumbImageUrl"],
    [/\bdomain tags\b/i, "domainTags"],
  ];

  // Only the write tools. A listing may legitimately name a field belonging to
  // another tool, the way list_project_images points at thumbImageUrl.
  const writeTools = registeredDescriptions().filter(([n]) => /^(create|update|batch_update)_/.test(n));

  it.each(writeTools)("%s only names fields it accepts", (name, description) => {
    const schema = registered().get(name) ?? {};
    const fields = new Set(Object.keys(schema));
    // batch_update_sections nests its writable fields one level down.
    for (const value of Object.values(schema)) {
      const inner = (value as { element?: { shape?: Record<string, unknown> } })?.element?.shape;
      if (inner) for (const k of Object.keys(inner)) fields.add(k);
    }
    for (const [word, field] of FIELD_WORDS) {
      if (word.test(description) && !fields.has(field)) {
        throw new Error(
          `${name} mentions ${word.source} but accepts no ${field} — fields: ${[...fields].join(", ")}`,
        );
      }
    }
  });

  it("every tool that takes contentBlocks points at the guide", () => {
    for (const [, schema] of registered()) {
      if (!("contentBlocks" in schema)) continue;
      const desc = (schema.contentBlocks as { description?: string }).description ?? "";
      expect(desc).toContain("get_content_blocks_guide");
    }
  });

  it("the guide names every tool that can use it", () => {
    const takesBlocks = [...registered()].filter(([, s]) => "contentBlocks" in s).map(([n]) => n);
    const guide = descriptionsByName().get("get_content_blocks_guide") ?? "";
    for (const tool of takesBlocks) expect(guide).toContain(tool);
  });
});

describe("first steps in get_project", () => {
  const load = async () => (await import("@/lib/mcp/project")).projectIndex;

  it("a young project carries its open questions and how to answer them", async () => {
    const projectIndex = await load();
    const out = projectIndex({
      id: "p1", title: "T", vision: { logline: "Um aprendiz quebra o tempo.", starter: { answered: [], skipped: ["docs.controls"] } },
      sections: [{ id: "s1", title: "História", order: 0 }],
    }) as { starterHelp?: string; starterQuestions?: { id: string; answerIn: unknown }[]; vision?: Record<string, unknown> };
    const ids = (out.starterQuestions ?? []).map((q) => q.id);
    expect(out.starterHelp).toBeTruthy();
    expect(ids).toContain("vision.feeling");
    expect(ids).not.toContain("vision.logline"); // already has content
    expect(ids).not.toContain("docs.story"); // the page exists
    expect(ids).not.toContain("docs.controls"); // skipped
    expect(ids).not.toContain("vision.name"); // an agent does not rename the project
    expect(out.starterQuestions?.find((q) => q.id === "vision.feeling")?.answerIn).toBe("update_project vision.feeling");
    expect(out.vision).toEqual({ logline: "Um aprendiz quebra o tempo." }); // no app bookkeeping
  });

  it("says nothing once the first steps are done or the project has grown", async () => {
    const projectIndex = await load();
    const done = projectIndex({ id: "p1", title: "T", vision: { starter: { answered: [], skipped: [], doneAt: "2026-10-28" } }, sections: [] });
    expect(done).not.toHaveProperty("starterQuestions");
    const big = projectIndex({ id: "p1", title: "T", sections: Array.from({ length: 16 }, (_, i) => ({ id: `s${i}`, title: `P${i}`, order: i })) });
    expect(big).not.toHaveProperty("starterQuestions");
  });
});

describe("what update_project can set, get_project can read", () => {
  it("no write-only fields", async () => {
    const { projectIndex } = await import("@/lib/mcp/project");
    const out = projectIndex({
      id: "p1", title: "T", description: "d", coverImageUrl: "https://x.test/c.png",
      aiInstructions: "conv", vision: { logline: "l" }, sections: [],
    });
    // update_project accepts title, description, coverImageUrl, aiInstructions, vision
    for (const field of ["title", "description", "coverImageUrl", "aiInstructions", "vision"]) {
      expect(out).toHaveProperty(field);
    }
  });
});

/**
 * The stdio server (packages/mcp-server) ships its own copy of the very same
 * instructions. Nothing but a comment asked the two to stay in sync, and they
 * had already drifted — the published copy was missing PAGE STATUS and the
 * contentUpdatedAt note, so every agent on the npm server flew without them.
 */
describe("the two copies of the server instructions", () => {
  const readInstructions = (path: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    const src = fs.readFileSync(path, "utf8");
    const start = src.indexOf("export const SERVER_INSTRUCTIONS");
    return src.slice(start);
  };

  it("say exactly the same thing", () => {
    expect(readInstructions("packages/mcp-server/src/instructions.ts")).toBe(
      readInstructions("lib/mcp/instructions.ts"),
    );
  });
});
