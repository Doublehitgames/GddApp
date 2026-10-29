/**
 * A Biblioteca com uma tabela de várias linhas: compara as páginas numa linha
 * escolhida ("Quantidade em Trigo") e mostra a tabela inteira no painel.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import BibliotecaClient from "@/app/projects/[id]/biblioteca/BibliotecaClient";

jest.mock("next/navigation", () => ({
  usePathname: () => "/projects/p/biblioteca",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock("@/lib/i18n/provider", () => ({
  useI18n: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

const receita = (id: string, title: string, nivel: number, ingredientes: Array<[string, number]>) => ({
  id,
  title,
  parentId: "mae",
  order: 0,
  content: [
    `Texto de ${title}.`,
    "",
    "## Produção",
    "",
    "| Nível |",
    "| --- |",
    `| ${nivel} |`,
    "",
    "## Ingredientes",
    "",
    "| Ingrediente | Quantidade |",
    "| --- | --- |",
    ...ingredientes.map(([n, q]) => `| $[${n}] | ${q} |`),
  ].join("\n"),
});

const project = {
  id: "p",
  title: "Projeto",
  sections: [
    {
      id: "mae",
      title: "Cozinha",
      order: 0,
      content: "",
      tableRule: {
        tables: [
          { name: "Produção", columns: [{ name: "Nível", type: "number", required: true }] },
          {
            name: "Ingredientes",
            multiRow: true,
            columns: [
              { name: "Ingrediente", type: "page", required: true },
              { name: "Quantidade", type: "number", required: true },
            ],
          },
        ],
      },
    },
    receita("a", "Farinha", 37, [["Farelo de Trigo", 3]]),
    receita("b", "Bolo", 12, [["Trigo", 2], ["Ovo", 3]]),
    receita("c", "Pão", 5, [["Trigo", 5]]),
  ],
};

jest.mock("@/components/project/useShellProject", () => ({
  useShellProject: () => project,
}));

describe("Biblioteca com tabela de várias linhas", () => {
  it("ordena por uma coluna numa linha escolhida, e troca a linha", () => {
    render(<BibliotecaClient projectId="p" />);
    const sort = screen.getByDisplayValue("Nome");
    const group = within(sort).getByRole("group", { name: "Ingredientes · Farelo de Trigo" });
    fireEvent.change(sort, { target: { value: within(group).getByText("Quantidade").getAttribute("value") } });

    // "em" aparece, começando na primeira linha que existe na coleção
    const at = screen.getByDisplayValue("Farelo de Trigo");
    fireEvent.change(at, { target: { value: "Trigo" } });
    fireEvent.click(screen.getByTitle("Crescente")); // decrescente

    // Pão leva 5, Bolo 2; a Farinha não leva Trigo e vai para o fim
    const ordered = [...document.querySelectorAll("ul li button span.line-clamp-2.font-semibold")].map((n) => n.textContent);
    expect(ordered).toEqual(["Pão", "Bolo", "Farinha"]);
    expect(screen.getAllByText(/Quantidade · Trigo/).length).toBeGreaterThan(0);
  });

  it("mostra a tabela inteira no painel da página selecionada", () => {
    render(<BibliotecaClient projectId="p" />);
    fireEvent.click(screen.getByText("Bolo", { selector: "span.line-clamp-2" }));
    const panel = screen.getByRole("heading", { level: 3, name: "Bolo" }).closest("aside")!;
    const box = within(panel).getByText("Ingredientes", { selector: "h4" }).closest("section")!;
    const rows = within(box).getAllByRole("row").slice(1).map((r) => r.textContent);
    expect(rows).toEqual(["Trigo2", "Ovo3"]);
  });

  it("no modo tabela, a tabela de várias linhas vira colunas na linha escolhida", () => {
    render(<BibliotecaClient projectId="p" />);
    fireEvent.click(screen.getByTitle("Comparar em tabela"));
    const table = document.querySelector("section table")!;
    const header = within(table as HTMLElement).getAllByRole("columnheader").map((h) => h.textContent?.trim());
    expect(header.some((h) => h?.startsWith("Ingredientes"))).toBe(true);
    expect(header).toContain("Quantidade");
  });
});
