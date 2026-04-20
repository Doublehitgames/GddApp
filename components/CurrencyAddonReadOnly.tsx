"use client";

import type { CurrencyAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";

interface CurrencyAddonReadOnlyProps {
  addon: CurrencyAddonDraft;
  theme?: "dark" | "light";
  bare?: boolean;
}

export function CurrencyAddonReadOnly({ addon, theme = "dark", bare = false }: CurrencyAddonReadOnlyProps) {
  const { t } = useI18n();
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
    </div>
  );
}
