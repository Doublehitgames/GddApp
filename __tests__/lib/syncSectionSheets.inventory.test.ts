import type { SectionAddon } from "@/lib/addons/types";

// Mock the Google Sheets API layer: only fetchSheetRangeValues is exercised by
// readCellCached for a simple (lock-free) cell ref.
const fetchSheetRangeValues = jest.fn();
jest.mock("@/lib/googleSheets", () => ({
  fetchSheetCellValue: jest.fn(),
  fetchSheetRangeValues: (...args: unknown[]) => fetchSheetRangeValues(...args),
  fetchColumnValues: jest.fn(),
  fetchSpreadsheetHeaders: jest.fn(),
  columnIndexToLetter: (i: number) => String.fromCharCode(65 + i),
  parseCellNumber: (s: string) => {
    const n = Number(String(s).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  },
}));

import { syncSectionAddons } from "@/lib/addons/syncSectionSheets";

function inventoryAddon(cachedValue: unknown): SectionAddon {
  return {
    id: "inv-1",
    type: "inventory",
    name: "Inventory",
    data: {
      id: "inv-1",
      name: "Inventory",
      weight: 0,
      stackable: true,
      maxStack: 999,
      inventoryCategory: "Sementes",
      slotSize: 1,
      durability: 0,
      bindType: "none",
      // Stale scalar — sync must overwrite it from the cell.
      showInShop: false,
      consumable: false,
      discardable: false,
      showInShopBinding: {
        source: "sheets",
        ref: { sheetName: "Seeds", cellRef: "C2", cachedValue, syncedAt: null },
      },
    },
  } as unknown as SectionAddon;
}

describe("syncSectionAddons — inventory boolean fields", () => {
  beforeEach(() => fetchSheetRangeValues.mockReset());

  async function syncWithCell(raw: string | number): Promise<{ scalar: unknown; cached: unknown; totalSynced: number }> {
    // Column C values: row 1 = header, row 2 = our cell (index 1).
    fetchSheetRangeValues.mockResolvedValue(["header", raw]);
    const result = await syncSectionAddons([inventoryAddon(false)], "sheet-id", "token");
    const data = (result.updatedAddons[0] as { data: Record<string, unknown> }).data;
    const binding = data.showInShopBinding as { ref: { cachedValue: unknown; syncedAt: unknown } };
    expect(binding.ref.syncedAt).toBeTruthy();
    return { scalar: data.showInShop, cached: binding.ref.cachedValue, totalSynced: result.totalSynced };
  }

  it("converts TRUE/1/SIM/YES to true", async () => {
    for (const raw of ["TRUE", "true", "1", "Yes", "SIM"]) {
      const { scalar, cached, totalSynced } = await syncWithCell(raw);
      expect({ raw, scalar, cached }).toEqual({ raw, scalar: true, cached: true });
      expect(totalSynced).toBe(1);
    }
  });

  it("converts FALSE/0/blank to false", async () => {
    for (const raw of ["FALSE", "0", "no", "qualquer"]) {
      const { scalar, cached } = await syncWithCell(raw);
      expect({ raw, scalar, cached }).toEqual({ raw, scalar: false, cached: false });
    }
  });

  it("never coerces a boolean cell into a number", async () => {
    const { scalar, cached } = await syncWithCell("TRUE");
    expect(typeof scalar).toBe("boolean");
    expect(typeof cached).toBe("boolean");
  });
});
