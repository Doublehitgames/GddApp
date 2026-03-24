import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { ProgressionTableAddonReadOnly } from "@/components/ProgressionTableAddonReadOnly";
import type { ProgressionTableAddonDraft } from "@/lib/addons/types";

describe("ProgressionTableAddonReadOnly", () => {
  it("shows min/mid/max preview and expands on header click", () => {
    const addon: ProgressionTableAddonDraft = {
      id: "prog-1",
      name: "Tabela Animal",
      startLevel: 1,
      endLevel: 5,
      columns: [{ id: "tempo", name: "Tempo", isPercentage: false }],
      rows: [
        { level: 1, values: { tempo: 60 } },
        { level: 2, values: { tempo: 45 } },
        { level: 3, values: { tempo: 30 } },
        { level: 4, values: { tempo: 20 } },
        { level: 5, values: { tempo: 10 } },
      ],
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProgressionTableAddonReadOnly addon={addon} />
      </I18nProvider>
    );

    expect(screen.getByText("Tabela Animal")).toBeInTheDocument();
    expect(screen.getByText("Tempo")).toBeInTheDocument();
    expect(screen.getByText(/Lv 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv 5/i)).toBeInTheDocument();
    expect(screen.queryByText(/Lv 2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lv 4/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Tabela Animal/i }));
    expect(screen.getByText("Tempo")).toBeInTheDocument();
    expect(screen.getByText(/Lv 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv 4/i)).toBeInTheDocument();
  });
});

