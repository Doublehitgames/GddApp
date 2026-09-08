/**
 * Who may read and write a project, and how that travels out to the caller.
 *
 * The MCP server writes through /api/v1 with an API key, so "which projects can
 * this connection touch" is decided here and nowhere else. A membership that is
 * silently dropped means an agent cannot see a teammate's document at all; an
 * `access` that never reaches the response means it discovers a read-only
 * project from a 403 in the middle of a sweep.
 *
 * @jest-environment node
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  accessFromRole,
  canWrite,
  projectAccessMap,
  projectToApi,
  type ProjectRow,
} from "@/lib/api/v1/helpers";

/**
 * The two reads projectAccessMap makes, and nothing else: owned project ids,
 * then the caller's membership rows.
 */
function supabaseWith(tables: {
  projects?: { id: string }[];
  project_members?: { project_id: string; role: string }[];
}): SupabaseClient {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: tables[table as keyof typeof tables] ?? [],
            error: null,
          }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const ROW: ProjectRow = {
  id: "p1",
  owner_id: "someone-else",
  title: "Granjita",
  description: "",
  content_blocks: null,
  cover_image_url: null,
  mindmap_settings: null,
  ai_instructions: null,
  image_library: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

describe("accessFromRole", () => {
  it("treats editor as the only writing role", () => {
    expect(accessFromRole("editor")).toBe("editor");
    expect(accessFromRole("viewer")).toBe("viewer");
  });

  it("falls back to viewer for anything it does not recognise", () => {
    // A role added to the schema later must not accidentally grant writes.
    expect(accessFromRole("admin")).toBe("viewer");
    expect(accessFromRole(null)).toBe("viewer");
    expect(accessFromRole(undefined)).toBe("viewer");
  });
});

describe("canWrite", () => {
  it("lets owners and editors write, and viewers only read", () => {
    expect(canWrite("owner")).toBe(true);
    expect(canWrite("editor")).toBe(true);
    expect(canWrite("viewer")).toBe(false);
  });
});

describe("projectAccessMap", () => {
  it("includes projects shared with the caller, not just their own", async () => {
    const access = await projectAccessMap(
      supabaseWith({
        projects: [{ id: "mine" }],
        project_members: [
          { project_id: "theirs-rw", role: "editor" },
          { project_id: "theirs-ro", role: "viewer" },
        ],
      }),
      "user-1",
    );

    expect([...access.entries()].sort()).toEqual([
      ["mine", "owner"],
      ["theirs-ro", "viewer"],
      ["theirs-rw", "editor"],
    ]);
  });

  it("keeps ownership when the owner also has a membership row", async () => {
    // A project can carry a project_members row for its own owner; being
    // listed there as a viewer must not downgrade the owner.
    const access = await projectAccessMap(
      supabaseWith({
        projects: [{ id: "mine" }],
        project_members: [{ project_id: "mine", role: "viewer" }],
      }),
      "user-1",
    );

    expect(access.get("mine")).toBe("owner");
    expect(access.size).toBe(1);
  });

  it("is empty for an account with nothing", async () => {
    const access = await projectAccessMap(supabaseWith({}), "user-1");
    expect(access.size).toBe(0);
  });
});

describe("projectToApi", () => {
  it("carries the caller's access when it was resolved", () => {
    expect(projectToApi(ROW, "viewer")).toMatchObject({ id: "p1", access: "viewer" });
  });

  it("omits access rather than guessing when it was not", () => {
    expect(projectToApi(ROW)).not.toHaveProperty("access");
  });
});
