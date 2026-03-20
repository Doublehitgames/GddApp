import { useProjectStore } from "@/store/projectStore";
import { createDefaultBalanceAddon } from "@/lib/balance/formulaEngine";
import { balanceDraftToSectionAddon } from "@/lib/addons/types";

describe("projectStore balance addons", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: jest.fn((key: string) => storage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          storage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete storage[key];
        }),
      },
      configurable: true,
      writable: true,
    });
    useProjectStore.setState({ projects: [], userId: null });
  });

  it("persists section addons via setSectionAddons", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Balance", "Desc");
    const sectionId = store.addSection(projectId, "Progressao", "");
    const addon = createDefaultBalanceAddon("addon-1");

    store.setSectionAddons(projectId, sectionId, [balanceDraftToSectionAddon(addon)]);

    const section = useProjectStore
      .getState()
      .getProject(projectId)
      ?.sections?.find((item) => item.id === sectionId);
    expect(section?.addons?.length).toBe(1);
    expect(section?.addons?.[0].id).toBe("addon-1");
    expect(section?.addons?.[0].type).toBe("balance");
  });
});
