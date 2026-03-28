import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/provider";
import { AttributeProfileAddonPanel } from "@/components/AttributeProfileAddonPanel";
import { useProjectStore } from "@/store/projectStore";

describe("AttributeProfileAddonPanel", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [
        {
          id: "proj-1",
          title: "Projeto",
          description: "",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          sections: [
            {
              id: "sec-defs",
              title: "Definições",
              content: "",
              created_at: "2026-01-01T00:00:00.000Z",
              order: 0,
              addons: [
                {
                  id: "defs-addon",
                  type: "attributeDefinitions",
                  name: "Defs",
                  data: {
                    id: "defs-addon",
                    name: "Defs",
                    attributes: [
                      {
                        id: "attr-1",
                        key: "strength",
                        label: "Força",
                        valueType: "int",
                        defaultValue: 0,
                        min: 10,
                        max: 20,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("uses attribute min as default when adding value", () => {
    const onChange = jest.fn();
    render(
      <I18nProvider initialLocale="pt-BR">
        <AttributeProfileAddonPanel
          addon={{
            id: "profile-1",
            name: "Perfil",
            definitionsRef: "sec-defs",
            values: [],
          }}
          onChange={onChange}
          onRemove={() => undefined}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /\+ Valor/i }));
    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.values?.[0]?.value).toBe(10);
  });

  it("clamps numeric value to min/max bounds from definition", () => {
    const onChange = jest.fn();
    render(
      <I18nProvider initialLocale="pt-BR">
        <AttributeProfileAddonPanel
          addon={{
            id: "profile-1",
            name: "Perfil",
            definitionsRef: "sec-defs",
            values: [{ id: "v1", attributeKey: "strength", value: 10 }],
          }}
          onChange={onChange}
          onRemove={() => undefined}
        />
      </I18nProvider>
    );

    const toggleButtons = screen.getAllByRole("button", { name: /Força/i });
    fireEvent.click(toggleButtons[toggleButtons.length - 1]);
    const valueInput = screen.getByDisplayValue("10");
    fireEvent.change(valueInput, { target: { value: "3" } });
    let lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.values?.[0]?.value).toBe(10);

    fireEvent.change(valueInput, { target: { value: "25" } });
    lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.values?.[0]?.value).toBe(20);
  });
});

