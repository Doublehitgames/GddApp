import { createDefaultBalanceAddon } from "@/lib/balance/formulaEngine";
import type { SectionAddon, SectionAddonType } from "@/lib/addons/types";
import {
  balanceDraftToSectionAddon,
  createDefaultAttributeDefinitionsAddon,
  createDefaultAttributeModifiersAddon,
  createDefaultAttributeProfileAddon,
  createDefaultCurrencyAddon,
  createDefaultDataSchemaAddon,
  createDefaultEconomyLinkAddon,
  createDefaultExportSchemaAddon,
  createDefaultGlobalVariableAddon,
  createDefaultInventoryAddon,
  createDefaultProductionAddon,
  createDefaultProgressionTableAddon,
  sectionAddonToBalanceDraft,
} from "@/lib/addons/types";
import { AttributeDefinitionsAddonPanel } from "@/components/AttributeDefinitionsAddonPanel";
import { AttributeDefinitionsAddonReadOnly } from "@/components/AttributeDefinitionsAddonReadOnly";
import { AttributeModifiersAddonPanel } from "@/components/AttributeModifiersAddonPanel";
import { AttributeModifiersAddonReadOnly } from "@/components/AttributeModifiersAddonReadOnly";
import { AttributeProfileAddonPanel } from "@/components/AttributeProfileAddonPanel";
import { AttributeProfileAddonReadOnly } from "@/components/AttributeProfileAddonReadOnly";
import { BalanceAddonPanel } from "@/components/BalanceAddonPanel";
import { BalanceAddonReadOnly } from "@/components/BalanceAddonReadOnly";
import { CurrencyAddonPanel } from "@/components/CurrencyAddonPanel";
import { CurrencyAddonReadOnly } from "@/components/CurrencyAddonReadOnly";
import { EconomyLinkAddonPanel } from "@/components/EconomyLinkAddonPanel";
import { EconomyLinkAddonReadOnly } from "@/components/EconomyLinkAddonReadOnly";
import { DataSchemaAddonPanel } from "@/components/DataSchemaAddonPanel";
import { DataSchemaAddonReadOnly } from "@/components/DataSchemaAddonReadOnly";
import { GlobalVariableAddonPanel } from "@/components/GlobalVariableAddonPanel";
import { GlobalVariableAddonReadOnly } from "@/components/GlobalVariableAddonReadOnly";
import { ExportSchemaAddonPanel } from "@/components/ExportSchemaAddonPanel";
import { ExportSchemaAddonReadOnly } from "@/components/ExportSchemaAddonReadOnly";
import { InventoryAddonPanel } from "@/components/InventoryAddonPanel";
import { InventoryAddonReadOnly } from "@/components/InventoryAddonReadOnly";
import { ProductionAddonPanel } from "@/components/ProductionAddonPanel";
import { ProductionAddonReadOnly } from "@/components/ProductionAddonReadOnly";
import { ProgressionTableAddonPanel } from "@/components/ProgressionTableAddonPanel";
import { ProgressionTableAddonReadOnly } from "@/components/ProgressionTableAddonReadOnly";
import React from "react";

export type AddonRegistryEntry = {
  type: SectionAddonType;
  label: string;
  createDefault: () => SectionAddon;
  renderEditor: (addon: SectionAddon, onChange: (next: SectionAddon) => void, onRemove: () => void) => React.ReactNode;
  renderReadOnly: (
    addon: SectionAddon,
    options?: { compact?: boolean; showChart?: boolean; maxRows?: number; theme?: "dark" | "light"; layout?: "stack" | "sideBySide"; showSummary?: boolean; showTable?: boolean }
  ) => React.ReactNode;
};

export const ADDON_REGISTRY: AddonRegistryEntry[] = [
  {
    type: "xpBalance",
    label: "Balanceamento de XP",
    createDefault: () => {
      const addonId = `balance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return balanceDraftToSectionAddon(createDefaultBalanceAddon(addonId));
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "xpBalance") return null;
      const draft = sectionAddonToBalanceDraft(addon);
      return React.createElement(BalanceAddonPanel, {
        addon: draft,
        onChange: (nextDraft) => onChange(balanceDraftToSectionAddon(nextDraft)),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "xpBalance") return null;
      const draft = sectionAddonToBalanceDraft(addon);
      return React.createElement(BalanceAddonReadOnly, {
        addon: draft,
        compact: options?.compact,
        showChart: options?.showChart,
        maxRows: options?.maxRows,
        theme: options?.theme,
        layout: options?.layout,
        showSummary: options?.showSummary,
        showTable: options?.showTable,
      });
    },
  },
  {
    type: "progressionTable",
    label: "Tabela de Balanceamento",
    createDefault: () => {
      const addonId = `progression-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultProgressionTableAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "progressionTable") return null;
      return React.createElement(ProgressionTableAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "progressionTable") return null;
      return React.createElement(ProgressionTableAddonReadOnly, {
        addon: addon.data,
        maxRows: options?.maxRows,
        theme: options?.theme,
      });
    },
  },
  {
    type: "economyLink",
    label: "Economy Link",
    createDefault: () => {
      const addonId = `economy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultEconomyLinkAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "economyLink") return null;
      return React.createElement(EconomyLinkAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "economyLink") return null;
      return React.createElement(EconomyLinkAddonReadOnly, {
        addon: addon.data,
        theme: options?.theme,
      });
    },
  },
  {
    type: "attributeDefinitions",
    label: "Definições de Atributos",
    createDefault: () => {
      const addonId = `attr-defs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultAttributeDefinitionsAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "attributeDefinitions") return null;
      return React.createElement(AttributeDefinitionsAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "attributeDefinitions") return null;
      return React.createElement(AttributeDefinitionsAddonReadOnly, {
        addon: addon.data,
        theme: options?.theme,
      });
    },
  },
  {
    type: "attributeProfile",
    label: "Perfil de Atributos",
    createDefault: () => {
      const addonId = `attr-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultAttributeProfileAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "attributeProfile") return null;
      return React.createElement(AttributeProfileAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "attributeProfile") return null;
      return React.createElement(AttributeProfileAddonReadOnly, {
        addon: addon.data,
        theme: options?.theme,
      });
    },
  },
  {
    type: "attributeModifiers",
    label: "Modificadores de Atributos",
    createDefault: () => {
      const addonId = `attr-modifiers-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultAttributeModifiersAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "attributeModifiers") return null;
      return React.createElement(AttributeModifiersAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "attributeModifiers") return null;
      return React.createElement(AttributeModifiersAddonReadOnly, {
        addon: addon.data,
        theme: options?.theme,
      });
    },
  },
  {
    type: "currency",
    label: "Currency",
    createDefault: () => {
      const addonId = `currency-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultCurrencyAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "currency") return null;
      return React.createElement(CurrencyAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "currency") return null;
      return React.createElement(CurrencyAddonReadOnly, {
        addon: addon.data,
        theme: options?.theme,
      });
    },
  },
  {
    type: "dataSchema",
    label: "Schema de Dados",
    createDefault: () => {
      const addonId = `data-schema-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultDataSchemaAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "dataSchema" && addon.type !== "genericStats") return null;
      return React.createElement(DataSchemaAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "dataSchema" && addon.type !== "genericStats") return null;
      return React.createElement(DataSchemaAddonReadOnly, {
        addon: addon.data,
        theme: options?.theme,
      });
    },
  },
  {
    type: "globalVariable",
    label: "Global Variable",
    createDefault: () => {
      const addonId = `gvar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultGlobalVariableAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "globalVariable") return null;
      return React.createElement(GlobalVariableAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "globalVariable") return null;
      return React.createElement(GlobalVariableAddonReadOnly, {
        addon: addon.data,
        theme: options?.theme,
      });
    },
  },
  {
    type: "production",
    label: "Production",
    createDefault: () => {
      const addonId = `production-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultProductionAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "production") return null;
      return React.createElement(ProductionAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "production") return null;
      return React.createElement(ProductionAddonReadOnly, {
        addon: addon.data,
        theme: options?.theme,
      });
    },
  },
  {
    type: "inventory",
    label: "Inventory",
    createDefault: () => {
      const addonId = `inventory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultInventoryAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "inventory") return null;
      return React.createElement(InventoryAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "inventory") return null;
      return React.createElement(InventoryAddonReadOnly, {
        addon: addon.data,
        theme: options?.theme,
      });
    },
  },
  {
    type: "exportSchema",
    label: "Remote Config",
    createDefault: () => {
      const addonId = `export-schema-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return createDefaultExportSchemaAddon(addonId);
    },
    renderEditor: (addon, onChange, onRemove) => {
      if (addon.type !== "exportSchema") return null;
      return React.createElement(ExportSchemaAddonPanel, {
        addon: addon.data,
        onChange: (nextDraft) => onChange({ ...addon, name: addon.name || nextDraft.name, data: nextDraft }),
        onRemove,
      });
    },
    renderReadOnly: (addon, options) => {
      if (addon.type !== "exportSchema") return null;
      return React.createElement(ExportSchemaAddonReadOnly, {
        addon: addon.data,
        theme: options?.theme,
      });
    },
  },
];

export function getAddonRegistryEntry(type: SectionAddonType): AddonRegistryEntry | undefined {
  if (type === "genericStats") {
    return ADDON_REGISTRY.find((entry) => entry.type === "dataSchema");
  }
  return ADDON_REGISTRY.find((entry) => entry.type === type);
}

