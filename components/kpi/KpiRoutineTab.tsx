"use client";

import { useI18n } from "@/lib/i18n/provider";

export default function KpiRoutineTab() {
  const { t } = useI18n();

  const rows = [0, 1, 2, 3, 4].map((i) => ({
    day: t(`kpi.routine.rows.${i}.day`),
    time: t(`kpi.routine.rows.${i}.time`),
    task: t(`kpi.routine.rows.${i}.task`),
  }));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">{t("kpi.routine.title")}</p>
        <p className="text-sm text-gray-400">{t("kpi.routine.subtitle")}</p>
      </div>

      <div className="rounded-xl border border-gray-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700/60 bg-gray-900/80">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-500 w-24">{t("kpi.routine.dayCol")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-500 w-20">{t("kpi.routine.timeCol")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-gray-500">{t("kpi.routine.taskCol")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-gray-700/40 last:border-0 ${i % 2 === 0 ? "bg-gray-900/30" : "bg-gray-900/60"}`}
              >
                <td className="px-4 py-3 font-semibold text-gray-200 align-top">{row.day}</td>
                <td className="px-4 py-3 text-emerald-400 font-mono tabular-nums align-top">{row.time}</td>
                <td className="px-4 py-3 text-gray-300 align-top">{row.task}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 px-4 py-3">
        <p className="text-xs text-gray-500">
          {t("kpi.routine.footer")}
        </p>
      </div>
    </div>
  );
}
