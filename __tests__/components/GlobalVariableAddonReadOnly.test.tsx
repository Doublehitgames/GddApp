import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { GlobalVariableAddonReadOnly } from "@/components/GlobalVariableAddonReadOnly";
import { useProjectStore } from "@/store/projectStore";

describe("GlobalVariableAddonReadOnly", () => {
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
              title: "Bonus de venda",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [
                {
                  id: "gvar-1",
                  type: "globalVariable",
                  name: "Bonus de venda",
                  data: {
                    id: "gvar-1",
                    name: "Bonus de venda",
                    key: "sell_bonus_pct",
                    displayName: "Vende mais caro",
                    valueType: "percent",
                    defaultValue: 20,
                    scope: "global",
                    notes: "Campanha",
                  },
                },
              ],
            },
            {
              id: "sec-shop",
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
                    buyModifiers: [{ refId: "sec-gvar" }],
                    hasSellConfig: true,
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

  it("renders global variable fields", () => {
    render(
      <I18nProvider initialLocale="pt-BR">
        <GlobalVariableAddonReadOnly
          addon={{
            id: "gvar-1",
            name: "Bonus de venda",
            key: "sell_bonus_pct",
            displayName: "Vende mais caro",
            valueType: "percent",
            defaultValue: 20,
            scope: "global",
            notes: "Campanha",
          }}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Bonus de venda")).toBeInTheDocument();
    expect(screen.queryByText(/^Resumo:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Variavel "Vende mais caro"/i)).toBeInTheDocument();
    expect(screen.getByText(/sell_bonus_pct/i)).toBeInTheDocument();
    expect(screen.getByText(/valor padrao 20/i)).toBeInTheDocument();
    expect(screen.getByText(/Campanha/i)).toBeInTheDocument();
    expect(screen.getByText(/Usado por/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Loja/i })).toBeInTheDocument();
    expect(screen.getByText(/Compra/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Venda/i).length).toBeGreaterThan(0);
  });
});
