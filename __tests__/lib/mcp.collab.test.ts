/**
 * The collaboration half of the MCP server: who am I, whose project is this,
 * who else writes here, and what did they just change.
 *
 * A connection holding an API key reaches the account's own projects AND the
 * ones other people shared with it, so these are not conveniences: without
 * them an agent cannot tell a teammate's document from its owner's, cannot know
 * a project is read-only until a write is refused, and cannot see that the page
 * it is about to rewrite was rewritten by a person minutes ago.
 *
 * @jest-environment node
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiFetcher } from "@/lib/mcp/api";
import { createMcpServer, registerGenericTools } from "@/lib/mcp/server";

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[] }>;

function harness(responses: Partial<Record<keyof ApiFetcher, unknown>> = {}) {
  const handlers = new Map<string, Handler>();
  const schemas = new Map<string, Record<string, unknown>>();
  const sent: { method: string; args: unknown[] }[] = [];

  const server = {
    tool(name: string, _description: string, schema: Record<string, unknown>, cb: Handler) {
      handlers.set(name, cb);
      schemas.set(name, schema);
    },
  } as unknown as McpServer;

  const api = new Proxy({} as ApiFetcher, {
    get: (_t, method: string) => (...args: unknown[]) => {
      sent.push({ method, args });
      return Promise.resolve(responses[method as keyof ApiFetcher] ?? {});
    },
  });

  registerGenericTools(server, api);

  return {
    sent,
    names: [...handlers.keys()],
    schemaOf: (tool: string) => schemas.get(tool) ?? {},
    call: async (tool: string, args: Record<string, unknown> = {}) => {
      const handler = handlers.get(tool);
      if (!handler) throw new Error(`tool not registered: ${tool}`);
      return JSON.parse((await handler(args)).content[0].text) as Record<string, unknown>;
    },
  };
}

const ME = {
  id: "user-1",
  email: "julio@example.com",
  displayName: "Julio",
  avatarUrl: "https://example.com/a.png",
  authSource: "apiKey",
  projects: { owned: 2, editor: 1, viewer: 3, total: 6 },
  limits: { maxProjects: 2, maxSectionsPerProject: 300 },
};

describe("whoami", () => {
  it("is registered and needs no arguments", () => {
    const h = harness();
    expect(h.names).toContain("whoami");
    expect(h.schemaOf("whoami")).toEqual({});
  });

  it("answers with the account, how it authenticated, and its limits", async () => {
    const h = harness({ me: ME });
    const out = await h.call("whoami");

    expect(out).toEqual({
      userId: "user-1",
      displayName: "Julio",
      email: "julio@example.com",
      authSource: "apiKey",
      projects: { owned: 2, sharedAsEditor: 1, sharedAsViewer: 3 },
      limits: { maxProjects: 2, maxSectionsPerProject: 300 },
    });
  });

  it("separates what the account owns from what was shared with it", async () => {
    // The distinction is the whole point: only two of these six are the
    // account's own documents.
    const h = harness({ me: ME });
    const projects = (await h.call("whoami")).projects as Record<string, number>;
    expect(projects.owned).toBe(2);
    expect(projects.sharedAsEditor + projects.sharedAsViewer).toBe(4);
  });

  it("drops the avatar, which an agent cannot act on", async () => {
    const h = harness({ me: ME });
    expect(await h.call("whoami")).not.toHaveProperty("avatarUrl");
  });

  it("survives an account with no profile row", async () => {
    const h = harness({ me: { id: "user-1", authSource: "oauth", projects: {}, limits: {} } });
    const out = await h.call("whoami");
    expect(out.userId).toBe("user-1");
    expect(out).not.toHaveProperty("displayName");
    expect(out.projects).toEqual({ owned: 0, sharedAsEditor: 0, sharedAsViewer: 0 });
  });
});

describe("access travels with every project row", () => {
  it("list_projects says what you may do in each project", async () => {
    const h = harness({
      listProjects: [
        { id: "p1", title: "Granjita", access: "owner", updatedAt: "2026-09-01T00:00:00Z" },
        { id: "p2", title: "Jogo da Ana", access: "viewer", updatedAt: "2026-09-02T00:00:00Z" },
      ],
    });

    const rows = (await h.call("list_projects")) as unknown as Record<string, unknown>[];
    expect(rows.map((r) => r.access)).toEqual(["owner", "viewer"]);
  });

  it("get_project keeps it too", async () => {
    const h = harness({ getProject: { id: "p2", title: "Jogo da Ana", access: "editor", sections: [] } });
    expect((await h.call("get_project", { projectId: "p2" })).access).toBe("editor");
  });
});

describe("list_project_members", () => {
  const MEMBERS = {
    projectId: "p1",
    ownerId: "user-9",
    yourAccess: "editor",
    members: [
      { userId: "user-9", email: "ana@example.com", displayName: "Ana", access: "owner", isYou: false },
      { userId: "user-1", email: "julio@example.com", displayName: "Julio", access: "editor", isYou: true },
      { userId: "user-3", email: "sem-nome@example.com", displayName: null, access: "viewer", isYou: false },
    ],
  };

  it("names the team, owner first, and flags which one is you", async () => {
    const h = harness({ listMembers: MEMBERS });
    const out = await h.call("list_project_members", { projectId: "p1" });

    expect(out.yourAccess).toBe("editor");
    expect(out.members).toEqual([
      { name: "Ana", access: "owner", userId: "user-9" },
      { name: "Julio", access: "editor", isYou: true, userId: "user-1" },
      { name: "sem-nome@example.com", access: "viewer", userId: "user-3" },
    ]);
  });

  it("does not hand out an email when a display name exists", async () => {
    const h = harness({ listMembers: MEMBERS });
    const out = await h.call("list_project_members", { projectId: "p1" });
    expect(JSON.stringify(out)).not.toContain("ana@example.com");
  });
});

describe("list_recent_activity", () => {
  const EVENTS = {
    projectId: "p1",
    count: 3,
    events: [
      {
        sectionId: "s1", sectionTitle: "Galinha", action: "modified",
        detail: "batch:12", by: "Ana", byUserId: "user-9",
        origin: "mcp", at: "2026-09-08T10:00:00Z",
      },
      {
        sectionId: "s2", sectionTitle: "Moinho", action: "renamed", oldTitle: "Molino",
        detail: null, by: "Julio", byUserId: "user-1",
        origin: "app", at: "2026-09-08T09:00:00Z",
      },
      {
        sectionId: "s3", sectionTitle: "Pato", action: "modified",
        detail: "description", by: null, byUserId: null,
        origin: "app", at: "2026-09-07T09:00:00Z",
      },
    ],
  };

  it("reports what happened, to which page, by whom, and from where", async () => {
    const h = harness({ listActivity: EVENTS });
    const out = await h.call("list_recent_activity", { projectId: "p1" });

    expect(out.events).toEqual([
      { at: "2026-09-08T10:00:00Z", action: "modified", title: "Galinha", pages: 12, by: "Ana", origin: "mcp", sectionId: "s1" },
      { at: "2026-09-08T09:00:00Z", action: "renamed", title: "Moinho", oldTitle: "Molino", by: "Julio", origin: "app", sectionId: "s2" },
      { at: "2026-09-07T09:00:00Z", action: "modified", title: "Pato", origin: "app", sectionId: "s3" },
    ]);
  });

  it("turns a batch token into a page count and drops the rest of `detail`", async () => {
    // `detail` holds machine tokens for the app's widget: 'batch:12' carries a
    // number worth having, 'description' only repeats what `action` already said.
    const h = harness({ listActivity: EVENTS });
    const out = await h.call("list_recent_activity", { projectId: "p1" });
    const events = out.events as Record<string, unknown>[];
    expect(events[0].pages).toBe(12);
    expect(JSON.stringify(out)).not.toContain("detail");
    expect(JSON.stringify(out)).not.toContain("description");
  });

  it("forwards the window the caller asked for", async () => {
    const h = harness({ listActivity: EVENTS });
    await h.call("list_recent_activity", { projectId: "p1", limit: 50, since: "2026-09-01T00:00:00Z" });
    expect(h.sent[0]).toEqual({
      method: "listActivity",
      args: ["p1", { limit: 50, since: "2026-09-01T00:00:00Z" }],
    });
  });
});

/**
 * Everything above registers the tools against a stub server, which cannot
 * reject a schema the real SDK would. This connects a real client to a real
 * McpServer over an in-memory pair and asks it what it offers.
 */
describe("the remote server as a client sees it", () => {
  it("offers the collaboration tools, and its handshake teaches them", async () => {
    const api = new Proxy({} as ApiFetcher, { get: () => () => Promise.resolve({}) });
    const server = createMcpServer(api);
    const client = new Client({ name: "test", version: "0" });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    try {
      expect(client.getInstructions()).toContain("whoami");

      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("whoami");
      expect(names).toContain("list_project_members");
      expect(names).toContain("list_recent_activity");

      // The schema the SDK actually publishes, not the one the stub recorded.
      const activity = tools.find((t) => t.name === "list_recent_activity");
      expect(activity?.inputSchema.required).toEqual(["projectId"]);
      expect(Object.keys(activity?.inputSchema.properties ?? {}).sort()).toEqual([
        "limit",
        "projectId",
        "since",
      ]);

      const me = tools.find((t) => t.name === "whoami");
      expect(me?.inputSchema.required ?? []).toEqual([]);
    } finally {
      await client.close();
      await server.close();
    }
  });
});

/**
 * The stdio server ships its own copy of the projections. They had already
 * drifted once; a byte comparison is the only thing that keeps an addition here
 * from missing the published npm server.
 */
describe("the two copies of the response projections", () => {
  const readProjections = (path: string) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    const src = fs.readFileSync(path, "utf8");
    // Skip the header comment, which names the other copy.
    return src.slice(src.indexOf("/** A plain-text tool result"));
  };

  it("say exactly the same thing", () => {
    expect(readProjections("packages/mcp-server/src/project.ts")).toBe(
      readProjections("lib/mcp/project.ts"),
    );
  });
});
