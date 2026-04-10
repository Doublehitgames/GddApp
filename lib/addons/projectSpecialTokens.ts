import type { Project, Section } from "@/store/projectStore";
import type { SectionAddon } from "@/lib/addons/types";

type TokenValue = string | number;
type TokenMap = Record<string, TokenValue>;
type TokenParams = Record<string, string>;

export type ProjectTokenSource = {
  updatedAt?: string | null;
  sections?: Section[];
};

export type SpecialTokenHelpItem = {
  label: string;
  token: string;
  description: string;
};

export const SPECIAL_TOKEN_HELP_ITEMS: SpecialTokenHelpItem[] = [
  { label: "Total de moedas", token: "@[currency_count]", description: "Conta moedas cadastradas no projeto." },
  { label: "Moedas soft", token: "@[currency_count(kind=soft)]", description: "Filtra moedas pelo tipo." },
  { label: "Códigos de moeda", token: "@[currency_codes]", description: "Lista códigos únicos (CSV)." },
  { label: "Títulos de moeda", token: "@[currency_titles]", description: "Lista nomes de exibição das moedas (CSV)." },
  { label: "Variáveis globais", token: "@[global_variable_count]", description: "Conta variáveis globais." },
  {
    label: "Variáveis por escopo",
    token: "@[global_variable_count(scope=event)]",
    description: "Filtra por escopo: global/mode/event/season.",
  },
  { label: "Itens de inventário", token: "@[inventory_item_count]", description: "Conta itens com addon de inventário." },
  {
    label: "Itens por categoria",
    token: "@[inventory_item_count(category=consumable)]",
    description: "Filtra por categoria do inventário.",
  },
  { label: "Produções passivas", token: "@[production_count(mode=passive)]", description: "Filtra produção por modo." },
  {
    label: "Tempo de produção (passive)",
    token: "@[production_interval_seconds]",
    description: "Intervalo em segundos do addon de Produção (passive) desta página.",
  },
  {
    label: "Tempo de craft (recipe)",
    token: "@[production_craft_time_seconds]",
    description: "Craft time em segundos do addon de Produção (recipe) desta página.",
  },
  { label: "Economy com compra", token: "@[economy_link_count(config=buy)]", description: "Filtra por tipo de config." },
  { label: "Nível máximo XP", token: "@[xp_max_level]", description: "Maior endLevel entre addons de XP." },
];

type AddonStats = {
  projectSectionCount: number;
  projectAddonCount: number;
  currencyCount: number;
  currencySoftCount: number;
  currencyPremiumCount: number;
  currencyEventCount: number;
  currencyCodes: string[];
  currencyTitles: string[];
  globalVariableCount: number;
  globalVariablePercentCount: number;
  globalVariableFlatCount: number;
  globalVariableMultiplierCount: number;
  globalVariableBooleanCount: number;
  globalVariableKeys: string[];
  inventoryItemCount: number;
  inventoryStackableCount: number;
  inventoryConsumableCount: number;
  inventoryShowInShopCount: number;
  productionCount: number;
  productionPassiveCount: number;
  productionRecipeCount: number;
  productionOutputItemCount: number;
  economyLinkCount: number;
  economyBuyConfigCount: number;
  economySellConfigCount: number;
  economyUnlockConfigCount: number;
  progressionTableCount: number;
  progressionMaxLevel: number;
  xpBalanceCount: number;
  xpMaxLevel: number;
};

function toNumberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSectionAddon(value: unknown): value is SectionAddon {
  return Boolean(value && typeof value === "object" && "type" in (value as Record<string, unknown>));
}

function formatIsoDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toISOString();
}

function getSectionAddons(section: Section): SectionAddon[] {
  if (!Array.isArray(section.addons) || section.addons.length === 0) return [];
  return section.addons.filter(isSectionAddon);
}

function hasBuyConfig(addon: SectionAddon): boolean {
  if (addon.type !== "economyLink") return false;
  const data = addon.data;
  return data.hasBuyConfig ?? Boolean(data.buyCurrencyRef || data.buyValue != null || (data.buyModifiers || []).length > 0);
}

function hasSellConfig(addon: SectionAddon): boolean {
  if (addon.type !== "economyLink") return false;
  const data = addon.data;
  return data.hasSellConfig ?? Boolean(data.sellCurrencyRef || data.sellValue != null || (data.sellModifiers || []).length > 0);
}

function hasUnlockConfig(addon: SectionAddon): boolean {
  if (addon.type !== "economyLink") return false;
  const data = addon.data;
  return data.hasUnlockConfig ?? Boolean(data.unlockRef || data.unlockValue != null);
}

function uniqueSorted(values: Iterable<string>): string[] {
  const normalized = Array.from(values)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function parseTokenExpression(rawExpression: string): { token: string; params: TokenParams } | null {
  const expression = String(rawExpression || "")
    .replace(/\\_/g, "_")
    .trim();
  if (!expression) return null;
  const match = expression.match(/^([a-z0-9_]+)(?:\((.*)\))?$/i);
  if (!match) return null;
  const token = String(match[1] || "").trim().toLowerCase();
  const paramsBlock = String(match[2] || "").trim();
  const params: TokenParams = {};
  if (paramsBlock) {
    for (const rawEntry of paramsBlock.split(",")) {
      const entry = rawEntry.trim();
      if (!entry) continue;
      const equalsIndex = entry.indexOf("=");
      if (equalsIndex <= 0) continue;
      const key = entry.slice(0, equalsIndex).trim().toLowerCase();
      const value = entry.slice(equalsIndex + 1).trim().toLowerCase();
      if (!key || !value) continue;
      params[key] = value;
    }
  }
  return { token, params };
}

function asListValue(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "-";
}

export function buildProjectAddonStats(project: ProjectTokenSource | null | undefined): AddonStats {
  const sections = Array.isArray(project?.sections) ? project.sections : [];
  const addons = sections.flatMap((section) => getSectionAddons(section));

  const currencyAddons = addons.filter((addon) => addon.type === "currency");
  const globalVariableAddons = addons.filter((addon) => addon.type === "globalVariable");
  const inventoryAddons = addons.filter((addon) => addon.type === "inventory");
  const productionAddons = addons.filter((addon) => addon.type === "production");
  const economyAddons = addons.filter((addon) => addon.type === "economyLink");
  const progressionAddons = addons.filter((addon) => addon.type === "progressionTable");
  const xpAddons = addons.filter((addon) => addon.type === "xpBalance");

  const currencyCodes = uniqueSorted(currencyAddons.map((addon) => normalizeText(addon.data.code).toUpperCase()).filter(Boolean));
  const currencyTitles = uniqueSorted(currencyAddons.map((addon) => normalizeText(addon.data.displayName)).filter(Boolean));
  const globalVariableKeys = uniqueSorted(globalVariableAddons.map((addon) => normalizeText(addon.data.key)).filter(Boolean));
  const productionOutputRefs = uniqueSorted(
    productionAddons.flatMap((addon) => {
      if (addon.data.mode === "passive") {
        const outputRef = normalizeText(addon.data.outputRef);
        return outputRef ? [outputRef] : [];
      }
      return (addon.data.outputs || [])
        .map((output) => normalizeText(output.itemRef))
        .filter(Boolean);
    })
  );

  const progressionMaxLevel = progressionAddons.reduce((max, addon) => {
    const candidate = toNumberOrNull(addon.data.endLevel);
    return candidate == null ? max : Math.max(max, Math.floor(candidate));
  }, 0);

  const xpMaxLevel = xpAddons.reduce((max, addon) => {
    const candidate = toNumberOrNull(addon.data.endLevel);
    return candidate == null ? max : Math.max(max, Math.floor(candidate));
  }, 0);

  return {
    projectSectionCount: sections.length,
    projectAddonCount: addons.length,
    currencyCount: currencyAddons.length,
    currencySoftCount: currencyAddons.filter((addon) => addon.data.kind === "soft").length,
    currencyPremiumCount: currencyAddons.filter((addon) => addon.data.kind === "premium").length,
    currencyEventCount: currencyAddons.filter((addon) => addon.data.kind === "event").length,
    currencyCodes,
    currencyTitles,
    globalVariableCount: globalVariableAddons.length,
    globalVariablePercentCount: globalVariableAddons.filter((addon) => addon.data.valueType === "percent").length,
    globalVariableFlatCount: globalVariableAddons.filter((addon) => addon.data.valueType === "flat").length,
    globalVariableMultiplierCount: globalVariableAddons.filter((addon) => addon.data.valueType === "multiplier").length,
    globalVariableBooleanCount: globalVariableAddons.filter((addon) => addon.data.valueType === "boolean").length,
    globalVariableKeys,
    inventoryItemCount: inventoryAddons.length,
    inventoryStackableCount: inventoryAddons.filter((addon) => Boolean(addon.data.stackable)).length,
    inventoryConsumableCount: inventoryAddons.filter((addon) => Boolean(addon.data.consumable)).length,
    inventoryShowInShopCount: inventoryAddons.filter((addon) => addon.data.showInShop !== false).length,
    productionCount: productionAddons.length,
    productionPassiveCount: productionAddons.filter((addon) => addon.data.mode === "passive").length,
    productionRecipeCount: productionAddons.filter((addon) => addon.data.mode === "recipe").length,
    productionOutputItemCount: productionOutputRefs.length,
    economyLinkCount: economyAddons.length,
    economyBuyConfigCount: economyAddons.filter((addon) => hasBuyConfig(addon)).length,
    economySellConfigCount: economyAddons.filter((addon) => hasSellConfig(addon)).length,
    economyUnlockConfigCount: economyAddons.filter((addon) => hasUnlockConfig(addon)).length,
    progressionTableCount: progressionAddons.length,
    progressionMaxLevel,
    xpBalanceCount: xpAddons.length,
    xpMaxLevel,
  };
}

export function buildProjectSpecialTokenMap(project: ProjectTokenSource | null | undefined): TokenMap {
  const stats = buildProjectAddonStats(project);
  return {
    currency_count: stats.currencyCount,
    currency_soft_count: stats.currencySoftCount,
    currency_premium_count: stats.currencyPremiumCount,
    currency_event_count: stats.currencyEventCount,
    currency_codes: asListValue(stats.currencyCodes),
    currency_titles: asListValue(stats.currencyTitles),
    global_variable_count: stats.globalVariableCount,
    global_variable_percent_count: stats.globalVariablePercentCount,
    global_variable_flat_count: stats.globalVariableFlatCount,
    global_variable_multiplier_count: stats.globalVariableMultiplierCount,
    global_variable_boolean_count: stats.globalVariableBooleanCount,
    global_variable_keys: asListValue(stats.globalVariableKeys),
    inventory_item_count: stats.inventoryItemCount,
    inventory_stackable_count: stats.inventoryStackableCount,
    inventory_consumable_count: stats.inventoryConsumableCount,
    inventory_show_in_shop_count: stats.inventoryShowInShopCount,
    production_count: stats.productionCount,
    production_passive_count: stats.productionPassiveCount,
    production_recipe_count: stats.productionRecipeCount,
    production_output_item_count: stats.productionOutputItemCount,
    economy_link_count: stats.economyLinkCount,
    economy_buy_config_count: stats.economyBuyConfigCount,
    economy_sell_config_count: stats.economySellConfigCount,
    economy_unlock_config_count: stats.economyUnlockConfigCount,
    progression_table_count: stats.progressionTableCount,
    progression_max_level: stats.progressionMaxLevel,
    xp_balance_count: stats.xpBalanceCount,
    xp_max_level: stats.xpMaxLevel,
    project_section_count: stats.projectSectionCount,
    project_addon_count: stats.projectAddonCount,
    project_last_updated_at: formatIsoDate(project?.updatedAt),
  };
}

type TokenContext = {
  stats: AddonStats;
  allAddons: SectionAddon[];
  baseTokenMap: TokenMap;
  currentSection: Section | null;
};

type CurrencyAddon = Extract<SectionAddon, { type: "currency" }>;
type GlobalVariableAddon = Extract<SectionAddon, { type: "globalVariable" }>;
type InventoryAddon = Extract<SectionAddon, { type: "inventory" }>;
type ProductionAddon = Extract<SectionAddon, { type: "production" }>;
type EconomyLinkAddon = Extract<SectionAddon, { type: "economyLink" }>;

function createTokenContext(
  project: ProjectTokenSource | null | undefined,
  sectionId?: string | null
): TokenContext {
  const sections = Array.isArray(project?.sections) ? project.sections : [];
  const allAddons = sections.flatMap((section) => getSectionAddons(section));
  const currentSection = sectionId ? sections.find((s) => s.id === sectionId) ?? null : null;
  return {
    stats: buildProjectAddonStats(project),
    allAddons,
    baseTokenMap: buildProjectSpecialTokenMap(project),
    currentSection,
  };
}

function resolveTokenValue(token: string, params: TokenParams, context: TokenContext): TokenValue | null {
  const { stats, allAddons, baseTokenMap, currentSection } = context;

  if (token === "production_interval_seconds" || token === "production_craft_time_seconds") {
    if (!currentSection) return null;
    const productionAddons = getSectionAddons(currentSection).filter(
      (addon): addon is ProductionAddon => addon.type === "production"
    );
    if (productionAddons.length === 0) return null;
    const field = token === "production_interval_seconds" ? "intervalSeconds" : "craftTimeSeconds";
    const match = productionAddons.find((addon) => toNumberOrNull(addon.data[field]) != null);
    const value = match ? toNumberOrNull(match.data[field]) : null;
    return value == null ? null : value;
  }

  if (Object.prototype.hasOwnProperty.call(baseTokenMap, token) && Object.keys(params).length === 0) {
    return baseTokenMap[token];
  }

  if (token === "currency_count" || token === "currency_codes" || token === "currency_titles") {
    const kind = params.kind;
    const rows = allAddons.filter(
      (addon): addon is CurrencyAddon => addon.type === "currency" && (!kind || addon.data.kind === kind)
    );
    if (token === "currency_count") return rows.length;
    if (token === "currency_codes") {
      return asListValue(uniqueSorted(rows.map((addon) => normalizeText(addon.data.code).toUpperCase()).filter(Boolean)));
    }
    return asListValue(uniqueSorted(rows.map((addon) => normalizeText(addon.data.displayName)).filter(Boolean)));
  }

  if (token === "global_variable_count" || token === "global_variable_keys") {
    const scope = params.scope;
    const valueType = params.value_type || params.valuetype;
    const rows = allAddons.filter((addon): addon is GlobalVariableAddon => {
      if (addon.type !== "globalVariable") return false;
      if (scope && addon.data.scope !== scope) return false;
      if (valueType && addon.data.valueType !== valueType) return false;
      return true;
    });
    if (token === "global_variable_count") return rows.length;
    return asListValue(uniqueSorted(rows.map((addon) => normalizeText(addon.data.key)).filter(Boolean)));
  }

  if (token === "inventory_item_count") {
    const category = normalizeText(params.category);
    const rows = allAddons.filter((addon): addon is InventoryAddon => {
      if (addon.type !== "inventory") return false;
      if (!category) return true;
      return normalizeText(addon.data.inventoryCategory).toLowerCase() === category;
    });
    return rows.length;
  }

  if (token === "production_count") {
    const mode = params.mode;
    const rows = allAddons.filter(
      (addon): addon is ProductionAddon => addon.type === "production" && (!mode || addon.data.mode === mode)
    );
    return rows.length;
  }

  if (token === "economy_link_count") {
    const config = params.config;
    const rows = allAddons.filter((addon): addon is EconomyLinkAddon => addon.type === "economyLink");
    if (!config) return rows.length;
    if (config === "buy") return rows.filter((addon) => hasBuyConfig(addon)).length;
    if (config === "sell") return rows.filter((addon) => hasSellConfig(addon)).length;
    if (config === "unlock") return rows.filter((addon) => hasUnlockConfig(addon)).length;
    return rows.length;
  }

  if (token === "project_section_count") {
    return stats.projectSectionCount;
  }

  return null;
}

export function resolveProjectSpecialTokens(
  content: string,
  project: ProjectTokenSource | null | undefined,
  sectionId?: string | null
): string {
  if (!content || !content.includes("@[")) return content;
  const normalizedContent = normalizeSpecialTokenSyntax(content);
  const context = createTokenContext(project, sectionId);
  return normalizedContent.replace(/@\[([^\]]+)\]/gi, (fullMatch: string, rawExpression: string) => {
    const parsed = parseTokenExpression(rawExpression);
    if (!parsed) return fullMatch;
    const resolved = resolveTokenValue(parsed.token, parsed.params, context);
    if (resolved == null) return fullMatch;
    return String(resolved);
  });
}

export function resolveProjectSpecialTokensForProject(
  content: string,
  project: Project | null | undefined,
  sectionId?: string | null
): string {
  return resolveProjectSpecialTokens(content, project ?? null, sectionId);
}

export function normalizeSpecialTokenSyntax(content: string): string {
  if (!content || !content.includes("@[")) return content;
  return content.replace(/@\[([^\]]+)\]/g, (fullMatch: string, rawExpression: string) => {
    const fixed = String(rawExpression || "").replace(/\\_/g, "_");
    return `@[${fixed}]`;
  });
}

