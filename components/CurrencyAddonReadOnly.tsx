"use client";

import { useMemo } from "react";
import type { CurrencyAddonDraft, CurrencyExchangeEntry } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";

interface CurrencyAddonReadOnlyProps {
  addon: CurrencyAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

type CurrencyMeta = { code: string; displayName: string };

function formatAmount(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function CurrencyAddonReadOnly({ addon, theme = "dark", bare = false }: CurrencyAddonReadOnlyProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const isLight = theme === "light";

  const labelClass = isLight ? "text-gray-700" : "text-gray-300";
  const mutedClass = isLight ? "text-gray-600" : "text-gray-400";
  const code = addon.code || t("currencyAddon.emptyValue", "nao informado");
  const displayName = addon.displayName || t("currencyAddon.emptyValue", "nao informado");
  const kindLabel = t(`currencyAddon.kind.${addon.kind}`, addon.kind);
  const decimalsSummary =
    addon.decimals === 0
      ? t("currencyAddon.summaryDecimalsNone", "sem casas decimais")
      : `${addon.decimals} ${t("currencyAddon.summaryDecimalsSomeSuffix", "casas decimais")}`;

  const ownerSectionId = useMemo(() => {
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const a of section.addons || []) {
          if (a.type === "currency" && a.id === addon.id) return section.id;
        }
      }
    }
    return null;
  }, [projects, addon.id]);

  const currencyByRef = useMemo(() => {
    const map = new Map<string, CurrencyMeta>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "currency") continue;
          const c = sectionAddon.data.code?.trim() || sectionAddon.data.name || section.title || section.id;
          const d = sectionAddon.data.displayName?.trim() || sectionAddon.data.name || section.title || section.id;
          map.set(section.id, { code: c, displayName: d });
        }
      }
    }
    return map;
  }, [projects]);

  const relatedExchanges = useMemo(() => {
    if (!ownerSectionId) return [] as Array<{ entry: CurrencyExchangeEntry; addonName: string }>;
    const out: Array<{ entry: CurrencyExchangeEntry; addonName: string }> = [];
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "currencyExchange") continue;
          const addonName = sectionAddon.name || sectionAddon.data.name || section.title || section.id;
          for (const entry of sectionAddon.data.entries || []) {
            if (entry.fromCurrencyRef === ownerSectionId || entry.toCurrencyRef === ownerSectionId) {
              out.push({ entry, addonName });
            }
          }
        }
      }
    }
    return out;
  }, [ownerSectionId, projects]);

  const renderRefLabel = (ref: string | undefined) => {
    if (!ref) return "?";
    const meta = currencyByRef.get(ref);
    return meta ? meta.code : `↯`;
  };

  const outerClass = bare
    ? ""
    : `rounded-xl p-3 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"}`;

  return (
    <div className={outerClass}>
      {!bare && (
        <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {addon.name || t("currencyAddon.defaultName", "Currency")}
        </h5>
      )}
      <div className={`${bare ? "" : "mt-2 text-xs"} grid gap-1`}>
        <p className={labelClass}>
          {t("currencyAddon.summaryStart", "Moeda")} {code} ({displayName}),{" "}
          {t("currencyAddon.summaryTypePrefix", "tipo")} {kindLabel}, {decimalsSummary}.
        </p>
        {addon.notes ? (
          <p className={mutedClass}>{addon.notes}</p>
        ) : null}
      </div>
      {relatedExchanges.length > 0 && (
        <div className={`mt-3 rounded-lg border ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-700 bg-gray-900/60"} p-2.5`}>
          <p className={`mb-1.5 text-[10px] uppercase tracking-wide ${isLight ? "text-gray-500" : "text-gray-400"}`}>
            {t("currencyAddon.exchangesBlockLabel", "Conversões disponíveis")}
          </p>
          <ul className="space-y-1">
            {relatedExchanges.map(({ entry, addonName }, index) => {
              const arrow = entry.direction === "bidirectional" ? "⇄" : "→";
              return (
                <li
                  key={`${entry.id}-${index}`}
                  className={`flex flex-wrap items-baseline gap-1 text-xs ${isLight ? "text-gray-800" : "text-gray-200"}`}
                >
                  <span className="font-mono">{formatAmount(entry.fromAmount)}</span>
                  <strong>{renderRefLabel(entry.fromCurrencyRef)}</strong>
                  <span className={`mx-0.5 ${isLight ? "text-indigo-700" : "text-indigo-300"} font-bold`}>{arrow}</span>
                  <span className="font-mono">{formatAmount(entry.toAmount)}</span>
                  <strong>{renderRefLabel(entry.toCurrencyRef)}</strong>
                  <span className={`ml-1 text-[10px] ${isLight ? "text-gray-500" : "text-gray-500"}`}>· {addonName}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
