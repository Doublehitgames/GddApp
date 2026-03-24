import { useProjectStore } from "@/store/projectStore";
import { createDefaultBalanceAddon } from "@/lib/balance/formulaEngine";
import {
  balanceDraftToSectionAddon,
  createDefaultCurrencyAddon,
  createDefaultEconomyLinkAddon,
  createDefaultGlobalVariableAddon,
  createDefaultInventoryAddon,
  createDefaultProductionAddon,
  createDefaultProgressionTableAddon,
} from "@/lib/addons/types";

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
    expect(section?.addons?.[0].type).toBe("xpBalance");
  });

  it("normalizes progression table addons and preserves them after reload", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Tabela", "Desc");
    const sectionId = store.addSection(projectId, "Economia", "");
    const progressionAddon = createDefaultProgressionTableAddon("prog-1");
    progressionAddon.data.columns = [
      { id: " value ", name: "", generator: { mode: "manual" }, decimals: 1 },
      { id: " value ", name: "Duplicada", generator: { mode: "manual" }, decimals: 0 },
    ];
    progressionAddon.data.rows = [{ level: 1, values: { value: 10 } }];

    store.setSectionAddons(projectId, sectionId, [progressionAddon]);
    useProjectStore.getState().loadFromStorage();

    const section = useProjectStore
      .getState()
      .getProject(projectId)
      ?.sections?.find((item) => item.id === sectionId);
    expect(section?.addons?.length).toBe(1);
    expect(section?.addons?.[0].type).toBe("progressionTable");
    if (section?.addons?.[0].type === "progressionTable") {
      expect(section.addons[0].data.columns.length).toBeGreaterThanOrEqual(1);
      expect(section.addons[0].data.columns[0].id).toBe("value");
      expect(section.addons[0].data.rows[0].values).toHaveProperty("value");
    }
  });

  it("keeps progressionTable added via addSectionAddon after reload", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Sync", "Desc");
    const sectionId = store.addSection(projectId, "Balanceamento", "");
    const progressionAddon = createDefaultProgressionTableAddon("prog-reload");

    store.addSectionAddon(projectId, sectionId, progressionAddon);
    useProjectStore.getState().loadFromStorage();

    const reloadedSection = useProjectStore
      .getState()
      .getProject(projectId)
      ?.sections?.find((item) => item.id === sectionId);

    expect(reloadedSection?.addons?.some((addon) => addon.id === "prog-reload")).toBe(true);
    expect(reloadedSection?.addons?.find((addon) => addon.id === "prog-reload")?.type).toBe("progressionTable");
  });

  it("preserves spaces in progression table text fields", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Texto", "Desc");
    const sectionId = store.addSection(projectId, "Tabela", "");
    const progressionAddon = createDefaultProgressionTableAddon("prog-space");
    progressionAddon.name = "Tabela de Progressao ";
    progressionAddon.data.name = "Tabela de Progressao ";
    progressionAddon.data.columns = [
      { id: "atk", name: "Ataque Base ", generator: { mode: "manual" }, decimals: 0 },
    ];
    progressionAddon.data.rows = [{ level: 1, values: { atk: 10 } }];

    store.setSectionAddons(projectId, sectionId, [progressionAddon]);
    useProjectStore.getState().loadFromStorage();

    const reloadedAddon = useProjectStore
      .getState()
      .getProject(projectId)
      ?.sections?.find((item) => item.id === sectionId)
      ?.addons?.find((addon) => addon.id === "prog-space");

    expect(reloadedAddon?.name).toBe("Tabela de Progressao ");
    if (reloadedAddon?.type === "progressionTable") {
      expect(reloadedAddon.data.name).toBe("Tabela de Progressao ");
      expect(reloadedAddon.data.columns[0].name).toBe("Ataque Base ");
    }
  });

  it("normalizes economy link addon and preserves it after reload", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Economia", "Desc");
    const sectionId = store.addSection(projectId, "Loja", "");
    const economyAddon = createDefaultEconomyLinkAddon("eco-1");
    economyAddon.data.buyValue = 150;
    economyAddon.data.buyModifiers = [{ refId: " var-compra " }];
    economyAddon.data.sellValue = 90;
    economyAddon.data.sellModifiers = [{ refId: "var-venda" }];

    store.setSectionAddons(projectId, sectionId, [economyAddon]);
    useProjectStore.getState().loadFromStorage();

    const reloadedAddon = useProjectStore
      .getState()
      .getProject(projectId)
      ?.sections?.find((item) => item.id === sectionId)
      ?.addons?.find((addon) => addon.id === "eco-1");

    expect(reloadedAddon?.type).toBe("economyLink");
    if (reloadedAddon?.type === "economyLink") {
      expect(reloadedAddon.data.buyValue).toBe(150);
      expect(reloadedAddon.data.sellValue).toBe(90);
      expect(reloadedAddon.data.buyModifiers[0]?.refId).toBe("var-compra");
    }
  });

  it("persists currency and global variable addons after reload", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Economia 2", "Desc");
    const sectionId = store.addSection(projectId, "Sistemas", "");
    const currencyAddon = createDefaultCurrencyAddon("cur-1");
    currencyAddon.data.code = "coins";
    currencyAddon.data.displayName = "Coins";
    const globalVarAddon = createDefaultGlobalVariableAddon("gvar-1");
    globalVarAddon.data.key = "sell_bonus_pct";
    globalVarAddon.data.displayName = "Sell Bonus";

    store.setSectionAddons(projectId, sectionId, [currencyAddon, globalVarAddon]);
    useProjectStore.getState().loadFromStorage();

    const reloadedAddons = useProjectStore
      .getState()
      .getProject(projectId)
      ?.sections?.find((item) => item.id === sectionId)
      ?.addons;

    expect(reloadedAddons?.some((addon) => addon.type === "currency")).toBe(true);
    expect(reloadedAddons?.some((addon) => addon.type === "globalVariable")).toBe(true);
  });

  it("persists inventory addon after reload", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Inventario", "Desc");
    const sectionId = store.addSection(projectId, "Item", "");
    const inventoryAddon = createDefaultInventoryAddon("inv-1");
    inventoryAddon.data.stackable = false;
    inventoryAddon.data.maxStack = 50;
    inventoryAddon.data.inventoryCategory = "Material";

    store.setSectionAddons(projectId, sectionId, [inventoryAddon]);
    useProjectStore.getState().loadFromStorage();

    const reloadedAddon = useProjectStore
      .getState()
      .getProject(projectId)
      ?.sections?.find((item) => item.id === sectionId)
      ?.addons?.find((addon) => addon.id === "inv-1");

    expect(reloadedAddon?.type).toBe("inventory");
    if (reloadedAddon?.type === "inventory") {
      expect(reloadedAddon.data.stackable).toBe(false);
      expect(reloadedAddon.data.maxStack).toBe(1);
      expect(reloadedAddon.data.inventoryCategory).toBe("Material");
    }
  });

  it("persists production addon after reload", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Producao", "Desc");
    const sectionId = store.addSection(projectId, "Gerador", "");
    const productionAddon = createDefaultProductionAddon("prod-1");
    productionAddon.data.mode = "recipe";
    productionAddon.data.ingredients = [{ itemRef: "item-seed", quantity: 2 }];
    productionAddon.data.outputs = [{ itemRef: "item-plant", quantity: 1 }];
    productionAddon.data.craftTimeSeconds = 45;

    store.setSectionAddons(projectId, sectionId, [productionAddon]);
    useProjectStore.getState().loadFromStorage();

    const reloadedAddon = useProjectStore
      .getState()
      .getProject(projectId)
      ?.sections?.find((item) => item.id === sectionId)
      ?.addons?.find((addon) => addon.id === "prod-1");

    expect(reloadedAddon?.type).toBe("production");
    if (reloadedAddon?.type === "production") {
      expect(reloadedAddon.data.mode).toBe("recipe");
      expect(reloadedAddon.data.ingredients[0]).toEqual({ itemRef: "item-seed", quantity: 2 });
      expect(reloadedAddon.data.outputs[0]).toEqual({ itemRef: "item-plant", quantity: 1 });
      expect(reloadedAddon.data.craftTimeSeconds).toBe(45);
    }
  });
});
