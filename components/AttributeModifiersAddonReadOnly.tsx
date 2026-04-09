"use client";

import { useMemo } from "react";
import type { AttributeModifiersAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface AttributeModifiersAddonReadOnlyProps {
  addon: AttributeModifiersAddonDraft;
  theme?: "dark" | "light";
}

function formatValue(value: number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function AttributeModifiersAddonReadOnly({ addon, theme = "dark" }: AttributeModifiersAddonReadOnlyProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const isLight = theme === "light";
  const rows = addon.modifiers || [];

  const definitionsMeta = useMemo(() => {
    if (!addon.definitionsRef) return null;
    for (const project of projects) {
      for (const section of project.sections || []) {
        if (section.id !== addon.definitionsRef) continue;
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "attributeDefinitions") continue;
          return {
            label: section.title || section.id,
            keys: new Map((sectionAddon.data.attributes || []).map((item) => [item.key, item.label || item.key])),
          };
        }
      }
    }
    return null;
  }, [addon.definitionsRef, projects]);

  return (
    <div
      className={`rounded-xl p-3 ${
        isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"
      }`}
    >
      <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
        {addon.name || t("attributeModifiersAddon.defaultName", "Modificadores de Atributos")}
      </h5>
      <p className={`mt-1 text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
        {t("attributeModifiersAddon.definitionsRefLabel", "Referência de definições")}:{" "}
        {definitionsMeta?.label || addon.definitionsRef || t("attributeModifiersAddon.selectNone", "Sem referência")}
      </p>
      {rows.length === 0 ? (
        <p className={`mt-2 text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
          {t("attributeModifiersAddon.readOnlyEmpty", "Nenhum modificador configurado.")}
        </p>
      ) : (
        <div className={`mt-2 space-y-1.5 ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {rows.map((entry) => (
            <p key={entry.id} className="text-sm">
              <strong>{definitionsMeta?.keys.get(entry.attributeKey) || entry.attributeKey}</strong>
              {entry.attributeKey ? (
                <span className={`ml-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>({entry.attributeKey})</span>
              ) : null}
              : {entry.mode} {formatValue(entry.value)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

