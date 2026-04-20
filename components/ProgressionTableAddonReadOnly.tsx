"use client";

import { useState } from "react";
import type { ProgressionTableAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";

interface ProgressionTableAddonReadOnlyProps {
  addon: ProgressionTableAddonDraft;
  maxRows?: number;
  theme?: "dark" | "light";
  bare?: boolean;
}

export function ProgressionTableAddonReadOnly({
  addon,
  maxRows = 20,
  theme = "dark",
  bare = false,
}: ProgressionTableAddonReadOnlyProps) {
  const { t } = useI18n();
  const rows = addon.rows || [];
  const columns = addon.columns || [];
  const isLight = theme === "light";
  void maxRows;
  const [isExpanded, setIsExpanded] = useState(false);
  const startLevel = Math.max(1, Math.floor(addon.startLevel || 1));
  const endLevel = Math.max(startLevel, Math.floor(addon.endLevel || startLevel));
  const midLevel = Math.floor((startLevel + endLevel) / 2);
  const rowsByLevel = new Map(rows.map((row) => [row.level, row]));
  const previewRows = [startLevel, midLevel, endLevel]
    .map((level) => rowsByLevel.get(level))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row, index, arr) => arr.findIndex((item) => item.level === row.level) === index);
  const visibleRows = isExpanded ? rows : previewRows;
  const canToggle = rows.length > previewRows.length;
  const outerClass = bare
    ? ""
    : `rounded-xl p-3 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"}`;

  return (
    <div className={outerClass}>
      {!bare && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="flex w-full items-center justify-between text-left"
        >
          <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
            {addon.name || t("progressionTableAddon.defaultName", "Tabela de balanceamento")}
          </h5>
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-sm font-semibold ${
              isLight ? "border-gray-300 bg-gray-100 text-gray-700" : "border-gray-600 bg-gray-800 text-gray-200"
            }`}
            aria-hidden="true"
          >
            {isExpanded ? "▾" : "▸"}
          </span>
        </button>
      )}
      <div
        className={`${bare ? "" : "mt-2"} overflow-auto rounded-lg ${
          isLight ? "border border-gray-300 bg-white" : "border border-gray-700"
        }`}
      >
        <table className={`w-full text-left ${bare ? "text-[13px]" : "text-xs"}`}>
          <thead className={isLight ? "bg-gray-100 text-gray-600" : "bg-gray-900 text-gray-400"}>
            <tr>
              <th className={`px-2 py-1.5 ${bare ? "text-[11px] uppercase tracking-wide font-semibold" : ""}`}>
                {t("progressionTableAddon.levelHeader", "Level")}
              </th>
              {columns.map((column) => (
                <th key={column.id} className={`px-2 py-1.5 ${bare ? "text-[11px] uppercase tracking-wide font-semibold" : ""}`}>
                  {column.name || t("progressionTableAddon.columnFallback", "Coluna")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
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
                    {column.isPercentage ? "%" : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canToggle && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className={`mt-1.5 text-xs font-medium ${
            isLight ? "text-blue-600 hover:text-blue-800" : "text-sky-300 hover:text-sky-200"
          }`}
        >
          {isExpanded
            ? t("progressionTableAddon.readOnlyShowLess", "Mostrar menos")
            : t("progressionTableAddon.readOnlyShowAll", "Mostrar todos os {count} níveis").replace(
                "{count}",
                String(rows.length)
              )}
        </button>
      )}
      {/* maxRows intentionally ignored in expanded mode to show full table */}
    </div>
  );
}
