import { createDefaultBalanceAddon } from "@/lib/balance/formulaEngine";
import type { SectionAddon, SectionAddonType } from "@/lib/addons/types";
import {
  balanceDraftToSectionAddon,
  createDefaultProgressionTableAddon,
  sectionAddonToBalanceDraft,
} from "@/lib/addons/types";
import { BalanceAddonPanel } from "@/components/BalanceAddonPanel";
import { BalanceAddonReadOnly } from "@/components/BalanceAddonReadOnly";
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
        onChange: (nextDraft) => onChange({ ...addon, name: nextDraft.name, data: nextDraft }),
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
];

export function getAddonRegistryEntry(type: SectionAddonType): AddonRegistryEntry | undefined {
  return ADDON_REGISTRY.find((entry) => entry.type === type);
}

