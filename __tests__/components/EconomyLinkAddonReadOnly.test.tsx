import { render, screen } from "@testing-library/react";
import { EconomyLinkAddonReadOnly } from "@/components/EconomyLinkAddonReadOnly";
import { I18nProvider } from "@/lib/i18n/provider";
import type { EconomyLinkAddonDraft } from "@/lib/addons/types";
import { useProjectStore } from "@/store/projectStore";

describe("EconomyLinkAddonReadOnly", () => {
  it("renders buy/sell/unlock summaries", () => {
    const addon: EconomyLinkAddonDraft = {
      id: "eco-ro",
      name: "Economia da Loja",
      buyCurrencyRef: "currency-coins",
      buyValue: 100,
      minBuyValue: 80,
      buyModifiers: [{ refId: "var-buy-discount" }],
      sellCurrencyRef: "currency-coins",
      sellValue: 60,
      maxSellValue: 120,
      sellModifiers: [{ refId: "var-sell-bonus" }],
      unlockRef: "progression-farm-level",
      unlockValue: 5,
      notes: "Teste",
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <EconomyLinkAddonReadOnly addon={addon} />
      </I18nProvider>
    );

    expect(screen.getByText("Economia da Loja")).toBeInTheDocument();
    expect(screen.getByText(/^Compra:/i)).toBeInTheDocument();
    expect(screen.getByText(/Compre por/i)).toBeInTheDocument();
    expect(screen.getByText(/desconto aplicado/i)).toBeInTheDocument();
    expect(screen.getByText(/minimo final de/i)).toBeInTheDocument();
    expect(screen.getByText(/Minimo de compra:\s*80/i)).toBeInTheDocument();
    expect(screen.getByText(/^Venda:/i)).toBeInTheDocument();
    expect(screen.getByText(/Venda por/i)).toBeInTheDocument();
    expect(screen.getAllByText(/bonus/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/maximo final de/i)).toBeInTheDocument();
    expect(screen.getByText(/Maximo de venda:\s*120/i)).toBeInTheDocument();
    expect(screen.getByText(/^Desbloqueio:/i)).toBeInTheDocument();
    expect(screen.getByText(/Libera no LV/i)).toBeInTheDocument();
    expect(screen.getByText(/5 de progression-farm-level/i)).toBeInTheDocument();
  });

  it("hides blocks when config toggles are disabled", () => {
    const addon: EconomyLinkAddonDraft = {
      id: "eco-ro-hidden",
      name: "Economia compacta",
      hasBuyConfig: false,
      hasSellConfig: false,
      hasUnlockConfig: false,
      buyModifiers: [],
      sellModifiers: [],
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <EconomyLinkAddonReadOnly addon={addon} />
      </I18nProvider>
    );

    expect(screen.queryByText(/^Compra:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Venda:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Desbloqueio:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Produz/i)).not.toBeInTheDocument();
  });

  it("shows effective value badges with neutral style text", () => {
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
              id: "currency-coins",
              title: "Coins",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [
                {
                  id: "currency-addon",
                  type: "currency",
                  name: "Currency",
                  data: {
                    id: "currency-addon",
                    name: "Currency",
                    code: "COINS",
                    displayName: "Coins",
                    kind: "soft",
                    decimals: 0,
                  },
                },
              ],
            },
            {
              id: "var-buy",
              title: "Desconto de compra",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 1,
              addons: [
                {
                  id: "gvar-buy",
                  type: "globalVariable",
                  name: "Global Variable",
                  data: {
                    id: "gvar-buy",
                    name: "Global Variable",
                    key: "buy_discount_pct",
                    displayName: "Desconto compra",
                    valueType: "percent",
                    defaultValue: -20,
                    scope: "global",
                  },
                },
              ],
            },
            {
              id: "var-sell",
              title: "Bonus de venda",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 2,
              addons: [
                {
                  id: "gvar-sell",
                  type: "globalVariable",
                  name: "Global Variable",
                  data: {
                    id: "gvar-sell",
                    name: "Global Variable",
                    key: "sell_bonus_pct",
                    displayName: "Bonus venda",
                    valueType: "percent",
                    defaultValue: 50,
                    scope: "global",
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const addon: EconomyLinkAddonDraft = {
      id: "eco-final",
      name: "Economia",
      hasBuyConfig: true,
      buyCurrencyRef: "currency-coins",
      buyValue: 100,
      minBuyValue: 90,
      buyModifiers: [{ refId: "var-buy" }],
      hasSellConfig: true,
      sellCurrencyRef: "currency-coins",
      sellValue: 100,
      maxSellValue: 120,
      sellModifiers: [{ refId: "var-sell" }],
      hasUnlockConfig: false,
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <EconomyLinkAddonReadOnly addon={addon} />
      </I18nProvider>
    );

    expect(screen.getAllByText(/Valor final:/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Valor final:\s*\$\s*90/i)).toBeInTheDocument();
    expect(screen.getByText(/Valor final:\s*\$\s*120/i)).toBeInTheDocument();
  });
});
