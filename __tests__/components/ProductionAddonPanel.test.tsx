import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { ProductionAddonPanel } from "@/components/ProductionAddonPanel";
import { useProjectStore } from "@/store/projectStore";
import type { ProductionAddonDraft } from "@/lib/addons/types";

describe("ProductionAddonPanel", () => {
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
              id: "sec-producer",
              title: "Galinha",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [
                {
                  id: "prod-1",
                  type: "production",
                  name: "Production",
                  data: {
                    id: "prod-1",
                    name: "Production",
                    mode: "passive",
                    ingredients: [],
                    outputs: [],
                  },
                },
                {
                  id: "prod-2",
                  type: "production",
                  name: "Production",
                  data: {
                    id: "prod-2",
                    name: "Production",
                    mode: "passive",
                    ingredients: [],
                    outputs: [],
                  },
                },
                {
                  id: "prod-3",
                  type: "production",
                  name: "Production",
                  data: {
                    id: "prod-3",
                    name: "Production",
                    mode: "recipe",
                    ingredients: [],
                    outputs: [],
                  },
                },
                {
                  id: "prog-1",
                  type: "progressionTable",
                  name: "Tabela Base",
                  data: {
                    id: "prog-1",
                    name: "Tabela Base",
                    startLevel: 1,
                    endLevel: 10,
                    columns: [
                      { id: "timeA", name: "Tempo", isPercentage: true },
                    ],
                    rows: [
                      { level: 1, values: { timeA: -10 } },
                      { level: 5, values: { timeA: -20 } },
                      { level: 10, values: { timeA: -30 } },
                    ],
                  },
                },
                {
                  id: "prog-2",
                  type: "progressionTable",
                  name: "Tabela Evento",
                  data: {
                    id: "prog-2",
                    name: "Tabela Evento",
                    startLevel: 1,
                    endLevel: 10,
                    columns: [
                      { id: "timeB", name: "Tempo", isPercentage: false },
                    ],
                    rows: [
                      { level: 1, values: { timeB: -5 } },
                      { level: 5, values: { timeB: -10 } },
                      { level: 10, values: { timeB: -20 } },
                    ],
                  },
                },
              ],
            },
            {
              id: "sec-item-output",
              title: "Ovo",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 1,
              addons: [
                {
                  id: "inv-1",
                  type: "inventory",
                  name: "Inventory",
                  data: {
                    id: "inv-1",
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
              id: "sec-no-inventory",
              title: "Sem inventario",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 2,
              addons: [],
            },
          ],
        },
      ],
    });
  });

  it("shows only inventory pages in passive output selector and updates outputRef", () => {
    const onChange = jest.fn();
    const addon: ProductionAddonDraft = {
      id: "prod-1",
      name: "Production",
      mode: "passive",
      minOutput: 1,
      maxOutput: 2,
      intervalSeconds: 60,
      requiresCollection: false,
      ingredients: [],
      outputs: [],
      craftTimeSeconds: 60,
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProductionAddonPanel addon={addon} onChange={onChange} onRemove={jest.fn()} />
      </I18nProvider>
    );

    const selectElements = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const outputSelect = selectElements.find((select) =>
      Array.from(select.options).some((option) => option.value === "sec-item-output")
    ) as HTMLSelectElement;

    const optionValues = Array.from(outputSelect.options).map((option) => option.value);
    expect(optionValues).toContain("sec-item-output");
    expect(optionValues).not.toContain("sec-no-inventory");

    fireEvent.change(outputSelect, { target: { value: "sec-item-output" } });
    const calls = onChange.mock.calls as Array<[ProductionAddonDraft]>;
    expect(calls[calls.length - 1][0].outputRef).toBe("sec-item-output");
  });

  it("shows link to output item page when outputRef is selected", () => {
    const addon: ProductionAddonDraft = {
      id: "prod-2",
      name: "Production",
      mode: "passive",
      outputRef: "sec-item-output",
      minOutput: 1,
      maxOutput: 2,
      intervalSeconds: 60,
      requiresCollection: false,
      ingredients: [],
      outputs: [],
      craftTimeSeconds: 60,
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProductionAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );

    expect(screen.getByText("Item produzido")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Abrir item/i });
    expect(link).toHaveAttribute("href", "/projects/projeto/sections/ovo");
    expect(link).toHaveTextContent("↗");
    expect(screen.queryByText(/ref estoque/i)).not.toBeInTheDocument();
  });

  it("shows quick links for selected ingredient and output rows", () => {
    const addon: ProductionAddonDraft = {
      id: "prod-3",
      name: "Receita",
      mode: "recipe",
      ingredients: [{ itemRef: "sec-item-output", quantity: 2 }],
      outputs: [{ itemRef: "sec-item-output", quantity: 1 }],
      craftTimeSeconds: 30,
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProductionAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );

    const links = screen.getAllByRole("link", { name: /Abrir item/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links[0]).toHaveAttribute("href", "/projects/projeto/sections/ovo");
    expect(links[1]).toHaveAttribute("href", "/projects/projeto/sections/ovo");
    expect(links[0]).toHaveTextContent("↗");
    expect(links[1]).toHaveTextContent("↗");
  });

  it("shows progression column selectors with disambiguation and simulation badges", () => {
    const addon: ProductionAddonDraft = {
      id: "prod-1",
      name: "Production",
      mode: "passive",
      intervalSeconds: 60,
      intervalSecondsBinding: {
        source: "progressionColumn",
        progressionAddonId: "prog-1",
        columnId: "timeA",
        columnName: "Tempo",
      },
      ingredients: [],
      outputs: [],
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProductionAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );

    const labelButton = screen.getByRole("button", { name: /Tempo \(segundos\)/i });
    expect(labelButton.textContent || "").toContain("Tabela Base - Tempo");
    fireEvent.click(labelButton);
    expect(screen.getAllByText(/Tabela Base - Tempo/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Tabela Evento - Tempo/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv1:\s*54s/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv5:\s*48s/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv10:\s*42s/i)).toBeInTheDocument();
  });

  it("shows recipe time simulation badges when craft link is set", () => {
    const addon: ProductionAddonDraft = {
      id: "prod-3",
      name: "Production",
      mode: "recipe",
      ingredients: [],
      outputs: [],
      craftTimeSeconds: 45,
      craftTimeSecondsBinding: {
        source: "progressionColumn",
        progressionAddonId: "prog-2",
        columnId: "timeB",
        columnName: "Tempo",
      },
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProductionAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );

    const labelButton = screen.getByRole("button", { name: /Tempo de receita \(segundos\)/i });
    expect(labelButton.textContent || "").toContain("Tabela Evento - Tempo");
    fireEvent.click(labelButton);

    expect(screen.getByText(/Lv1:\s*40s/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv5:\s*35s/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv10:\s*25s/i)).toBeInTheDocument();
  });

  it("shows invalid progression link option when linked column was removed", () => {
    const addon: ProductionAddonDraft = {
      id: "prod-1",
      name: "Production",
      mode: "passive",
      intervalSeconds: 60,
      intervalSecondsBinding: {
        source: "progressionColumn",
        progressionAddonId: "prog-404",
        columnId: "time404",
        columnName: "Tempo",
      },
      ingredients: [],
      outputs: [],
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProductionAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );

    const labelButton = screen.getByRole("button", { name: /Tempo \(segundos\)/i });
    fireEvent.click(labelButton);
    expect(screen.getAllByText(/Vínculo quebrado/i).length).toBeGreaterThan(0);
  });

  it("supports output quantity link with computed badges", () => {
    const addon: ProductionAddonDraft = {
      id: "prod-1",
      name: "Production",
      mode: "passive",
      minOutput: 10,
      maxOutput: 100,
      minOutputBinding: {
        source: "progressionColumn",
        progressionAddonId: "prog-1",
        columnId: "timeA",
        columnName: "Tempo",
      },
      ingredients: [],
      outputs: [],
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProductionAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );

    // "Quantidade" field with progression binding: clicking chip shows level badges
    const quantityButton = screen.getByRole("button", { name: /Quantidade/i });
    fireEvent.click(quantityButton);
    expect(screen.getByText(/Lv1:\s*9\b/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv5:\s*8\b/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv10:\s*7\b/i)).toBeInTheDocument();

    // maxOutput is set, so the NumericLimitsToggle auto-opens showing Mín + Máx plain inputs
    expect(screen.getByText(/^Mín$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Máx$/i)).toBeInTheDocument();
    // No separate binding chip for Qtd maxima — it's a plain input inside the toggle
    expect(screen.queryByRole("button", { name: /Qtd maxima/i })).toBeNull();
  });

  it("shows active-link visual marker on linked field labels", () => {
    const addon: ProductionAddonDraft = {
      id: "prod-1",
      name: "Production",
      mode: "passive",
      minOutput: 10,
      minOutputBinding: {
        source: "progressionColumn",
        progressionAddonId: "prog-1",
        columnId: "timeA",
        columnName: "Tempo",
      },
      intervalSeconds: 60,
      intervalSecondsBinding: {
        source: "progressionColumn",
        progressionAddonId: "prog-1",
        columnId: "timeA",
        columnName: "Tempo",
      },
      ingredients: [],
      outputs: [],
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProductionAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );

    // "Quantidade" (formerly "Qtd minima") shows active-link dot when bound
    expect(screen.getByRole("button", { name: /Quantidade/i })).toHaveTextContent("•");
    // "Qtd maxima" is now a plain input (no chip button) — no active-link marker
    expect(screen.queryByRole("button", { name: /Qtd maxima/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Tempo \(segundos\)/i })).toHaveTextContent("•");
  });
});
