"use client";

import { useI18n } from "@/lib/i18n/provider";

export default function KpiQuestionsTab() {
  const { t } = useI18n();

  const retentionQAs = [0, 1, 2, 3].map((i) => ({
    q: t(`kpi.questions.retention.${i}.q`),
    a: t(`kpi.questions.retention.${i}.a`),
  }));

  const experimentQAs = [0, 1, 2, 3].map((i) => ({
    q: t(`kpi.questions.experiments.${i}.q`),
    a: t(`kpi.questions.experiments.${i}.a`),
  }));

  return (
    <div className="space-y-6">
      {/* Info box */}
      <div className="rounded-xl border border-sky-700/50 bg-sky-950/30 px-4 py-3">
        <p className="text-sm text-sky-200 font-medium mb-1">{t("kpi.questions.whyTitle")}</p>
        <p className="text-sm text-sky-300/80">
          {t("kpi.questions.whyText")}
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-4">{t("kpi.questions.retentionTitle")}</p>
          <div className="space-y-4">
            {retentionQAs.map((item, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-gray-200">{item.q}</p>
                <p className="mt-1 text-sm text-gray-400 pl-3 border-l-2 border-gray-700">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-700/60 bg-gray-900/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400 mb-4">{t("kpi.questions.experimentsTitle")}</p>
          <div className="space-y-4">
            {experimentQAs.map((item, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-gray-200">{item.q}</p>
                <p className="mt-1 text-sm text-gray-400 pl-3 border-l-2 border-gray-700">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 px-4 py-3">
        <p className="text-xs text-gray-500">
          {t("kpi.questions.footer")}
        </p>
      </div>
    </div>
  );
}
