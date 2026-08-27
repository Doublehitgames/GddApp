/**
 * The server-side half of the rename sweep — the one every /api/v1 rename runs,
 * which is what the MCP server writes through.
 *
 * The fake Supabase client below is deliberately dumb: it records the updates
 * the sweep issues so the test can assert on what would hit Postgres.
 */

import { sweepRenamedRefs } from "@/lib/api/v1/renameRefs";

type Row = { id: string; title: string; content: string; content_blocks?: unknown };

type Recorded = { table: string; id: string; updates: Record<string, unknown> };

function fakeSupabase(rows: Row[], description = "", opts: { blocksColumn?: boolean } = {}) {
  const blocksColumn = opts.blocksColumn !== false;
  const recorded: Recorded[] = [];

  const client = {
    from(table: string) {
      const ctx: { table: string; updates?: Record<string, unknown>; id?: string } = { table };
      const builder: Record<string, unknown> = {
        select(columns: string) {
          if (table === "sections" && columns.includes("content_blocks") && !blocksColumn) {
            return {
              eq: () => Promise.resolve({ data: null, error: { message: "column does not exist" } }),
            };
          }
          if (table === "sections") {
            const data = rows.map((r) =>
              blocksColumn && columns.includes("content_blocks")
                ? r
                : { id: r.id, title: r.title, content: r.content },
            );
            return {
              eq: () => Promise.resolve({ data, error: null }),
            };
          }
          // projects
          return {
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { description }, error: null }),
            }),
          };
        },
        update(updates: Record<string, unknown>) {
          ctx.updates = updates;
          const chain = {
            eq(column: string, value: string) {
              if (column === "id") ctx.id = value;
              if (table === "projects") {
                recorded.push({ table, id: value, updates: ctx.updates! });
                return Promise.resolve({ error: null });
              }
              // sections: .eq("id", …).eq("project_id", …)
              if (column === "project_id") {
                recorded.push({ table, id: ctx.id!, updates: ctx.updates! });
                return Promise.resolve({ error: null });
              }
              return chain;
            },
          };
          return chain;
        },
      };
      return builder;
    },
  };

  return { client: client as never, recorded };
}

const ARGS = {
  projectId: "proj-1",
  sectionId: "s1",
  oldTitle: "Racoes Animal",
  newTitle: "Rações de Animal",
  userId: "user-1",
  now: "2026-08-27T10:00:00Z",
};

describe("sweepRenamedRefs", () => {
  it("rewrites the pages that referenced the old title and reports how many", async () => {
    const { client, recorded } = fakeSupabase([
      { id: "s1", title: "Rações de Animal", content: "A ração base." },
      { id: "s2", title: "Cocho", content: "Enche com $[Racoes Animal]." },
      { id: "s3", title: "Moinho", content: "Nada a ver." },
    ]);

    const swept = await sweepRenamedRefs(client, ARGS);

    expect(swept).toBe(1);
    const sections = recorded.filter((r) => r.table === "sections");
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      id: "s2",
      updates: {
        content: "Enche com $[Rações de Animal].",
        updated_at: ARGS.now,
        updated_by: "user-1",
      },
    });
  });

  it("rewrites content_blocks alongside the markdown", async () => {
    const { client, recorded } = fakeSupabase([
      { id: "s1", title: "Rações de Animal", content: "A ração base." },
      {
        id: "s2",
        title: "Cocho",
        content: "Enche com $[Racoes Animal].",
        content_blocks: [
          { type: "paragraph", content: [{ type: "text", text: "Enche com $[Racoes Animal].", styles: {} }] },
        ],
      },
    ]);

    await sweepRenamedRefs(client, ARGS);

    const blocks = recorded[0].updates.content_blocks as any;
    expect(blocks[0].content[0].text).toBe("Enche com $[Rações de Animal].");
  });

  it("sweeps the project description too", async () => {
    const { client, recorded } = fakeSupabase(
      [{ id: "s1", title: "Rações de Animal", content: "A ração base." }],
      "O loop gira em torno de $[Racoes Animal].",
    );

    const swept = await sweepRenamedRefs(client, ARGS);

    // The project description is not a page, so it is not counted.
    expect(swept).toBe(0);
    expect(recorded).toEqual([
      {
        table: "projects",
        id: "proj-1",
        updates: {
          description: "O loop gira em torno de $[Rações de Animal].",
          updated_at: ARGS.now,
        },
      },
    ]);
  });

  it("still sweeps markdown when the DB has no content_blocks column", async () => {
    const { client, recorded } = fakeSupabase(
      [
        { id: "s1", title: "Rações de Animal", content: "A ração base." },
        { id: "s2", title: "Cocho", content: "Enche com $[Racoes Animal]." },
      ],
      "",
      { blocksColumn: false },
    );

    await sweepRenamedRefs(client, ARGS);

    expect(recorded).toHaveLength(1);
    expect(recorded[0].updates.content).toBe("Enche com $[Rações de Animal].");
    expect(recorded[0].updates.content_blocks).toBeUndefined();
  });

  it("writes nothing when another page still carries the old title", async () => {
    const { client, recorded } = fakeSupabase([
      { id: "s1", title: "Rações de Animal", content: "A ração base." },
      { id: "s2", title: "Cocho", content: "Enche com $[Racoes Animal]." },
      { id: "s3", title: "Racoes Animal", content: "A homônima." },
    ]);

    expect(await sweepRenamedRefs(client, ARGS)).toBe(0);
    expect(recorded).toHaveLength(0);
  });

  it("does not even query when the title did not really change", async () => {
    const { client, recorded } = fakeSupabase([
      { id: "s1", title: "Cocho", content: "Enche com $[Racoes Animal]." },
    ]);

    expect(
      await sweepRenamedRefs(client, { ...ARGS, oldTitle: "Cocho", newTitle: "cocho " }),
    ).toBe(0);
    expect(recorded).toHaveLength(0);
  });

  it("reports zero instead of throwing when the read fails", async () => {
    const broken = {
      from: () => ({
        select: () => {
          throw new Error("boom");
        },
      }),
    } as never;

    expect(await sweepRenamedRefs(broken, ARGS)).toBe(0);
  });
});
