"use client";

import { useMemo } from "react";
import type { CurrencyExchangeAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectStore } from "@/store/projectStore";
import { SectionAnchorLink } from "@/components/common/SectionAnchorLink";

interface CurrencyExchangeAddonReadOnlyProps {
  addon: CurrencyExchangeAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

type CurrencyMeta = { code: string; displayName: string };

function formatAmount(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function CurrencyExchangeAddonReadOnly({
  addon,
  theme = "dark",
  bare = false,
}: CurrencyExchangeAddonReadOnlyProps) {
  const { t } = useI18n();
  const projects = useProjectStore((state) => state.projects);
  const isLight = theme === "light";

  const currencyByRef = useMemo(() => {
    const map = new Map<string, CurrencyMeta>();
    for (const project of projects) {
      for (const section of project.sections || []) {
        for (const sectionAddon of section.addons || []) {
          if (sectionAddon.type !== "currency") continue;
          const code = sectionAddon.data.code?.trim() || sectionAddon.data.name || section.title || section.id;
          const displayName =
            sectionAddon.data.displayName?.trim() || sectionAddon.data.name || section.title || section.id;
          map.set(section.id, { code, displayName });
        }
      }
    }
    return map;
  }, [projects]);

  const entries = addon.entries || [];

  const outerClass = bare
    ? ""
    : `rounded-xl p-3 ${isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"}`;

  const renderRef = (ref: string | undefined) => {
    if (!ref) {
      return <span className={isLight ? "text-rose-700" : "text-rose-300"}>?</span>;
    }
    const meta = currencyByRef.get(ref);
    if (!meta) {
      return (
        <span className={isLight ? "text-amber-700" : "text-amber-300"} title={ref}>
          {t("currencyExchangeAddon.brokenCurrency", "Moeda removida")} ↯
        </span>
      );
    }
    return (
      <SectionAnchorLink sectionId={ref} variant="inline" theme={theme}>
        <span>
          <strong>{meta.code}</strong>
          <span className={`ml-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
            ({meta.displayName})
          </span>
        </span>
      </SectionAnchorLink>
    );
  };

  return (
    <div className={outerClass}>
      {!bare && (
        <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {addon.name || t("currencyExchangeAddon.defaultName", "Currency Exchange")}
        </h5>
      )}
      {entries.length === 0 ? (
        <p className={`${bare ? "" : "mt-2"} text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
          {t("currencyExchangeAddon.readOnlyEmpty", "Nenhuma conversão configurada.")}
        </p>
      ) : (
        <div className={`${bare ? "" : "mt-2"} space-y-1.5 ${isLight ? "text-gray-900" : "text-gray-200"}`}>
          {entries.map((entry) => {
            const arrow = entry.direction === "bidirectional" ? "⇄" : "→";
            return (
              <div key={entry.id} className={bare ? "" : "text-sm"}>
                <p className="flex flex-wrap items-baseline gap-1">
                  <span className="font-mono">{formatAmount(entry.fromAmount)}</span>
                  {renderRef(entry.fromCurrencyRef)}
                  <span className={`mx-1 font-bold ${isLight ? "text-indigo-700" : "text-indigo-300"}`}>
                    {arrow}
                  </span>
                  <span className="font-mono">{formatAmount(entry.toAmount)}</span>
                  {renderRef(entry.toCurrencyRef)}
                </p>
                {entry.notes ? (
                  <p className={`text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
                    {entry.notes}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
