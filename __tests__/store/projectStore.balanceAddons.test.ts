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

  it("copia addon singleton para pagina sem conflito (cria novo)", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Copia", "Desc");
    const fromId = store.addSection(projectId, "Origem", "");
    const toId = store.addSection(projectId, "Destino", "");
    const economyAddon = createDefaultEconomyLinkAddon("eco-src");
    economyAddon.data.buyValue = 123;
    store.setSectionAddons(projectId, fromId, [economyAddon]);

    store.copyAddonToSection(projectId, fromId, toId, "eco-src");

    const toSection = useProjectStore.getState().getProject(projectId)?.sections?.find((s) => s.id === toId);
    expect(toSection?.addons?.length).toBe(1);
    const copied = toSection?.addons?.[0];
    expect(copied?.type).toBe("economyLink");
    expect(copied?.id).not.toBe("eco-src"); // novo ID
    if (copied?.type === "economyLink") expect(copied.data.buyValue).toBe(123);
  });

  it("nao sobrescreve singleton existente sem flag overwrite", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Copia 2", "Desc");
    const fromId = store.addSection(projectId, "Origem", "");
    const toId = store.addSection(projectId, "Destino", "");
    const src = createDefaultEconomyLinkAddon("eco-src");
    src.data.buyValue = 999;
    const dest = createDefaultEconomyLinkAddon("eco-dest");
    dest.data.buyValue = 10;
    store.setSectionAddons(projectId, fromId, [src]);
    store.setSectionAddons(projectId, toId, [dest]);

    store.copyAddonToSection(projectId, fromId, toId, "eco-src"); // sem overwrite

    const toSection = useProjectStore.getState().getProject(projectId)?.sections?.find((s) => s.id === toId);
    // Nada muda: ainda 1 addon, com o ID e valor originais do destino.
    expect(toSection?.addons?.length).toBe(1);
    expect(toSection?.addons?.[0].id).toBe("eco-dest");
    const kept = toSection?.addons?.[0];
    if (kept?.type === "economyLink") expect(kept.data.buyValue).toBe(10);
  });

  it("sobrescreve singleton existente preservando ID e grupo do destino", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Copia 3", "Desc");
    const fromId = store.addSection(projectId, "Origem", "");
    const toId = store.addSection(projectId, "Destino", "");
    const src = createDefaultEconomyLinkAddon("eco-src");
    src.name = "Economia Origem";
    src.data.name = "Economia Origem";
    src.data.buyValue = 777;
    const dest = createDefaultEconomyLinkAddon("eco-dest");
    dest.name = "Economia Destino";
    dest.data.name = "Economia Destino";
    dest.data.buyValue = 10;
    dest.group = "GrupoB";
    store.setSectionAddons(projectId, fromId, [src]);
    store.setSectionAddons(projectId, toId, [dest]);

    store.copyAddonToSection(projectId, fromId, toId, "eco-src", undefined, true);

    const toSection = useProjectStore.getState().getProject(projectId)?.sections?.find((s) => s.id === toId);
    // Continua 1 addon: o do destino, com ID/grupo/nome preservados mas valores sobrescritos.
    expect(toSection?.addons?.length).toBe(1);
    const result = toSection?.addons?.[0];
    expect(result?.id).toBe("eco-dest");
    expect(result?.group).toBe("GrupoB");
    expect(result?.name).toBe("Economia Destino");
    if (result?.type === "economyLink") {
      expect(result.data.id).toBe("eco-dest");
      expect(result.data.name).toBe("Economia Destino");
      expect(result.data.buyValue).toBe(777);
    }
  });

  it("mover sem overwrite mantem singleton conflitante na origem", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Mover", "Desc");
    const fromId = store.addSection(projectId, "Origem", "");
    const toId = store.addSection(projectId, "Destino", "");
    const src = createDefaultEconomyLinkAddon("eco-src");
    src.data.buyValue = 500;
    const dest = createDefaultEconomyLinkAddon("eco-dest");
    dest.data.buyValue = 10;
    store.setSectionAddons(projectId, fromId, [src]);
    store.setSectionAddons(projectId, toId, [dest]);

    store.moveAddonToSection(projectId, fromId, toId, "eco-src"); // sem overwrite

    const proj = useProjectStore.getState().getProject(projectId);
    const fromSection = proj?.sections?.find((s) => s.id === fromId);
    const toSection = proj?.sections?.find((s) => s.id === toId);
    // src fica na origem; destino intacto (sem duplicata).
    expect(fromSection?.addons?.some((a) => a.id === "eco-src")).toBe(true);
    expect(toSection?.addons?.length).toBe(1);
    expect(toSection?.addons?.[0].id).toBe("eco-dest");
  });

  it("mover com overwrite substitui singleton do destino e esvazia a origem", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Mover 2", "Desc");
    const fromId = store.addSection(projectId, "Origem", "");
    const toId = store.addSection(projectId, "Destino", "");
    const src = createDefaultEconomyLinkAddon("eco-src");
    src.name = "Origem";
    src.data.name = "Origem";
    src.data.buyValue = 888;
    const dest = createDefaultEconomyLinkAddon("eco-dest");
    dest.name = "Destino";
    dest.data.name = "Destino";
    dest.data.buyValue = 10;
    store.setSectionAddons(projectId, fromId, [src]);
    store.setSectionAddons(projectId, toId, [dest]);

    store.moveAddonToSection(projectId, fromId, toId, "eco-src", undefined, true);

    const proj = useProjectStore.getState().getProject(projectId);
    const fromSection = proj?.sections?.find((s) => s.id === fromId);
    const toSection = proj?.sections?.find((s) => s.id === toId);
    // origem perde o addon; destino mantem id/nome mas recebe os valores movidos.
    expect(fromSection?.addons?.some((a) => a.id === "eco-src") ?? false).toBe(false);
    expect(toSection?.addons?.length).toBe(1);
    const result = toSection?.addons?.[0];
    expect(result?.id).toBe("eco-dest");
    expect(result?.name).toBe("Destino");
    if (result?.type === "economyLink") expect(result.data.buyValue).toBe(888);
  });

  it("copiar RemoteConfig religa arraySource/dataSchema aos addons do destino", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto RC", "Desc");
    const fromId = store.addSection(projectId, "Origem", "");
    const toId = store.addSection(projectId, "Destino", "");

    const exportAddon = {
      id: "export-schema-src",
      type: "exportSchema" as const,
      name: "Remote Config",
      data: {
        id: "export-schema-src",
        name: "Remote Config",
        nodes: [
          {
            id: "n1",
            key: "levelSettings",
            nodeType: "array",
            arraySource: { type: "progressionTable", addonId: "prog-origem" },
            itemTemplate: [
              { id: "n1a", key: "price", nodeType: "value", binding: { source: "dataSchema", addonId: "schema-origem", entryKey: "price" } },
            ],
          },
        ],
      },
    } as unknown as Parameters<typeof store.addSectionAddon>[2];

    store.setSectionAddons(projectId, fromId, [exportAddon]);

    // Destino já tem os addons equivalentes (IDs diferentes da origem).
    const progDest = createDefaultProgressionTableAddon("prog-dest");
    const schemaDest = {
      id: "schema-dest",
      type: "dataSchema" as const,
      name: "Stats",
      data: { id: "schema-dest", name: "Stats", entries: [{ id: "e1", key: "price", label: "Price", valueType: "int", value: 0 }] },
    } as unknown as Parameters<typeof store.addSectionAddon>[2];
    store.setSectionAddons(projectId, toId, [progDest, schemaDest]);

    store.copyAddonToSection(projectId, fromId, toId, "export-schema-src");

    const toSection = useProjectStore.getState().getProject(projectId)?.sections?.find((s) => s.id === toId);
    const copied = toSection?.addons?.find((a) => a.type === "exportSchema");
    expect(copied).toBeDefined();
    if (copied?.type === "exportSchema") {
      const node = copied.data.nodes[0];
      // arraySource re-apontado para a ProgressionTable do destino, não a da origem.
      expect(node.arraySource?.type === "progressionTable" ? node.arraySource.addonId : undefined).toBe("prog-dest");
      const binding = node.itemTemplate?.[0].binding;
      expect(binding?.source === "dataSchema" ? binding.addonId : undefined).toBe("schema-dest");
    }
  });

  it("copiar dependência antes do RemoteConfig faz o relink apontar para o addon recém-copiado", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto RC2", "Desc");
    const fromId = store.addSection(projectId, "Origem", "");
    const toId = store.addSection(projectId, "Destino", "");

    const schemaSrc = {
      id: "schema-origem",
      type: "dataSchema" as const,
      name: "Stats",
      data: { id: "schema-origem", name: "Stats", entries: [{ id: "e1", key: "price", label: "Price", valueType: "int", value: 0 }] },
    } as unknown as Parameters<typeof store.addSectionAddon>[2];
    const exportSrc = {
      id: "export-schema-src",
      type: "exportSchema" as const,
      name: "Remote Config",
      data: {
        id: "export-schema-src",
        name: "Remote Config",
        nodes: [
          { id: "n1", key: "id", nodeType: "value", binding: { source: "dataSchema", addonId: "schema-origem", entryKey: "id" } },
        ],
      },
    } as unknown as Parameters<typeof store.addSectionAddon>[2];
    store.setSectionAddons(projectId, fromId, [schemaSrc, exportSrc]);
    // Destino começa SEM o dataSchema.
    store.setSectionAddons(projectId, toId, []);

    // Fluxo do performCopy: dependência primeiro, RemoteConfig depois.
    store.copyAddonToSection(projectId, fromId, toId, "schema-origem");
    store.copyAddonToSection(projectId, fromId, toId, "export-schema-src");

    const toSection = useProjectStore.getState().getProject(projectId)?.sections?.find((s) => s.id === toId);
    const newSchema = toSection?.addons?.find((a) => a.type === "dataSchema");
    const copiedExport = toSection?.addons?.find((a) => a.type === "exportSchema");
    expect(newSchema).toBeDefined();
    expect(copiedExport).toBeDefined();
    if (copiedExport?.type === "exportSchema") {
      const binding = copiedExport.data.nodes[0].binding;
      // O binding aponta para o dataSchema recém-copiado (novo ID), não o da origem.
      expect(binding?.source === "dataSchema" ? binding.addonId : undefined).toBe(newSchema?.id);
      expect(binding?.source === "dataSchema" ? binding.addonId : undefined).not.toBe("schema-origem");
    }
  });

  it("copiar Schema de Dados religa bindings (production/economyLink/progressionColumn) ao destino", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Schema", "Desc");
    const fromId = store.addSection(projectId, "Origem", "");
    const toId = store.addSection(projectId, "Destino", "");

    // Origem: production, economyLink, progressionTable e um dataSchema que referencia todos.
    const prodSrc = createDefaultProductionAddon("prod-origem");
    const ecoSrc = createDefaultEconomyLinkAddon("eco-origem");
    const progSrc = createDefaultProgressionTableAddon("prog-origem");
    const schemaSrc = {
      id: "schema-origem",
      type: "dataSchema" as const,
      name: "Stats",
      data: {
        id: "schema-origem",
        name: "Stats",
        entries: [
          { id: "e1", key: "rate", label: "Rate", valueType: "int", value: 0, binding: { source: "production", addonId: "prod-origem", field: "minOutput" } },
          { id: "e2", key: "price", label: "Price", valueType: "int", value: 0, binding: { source: "economyLink", sectionId: "eco-origem", field: "buyValue" } },
          { id: "e3", key: "col", label: "Col", valueType: "int", value: 0, binding: { source: "progressionColumn", progressionAddonId: "prog-origem", columnId: "c1", columnName: "C1" } },
          { id: "e4", key: "pid", label: "PID", valueType: "text", value: "", binding: { source: "pageDataId" } },
        ],
      },
    } as unknown as Parameters<typeof store.addSectionAddon>[2];
    store.setSectionAddons(projectId, fromId, [prodSrc, ecoSrc, progSrc, schemaSrc]);

    // Destino: já tem production, economyLink e progressionTable (IDs diferentes).
    const prodDest = createDefaultProductionAddon("prod-dest");
    const ecoDest = createDefaultEconomyLinkAddon("eco-dest");
    const progDest = createDefaultProgressionTableAddon("prog-dest");
    store.setSectionAddons(projectId, toId, [prodDest, ecoDest, progDest]);

    store.copyAddonToSection(projectId, fromId, toId, "schema-origem");

    const toSection = useProjectStore.getState().getProject(projectId)?.sections?.find((s) => s.id === toId);
    const copied = toSection?.addons?.find((a) => a.type === "dataSchema");
    expect(copied).toBeDefined();
    if (copied?.type === "dataSchema") {
      const byKey = Object.fromEntries(copied.data.entries.map((e) => [e.key, e.binding]));
      // production → addon do destino
      expect((byKey.rate as any)?.source).toBe("production");
      expect((byKey.rate as any)?.addonId).toBe("prod-dest");
      // economyLink → sectionId guarda o id do ADDON economyLink: re-apontado ao do destino
      expect((byKey.price as any)?.source).toBe("economyLink");
      expect((byKey.price as any)?.sectionId).toBe("eco-dest");
      // progressionColumn → tabela do destino (columnId preservado)
      expect((byKey.col as any)?.source).toBe("progressionColumn");
      expect((byKey.col as any)?.progressionAddonId).toBe("prog-dest");
      expect((byKey.col as any)?.columnId).toBe("c1");
      // pageDataId → inalterado
      expect((byKey.pid as any)?.source).toBe("pageDataId");
    }
  });

  it("copiar Schema de Dados para destino SEM os addons limpa os bindings intra-página", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("Projeto Schema 2", "Desc");
    const fromId = store.addSection(projectId, "Origem", "");
    const toId = store.addSection(projectId, "Destino", "");
    const prodSrc = createDefaultProductionAddon("prod-origem");
    const schemaSrc = {
      id: "schema-origem",
      type: "dataSchema" as const,
      name: "Stats",
      data: {
        id: "schema-origem",
        name: "Stats",
        entries: [
          { id: "e1", key: "rate", label: "Rate", valueType: "int", value: 0, binding: { source: "production", addonId: "prod-origem", field: "minOutput" } },
        ],
      },
    } as unknown as Parameters<typeof store.addSectionAddon>[2];
    store.setSectionAddons(projectId, fromId, [prodSrc, schemaSrc]);
    store.setSectionAddons(projectId, toId, []); // destino vazio

    store.copyAddonToSection(projectId, fromId, toId, "schema-origem");

    const toSection = useProjectStore.getState().getProject(projectId)?.sections?.find((s) => s.id === toId);
    const copied = toSection?.addons?.find((a) => a.type === "dataSchema");
    if (copied?.type === "dataSchema") {
      // sem production no destino → binding fica sem vínculo (undefined), não dangling.
      expect(copied.data.entries[0].binding).toBeUndefined();
    }
  });
});
