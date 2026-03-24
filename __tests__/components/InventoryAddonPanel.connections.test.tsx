import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { InventoryAddonPanel } from "@/components/InventoryAddonPanel";
import { useProjectStore } from "@/store/projectStore";
import type { InventoryAddonDraft } from "@/lib/addons/types";

describe("InventoryAddonPanel connections", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [
        {
          id: "p1",
          title: "Projeto",
          description: "",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
          sections: [
            {
              id: "sec-egg",
              title: "Ovo",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [
                {
                  id: "inv-egg",
                  type: "inventory",
                  name: "Inventory",
                  data: {
                    id: "inv-egg",
                    name: "Inventory",
                    weight: 1,
                    stackable: true,
                    maxStack: 20,
                    inventoryCategory: "Comida",
                    slotSize: 1,
                    durability: 0,
                    bindType: "none",
                    showInShop: true,
                    consumable: true,
                    discardable: true,
                  },
                },
              ],
            },
            {
              id: "sec-chicken",
              title: "Galinha",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 1,
              addons: [
                {
                  id: "prod-1",
                  type: "production",
                  name: "Production",
                  data: {
                    id: "prod-1",
                    name: "Production",
                    mode: "passive",
                    outputRef: "sec-egg",
                    minOutput: 1,
                    maxOutput: 2,
                    intervalSeconds: 60,
                    ingredients: [],
                    outputs: [],
                    craftTimeSeconds: 60,
                  },
                },
              ],
            },
            {
              id: "sec-feed",
              title: "Racao basica",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 2,
              addons: [
                {
                  id: "prod-2",
                  type: "production",
                  name: "Production",
                  data: {
                    id: "prod-2",
                    name: "Production",
                    mode: "recipe",
                    ingredients: [{ itemRef: "sec-egg", quantity: 2 }],
                    outputs: [{ itemRef: "sec-feed", quantity: 1 }],
                    craftTimeSeconds: 30,
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("shows production connections in management mode", () => {
    const addon: InventoryAddonDraft = {
      id: "inv-egg",
      name: "Inventory",
      weight: 1,
      stackable: true,
      maxStack: 20,
      inventoryCategory: "Comida",
      slotSize: 1,
      durability: 0,
      bindType: "none",
      showInShop: true,
      consumable: true,
      discardable: true,
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <InventoryAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );

    expect(screen.getByText(/Conexoes de producao/i)).toBeInTheDocument();
    expect(screen.getByText(/Produzido por/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Galinha/i })).toHaveAttribute("href", "/projects/p1/sections/sec-chicken");
    expect(screen.getByText(/Passiva/i)).toBeInTheDocument();
    expect(screen.getByText(/Ingrediente para/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Racao basica/i })).toHaveAttribute("href", "/projects/p1/sections/sec-feed");
    expect(screen.getAllByText("↗")).toHaveLength(2);
  });
});
