"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

export type AttributeSlotCustom = { key: string; label: string };

export type AttributeSlotsEditorProps = {
  /** Built-in suggestions shown as checkboxes (HP/ATK/DEF/SPD). */
  presets: ReadonlyArray<{ key: string; label: string }>;
  /** Which preset keys are currently ticked. */
  selectedPresetKeys: string[];
  /** Called when user toggles a preset checkbox. */
  onTogglePreset: (key: string) => void;
  /** User-defined attributes beyond the presets (name-only). */
  customAttributes: AttributeSlotCustom[];
  /**
   * Called when user adds a new custom attribute. Receives the raw label —
   * the parent is responsible for generating a unique key and pushing
   * `{ key, label }` onto its `customAttributes` array.
   */
  onAddCustom: (label: string) => void;
  /** Remove a custom attribute by its key. */
  onRemoveCustom: (key: string) => void;
};

/**
 * Reusable picker for attribute slots — presets as checkboxes plus a simple
 * "add custom attribute" row for user-defined names. Emits raw events; the
 * parent owns state and slug/key generation.
 *
 * Used in three places:
 *   1. Page type "Atributos" self-setup dialog (new).
 *   2. Character wizard when creating a new attributes page.
 *   3. Item-with-effect wizard when creating a new attributes page.
 */
export function AttributeSlotsEditor({
  presets,
  selectedPresetKeys,
  onTogglePreset,
  customAttributes,
  onAddCustom,
  onRemoveCustom,
}: AttributeSlotsEditorProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  // Detect a live duplicate (case-insensitive label match) so we can warn
  // the user before they commit. Checks both preset labels and existing
  // custom attribute labels.
  const draftTrimmed = draft.trim();
  const duplicateLabel =
    draftTrimmed.length > 0 &&
    [...presets, ...customAttributes].some(
      (a) => a.label.toLowerCase() === draftTrimmed.toLowerCase()
    );

  const commitDraft = () => {
    if (!draftTrimmed || duplicateLabel) return;
    onAddCustom(draftTrimmed);
    setDraft("");
  };

  return (
    <div className="space-y-3">
      {/* Preset attributes — rendered as a compact checkbox grid. */}
      <div className="grid grid-cols-2 gap-2">
        {presets.map((preset) => {
          const checked = selectedPresetKeys.includes(preset.key);
          return (
            <label
              key={preset.key}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-200 hover:border-gray-600"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onTogglePreset(preset.key)}
                className="h-4 w-4 accent-blue-500"
              />
              <span>{preset.label}</span>
            </label>
          );
        })}
      </div>

      {/* Custom attributes — one row per entry, with a delete button. */}
      {customAttributes.length > 0 && (
        <ul className="space-y-1">
          {customAttributes.map((attr) => (
            <li
              key={attr.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-1.5 text-sm text-gray-200"
            >
              <span>{attr.label}</span>
              <button
                type="button"
                onClick={() => onRemoveCustom(attr.key)}
                className="text-xs text-red-300 hover:text-red-200"
                aria-label={t("attributeSlotsEditor.removeCustom", "Remover")}
              >
                {t("attributeSlotsEditor.removeCustom", "Remover")}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add-custom row: just a name input + button. No value, no type. */}
      <div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              }
            }}
            placeholder={t(
              "attributeSlotsEditor.addCustomPlaceholder",
              "Ex.: Mana, Crítico, Sorte"
            )}
            aria-invalid={duplicateLabel}
            className={`flex-1 rounded-lg border bg-gray-900/40 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none ${
              duplicateLabel
                ? "border-red-500/60 focus:border-red-400"
                : "border-gray-700 focus:border-blue-500"
            }`}
          />
          <button
            type="button"
            onClick={commitDraft}
            disabled={!draftTrimmed || duplicateLabel}
            className="rounded-lg border border-blue-500 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("attributeSlotsEditor.addCustomButton", "+ Adicionar")}
          </button>
        </div>
        {duplicateLabel && (
          <p className="mt-1 text-xs text-red-300">
            {t(
              "attributeSlotsEditor.duplicateLabel",
              "Esse atributo já existe."
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Slugify helper shared by callers that need to derive a stable attribute
 * `key` from a user-typed label. Keeps the output lowercase, ASCII, and
 * underscore-separated so keys match what `seedAttributeDefinitions` emits.
 */
export function slugifyAttributeKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Ensures a new custom attribute key is unique across both preset and
 * existing custom keys. Appends `_2`, `_3` … as needed.
 */
export function uniqueAttributeKey(
  desired: string,
  taken: Iterable<string>
): string {
  const set = new Set(taken);
  if (!set.has(desired)) return desired;
  let i = 2;
  while (set.has(`${desired}_${i}`)) i += 1;
  return `${desired}_${i}`;
}
