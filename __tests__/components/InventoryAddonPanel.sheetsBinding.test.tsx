import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { InventoryAddonPanel } from "@/components/InventoryAddonPanel";
import { useProjectStore } from "@/store/projectStore";
import type { InventoryAddonDraft } from "@/lib/addons/types";

function baseAddon(overrides: Partial<InventoryAddonDraft> = {}): InventoryAddonDraft {
  return {
    id: "inv-1",
    name: "Inventory",
    weight: 0,
    stackable: true,
    maxStack: 999,
    inventoryCategory: "Sementes",
    slotSize: 1,
    durability: 0,
    bindType: "none",
    showInShop: true,
    consumable: false,
    discardable: false,
    ...overrides,
  };
}

function setupStore(addon: InventoryAddonDraft) {
  useProjectStore.setState({
    projects: [
      {
        id: "p1",
        title: "Projeto",
        description: "",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
        linkedSpreadsheets: [],
        sections: [
          {
            id: "sec-1",
            title: "Semente",
            created_at: "2026-03-01T00:00:00.000Z",
            order: 0,
            addons: [{ id: "inv-1", type: "inventory", name: "Inventory", data: addon }],
          },
        ],
      },
    ],
  } as never);
}

describe("InventoryAddonPanel Google Sheets binding", () => {
  it("renders an unbound boolean toggle as enabled", () => {
    const addon = baseAddon();
    setupStore(addon);
    render(
      <I18nProvider initialLocale="pt-BR">
        <InventoryAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );
    const toggle = screen.getByRole("switch", { name: /Pode aparecer na Loja/i });
    expect(toggle).toBeEnabled();
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("reflects the synced cell value and locks the toggle when bound to Sheets", () => {
    // Scalar says true, but the bound cell value is false → toggle must show false + be disabled.
    const addon = baseAddon({
      showInShop: true,
      showInShopBinding: {
        source: "sheets",
        ref: { sheetName: "Seeds", cellRef: "C2", cachedValue: false, syncedAt: "2026-06-24T00:00:00.000Z" },
      },
    });
    setupStore(addon);
    render(
      <I18nProvider initialLocale="pt-BR">
        <InventoryAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );
    const toggle = screen.getByRole("switch", { name: /Pode aparecer na Loja/i });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});
