import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { CurrencyAddonReadOnly } from "@/components/CurrencyAddonReadOnly";

describe("CurrencyAddonReadOnly", () => {
  it("renders currency fields", () => {
    render(
      <I18nProvider initialLocale="pt-BR">
        <CurrencyAddonReadOnly
          addon={{
            id: "cur-1",
            name: "Coins",
            code: "COINS",
            displayName: "Moedas",
            kind: "soft",
            decimals: 0,
            notes: "Principal",
          }}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Coins")).toBeInTheDocument();
    expect(screen.queryByText(/^Resumo:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Moeda COINS/i)).toBeInTheDocument();
    expect(screen.getByText(/tipo Soft/i)).toBeInTheDocument();
    expect(screen.getByText(/sem casas decimais/i)).toBeInTheDocument();
    expect(screen.getByText(/Principal/i)).toBeInTheDocument();
  });
});
