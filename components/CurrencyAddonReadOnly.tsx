"use client";

import type { CurrencyAddonDraft } from "@/lib/addons/types";
import { useI18n } from "@/lib/i18n/provider";

interface CurrencyAddonReadOnlyProps {
  addon: CurrencyAddonDraft;
  theme?: "dark" | "light";
}

export function CurrencyAddonReadOnly({ addon, theme = "dark" }: CurrencyAddonReadOnlyProps) {
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

  return (
    <div
      className={`mt-3 rounded-xl p-3 ${
        isLight ? "border border-gray-300 bg-white" : "border border-gray-700 bg-gray-900/40"
      }`}
    >
      <h5 className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-gray-200"}`}>
        {addon.name || t("currencyAddon.defaultName", "Currency")}
      </h5>
      <div className="mt-2 grid gap-2 text-xs">
        <p className={labelClass}>
          {t("currencyAddon.summaryStart", "Moeda")} {code} ({displayName}),{" "}
          {t("currencyAddon.summaryTypePrefix", "tipo")} {kindLabel}, {decimalsSummary}.
        </p>
        <p className={mutedClass}>
          <strong>{t("currencyAddon.notesLabel", "Observacoes")}:</strong>{" "}
          {addon.notes || t("currencyAddon.none", "nenhuma")}
        </p>
      </div>
    </div>
  );
}
