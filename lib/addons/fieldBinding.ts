import type { EconomyLinkFieldKey, ProductionFieldKey, SheetsCellRef } from "@/lib/addons/types";
import type { LinkedSpreadsheet } from "@/store/slices/types";

// ── Value types ──────────────────────────────────────────────────────────────

export type FieldValueType = "number" | "text" | "boolean";

// ── Binding discriminated union ──────────────────────────────────────────────

export type FieldBinding =
  /** No binding — value is set manually by the user. */
  | { source: "manual" }
  /** Value from a single Google Sheets cell. Works for number, text, or boolean. */
  | { source: "sheets"; ref: SheetsCellRef }
  /** Numeric value from a ProgressionTable column (level-scaled). Intra-section ref. */
  | { source: "progressionColumn"; progressionAddonId: string; columnId: string; columnName: string }
  /** Key/label from a FieldLibrary entry. Cross-section ref. */
  | { source: "library"; libraryAddonId: string; entryId: string }
  /** Numeric (or text) value from a specific field of an EconomyLink addon. Cross-section ref. */
  | { source: "economyLink"; sectionId: string; field: EconomyLinkFieldKey }
  /** Numeric value from a specific field of a Production addon. Intra-section ref. */
  | { source: "production"; addonId: string; field: ProductionFieldKey }
  /** Numeric value from the linked XpBalance section. Cross-section ref. */
  | { source: "unitXp"; sectionId: string }
  /** Value is the section's own dataId field. */
  | { source: "pageDataId" };

export const MANUAL_BINDING: FieldBinding = { source: "manual" };

export function isActiveBinding(b: FieldBinding): boolean {
  return b.source !== "manual";
}

/** Returns true when the binding targets an addon in the same section (cleared on move/copy). */
export function isIntraSectionBinding(b: FieldBinding): boolean {
  return b.source === "production" || b.source === "progressionColumn";
}

// ── Config ───────────────────────────────────────────────────────────────────

export type FieldBindingConfig = {
  /** The kind of value this field holds — controls which sources are valid. */
  valueType: FieldValueType;
  /** Which binding sources the user may pick for this field. */
  acceptedSources: FieldBinding["source"][];
  /** Label shown above the field row. */
  label: string;
  /** Optional hint text shown near the label. */
  hint?: string;
  /** For `library` source: whether to resolve to `key` or `label`. Default: "label". */
  libraryOutput?: "key" | "label";
};

// ── Picker context (options per source) ──────────────────────────────────────

export type ProgressionColumnBindingOption = {
  progressionAddonId: string;
  progressionAddonName: string;
  columnId: string;
  columnName: string;
};

export type LibraryEntryBindingOption = {
  libraryAddonId: string;
  entryId: string;
  key: string;
  label: string;
};

export type EconomyLinkBindingOption = {
  sectionId: string;
  sectionLabel: string;
  field: EconomyLinkFieldKey;
};

export type ProductionBindingOption = {
  addonId: string;
  addonName: string;
  field: ProductionFieldKey;
};

export type UnitXpBindingOption = {
  sectionId: string;
  sectionLabel: string;
};

export type FieldBindingPickerContext = {
  /** Available ProgressionTable columns in this section. */
  progressionColumns?: ProgressionColumnBindingOption[];
  /** Available FieldLibrary entries across the project. */
  libraryEntries?: LibraryEntryBindingOption[];
  /** Available EconomyLink fields from other sections. */
  economyLinks?: EconomyLinkBindingOption[];
  /** Available Production addon fields in this section. */
  productionAddons?: ProductionBindingOption[];
  /** Available XpBalance sections. */
  unitXpSections?: UnitXpBindingOption[];
  /** Registered Google Sheets spreadsheets in this project. */
  spreadsheetRegistry?: LinkedSpreadsheet[];
  /** ID da planilha (registry) vinculada à seção atual. */
  linkedSpreadsheetId?: string;
  /** Chamado quando o usuário muda a planilha vinculada à seção. */
  onLinkedSpreadsheetChange?: (id: string) => void;
};

// ── Display helpers ───────────────────────────────────────────────────────────

export function getBindingChipLabel(
  binding: FieldBinding,
  context: FieldBindingPickerContext,
  libraryOutput: "key" | "label" = "label"
): string {
  switch (binding.source) {
    case "manual":
      return "Sem vínculo";
    case "sheets": {
      const regName = context.linkedSpreadsheetId
        ? context.spreadsheetRegistry?.find((s) => s.id === context.linkedSpreadsheetId)?.name
        : undefined;
      const ref = `${binding.ref.sheetName}!${binding.ref.cellRef}`;
      return regName ? `Google Sheets: ${regName} - ${ref}` : ref;
    }
    case "progressionColumn": {
      // When multiple columns share the same name, add the table name for disambiguation
      const cols = context.progressionColumns;
      if (cols) {
        const sameNameCols = cols.filter((c) => c.columnName === binding.columnName);
        if (sameNameCols.length > 1) {
          const opt = cols.find(
            (c) => c.progressionAddonId === binding.progressionAddonId && c.columnId === binding.columnId
          );
          if (opt) return opt.progressionAddonName;
        }
      }
      return binding.columnName;
    }
    case "library": {
      const entry = context.libraryEntries?.find(
        (e) => e.libraryAddonId === binding.libraryAddonId && e.entryId === binding.entryId
      );
      if (!entry) return "Vínculo quebrado";
      return libraryOutput === "key" ? entry.key : entry.label;
    }
    case "economyLink": {
      const opt = context.economyLinks?.find(
        (e) => e.sectionId === binding.sectionId && e.field === binding.field
      );
      const fieldLbl = economyLinkFieldLabel(binding.field);
      return opt ? `${opt.sectionLabel} › ${fieldLbl}` : fieldLbl;
    }
    case "production": {
      const opt = context.productionAddons?.find(
        (e) => e.addonId === binding.addonId && e.field === binding.field
      );
      const fieldLbl = productionFieldLabel(binding.field);
      return opt ? `${opt.addonName} › ${fieldLbl}` : fieldLbl;
    }
    case "unitXp": {
      const opt = context.unitXpSections?.find((e) => e.sectionId === binding.sectionId);
      return opt ? opt.sectionLabel : "XP Balance";
    }
    case "pageDataId":
      return "ID da página";
  }
}

export function isBindingBroken(binding: FieldBinding, context: FieldBindingPickerContext): boolean {
  switch (binding.source) {
    case "library":
      return !context.libraryEntries?.some(
        (e) => e.libraryAddonId === binding.libraryAddonId && e.entryId === binding.entryId
      );
    case "progressionColumn":
      return !context.progressionColumns?.some(
        (e) => e.progressionAddonId === binding.progressionAddonId && e.columnId === binding.columnId
      );
    case "economyLink":
      return !context.economyLinks?.some(
        (e) => e.sectionId === binding.sectionId && e.field === binding.field
      );
    case "production":
      return !context.productionAddons?.some(
        (e) => e.addonId === binding.addonId && e.field === binding.field
      );
    case "unitXp":
      return !context.unitXpSections?.some((e) => e.sectionId === binding.sectionId);
    default:
      return false;
  }
}

// ── Field label maps ──────────────────────────────────────────────────────────

export function economyLinkFieldLabel(field: EconomyLinkFieldKey): string {
  const labels: Record<EconomyLinkFieldKey, string> = {
    buyValue: "Preço de compra",
    minBuyValue: "Preço mínimo de compra",
    maxBuyValue: "Preço máximo de compra",
    sellValue: "Preço de venda",
    minSellValue: "Preço mínimo de venda",
    maxSellValue: "Preço máximo de venda",
    unlockValue: "Valor de desbloqueio",
    unlockValueMin: "Desbloqueio mínimo",
    unlockValueMax: "Desbloqueio máximo",
    buyCurrencyRef: "Moeda de compra (ref)",
    sellCurrencyRef: "Moeda de venda (ref)",
    buyCurrencyKey: "Moeda de compra (key)",
    sellCurrencyKey: "Moeda de venda (key)",
  };
  return labels[field] ?? field;
}

export function productionFieldLabel(field: ProductionFieldKey): string {
  const labels: Record<ProductionFieldKey, string> = {
    minOutput: "Quantidade",
    outputMin: "Quantidade — Mín",
    maxOutput: "Quantidade — Máx",
    intervalSeconds: "Tempo (passivo)",
    intervalSecondsMin: "Tempo (passivo) — Mín",
    intervalSecondsMax: "Tempo (passivo) — Máx",
    craftTimeSeconds: "Tempo (receita)",
    craftTimeSecondsMin: "Tempo (receita) — Mín",
    craftTimeSecondsMax: "Tempo (receita) — Máx",
    capacity: "Capacidade",
    capacityMin: "Capacidade — Mín",
    capacityMax: "Capacidade — Máx",
    outputBuyEffective: "Preço de compra efetivo",
    outputMinBuyValue: "Preço mínimo de compra",
    outputSellEffective: "Preço de venda efetivo",
    outputMaxSellValue: "Preço máximo de venda",
    outputUnlockValue: "Valor de desbloqueio",
  };
  return labels[field] ?? field;
}
