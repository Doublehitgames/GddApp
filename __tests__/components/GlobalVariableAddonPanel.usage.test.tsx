import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { GlobalVariableAddonPanel } from "@/components/GlobalVariableAddonPanel";
import { useProjectStore } from "@/store/projectStore";
import type { GlobalVariableAddonDraft } from "@/lib/addons/types";

describe("GlobalVariableAddonPanel usage backlinks", () => {
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
              id: "sec-gvar",
              title: "Bonus Global",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [
                {
                  id: "gvar-1",
                  type: "globalVariable",
                  name: "Global Variable",
                  data: {
                    id: "gvar-1",
                    name: "Global Variable",
                    key: "sell_bonus_pct",
                    displayName: "Vende mais caro",
                    valueType: "percent",
                    defaultValue: 20,
                    scope: "global",
                  },
                },
              ],
            },
            {
              id: "sec-economy",
              title: "Loja",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 1,
              addons: [
                {
                  id: "eco-1",
                  type: "economyLink",
                  name: "Economia",
                  data: {
                    id: "eco-1",
                    name: "Economia",
                    hasBuyConfig: true,
                    buyValue: 10,
                    buyModifiers: [{ refId: "sec-gvar" }],
                    hasSellConfig: true,
                    sellValue: 20,
                    sellModifiers: [{ refId: "sec-gvar" }],
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("shows used by block with navigation link and buy/sell badges", () => {
    const addon: GlobalVariableAddonDraft = {
      id: "gvar-1",
      name: "Global Variable",
      key: "sell_bonus_pct",
      displayName: "Vende mais caro",
      valueType: "percent",
      defaultValue: 20,
      scope: "global",
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <GlobalVariableAddonPanel addon={addon} onChange={jest.fn()} onRemove={jest.fn()} />
      </I18nProvider>
    );

    expect(screen.getByText(/Usado por/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Loja/i })).toHaveAttribute("href", "/projects/p1/sections/sec-economy");
    expect(screen.getByText(/Compra/i)).toBeInTheDocument();
    expect(screen.getByText(/Venda/i)).toBeInTheDocument();
  });
});
