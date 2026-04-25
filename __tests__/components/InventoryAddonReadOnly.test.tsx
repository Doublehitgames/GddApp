import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { InventoryAddonReadOnly } from "@/components/InventoryAddonReadOnly";

/**
 * The summary paragraph in InventoryAddonReadOnly intentionally interleaves
 * plain text, <LibraryLabelPath/> chips, and conditional t() calls — so the
 * substrings we want to assert (e.g. "Item de categoria Semente", "Loja: Sim")
 * end up split across multiple text nodes inside the same <p>. RTL's
 * getByText skips over composite nodes by default, so we walk parents and
 * test whitespace-normalised textContent against the regex instead.
 */
const matchInTextContent = (pattern: RegExp) => (_: string, node: Element | null) => {
  if (!node) return false;
  const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  if (!pattern.test(text)) return false;
  // Only match the deepest node so we don't accidentally also match the root.
  const childMatch = Array.from(node.children).some((child) => {
    const childText = (child.textContent ?? "").replace(/\s+/g, " ").trim();
    return pattern.test(childText);
  });
  return !childMatch;
};

describe("InventoryAddonReadOnly", () => {
  it("renders inventory fields", () => {
    render(
      <I18nProvider initialLocale="pt-BR">
        <InventoryAddonReadOnly
          addon={{
            id: "inv-1",
            name: "Estoque da Semente",
            weight: 1.5,
            stackable: true,
            maxStack: 99,
            inventoryCategory: "Semente",
            slotSize: 1,
            durability: 0,
            volume: 0.2,
            maxDurability: 0,
            bindType: "none",
            showInShop: true,
            consumable: false,
            discardable: true,
            notes: "Item padrao",
          }}
        />
      </I18nProvider>
    );

    // Heading is its own <h5>, so the simple text matcher works for it.
    expect(screen.getByText(/Estoque da Semente/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Resumo:/i)).not.toBeInTheDocument();
    // These all live inside the summary <p> and are split across nodes.
    expect(screen.getByText(matchInTextContent(/Item de categoria Semente/i))).toBeInTheDocument();
    expect(screen.getByText(matchInTextContent(/permite pilha \(max 99\)/i))).toBeInTheDocument();
    expect(screen.getByText(matchInTextContent(/Loja: Sim/i))).toBeInTheDocument();
    // Notes render in their own <p>, so the simple matcher is enough.
    expect(screen.getByText(/Item padrao/i)).toBeInTheDocument();
  });
});
