"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { useResetOnOpen } from "@/hooks/useResetOnOpen";
import {
  AttributeSlotsEditor,
  slugifyAttributeKey,
  uniqueAttributeKey,
  type AttributeSlotCustom,
} from "./AttributeSlotsEditor";

export type AttributeDefinitionsSetupResult = {
  name: string;
  selectedPresetKeys: string[];
  customAttrs: AttributeSlotCustom[];
};

type Props = {
  open: boolean;
  /** Pre-filled name (typed title from the sidebar quick-add input). */
  defaultName: string;
  /** Preset attribute chips offered as checkboxes (HP/ATK/DEF/SPD). */
  presets: ReadonlyArray<{ key: string; label: string }>;
  onConfirm: (result: AttributeDefinitionsSetupResult) => void;
  onCancel: () => void;
};

/**
 * Self-setup dialog shown when the user creates an `attributeDefinitions`
 * page directly (not as a `requires` step of another page type). Lets them
 * tweak the name, tick which preset slots to seed, and add custom name-only
 * slots before the page is actually created.
 *
 * Resets its state on every open-edge so the dialog can be mounted once and
 * reused across many creates.
 */
export function AttributeDefinitionsSetupDialog({
  open,
  defaultName,
  presets,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(defaultName);
  const [selectedPresetKeys, setSelectedPresetKeys] = useState<string[]>(
    presets.map((p) => p.key)
  );
  const [customAttrs, setCustomAttrs] = useState<AttributeSlotCustom[]>([]);

  useResetOnOpen(open, () => {
    setName(defaultName);
    setSelectedPresetKeys(presets.map((p) => p.key));
    setCustomAttrs([]);
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const togglePreset = (key: string) =>
    setSelectedPresetKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  const addCustom = (label: string) => {
    const presetKeys = presets.map((p) => p.key);
    const key = uniqueAttributeKey(slugifyAttributeKey(label) || "attr", [
      ...presetKeys,
      ...customAttrs.map((a) => a.key),
    ]);
    setCustomAttrs((prev) => [...prev, { key, label }]);
  };
  const removeCustom = (key: string) =>
    setCustomAttrs((prev) => prev.filter((a) => a.key !== key));

  const canConfirm =
    name.trim().length > 0 &&
    (selectedPresetKeys.length > 0 || customAttrs.length > 0);

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm({
      name: name.trim(),
      selectedPresetKeys,
      customAttrs,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(
        "attributeDefinitionsSetup.title",
        "Configurar página de Atributos"
      )}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-100">
            {t(
              "attributeDefinitionsSetup.title",
              "Configurar página de Atributos"
            )}
          </h3>
          <p className="mt-1 text-xs text-gray-400 leading-relaxed">
            {t(
              "attributeDefinitionsSetup.description",
              "Escolha o nome da página e quais atributos ela vai começar com. Você pode adicionar, renomear ou remover depois."
            )}
          </p>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-gray-400">
            {t("attributeDefinitionsSetup.nameLabel", "Nome da página")}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(
              "attributeDefinitionsSetup.namePlaceholder",
              "Ex.: Atributos base"
            )}
            className="w-full rounded-md border border-gray-600 bg-gray-900/80 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
            autoFocus
          />
        </label>

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="block text-[11px] uppercase tracking-wide text-gray-400">
              {t("attributeDefinitionsSetup.slotsLabel", "Atributos")}
            </span>
            <button
              type="button"
              onClick={() =>
                setSelectedPresetKeys(
                  selectedPresetKeys.length === 0 ? presets.map((p) => p.key) : []
                )
              }
              className="text-xs text-indigo-300 hover:text-indigo-200"
            >
              {selectedPresetKeys.length === 0
                ? t("attributeDefinitionsSetup.selectAll", "Marcar todos")
                : t("attributeDefinitionsSetup.clearAll", "Desmarcar todos")}
            </button>
          </div>
          <AttributeSlotsEditor
            presets={presets}
            selectedPresetKeys={selectedPresetKeys}
            onTogglePreset={togglePreset}
            customAttributes={customAttrs}
            onAddCustom={addCustom}
            onRemoveCustom={removeCustom}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
          >
            {t("attributeDefinitionsSetup.cancel", "Cancelar")}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="rounded-md border border-blue-500 bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("attributeDefinitionsSetup.confirm", "Criar página")}
          </button>
        </div>
      </div>
    </div>
  );
}
