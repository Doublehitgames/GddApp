import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { EconomyLinkAddonPanel } from "@/components/EconomyLinkAddonPanel";
import { useProjectStore } from "@/store/projectStore";
import type { EconomyLinkAddonDraft } from "@/lib/addons/types";

describe("EconomyLinkAddonPanel integration", () => {
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
              id: "sec-currency",
              title: "Coins",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [
                {
                  id: "cur-addon",
                  type: "currency",
                  name: "Currency",
                  data: {
                    id: "cur-addon",
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
              id: "sec-gvar",
              title: "Bonus de venda",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 1,
              addons: [
                {
                  id: "gvar-addon",
                  type: "globalVariable",
                  name: "Global Variable",
                  data: {
                    id: "gvar-addon",
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
              id: "sec-xp",
              title: "Progressao da Fazenda",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 2,
              addons: [
                {
                  id: "xp-addon",
                  type: "xpBalance",
                  name: "XP Fazenda",
                  data: {
                    id: "xp-addon",
                    name: "XP Fazenda",
                    mode: "preset",
                    preset: "linear",
                    expression: "",
                    startLevel: 5,
                    endLevel: 40,
                    decimals: 0,
                    params: {
                      base: 10,
                      growth: 1.1,
                      offset: 0,
                      tierStep: 5,
                      tierMultiplier: 1,
                      capValue: 0,
                      capStrength: 0,
                      plateauStartLevel: 1,
                      plateauFactor: 1,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("shows assisted references for currency and global variable", () => {
    const onChange = jest.fn();
    const addon: EconomyLinkAddonDraft = {
      id: "eco-1",
      name: "Economia",
      hasBuyConfig: true,
      hasSellConfig: true,
      hasUnlockConfig: true,
      buyModifiers: [],
      sellModifiers: [],
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <EconomyLinkAddonPanel addon={addon} onChange={onChange} onRemove={jest.fn()} />
      </I18nProvider>
    );

    expect(screen.getAllByText(/Coins \(COINS\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Vende mais caro/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Progressao da Fazenda - XP Fazenda/i)).toBeInTheDocument();
  });

  it("updates buy currency when selecting assisted reference", () => {
    const onChange = jest.fn();
    const addon: EconomyLinkAddonDraft = {
      id: "eco-2",
      name: "Economia",
      hasBuyConfig: true,
      hasSellConfig: true,
      buyModifiers: [],
      sellModifiers: [],
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <EconomyLinkAddonPanel addon={addon} onChange={onChange} onRemove={jest.fn()} />
      </I18nProvider>
    );

    const selectElements = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const buyCurrencySelect = selectElements.find((select) =>
      Array.from(select.options).some((option) => option.value === "sec-currency")
    );
    expect(buyCurrencySelect).toBeDefined();
    fireEvent.change(buyCurrencySelect as HTMLSelectElement, { target: { value: "sec-currency" } });

    expect(onChange).toHaveBeenCalled();
    const calls = onChange.mock.calls as Array<[EconomyLinkAddonDraft]>;
    expect(calls[calls.length - 1][0].buyCurrencyRef).toBe("sec-currency");
  });

  it("shows effective value label and applies buy/sell bounds", () => {
    const onChange = jest.fn();
    const addon: EconomyLinkAddonDraft = {
      id: "eco-3",
      name: "Economia",
      hasBuyConfig: true,
      buyValue: 50,
      minBuyValue: 70,
      buyModifiers: [{ refId: "sec-gvar" }],
      hasSellConfig: true,
      sellValue: 100,
      maxSellValue: 110,
      sellModifiers: [{ refId: "sec-gvar" }],
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <EconomyLinkAddonPanel addon={addon} onChange={onChange} onRemove={jest.fn()} />
      </I18nProvider>
    );

    expect(screen.getByText(/Valor de compra:\s*70/i)).toBeInTheDocument();
    expect(screen.getByText(/\$\s*110/i)).toBeInTheDocument();
    expect(screen.getAllByText("+20%").length).toBeGreaterThan(0);
  });

  it("clamps unlock value within xp addon start/end levels", () => {
    const onChange = jest.fn();
    const addon: EconomyLinkAddonDraft = {
      id: "eco-4",
      name: "Economia",
      hasBuyConfig: false,
      hasSellConfig: false,
      hasUnlockConfig: true,
      unlockRef: "sec-xp",
      unlockValue: 10,
      buyModifiers: [],
      sellModifiers: [],
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <EconomyLinkAddonPanel addon={addon} onChange={onChange} onRemove={jest.fn()} />
      </I18nProvider>
    );

    const unlockInput = screen.getByDisplayValue("10") as HTMLInputElement;
    expect(unlockInput.min).toBe("5");
    expect(unlockInput.max).toBe("40");

    fireEvent.blur(unlockInput, { target: { value: "999" } });
    let calls = onChange.mock.calls as Array<[EconomyLinkAddonDraft]>;
    expect(calls[calls.length - 1][0].unlockValue).toBe(40);

    fireEvent.blur(unlockInput, { target: { value: "1" } });
    calls = onChange.mock.calls as Array<[EconomyLinkAddonDraft]>;
    expect(calls[calls.length - 1][0].unlockValue).toBe(5);
  });

});
