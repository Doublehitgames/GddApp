"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Project } from "@/store/projectStore";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { useI18n } from "@/lib/i18n/provider";
import { getSyncPreview, type SyncPreviewItem } from "@/lib/supabase/projectSync";

export default function HomeSyncBar() {
  const { user } = useAuthStore();
  const { locale, t } = useI18n();
  const lastQuotaStatus = useProjectStore((s) => s.lastQuotaStatus);
  const lastSyncedAt = useProjectStore((s) => s.lastSyncedAt);
  const getProject = useProjectStore((s) => s.getProject);
  const getPendingProjectIds = useProjectStore((s) => s.getPendingProjectIds);
  const projects = useProjectStore((s) => s.projects);
  const diagramsBySection = useProjectStore((s) => s.diagramsBySection);
  const pendingSyncCount = useProjectStore((s) => s.pendingSyncCount);

  const [estimatedCreditsToSync, setEstimatedCreditsToSync] = useState<number | null>(null);
  const [syncPreviewItems, setSyncPreviewItems] = useState<SyncPreviewItem[] | null>(null);
  const [showPreviewPopover, setShowPreviewPopover] = useState(false);
  const previewPopoverRef = useRef<HTMLDivElement>(null);

  const pendingSignature = useMemo(() => {
    const ids = getPendingProjectIds();
    return ids
      .map((id) => {
        const p = projects.find((pr) => pr.id === id);
        if (!p) return "";
        const diagramStamp = Object.entries(diagramsBySection)
          .filter(([key]) => key.startsWith(`${p.id}:`))
          .map(([, state]) => state?.updatedAt || "")
          .join(",");
        return `${p.id}:${(p.sections ?? []).length}:${p.updatedAt}:${diagramStamp}`;
      })
      .filter(Boolean)
      .join("|");
  }, [projects, diagramsBySection, getPendingProjectIds]);

  const refreshEstimatedCredits = useCallback(() => {
    const ids = getPendingProjectIds();
    if (ids.length === 0) {
      setEstimatedCreditsToSync(null);
      setSyncPreviewItems(null);
      return;
    }
    const toSync = ids
      .map((id) => getProject(id))
      .filter((p): p is Project => p != null);
    if (toSync.length === 0) {
      setEstimatedCreditsToSync(null);
      setSyncPreviewItems(null);
      return;
    }
    setEstimatedCreditsToSync(null);
    setSyncPreviewItems(null);
    getSyncPreview(toSync).then((result) => {
      if (result) {
        setEstimatedCreditsToSync(result.estimatedCredits);
        setSyncPreviewItems(result.items);
      }
    });
  }, [getPendingProjectIds, getProject]);

  useEffect(() => {
    if (pendingSyncCount === 0) {
      setEstimatedCreditsToSync(null);
      setSyncPreviewItems(null);
      setShowPreviewPopover(false);
      return;
    }
    setEstimatedCreditsToSync(null);
    setSyncPreviewItems(null);
    const timer = setTimeout(refreshEstimatedCredits, 600);
    return () => clearTimeout(timer);
  }, [pendingSyncCount, pendingSignature, refreshEstimatedCredits]);

  useEffect(() => {
    if (!showPreviewPopover) return;
    const onPointerDown = (e: PointerEvent) => {
      if (previewPopoverRef.current && !previewPopoverRef.current.contains(e.target as Node)) {
        setShowPreviewPopover(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [showPreviewPopover]);

  const tr = (pt: string, en: string, es: string) => {
    switch (locale) {
      case "es":
        return es;
      case "en":
        return en;
      default:
        return pt;
    }
  };

  const quotaPercent =
    lastQuotaStatus && lastQuotaStatus.limitPerHour > 0
      ? Math.min(100, Math.round((lastQuotaStatus.usedInWindow / lastQuotaStatus.limitPerHour) * 100))
      : null;

  if (!user) return null;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-700 bg-gray-900/95 backdrop-blur py-2 px-4">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{t("settings.persistencePage.syncBadge.creditsUsed")}</span>
            {lastQuotaStatus ? (
              <>
                <span className="font-medium text-gray-200">
                  {lastQuotaStatus.usedInWindow}/{lastQuotaStatus.limitPerHour}
                </span>
                <div className="w-24 h-1.5 rounded bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full transition-colors ${
                      quotaPercent !== null && quotaPercent >= 75
                        ? "bg-red-500"
                        : quotaPercent !== null && quotaPercent >= 50
                          ? "bg-amber-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${quotaPercent || 0}%` }}
                  />
                </div>
                <span className="text-gray-500">
                  {t("settings.persistencePage.syncBadge.resetsAt")} {new Date(lastQuotaStatus.windowEndsAt).toLocaleTimeString()}
                </span>
              </>
            ) : (
              <span className="text-gray-500" title={t("home.syncBar.creditsPerProjectHint")}>
                {t("home.syncBar.creditsPerProjectHint")}
              </span>
            )}
          </div>
          <span className="text-gray-500">
            {lastSyncedAt
              ? `${tr("Último sync", "Last sync", "Último sync")}: ${new Date(lastSyncedAt).toLocaleTimeString()}`
              : tr("Ainda sem sync", "No sync yet", "Sin sincronización aún")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {pendingSyncCount > 0 && (
            <div className="relative" ref={previewPopoverRef}>
              <button
                type="button"
                onClick={() => setShowPreviewPopover((v) => !v)}
                title={t("settings.persistencePage.syncBadge.previewClickHint")}
                className="text-gray-300 hover:text-white underline"
              >
                {estimatedCreditsToSync !== null
                  ? estimatedCreditsToSync === 0
                    ? t("settings.persistencePage.syncBadge.pendingNoCredits")
                    : t("settings.persistencePage.syncBadge.creditsToSyncAll").replace("{{count}}", String(estimatedCreditsToSync))
                  : tr("Calculando…", "Loading…", "Calculando…")}
              </button>
              {showPreviewPopover && (
                <div className="absolute bottom-full left-0 mb-1 rounded-lg border border-gray-600 bg-gray-900 shadow-xl max-h-48 overflow-y-auto min-w-[220px]">
                  <div className="p-2 border-b border-gray-700 text-[10px] font-semibold text-gray-300 sticky top-0 bg-gray-900">
                    {t("settings.persistencePage.syncBadge.previewTitle")}
                  </div>
                  {syncPreviewItems === null ? (
                    <div className="p-2 text-[10px] opacity-80">{tr("Calculando…", "Loading…", "Calculando…")}</div>
                  ) : syncPreviewItems.length > 0 ? (
                    <ul className="p-2 space-y-2 text-[10px]">
                      {syncPreviewItems.map((item) => (
                        <li key={item.projectId} className="space-y-1">
                          <div className="font-medium text-gray-200 truncate">{item.projectTitle}</div>
                          {item.sectionsNew.length > 0 && (
                            <div><span className="text-green-400">{t("settings.persistencePage.syncBadge.previewNew")}:</span> {item.sectionsNew.map((s) => s.title).join(", ")}</div>
                          )}
                          {item.sectionsUpdated.length > 0 && (
                            <div><span className="text-amber-400">{t("settings.persistencePage.syncBadge.previewUpdated")}:</span> {item.sectionsUpdated.map((s) => s.title).join(", ")}</div>
                          )}
                          {item.sectionsDeleted.length > 0 && (
                            <div><span className="text-red-400">{t("settings.persistencePage.syncBadge.previewDeleted")}:</span> {item.sectionsDeleted.map((s) => s.title).join(", ")}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-2 text-[10px] opacity-80">{t("settings.persistencePage.syncBadge.previewNoSectionChanges")}</div>
                  )}
                </div>
              )}
            </div>
          )}
          <Link href="/settings/persistence" className="text-gray-400 hover:text-gray-200 underline">
            {tr("Ajustes de sync", "Sync settings", "Ajustes de sync")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
