"use client";

import type { AttributeDefinitionsAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";

interface AttributeDefinitionsAddonReadOnlyProps {
  addon: AttributeDefinitionsAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

function formatValue(value: number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function AttributeDefinitionsAddonReadOnly({ addon, theme = "dark", bare = false }: AttributeDefinitionsAddonReadOnlyProps) {
  const { t } = useI18n();
  const isLight = theme === "light";
  const rows = addon.attributes || [];
  const outerClass = bare
    ? ""
    : `rounded-xl p-3 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"}`;

  return (
    <div className={outerClass}>
      {!bare && (
        <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {addon.name || t("attributeDefinitionsAddon.defaultName", "Definições de Atributos")}
        </h5>
      )}
      {rows.length === 0 ? (
        <p className={`${bare ? "" : "mt-2"} text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
          {t("attributeDefinitionsAddon.readOnlyEmpty", "Nenhum atributo definido.")}
        </p>
      ) : (
        <div className={`${bare ? "" : "mt-2"} space-y-1.5 ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {rows.map((entry) => (
            <p key={entry.id} className={bare ? "" : "text-sm"}>
              <strong>{entry.label || entry.key}</strong>
              {entry.key ? (
                <span className={`ml-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>({entry.key})</span>
              ) : null}
              : {formatValue(entry.defaultValue)}
              {entry.unit ? ` ${entry.unit}` : ""}
              {typeof entry.min === "number" || typeof entry.max === "number"
                ? ` [${entry.min ?? "-∞"} .. ${entry.max ?? "+∞"}]`
                : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

