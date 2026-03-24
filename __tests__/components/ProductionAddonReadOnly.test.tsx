import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { ProductionAddonReadOnly } from "@/components/ProductionAddonReadOnly";
import { useProjectStore } from "@/store/projectStore";
import type { ProductionAddonDraft } from "@/lib/addons/types";

describe("ProductionAddonReadOnly", () => {
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
              id: "sec-input",
              title: "Milho",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [],
            },
            {
              id: "sec-output",
              title: "Ovo",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 1,
              addons: [],
            },
          ],
        },
      ],
    });
  });

  it("renders passive summary in document mode", () => {
    const addon: ProductionAddonDraft = {
      id: "prod-1",
      name: "Producao Galinha",
      mode: "passive",
      outputRef: "sec-output",
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
        <ProductionAddonReadOnly addon={addon} />
      </I18nProvider>
    );

    expect(screen.getByText("Producao Galinha")).toBeInTheDocument();
    const paragraph = screen.getByText(/Produz/i);
    expect(paragraph.textContent || "").toContain("passivamente");
    expect(paragraph.textContent || "").toContain("1");
    expect(paragraph.textContent || "").toContain("2");
    expect(paragraph.textContent || "").toContain("Ovo");
    expect(paragraph.textContent || "").toContain("60s");
    expect(screen.getByRole("link", { name: "Ovo" })).toBeInTheDocument();
  });

  it("renders ingredient and output references as links in recipe mode", () => {
    const addon: ProductionAddonDraft = {
      id: "prod-2",
      name: "Receita de Racao",
      mode: "recipe",
      ingredients: [{ itemRef: "sec-input", quantity: 3 }],
      outputs: [{ itemRef: "sec-output", quantity: 1 }],
      craftTimeSeconds: 30,
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProductionAddonReadOnly addon={addon} />
      </I18nProvider>
    );

    expect(screen.getByText("Receita de Racao")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Milho" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ovo" })).toBeInTheDocument();
  });

  it("renders simulation badges with computed linked time in document mode", () => {
    useProjectStore.setState({
      projects: [
        {
          id: "p2",
          title: "Projeto Simulacao",
          description: "",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-01T00:00:00.000Z",
          sections: [
            {
              id: "sec-output",
              title: "Ovo",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [],
            },
            {
              id: "sec-producer",
              title: "Galinha",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 1,
              addons: [
                {
                  id: "prod-readonly",
                  type: "production",
                  name: "Production",
                  data: {
                    id: "prod-readonly",
                    name: "Production",
                    mode: "passive",
                    ingredients: [],
                    outputs: [],
                  },
                },
                {
                  id: "prog-readonly",
                  type: "progressionTable",
                  name: "Tabela Tempo",
                  data: {
                    id: "prog-readonly",
                    name: "Tabela Tempo",
                    startLevel: 1,
                    endLevel: 10,
                    columns: [{ id: "tempo_pct", name: "Tempo", isPercentage: true }],
                    rows: [
                      { level: 1, values: { tempo_pct: -10 } },
                      { level: 5, values: { tempo_pct: -20 } },
                      { level: 10, values: { tempo_pct: -30 } },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const addon: ProductionAddonDraft = {
      id: "prod-readonly",
      name: "Producao Simulada",
      mode: "passive",
      outputRef: "sec-output",
      minOutput: 10,
      maxOutput: 100,
      minOutputProgressionLink: {
        progressionAddonId: "prog-readonly",
        columnId: "tempo_pct",
        columnName: "Tempo",
      },
      maxOutputProgressionLink: {
        progressionAddonId: "prog-readonly",
        columnId: "tempo_pct",
        columnName: "Tempo",
      },
      intervalSeconds: 60,
      intervalSecondsProgressionLink: {
        progressionAddonId: "prog-readonly",
        columnId: "tempo_pct",
        columnName: "Tempo",
      },
      requiresCollection: false,
      ingredients: [],
      outputs: [],
      craftTimeSeconds: 60,
    };

    render(
      <I18nProvider initialLocale="pt-BR">
        <ProductionAddonReadOnly addon={addon} />
      </I18nProvider>
    );

    expect(screen.getAllByText(/Lv1:/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Lv1:\s*9\b/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv5:\s*8\b/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv10:\s*7\b/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv1:\s*90/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv10:\s*70/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv1:\s*54s/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv5:\s*48s/i)).toBeInTheDocument();
    expect(screen.getByText(/Lv10:\s*42s/i)).toBeInTheDocument();
  });
});
