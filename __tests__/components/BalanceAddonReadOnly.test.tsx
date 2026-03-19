import { render, screen } from "@testing-library/react";
import { createDefaultBalanceAddon } from "@/lib/balance/formulaEngine";
import { BalanceAddonReadOnly } from "@/components/BalanceAddonReadOnly";

describe("BalanceAddonReadOnly", () => {
  it("renders LV -> XP table rows", () => {
    const addon = createDefaultBalanceAddon("addon-ro");
    addon.name = "XP Curve";
    addon.startLevel = 1;
    addon.endLevel = 5;

    render(<BalanceAddonReadOnly addon={addon} showChart={false} maxRows={5} />);

    expect(screen.getByText("XP Curve")).toBeInTheDocument();
    expect(screen.getByText("LV")).toBeInTheDocument();
    expect(screen.getByText("XP")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

