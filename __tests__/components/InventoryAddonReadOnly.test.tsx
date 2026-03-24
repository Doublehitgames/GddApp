import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { InventoryAddonReadOnly } from "@/components/InventoryAddonReadOnly";

describe("InventoryAddonReadOnly", () => {
  it("renders inventory fields", () => {
    render(
      <I18nProvider initialLocale="pt-BR">
        <InventoryAddonReadOnly
          addon={{
            id: "inv-1",
            name: "Estoque da Semente",
            weight: 1.5,
            stackable: true,
            maxStack: 99,
            inventoryCategory: "Semente",
            slotSize: 1,
            durability: 0,
            volume: 0.2,
            maxDurability: 0,
            bindType: "none",
            showInShop: true,
            consumable: false,
            discardable: true,
            notes: "Item padrao",
          }}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/Estoque da Semente/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Resumo:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Item de categoria Semente/i)).toBeInTheDocument();
    expect(screen.getByText(/permite pilha \(max 99\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Loja: Sim/i)).toBeInTheDocument();
    expect(screen.getByText(/Item padrao/i)).toBeInTheDocument();
  });
});
