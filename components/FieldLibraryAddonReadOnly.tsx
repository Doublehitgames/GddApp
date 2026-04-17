"use client";

import type { FieldLibraryAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";

interface FieldLibraryAddonReadOnlyProps {
  addon: FieldLibraryAddonDraft;
  theme?: "dark" | "light";
}

export function FieldLibraryAddonReadOnly({ addon, theme = "dark" }: FieldLibraryAddonReadOnlyProps) {
  const { t } = useI18n();
  const isLight = theme === "light";
  const entries = addon.entries || [];

  return (
    <div
      className={`rounded-xl p-3 ${
        isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"
      }`}
    >
      <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
        {addon.name || t("fieldLibraryAddon.defaultName", "Biblioteca de Campos")}
      </h5>
      {entries.length === 0 ? (
        <p className={`mt-2 text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
          {t("fieldLibraryAddon.readOnlyEmpty", "Nenhum campo definido.")}
        </p>
      ) : (
        <div className={`mt-2 space-y-1.5 ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {entries.map((entry) => (
            <div key={entry.id} className="text-sm">
              <p>
                <strong>{entry.label || entry.key}</strong>
                {entry.key ? (
                  <span className={`ml-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>({entry.key})</span>
                ) : null}
              </p>
              {entry.description ? (
                <p className={`text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>{entry.description}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
