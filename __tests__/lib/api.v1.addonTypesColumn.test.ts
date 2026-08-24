/**
 * selectSections and the `addon_types` generated column.
 *
 * The column arrives with add_sections_addon_types.sql, which may be run long
 * after this code ships. So the read has to work in both states, and must not
 * pay a failed probe on every request while the migration is unrun.
 *
 * @jest-environment node
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resetAddonTypesColumnCache, selectSections } from "@/lib/api/v1/helpers";

const ROW = {
  id: "sec-1",
  project_id: "proj-1",
  parent_id: null,
  title: "Galinha",
  content: "texto",
  sort_order: 0,
  balance_addons: [{ id: "a1", type: "progressionTable" }, { id: "a2", type: "dataSchema" }],
};

/**
 * Stands in for the Supabase query builder: records which column list each
 * query asked for, and fails the ones naming a column the fake DB lacks.
 */
function stubClient(opts: { hasAddonTypes: boolean }) {
  const asked: string[] = [];

  function query(columns: string) {
    asked.push(columns);
    const missing = !opts.hasAddonTypes && columns.includes("addon_types");
    const row = opts.hasAddonTypes
      ? { ...ROW, balance_addons: undefined, addon_types: ["progressionTable", "dataSchema"] }
      : ROW;

    const result = missing
      ? { data: null, error: { message: 'column sections.addon_types does not exist' } }
      : { data: [row], error: null };

    const chain = {
      eq: () => chain,
      order: () => chain,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return chain;
  }

  const supabase = { from: () => ({ select: (columns: string) => query(columns) }) } as unknown as SupabaseClient;
  return { supabase, asked };
}

beforeEach(() => resetAddonTypesColumnCache());

describe("before the migration is run", () => {
  it("falls back to the jsonb and still returns the addons", async () => {
    const { supabase } = stubClient({ hasAddonTypes: false });
    const { data, error } = await selectSections(supabase, { projectId: "p1" }, { addons: "types" });
    expect(error).toBeNull();
    expect(data?.[0].balance_addons).toEqual(ROW.balance_addons);
  });

  it("probes once, then stops paying for the failure", async () => {
    const { supabase, asked } = stubClient({ hasAddonTypes: false });

    await selectSections(supabase, { projectId: "p1" }, { addons: "types" });
    const afterFirst = asked.filter((c) => c.includes("addon_types")).length;

    await selectSections(supabase, { projectId: "p1" }, { addons: "types" });
    await selectSections(supabase, { projectId: "p1" }, { addons: "types" });
    const afterThree = asked.filter((c) => c.includes("addon_types")).length;

    expect(afterFirst).toBe(1);
    expect(afterThree).toBe(1);
  });

  it("still reads the full row each time, so nothing is lost", async () => {
    const { supabase, asked } = stubClient({ hasAddonTypes: false });
    await selectSections(supabase, { projectId: "p1" }, { addons: "types" });
    await selectSections(supabase, { projectId: "p1" }, { addons: "types" });
    expect(asked.filter((c) => c.includes("balance_addons")).length).toBe(2);
  });
});

describe("once the migration has been run", () => {
  it("reads the generated column and leaves the jsonb alone", async () => {
    const { supabase, asked } = stubClient({ hasAddonTypes: true });
    const { data } = await selectSections(supabase, { projectId: "p1" }, { addons: "types" });

    expect(data?.[0].addon_types).toEqual(["progressionTable", "dataSchema"]);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("addon_types");
    expect(asked[0]).not.toContain("balance_addons");
  });

  it("keeps using it without re-probing", async () => {
    const { supabase, asked } = stubClient({ hasAddonTypes: true });
    await selectSections(supabase, { projectId: "p1" }, { addons: "types" });
    await selectSections(supabase, { projectId: "p1" }, { addons: "types" });
    expect(asked).toHaveLength(2);
    expect(asked.every((c) => c.includes("addon_types"))).toBe(true);
  });

  it("picks the column up on its own — no redeploy needed", async () => {
    // Same process learns "absent", then the DBA runs the SQL.
    const before = stubClient({ hasAddonTypes: false });
    await selectSections(before.supabase, { projectId: "p1" }, { addons: "types" });

    jest.useFakeTimers().setSystemTime(Date.now() + 6 * 60_000);
    try {
      const after = stubClient({ hasAddonTypes: true });
      const { data } = await selectSections(after.supabase, { projectId: "p1" }, { addons: "types" });
      expect(data?.[0].addon_types).toEqual(["progressionTable", "dataSchema"]);
      expect(after.asked[0]).toContain("addon_types");
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("the other modes are untouched by the probe", () => {
  it("addons=none never asks for the generated column", async () => {
    const { supabase, asked } = stubClient({ hasAddonTypes: true });
    await selectSections(supabase, { projectId: "p1" }, { addons: "none" });
    expect(asked.some((c) => c.includes("addon_types"))).toBe(false);
    expect(asked.some((c) => c.includes("balance_addons"))).toBe(false);
  });

  it("the default still reads everything", async () => {
    const { supabase, asked } = stubClient({ hasAddonTypes: true });
    await selectSections(supabase, { projectId: "p1" });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("balance_addons");
    expect(asked[0]).not.toContain("addon_types");
  });
});
