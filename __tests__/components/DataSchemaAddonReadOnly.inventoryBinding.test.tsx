import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { DataSchemaAddonReadOnly } from "@/components/DataSchemaAddonReadOnly";
import { useProjectStore } from "@/store/projectStore";
import type { DataSchemaAddonDraft } from "@/lib/addons/types";

/**
 * Regression: an entry bound to an Inventory field must reflect the source
 * addon's CURRENT value, not the snapshot captured when the binding was made.
 */
describe("DataSchemaAddonReadOnly inventory binding", () => {
  const schemaAddon: DataSchemaAddonDraft = {
    id: "ds-1",
    name: "Schema",
    entries: [
      {
        id: "e1",
        key: "can_show_shop",
        label: "Can Show in Shop",
        valueType: "boolean",
        // Stale snapshot captured at bind time — must be ignored in favour of the live value.
        value: true,
        binding: { source: "inventory", addonId: "inv-1", field: "showInShop" },
      },
    ],
  };

  function setupStore(showInShop: boolean) {
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
              id: "sec-1",
              title: "Semente",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [
                {
                  id: "inv-1",
                  type: "inventory",
                  name: "Inventory",
                  data: {
                    id: "inv-1",
                    name: "Inventory",
                    weight: 0,
                    stackable: true,
                    maxStack: 999,
                    inventoryCategory: "Sementes",
                    slotSize: 1,
                    durability: 0,
                    bindType: "none",
                    showInShop,
                    consumable: false,
                    discardable: false,
                  },
                },
                { id: "ds-1", type: "dataSchema", name: "Schema", data: schemaAddon },
              ],
            },
          ],
        },
      ],
    } as never);
  }

  it("renders the live inventory value, not the stale snapshot", () => {
    setupStore(false);
    const { container } = render(
      <I18nProvider initialLocale="pt-BR">
        <DataSchemaAddonReadOnly addon={schemaAddon} />
      </I18nProvider>
    );
    // Live value is false even though the persisted entry.value is true.
    expect(container.textContent).toMatch(/Can Show in Shop\s*:\s*false/i);
    expect(container.textContent).not.toMatch(/Can Show in Shop\s*:\s*true/i);
  });

  it("reflects a true source value", () => {
    setupStore(true);
    const { container } = render(
      <I18nProvider initialLocale="pt-BR">
        <DataSchemaAddonReadOnly addon={schemaAddon} />
      </I18nProvider>
    );
    expect(container.textContent).toMatch(/Can Show in Shop\s*:\s*true/i);
  });
});

describe("DataSchemaAddonReadOnly crop binding", () => {
  const schemaAddon: DataSchemaAddonDraft = {
    id: "ds-2",
    name: "Schema",
    entries: [
      {
        id: "e1",
        key: "growth_seconds",
        label: "Growth",
        valueType: "int",
        value: 60, // stale snapshot
        binding: { source: "crop", addonId: "crop-1", field: "growthSeconds" },
      },
    ],
  };

  it("renders the live crop value, not the stale snapshot", () => {
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
              id: "sec-1",
              title: "Plantio",
              created_at: "2026-03-01T00:00:00.000Z",
              order: 0,
              addons: [
                {
                  id: "crop-1",
                  type: "crop",
                  name: "Crop",
                  data: { id: "crop-1", name: "Crop", growthSeconds: 300, outputs: [] },
                },
                { id: "ds-2", type: "dataSchema", name: "Schema", data: schemaAddon },
              ],
            },
          ],
        },
      ],
    } as never);

    const { container } = render(
      <I18nProvider initialLocale="pt-BR">
        <DataSchemaAddonReadOnly addon={schemaAddon} />
      </I18nProvider>
    );
    expect(container.textContent).toMatch(/Growth\s*:\s*300/i);
    expect(container.textContent).not.toMatch(/Growth\s*:\s*60\b/i);
  });
});
