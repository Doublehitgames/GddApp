"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Project } from "@/store/projectStore";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { useI18n } from "@/lib/i18n/provider";
import { getSyncPreview, type SyncPreviewItem } from "@/lib/supabase/projectSync";

export default function ProjectSyncFooter() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { locale, t } = useI18n();
  const projectId = useMemo(() => {
    const m = pathname?.match(/^\/projects\/([^/]+)/);
    return m ? m[1] : null;
  }, [pathname]);

  const lastQuotaStatus = useProjectStore((s) => s.lastQuotaStatus);
  const lastSyncedAt = useProjectStore((s) => s.lastSyncedAt);
  const lastSyncError = useProjectStore((s) => s.lastSyncError);
  const syncStatus = useProjectStore((s) => s.syncStatus);
  const cloudSyncPausedUntil = useProjectStore((s) => s.cloudSyncPausedUntil);
  const getProject = useProjectStore((s) => s.getProject);
  const getPendingProjectIds = useProjectStore((s) => s.getPendingProjectIds);
  const pendingSyncCount = useProjectStore((s) => s.pendingSyncCount);
  const syncProjectToSupabase = useProjectStore((s) => s.syncProjectToSupabase);
  const discardPendingChangesForProject = useProjectStore((s) => s.discardPendingChangesForProject);
  const refreshQuotaStatus = useProjectStore((s) => s.refreshQuotaStatus);
  const projects = useProjectStore((s) => s.projects);

  const [estimatedCreditsToSync, setEstimatedCreditsToSync] = useState<number | null>(null);
  const [syncPreviewItems, setSyncPreviewItems] = useState<SyncPreviewItem[] | null>(null);
  const [showPreviewPopover, setShowPreviewPopover] = useState(false);
  const [discardingChanges, setDiscardingChanges] = useState(false);
  const [discardFeedback, setDiscardFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const previewPopoverRef = useRef<HTMLDivElement>(null);

  const project = projectId ? getProject(projectId as import("@/store/projectStore").UUID) : null;
  const isDirty = projectId ? getPendingProjectIds().includes(projectId) : false;
  const pendingSignature = useMemo(() => {
    if (!project || !projectId) return "";
    return `${projectId}:${(project.sections ?? []).length}:${project.updatedAt}`;
  }, [projectId, project, projects]);

  const cloudSyncPaused = Boolean(
    cloudSyncPausedUntil && new Date(cloudSyncPausedUntil).getTime() > Date.now()
  );
  const noCreditsLeft = Boolean(lastQuotaStatus && lastQuotaStatus.remainingInWindow === 0);
  const isSyncing = syncStatus === "syncing";
  const syncDisabled = isSyncing || cloudSyncPaused || noCreditsLeft || discardingChanges;

  const refreshEstimatedCredits = useCallback(() => {
    if (!projectId || !project) {
      setEstimatedCreditsToSync(null);
      setSyncPreviewItems(null);
      return;
    }
    setEstimatedCreditsToSync(null);
    setSyncPreviewItems(null);
    getSyncPreview([project]).then((result) => {
      if (result) {
        setEstimatedCreditsToSync(result.estimatedCredits);
        setSyncPreviewItems(result.items);
      }
    });
  }, [projectId, project]);

  // Cota é por projeto: buscar ao montar e ao voltar à aba
  useEffect(() => {
    if (!projectId) return;
    void refreshQuotaStatus(projectId);
  }, [projectId, refreshQuotaStatus]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && projectId) void refreshQuotaStatus(projectId);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [projectId, refreshQuotaStatus]);

  useEffect(() => {
    if (!isDirty || !project) {
      setEstimatedCreditsToSync(null);
      setSyncPreviewItems(null);
      setShowPreviewPopover(false);
      return;
    }
    setEstimatedCreditsToSync(null);
    setSyncPreviewItems(null);
    const timer = setTimeout(refreshEstimatedCredits, 600);
    return () => clearTimeout(timer);
  }, [isDirty, project, pendingSignature, refreshEstimatedCredits]);

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

  const handleDiscardPendingChanges = useCallback(async () => {
    if (!projectId || !isDirty || discardingChanges || isSyncing) return;

    const confirmed = window.confirm(t("settings.persistencePage.syncBadge.discardConfirmMessage"));
    if (!confirmed) return;

    setDiscardingChanges(true);
    setDiscardFeedback(null);
    setShowPreviewPopover(false);

    const { error } = await discardPendingChangesForProject(projectId);
    if (error) {
      const key =
        error === "unauthenticated"
          ? "settings.persistencePage.syncBadge.discardErrorUnauthenticated"
          : error === "sync_in_progress"
            ? "settings.persistencePage.syncBadge.discardErrorSyncing"
            : error === "project_not_found_in_cloud"
              ? "settings.persistencePage.syncBadge.discardErrorCloudMissing"
              : "settings.persistencePage.syncBadge.discardErrorGeneric";
      setDiscardFeedback({ type: "error", message: t(key) });
      setDiscardingChanges(false);
      return;
    }

    setEstimatedCreditsToSync(null);
    setSyncPreviewItems(null);
    setDiscardFeedback({ type: "success", message: t("settings.persistencePage.syncBadge.discardSuccess") });
    setDiscardingChanges(false);
  }, [projectId, isDirty, discardingChanges, isSyncing, t, discardPendingChangesForProject]);

  const quotaPercent =
    lastQuotaStatus && lastQuotaStatus.limitPerHour > 0
      ? Math.min(100, Math.round((lastQuotaStatus.usedInWindow / lastQuotaStatus.limitPerHour) * 100))
      : null;

  const isViewRoute = /^\/projects\/[^/]+\/view(?:\/|$)/.test(pathname || "");
  const isMindMapRoute = /^\/projects\/[^/]+\/mindmap(?:\/|$)/.test(pathname || "");
  if (!user || !projectId || isViewRoute || isMindMapRoute) return null;

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 w-screen border-t border-gray-700 bg-gray-900/95 px-4 py-2 backdrop-blur"
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">{t("settings.persistencePage.syncBadge.creditsUsed")}</span>
            <span className="font-medium text-gray-200">
              {lastQuotaStatus ? `${lastQuotaStatus.usedInWindow}/${lastQuotaStatus.limitPerHour}` : "—"}
            </span>
          </div>
          {lastQuotaStatus && (
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
          )}
          <span className="text-gray-500">
            {t("settings.persistencePage.syncBadge.resetsAt")} {lastQuotaStatus ? new Date(lastQuotaStatus.windowEndsAt).toLocaleTimeString() : "—"}
          </span>
          <span className="text-gray-500">
            {lastSyncedAt
              ? `${tr("Último sync", "Last sync", "Último sync")}: ${new Date(lastSyncedAt).toLocaleTimeString()}`
              : tr("Ainda sem sync", "No sync yet", "Sin sincronización aún")}
          </span>
          {lastSyncError && (
            <span className="text-amber-400 font-medium" title={lastSyncError}>
              {lastSyncError}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {discardFeedback && (
            <span className={discardFeedback.type === "error" ? "text-red-300" : "text-emerald-300"}>
              {discardFeedback.message}
            </span>
          )}
          {isDirty && (
            <div className="relative" ref={previewPopoverRef}>
              <button
                type="button"
                onClick={() => setShowPreviewPopover((v) => !v)}
                title={t("settings.persistencePage.syncBadge.previewClickHint")}
                className="text-gray-300 hover:text-white underline"
              >
                {estimatedCreditsToSync !== null
                  ? t("settings.persistencePage.syncBadge.creditsToSyncThis").replace("{{count}}", String(estimatedCreditsToSync))
                  : tr("Calculando…", "Loading…", "Calculando…")}
              </button>
              {showPreviewPopover && (
                <div className="absolute bottom-full left-0 mb-1 rounded-lg border border-gray-600 bg-gray-900 shadow-xl max-h-48 overflow-y-auto min-w-[220px]">
                  <div className="p-2 border-b border-gray-700 text-[10px] font-semibold text-gray-300 sticky top-0 bg-gray-900">
                    {t("settings.persistencePage.syncBadge.previewTitle")}
                  </div>
                  {syncPreviewItems && syncPreviewItems.length > 0 ? (
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
                    <div className="p-2 text-[10px] opacity-80">{tr("Calculando…", "Loading…", "Calculando…")}</div>
                  )}
                </div>
              )}
            </div>
          )}
          {isDirty && (
            <button
              type="button"
              onClick={() => void handleDiscardPendingChanges()}
              disabled={discardingChanges || isSyncing}
              title={t("settings.persistencePage.syncBadge.discardButtonHint")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                discardingChanges || isSyncing
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-red-700 hover:bg-red-600 text-white"
              }`}
            >
              {discardingChanges
                ? t("settings.persistencePage.syncBadge.discarding")
                : t("settings.persistencePage.syncBadge.discardButton")}
            </button>
          )}
          <button
            onClick={() => projectId && void syncProjectToSupabase(projectId)}
            disabled={syncDisabled}
            title={
              isSyncing
                ? tr("Sincronizando…", "Syncing…", "Sincronizando…")
                : syncDisabled && cloudSyncPausedUntil
                  ? `${t("settings.persistencePage.syncBadge.pausedUntil")}: ${new Date(cloudSyncPausedUntil).toLocaleTimeString()}`
                  : noCreditsLeft
                    ? t("settings.persistencePage.syncBadge.pausedQuota")
                    : undefined
            }
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              syncDisabled
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            {isSyncing
              ? tr("Sincronizando…", "Syncing…", "Sincronizando…")
              : tr("Sincronizar este projeto", "Sync this project", "Sincronizar este proyecto")}
          </button>
          <Link href="/settings/persistence" className="text-gray-400 hover:text-gray-200 underline">
            {tr("Ajustes", "Settings", "Ajustes")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
