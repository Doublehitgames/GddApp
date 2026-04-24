"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { AttributeModifierMode } from "@/lib/addons/types";

export type { AttributeModifierMode };

export type AttributeModifierDraft = {
  attributeKey: string;
  enabled: boolean;
  mode: AttributeModifierMode;
  value: number;
};

export type AttributeModifiersEditorProps = {
  /**
   * Attributes sourced from the selected `attributeDefinitions` page. The
   * editor renders one row per attribute; the user ticks which ones this
   * page modifies and sets a value + op for each enabled entry.
   */
  attributes: ReadonlyArray<{ key: string; label: string }>;
  /** Current per-attribute draft state, keyed by attribute key. */
  drafts: Record<string, AttributeModifierDraft>;
  /** Called whenever the draft for a single attribute changes. */
  onChange: (attrKey: string, next: AttributeModifierDraft) => void;
};

/**
 * Per-attribute modifier editor. One row per available attribute:
 *   [x] HP   [add ▾]  [ 20 ]
 * Used in the requires-wizard when the user picks an existing attributes
 * page and the parent page type seeds an `attributeModifiers` addon
 * (equipmentItem, characters).
 */
export function AttributeModifiersEditor({
  attributes,
  drafts,
  onChange,
}: AttributeModifiersEditorProps) {
  const { t } = useI18n();

  if (attributes.length === 0) {
    return (
      <p className="text-xs italic text-gray-400">
        {t(
          "attributeModifiersEditor.empty",
          "A página de atributos selecionada está vazia — nada pra modificar."
        )}
      </p>
    );
  }

  const modeLabel = (mode: AttributeModifierMode) => {
    if (mode === "add")
      return t("attributeModifiersEditor.modeAdd", "Somar (+)");
    if (mode === "mult")
      return t("attributeModifiersEditor.modeMult", "Multiplicar (×)");
    return t("attributeModifiersEditor.modeSet", "Definir (=)");
  };

  return (
    <div className="space-y-1.5">
      {attributes.map((attr) => {
        const draft: AttributeModifierDraft = drafts[attr.key] ?? {
          attributeKey: attr.key,
          enabled: false,
          mode: "add",
          value: 0,
        };
        return (
          <div
            key={attr.key}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              draft.enabled
                ? "border-indigo-400/60 bg-indigo-900/10"
                : "border-gray-700 bg-gray-900/40"
            }`}
          >
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  onChange(attr.key, { ...draft, enabled: e.target.checked })
                }
                className="h-4 w-4 accent-indigo-500"
              />
              <span className="truncate text-gray-200">{attr.label}</span>
            </label>
            <select
              value={draft.mode}
              onChange={(e) =>
                onChange(attr.key, {
                  ...draft,
                  mode: e.target.value as AttributeModifierMode,
                })
              }
              disabled={!draft.enabled}
              className="rounded-md border border-gray-600 bg-gray-900/80 px-2 py-1 text-xs text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="add">{modeLabel("add")}</option>
              <option value="mult">{modeLabel("mult")}</option>
              <option value="set">{modeLabel("set")}</option>
            </select>
            <input
              type="number"
              step="any"
              value={Number.isFinite(draft.value) ? draft.value : 0}
              onChange={(e) =>
                onChange(attr.key, { ...draft, value: Number(e.target.value) })
              }
              disabled={!draft.enabled}
              className="w-20 rounded-md border border-gray-600 bg-gray-900/80 px-2 py-1 text-xs text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        );
      })}
    </div>
  );
}
