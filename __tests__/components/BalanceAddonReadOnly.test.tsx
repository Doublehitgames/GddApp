import { render, screen } from "@testing-library/react";
import { createDefaultBalanceAddon } from "@/lib/balance/formulaEngine";
import { BalanceAddonReadOnly } from "@/components/BalanceAddonReadOnly";
import { I18nProvider } from "@/lib/i18n/provider";

describe("BalanceAddonReadOnly", () => {
  it("renders LV -> XP table rows", () => {
    const addon = createDefaultBalanceAddon("addon-ro");
    addon.name = "XP Curve";
    addon.startLevel = 1;
    addon.endLevel = 5;

    render(
      <I18nProvider initialLocale="pt-BR">
        <BalanceAddonReadOnly addon={addon} showChart={false} maxRows={5} />
      </I18nProvider>
    );

    expect(screen.getByText("XP Curve")).toBeInTheDocument();
    expect(screen.getByText("LV")).toBeInTheDocument();
    expect(screen.getByText("XP")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

