"use client";

import type { ProgressionTableAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";

interface ProgressionTableAddonReadOnlyProps {
  addon: ProgressionTableAddonDraft;
  maxRows?: number;
  theme?: "dark" | "light";
}

export function ProgressionTableAddonReadOnly({
  addon,
  maxRows = 20,
  theme = "dark",
}: ProgressionTableAddonReadOnlyProps) {
  const { t } = useI18n();
  const rows = (addon.rows || []).slice(0, Math.max(1, maxRows));
  const columns = addon.columns || [];
  const isLight = theme === "light";

  return (
    <div
      className={`mt-3 rounded-xl p-3 ${
        isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"
      }`}
    >
      <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
        {addon.name || t("progressionTableAddon.defaultName", "Tabela de balanceamento")}
      </h5>
      <div
        className={`mt-2 overflow-auto rounded-lg ${
          isLight ? "border border-gray-300 bg-white" : "border border-gray-700"
        }`}
      >
        <table className="w-full text-left text-xs">
          <thead className={isLight ? "bg-gray-100 text-gray-800" : "bg-gray-900 text-gray-300"}>
            <tr>
              <th className="px-2 py-1.5">{t("progressionTableAddon.levelHeader", "Level")}</th>
              {columns.map((column) => (
                <th key={column.id} className="px-2 py-1.5">
                  {column.name || t("progressionTableAddon.columnFallback", "Coluna")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.level}
                className={isLight ? "border-t border-gray-200 text-gray-900" : "border-t border-gray-800 text-gray-200"}
              >
                <td className="px-2 py-1">
                  {t("progressionTableAddon.levelPrefix", "Lv")} {row.level}
                </td>
                {columns.map((column) => (
                  <td key={`${row.level}-${column.id}`} className="px-2 py-1">
                    {String(row.values?.[column.id] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(addon.rows || []).length > rows.length && (
        <p className={`mt-1 text-[11px] ${isLight ? "text-gray-600" : "text-gray-400"}`}>
          {t("progressionTableAddon.showingRows", "Mostrando {shown} de {total} niveis.")
            .replace("{shown}", String(rows.length))
            .replace("{total}", String((addon.rows || []).length))}
        </p>
      )}
    </div>
  );
}
