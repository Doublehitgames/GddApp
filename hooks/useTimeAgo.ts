"use client";

import { useI18n } from "@/lib/i18n/provider";

/** "há 2 dias", "ontem", "agora há pouco" — a partir de uma data ISO. */
export function useTimeAgo() {
  const { t } = useI18n();
  return (dateStr: string): string => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diffMs / 60_000);
    const hours = Math.floor(diffMs / 3_600_000);
    const days  = Math.floor(diffMs / 86_400_000);
    if (mins  < 1)   return t("activityLog.timeJustNow");
    if (mins  < 60)  return t("activityLog.timeMinutes").replace("{n}", String(mins));
    if (hours < 24)  return t("activityLog.timeHours").replace("{n}", String(hours));
    if (days  === 1) return t("activityLog.timeYesterday");
    if (days  < 7)   return t("activityLog.timeDays").replace("{n}", String(days));
    if (days  < 30)  return t("activityLog.timeWeeks").replace("{n}", String(Math.floor(days / 7)));
    if (days  < 365) return t("activityLog.timeMonths").replace("{n}", String(Math.floor(days / 30)));
    return t("activityLog.timeYears").replace("{n}", String(Math.floor(days / 365)));
  };
}
