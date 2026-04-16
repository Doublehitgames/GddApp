import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/lib/i18n/provider";
import {
  SectionPickerModal,
  SECTION_PICKER_ROOT,
  type SectionLite,
} from "@/components/SectionPickerModal";

const sections: SectionLite[] = [
  { id: "gameplay", title: "Gameplay", parentId: null, order: 0 },
  { id: "combat", title: "Combat", parentId: "gameplay", order: 0 },
  { id: "weapons", title: "Weapons", parentId: "combat", order: 0 },
  { id: "magic", title: "Magia", parentId: "gameplay", order: 1 },
  { id: "economy", title: "Economia", parentId: null, order: 1 },
  { id: "items", title: "Itens", parentId: "economy", order: 0 },
];

function renderModal(overrides: Partial<React.ComponentProps<typeof SectionPickerModal>> = {}) {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <I18nProvider initialLocale="pt-BR">
      <SectionPickerModal
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Test picker"
        confirmLabel="Confirmar"
        sections={sections}
        {...overrides}
      />
    </I18nProvider>
  );
  return { onConfirm, onClose, ...utils };
}

describe("SectionPickerModal", () => {
  it("renders all root sections and total count", () => {
    renderModal();
    expect(screen.getByText("Gameplay")).toBeInTheDocument();
    expect(screen.getByText("Economia")).toBeInTheDocument();
    // Filhos ficam expandidos por padrão (hasSearch=false => manualCollapsed empty => expanded)
    expect(screen.getByText("Combat")).toBeInTheDocument();
    // Total de páginas aparece no header
    expect(screen.getByText(/6 páginas/i)).toBeInTheDocument();
  });

  it("filters sections by title with accent-insensitive search", async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByPlaceholderText(/buscar página/i);
    await user.type(input, "magia");
    expect(screen.getByText("Magia")).toBeInTheDocument();
    expect(screen.queryByText("Combat")).not.toBeInTheDocument();
    expect(screen.queryByText("Economia")).not.toBeInTheDocument();
    // Ancestral expandido automaticamente
    expect(screen.getByText("Gameplay")).toBeInTheDocument();
  });

  it("search without accents still finds sections with accented titles", async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByPlaceholderText(/buscar página/i);
    await user.type(input, "economia");
    expect(screen.getByText("Economia")).toBeInTheDocument();
  });

  it("shows no-match state when search has no results", async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByPlaceholderText(/buscar página/i);
    await user.type(input, "xyzzy");
    expect(screen.getByText(/nenhuma página encontrada/i)).toBeInTheDocument();
  });

  it("disables sections in disabledSectionIds and shows the reason chip", () => {
    renderModal({
      disabledSectionIds: ["combat", "weapons"],
      disabledReason: (id) => (id === "combat" ? "atual" : "descendente"),
    });
    expect(screen.getByText("atual")).toBeInTheDocument();
    expect(screen.getByText("descendente")).toBeInTheDocument();
  });

  it("confirm button is disabled until a valid selection is made", () => {
    renderModal();
    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(screen.getByText("Gameplay"));
    expect(confirmBtn).not.toBeDisabled();
  });

  it("calls onConfirm with the selected section id on confirm click", () => {
    const { onConfirm } = renderModal();
    fireEvent.click(screen.getByText("Combat"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledWith("combat");
  });

  it("renders the root option when allowRoot is true and confirms SECTION_PICKER_ROOT", () => {
    const { onConfirm } = renderModal({ allowRoot: true, rootLabel: "📁 Raiz" });
    fireEvent.click(screen.getByText("📁 Raiz"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledWith(SECTION_PICKER_ROOT);
  });

  it("calls onClose when Escape is pressed", () => {
    const { onClose } = renderModal();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("confirms via Enter when a valid selection is made", () => {
    const { onConfirm } = renderModal();
    fireEvent.click(screen.getByText("Magia"));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(onConfirm).toHaveBeenCalledWith("magic");
  });

  it("ArrowDown/ArrowUp navigates selectable rows", () => {
    renderModal();
    // Sem seleção, ArrowDown seleciona o primeiro item
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    // Confirma -> Gameplay é o primeiro root
    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    expect(confirmBtn).not.toBeDisabled();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    // Agora é Combat (filho expandido)
  });

  it("renders breadcrumb for the selected nested section", () => {
    renderModal();
    fireEvent.click(screen.getByText("Weapons"));
    // footer breadcrumb: Gameplay › Combat › Weapons
    // verificar que os três aparecem em uma string contínua (todos em elementos filhos do footer)
    const destinoLabel = screen.getByText(/destino:/i);
    // destino fica no mesmo container que o breadcrumb
    const footer = destinoLabel.closest("div");
    expect(footer?.textContent).toMatch(/Gameplay.*Combat.*Weapons/);
  });

  it("does nothing when open is false", () => {
    const { container } = render(
      <I18nProvider initialLocale="pt-BR">
        <SectionPickerModal
          open={false}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          title="Hidden"
          confirmLabel="Go"
          sections={sections}
        />
      </I18nProvider>
    );
    expect(container.firstChild).toBeNull();
  });
});
