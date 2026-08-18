/**
 * `?addons=` on the section listing endpoints.
 *
 * balance_addons is 84% of the bytes in a 185-section listing. A caller that
 * only needs the shape of the document — which pages exist, which carry a
 * progression table — should not have to receive every progression table.
 *
 * @jest-environment node
 */

import type { NextRequest } from "next/server";
import { addonDetailParam, sectionMapper } from "@/lib/api/v1/helpers";

type Row = Parameters<ReturnType<typeof sectionMapper>>[0];

function makeRow(overrides: Record<string, unknown> = {}): Row {
  return {
    id: "sec-1",
    project_id: "proj-1",
    parent_id: "sec-parent",
    title: "Galinha",
    content: "A galinha bota ovos.",
    sort_order: 3,
    color: "#ffcc00",
    thumb_image_url: null,
    domain_tags: ["economy"],
    balance_addons: [
      { id: "a1", type: "progressionTable", name: "Balanceamento", data: { rows: [{ level: 1 }, { level: 2 }] } },
      { id: "a2", type: "dataSchema", name: "Stats", data: { entries: [] } },
    ],
    addon_group_notes: {},
    data_id: "FARM_ANIMAL_CHICKEN",
    flowchart_state: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-08-18T12:00:00Z",
    created_by: "user-1",
    created_by_name: "Julio",
    updated_by: "user-1",
    updated_by_name: "Julio",
    linked_spreadsheet_id: null,
    content_blocks: null,
    ...overrides,
  } as unknown as Row;
}

const asRequest = (url: string) => ({ nextUrl: new URL(url) }) as unknown as NextRequest;

describe("addonDetailParam", () => {
  it("defaults to full so existing callers are unaffected", () => {
    expect(addonDetailParam(asRequest("https://x.test/api/v1/projects/p/sections"))).toBe("full");
  });

  it("reads types and none", () => {
    expect(addonDetailParam(asRequest("https://x.test/s?addons=types"))).toBe("types");
    expect(addonDetailParam(asRequest("https://x.test/s?addons=none"))).toBe("none");
  });

  it("treats anything unrecognised as full rather than erroring", () => {
    for (const value of ["", "full", "TYPES", "1", "yes"]) {
      expect(addonDetailParam(asRequest(`https://x.test/s?addons=${value}`))).toBe("full");
    }
  });
});

describe("sectionMapper", () => {
  it("full keeps the addon data, exactly as before", () => {
    const out = sectionMapper("full")(makeRow()) as Record<string, unknown>;
    const addons = out.addons as Record<string, unknown>[];
    expect(addons).toHaveLength(2);
    expect(addons[0].data).toEqual({ rows: [{ level: 1 }, { level: 2 }] });
    expect(out).not.toHaveProperty("addonTypes");
  });

  it("full is the default", () => {
    expect(sectionMapper()(makeRow())).toEqual(sectionMapper("full")(makeRow()));
  });

  it("types swaps the payload for the type names", () => {
    const out = sectionMapper("types")(makeRow()) as Record<string, unknown>;
    expect(out.addonTypes).toEqual(["progressionTable", "dataSchema"]);
    expect(out).not.toHaveProperty("addons");
    // everything else survives, so the caller can still navigate
    expect(out).toMatchObject({ id: "sec-1", title: "Galinha", dataId: "FARM_ANIMAL_CHICKEN", order: 3 });
    expect(out.content).toBe("A galinha bota ovos.");
  });

  it("none drops addons entirely and adds nothing back", () => {
    const out = sectionMapper("none")(makeRow()) as Record<string, unknown>;
    expect(out).not.toHaveProperty("addons");
    expect(out).not.toHaveProperty("addonTypes");
    expect(out.title).toBe("Galinha");
  });

  it("types on a page with no addons gives an empty list, not a missing key", () => {
    const out = sectionMapper("types")(makeRow({ balance_addons: null })) as Record<string, unknown>;
    expect(out.addonTypes).toEqual([]);
  });

  it("skips malformed addon entries instead of emitting holes", () => {
    const out = sectionMapper("types")(makeRow({
      balance_addons: [{ type: "currency" }, null, "junk", { name: "sem tipo" }, { type: 42 }],
    })) as Record<string, unknown>;
    expect(out.addonTypes).toEqual(["currency"]);
  });

  it("is the whole point: types is a fraction of the bytes", () => {
    const heavy = makeRow({
      balance_addons: [{
        id: "a1", type: "progressionTable", name: "Balanceamento",
        data: { rows: Array.from({ length: 100 }, (_, i) => ({ level: i + 1, xp: i * 137 })) },
      }],
    });
    const full = JSON.stringify(sectionMapper("full")(heavy)).length;
    const types = JSON.stringify(sectionMapper("types")(heavy)).length;
    expect(full).toBeGreaterThan(2500);
    expect(types).toBeLessThan(full / 5);
  });
});
