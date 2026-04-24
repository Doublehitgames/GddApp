"use client";

import { useMemo } from "react";
import type { AttributeModifiersAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface AttributeModifiersAddonReadOnlyProps {
  addon: AttributeModifiersAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

function formatValue(value: number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatOperatorValue(mode: "add" | "mult" | "set", value: number | boolean): string {
  if (typeof value === "boolean") return `= ${value ? "true" : "false"}`;
  if (mode === "mult") return `× ${formatValue(value)}`;
  if (mode === "set") return `= ${formatValue(value)}`;
  const formatted = formatValue(Math.abs(value));
  return value < 0 ? `- ${formatted}` : `+ ${formatted}`;
}

export function AttributeModifiersAddonReadOnly({ addon, theme = "dark", bare = false }: AttributeModifiersAddonReadOnlyProps) {
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

  const outerClass = bare
    ? ""
    : `rounded-xl p-3 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"}`;

  return (
    <div className={outerClass}>
      {!bare && (
        <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {addon.name || t("attributeModifiersAddon.defaultName", "Modificadores de Atributos")}
        </h5>
      )}
      <p className={`${bare ? "" : "mt-1"} text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
        {t("attributeModifiersAddon.definitionsRefLabel", "Referência de definições")}:{" "}
        {definitionsMeta?.label || addon.definitionsRef || t("attributeModifiersAddon.selectNone", "Sem referência")}
      </p>
      {rows.length === 0 ? (
        <p className={`mt-2 text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
          {t("attributeModifiersAddon.readOnlyEmpty", "Nenhum modificador configurado.")}
        </p>
      ) : (
        <div className={`mt-2 space-y-1.5 ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {rows.map((entry) => {
            const tick = entry.tickIntervalSeconds && entry.tickIntervalSeconds > 0 ? entry.tickIntervalSeconds : null;
            const duration = entry.durationSeconds && entry.durationSeconds > 0 ? entry.durationSeconds : null;
            let timingText: string | null = null;
            if (entry.temporary) {
              if (tick && duration) {
                const count = Math.floor(duration / tick);
                timingText = t(
                  "attributeModifiersAddon.timingTickDuration",
                  "a cada {tick}s durante {seconds}s (~{count} ticks)"
                )
                  .replace("{tick}", String(tick))
                  .replace("{seconds}", String(duration))
                  .replace("{count}", String(count));
              } else if (tick) {
                timingText = t("attributeModifiersAddon.timingTickOnly", "a cada {tick}s").replace(
                  "{tick}",
                  String(tick)
                );
              } else if (duration) {
                timingText = t("attributeModifiersAddon.timingDurationOnly", "durante {seconds}s").replace(
                  "{seconds}",
                  String(duration)
                );
              } else {
                timingText = t("attributeModifiersAddon.temporaryTag", "temporário");
              }
            }
            const stackingLabel = entry.stackingRule
              ? t(
                  `attributeModifiersAddon.stacking_${entry.stackingRule}`,
                  entry.stackingRule === "unique" ? "único" : entry.stackingRule === "refresh" ? "renova" : "acumula"
                )
              : null;
            const categoryBadgeClass =
              entry.category === "buff"
                ? isLight ? "bg-emerald-100 text-emerald-800" : "bg-emerald-900/40 text-emerald-300"
                : entry.category === "debuff"
                ? isLight ? "bg-rose-100 text-rose-800" : "bg-rose-900/40 text-rose-300"
                : isLight ? "bg-gray-200 text-gray-700" : "bg-gray-700/60 text-gray-300";
            const categoryLabel = entry.category
              ? t(
                  `attributeModifiersAddon.category_${entry.category}`,
                  entry.category === "buff" ? "Buff" : entry.category === "debuff" ? "Debuff" : "Neutro"
                )
              : null;
            const hasBadges =
              categoryLabel || stackingLabel || (entry.tags && entry.tags.length > 0);
            return (
              <div
                key={entry.id}
                className={`${bare ? "" : "text-sm"} rounded-lg ${
                  bare ? "" : isLight ? "bg-gray-50 px-2 py-1.5" : "bg-gray-800/40 px-2 py-1.5"
                }`}
              >
                <p>
                  <strong>{definitionsMeta?.keys.get(entry.attributeKey) || entry.attributeKey}</strong>
                  {entry.attributeKey ? (
                    <span className={`ml-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                      ({entry.attributeKey})
                    </span>
                  ) : null}
                  <span className="ml-2 font-mono">{formatOperatorValue(entry.mode, entry.value)}</span>
                </p>
                {timingText ? (
                  <p className={`mt-0.5 text-xs ${isLight ? "text-amber-700" : "text-amber-300"}`}>
                    ⏱ {timingText}
                  </p>
                ) : null}
                {hasBadges ? (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {categoryLabel ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${categoryBadgeClass}`}
                      >
                        {categoryLabel}
                      </span>
                    ) : null}
                    {stackingLabel ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          isLight ? "bg-sky-100 text-sky-800" : "bg-sky-900/40 text-sky-300"
                        }`}
                      >
                        ⟳ {stackingLabel}
                      </span>
                    ) : null}
                    {(entry.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          isLight ? "bg-gray-100 text-gray-600" : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

