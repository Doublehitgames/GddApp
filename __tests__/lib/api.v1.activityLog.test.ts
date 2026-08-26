/**
 * Tests for the server-side activity log — the path the MCP writes through.
 *
 * The rules under test are what keep an agent from evicting the project's
 * history: a batch is one event no matter how many pages it touched, and a
 * rewrite stays quiet while a recent event for the same page already covers it.
 */

import { logApiSectionActivity, logBatchActivity } from "@/lib/api/v1/activityLog";

type Inserted = Record<string, unknown>;

/**
 * Minimal chainable stand-in for the Supabase client: enough of the builder to
 * satisfy the two reads and one write the log makes.
 */
function fakeSupabase(opts: { lastEvent?: { action: string; created_at: string } | null } = {}) {
  const inserted: Inserted[] = [];

  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {
        insert(row: Inserted) {
          if (table === "section_activity_log") inserted.push(row);
          return Promise.resolve({ error: null });
        },
      };
      // Every filter/order step returns the builder; awaiting it resolves to
      // the table's canned rows.
      for (const step of ["select", "eq", "order", "limit"]) {
        builder[step] = () => builder;
      }
      builder.maybeSingle = () =>
        Promise.resolve({ data: table === "profiles" ? { display_name: "Julio" } : null });
      (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
        resolve({
          data: table === "section_activity_log" && opts.lastEvent ? [opts.lastEvent] : [],
          error: null,
        });
      return builder;
    },
  };

  return { client, inserted };
}

const authFor = (
  supabase: unknown,
  source: "session" | "apiKey" | "oauth" = "apiKey"
) => ({ authenticated: true, userId: "user-1", source, supabase, keyId: "key-1" } as never);

describe("logApiSectionActivity", () => {
  it("tags API-key writes as coming from the MCP", async () => {
    const { client, inserted } = fakeSupabase();

    await logApiSectionActivity(authFor(client), {
      projectId: "p1",
      sectionId: "s1",
      sectionTitle: "Quadro de Missões",
      action: "created",
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].origin).toBe("mcp");
    expect(inserted[0].action).toBe("created");
    expect(inserted[0].user_name).toBe("Julio");
  });

  it("tags browser writes as coming from the app", async () => {
    const { client, inserted } = fakeSupabase();

    await logApiSectionActivity(authFor(client, "session"), {
      projectId: "p1",
      sectionId: "s1",
      sectionTitle: "Loja",
      action: "created",
    });

    expect(inserted[0].origin).toBe("app");
  });

  it("stays quiet when the page was edited moments ago", async () => {
    const { client, inserted } = fakeSupabase({
      lastEvent: { action: "modified", created_at: new Date(Date.now() - 60_000).toISOString() },
    });

    await logApiSectionActivity(authFor(client), {
      projectId: "p1",
      sectionId: "s1",
      sectionTitle: "Economia",
      action: "modified",
      detail: "description",
    });

    expect(inserted).toHaveLength(0);
  });

  it("stays quiet when the page was just created", async () => {
    const { client, inserted } = fakeSupabase({
      lastEvent: { action: "created", created_at: new Date(Date.now() - 5_000).toISOString() },
    });

    await logApiSectionActivity(authFor(client), {
      projectId: "p1",
      sectionId: "s1",
      sectionTitle: "Economia",
      action: "modified",
      detail: "description",
    });

    expect(inserted).toHaveLength(0);
  });

  it("logs again once the edit window has passed", async () => {
    const { client, inserted } = fakeSupabase({
      lastEvent: {
        action: "modified",
        created_at: new Date(Date.now() - 31 * 60_000).toISOString(),
      },
    });

    await logApiSectionActivity(authFor(client), {
      projectId: "p1",
      sectionId: "s1",
      sectionTitle: "Economia",
      action: "modified",
    });

    expect(inserted).toHaveLength(1);
  });

  it("never folds a rename or a deletion", async () => {
    const { client, inserted } = fakeSupabase({
      lastEvent: { action: "modified", created_at: new Date().toISOString() },
    });

    await logApiSectionActivity(authFor(client), {
      projectId: "p1",
      sectionId: "s1",
      sectionTitle: "Quadro de Missões",
      action: "renamed",
      oldTitle: "Balanceamento do Quadro de Missões",
    });
    await logApiSectionActivity(authFor(client), {
      projectId: "p1",
      sectionId: "s1",
      sectionTitle: "Quadro de Missões",
      action: "deleted",
    });

    expect(inserted).toHaveLength(2);
    expect(inserted[0].old_title).toBe("Balanceamento do Quadro de Missões");
  });
});

describe("logBatchActivity", () => {
  const titles = new Map([
    ["s1", "Antiga A"],
    ["s2", "Antiga B"],
    ["s3", "Antiga C"],
  ]);
  const allOk = ["s1", "s2", "s3"].map((sectionId) => ({ sectionId, ok: true }));

  it("collapses a many-page rename into one event carrying the total", async () => {
    const { client, inserted } = fakeSupabase();

    await logBatchActivity(
      authFor(client),
      "p1",
      [
        { sectionId: "s1", title: "Nova A" },
        { sectionId: "s2", title: "Nova B" },
        { sectionId: "s3", title: "Nova C" },
      ],
      titles,
      allOk,
    );

    expect(inserted).toHaveLength(1);
    expect(inserted[0].action).toBe("renamed");
    expect(inserted[0].section_title).toBe("Nova A");
    expect(inserted[0].old_title).toBe("Antiga A");
    expect(inserted[0].detail).toBe("batch:3");
  });

  it("leaves detail empty when a batch renamed a single page", async () => {
    const { client, inserted } = fakeSupabase();

    await logBatchActivity(
      authFor(client),
      "p1",
      [{ sectionId: "s1", title: "Nova A" }],
      titles,
      [{ sectionId: "s1", ok: true }],
    );

    expect(inserted[0].detail).toBeNull();
  });

  it("reports a content-only batch as modified with the page count", async () => {
    const { client, inserted } = fakeSupabase();

    await logBatchActivity(
      authFor(client),
      "p1",
      [
        { sectionId: "s1", content: "texto" },
        { sectionId: "s2", content: "texto" },
      ],
      titles,
      allOk,
    );

    expect(inserted).toHaveLength(1);
    expect(inserted[0].action).toBe("modified");
    expect(inserted[0].detail).toBe("batch:2");
  });

  it("prefers the rename when a batch both renamed and rewrote", async () => {
    const { client, inserted } = fakeSupabase();

    await logBatchActivity(
      authFor(client),
      "p1",
      [
        { sectionId: "s1", content: "texto" },
        { sectionId: "s2", title: "Nova B", content: "texto" },
      ],
      titles,
      allOk,
    );

    expect(inserted).toHaveLength(1);
    expect(inserted[0].action).toBe("renamed");
    expect(inserted[0].section_title).toBe("Nova B");
  });

  it("ignores a title sent unchanged", async () => {
    const { client, inserted } = fakeSupabase();

    await logBatchActivity(
      authFor(client),
      "p1",
      [{ sectionId: "s1", title: "Antiga A" }],
      titles,
      [{ sectionId: "s1", ok: true }],
    );

    expect(inserted).toHaveLength(0);
  });

  it("ignores pages the batch failed to write", async () => {
    const { client, inserted } = fakeSupabase();

    await logBatchActivity(
      authFor(client),
      "p1",
      [{ sectionId: "s1", title: "Nova A" }],
      titles,
      [{ sectionId: "s1", ok: false }],
    );

    expect(inserted).toHaveLength(0);
  });

  it("writes nothing for a batch that only moved pages around", async () => {
    const { client, inserted } = fakeSupabase();

    await logBatchActivity(
      authFor(client),
      "p1",
      [{ sectionId: "s1" }, { sectionId: "s2" }],
      titles,
      allOk,
    );

    expect(inserted).toHaveLength(0);
  });
});
