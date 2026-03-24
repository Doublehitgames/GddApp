import { render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { InventoryAddonReadOnly } from "@/components/InventoryAddonReadOnly";
import { useProjectStore } from "@/store/projectStore";
import type { InventoryAddonDraft } from "@/lib/addons/types";

describe("InventoryAddonReadOnly backlinks", () => {
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
                    requiresCollection: false,
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
            {
              id: "sec-duck",
              title: "Pato",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 3,
              addons: [
                {
                  id: "prod-3",
                  type: "production",
                  name: "Production",
                  data: {
                    id: "prod-3",
                    name: "Production",
                    mode: "passive",
                    outputRef: "sec-egg",
                    minOutput: 1,
                    maxOutput: 1,
                    intervalSeconds: 40,
                    ingredients: [],
                    outputs: [],
                    craftTimeSeconds: 40,
                  },
                },
              ],
            },
            {
              id: "sec-mill",
              title: "Moinho",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 4,
              addons: [
                {
                  id: "prod-4",
                  type: "production",
                  name: "Production",
                  data: {
                    id: "prod-4",
                    name: "Production",
                    mode: "recipe",
                    ingredients: [{ itemRef: "sec-feed", quantity: 1 }],
                    outputs: [{ itemRef: "sec-egg", quantity: 1 }],
                    craftTimeSeconds: 20,
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("renders Produced by list from production references", () => {
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
        <InventoryAddonReadOnly addon={addon} />
      </I18nProvider>
    );

    expect(screen.getByText(/Conexoes de producao/i)).toBeInTheDocument();
    expect(screen.getByText(/Produzido por/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Galinha/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pato/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Moinho/i })).toBeInTheDocument();
    expect(screen.getByText(/Ingrediente para/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Racao basica/i })).toBeInTheDocument();

    const producedByParagraph = screen.getByText(/Produzido por/i).closest("p");
    expect(producedByParagraph).not.toBeNull();
    const producedByLinks = within(producedByParagraph as HTMLElement).getAllByRole("link");
    expect(producedByLinks.map((link) => link.textContent)).toEqual(["Galinha", "Pato", "Moinho"]);
    const producedByText = producedByParagraph?.textContent || "";
    expect(producedByText).toContain("Passiva");
    expect(producedByText).toContain("Receita");
  });
});
