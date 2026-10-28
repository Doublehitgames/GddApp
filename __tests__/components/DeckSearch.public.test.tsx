/**
 * A busca do Deck no link público (`/s/<token>?mode=deck`): o projeto chega
 * pela API pública, não pela store, e a busca tem que funcionar igual.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DeckClient from "@/app/projects/[id]/deck/DeckClient";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock("@/lib/i18n/provider", () => ({
  useI18n: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

// A barra real puxa as abas e o Drive; aqui só importa o slot da busca.
jest.mock("@/components/project/ProjectTopBar", () => ({
  ALTURA_BARRA: 80,
  IconeDeck: () => null,
  ProjectTopBar: ({ busca }: { busca?: React.ReactNode }) => <div>{busca}</div>,
}));

jest.mock("@/components/project/PageModeLinks", () => ({
  ...jest.requireActual("@/components/project/PageModeLinks"),
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/SectionDescriptionReadOnly", () => ({
  __esModule: true,
  default: ({ markdown }: { markdown?: string }) => <div>{markdown}</div>,
}));

const now = "2026-10-01T00:00:00.000Z";
const sec = (id: string, title: string, content: string, parentId?: string, order = 0) => ({
  id,
  title,
  content,
  parentId,
  order,
  created_at: now,
});

const project = {
  id: "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
  title: "Fazenda",
  sections: [
    sec("a", "💰 Economia", "Dinheiro."),
    sec("b", "Moeda", "A moeda.", "a"),
    sec("c", "Loja", "Compra.", "b"),
    sec("d", "Promoção Relâmpago", "Desconto de surpresa.", "c"),
    sec("e", "Progressão", "Níveis."),
  ],
};

beforeAll(() => {
  (global as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.scrollTo = jest.fn() as never;
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ project }) });
});

it("acha a página sem acento e abre os níveis até ela no modo público", async () => {
  render(<DeckClient projectId={project.id} publicToken="tok-123" />);

  const input = await screen.findByPlaceholderText("Buscar página…");
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("token=tok-123"));

  act(() => {
    fireEvent.keyDown(document.body, { key: "/" });
  });
  expect(document.activeElement).toBe(input);

  fireEvent.change(input, { target: { value: "promocao" } });
  const option = await screen.findByRole("option");
  expect(option).toHaveTextContent("Economia › Moeda › Loja");
  expect(option).toHaveTextContent("Promoção Relâmpago");

  fireEvent.keyDown(input, { key: "Enter" });

  // A página mora na lista da gaveta de Economia: a carta abre e o conteúdo é o dela.
  await waitFor(() => expect(screen.getByText("Desconto de surpresa.")).toBeInTheDocument());
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

it("Esc na busca não fecha a gaveta", async () => {
  render(<DeckClient projectId={project.id} publicToken="tok-123" />);
  const input = await screen.findByPlaceholderText("Buscar página…");

  fireEvent.change(input, { target: { value: "moeda" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(screen.getByText("A moeda.")).toBeInTheDocument());

  act(() => input.focus());
  fireEvent.keyDown(input, { key: "Escape" });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveValue("");
  expect(screen.getByText("A moeda.")).toBeInTheDocument();
});
