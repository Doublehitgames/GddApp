"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Project } from "@/store/projectStore";
import { useProjectStore } from "@/store/projectStore";
import { useAuthStore } from "@/store/authStore";
import { useI18n } from "@/lib/i18n/provider";
import { getSyncPreview, type SyncPreviewItem } from "@/lib/supabase/projectSync";

const BADGE_UI_KEY = "gdd_sync_badge_ui_v1";

type BadgeUIState = {
  compact: boolean;
  x: number;
  y: number;
};

function getInitialBadgeUIState(): BadgeUIState {
  if (typeof window === "undefined") {
    return { compact: true, x: 0, y: 0 };
  }

  const defaultX = Math.max(16, window.innerWidth - 300);
  const defaultY = Math.max(16, window.innerHeight - 120);

  try {
    const raw = localStorage.getItem(BADGE_UI_KEY);
    if (!raw) {
      return { compact: true, x: defaultX, y: defaultY };
    }

    const parsed = JSON.parse(raw) as Partial<BadgeUIState>;
    return {
      compact: parsed.compact ?? true,
      x: typeof parsed.x === "number" ? parsed.x : defaultX,
      y: typeof parsed.y === "number" ? parsed.y : defaultY,
    };
  } catch {
    return { compact: true, x: defaultX, y: defaultY };
  }
}

export default function SyncStatusBadge() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { locale, t } = useI18n();
  const syncStatus = useProjectStore((s) => s.syncStatus);
  const cloudSyncPausedUntil = useProjectStore((s) => s.cloudSyncPausedUntil);
  const cloudSyncPauseReason = useProjectStore((s) => s.cloudSyncPauseReason);
  const pendingSyncCount = useProjectStore((s) => s.pendingSyncCount);
  const lastSyncedAt = useProjectStore((s) => s.lastSyncedAt);
  const lastQuotaStatus = useProjectStore((s) => s.lastQuotaStatus);
  const flushPendingSyncs = useProjectStore((s) => s.flushPendingSyncs);
  const projects = useProjectStore((s) => s.projects);
  const getPendingProjectIds = useProjectStore((s) => s.getPendingProjectIds);
  const getProject = useProjectStore((s) => s.getProject);
  const [estimatedCreditsToSync, setEstimatedCreditsToSync] = useState<number | null>(null);
  const [syncPreviewItems, setSyncPreviewItems] = useState<SyncPreviewItem[] | null>(null);
  const [showPreviewPopover, setShowPreviewPopover] = useState(false);
  const previewPopoverRef = useRef<HTMLDivElement>(null);

  // Assinatura do conteúdo dos projetos pendentes: quando mudar (ex.: novas seções), re-fetch da estimativa
  const pendingSignature = useMemo(() => {
    const ids = getPendingProjectIds();
    return ids
      .map((id) => {
        const p = projects.find((pr) => pr.id === id);
        return p ? `${p.id}:${(p.sections ?? []).length}:${p.updatedAt}` : "";
      })
      .filter(Boolean)
      .join("|");
  }, [projects, getPendingProjectIds]);
  const cloudSyncPaused = Boolean(
    cloudSyncPausedUntil && new Date(cloudSyncPausedUntil).getTime() > Date.now()
  );
  const noCreditsLeft = Boolean(lastQuotaStatus && lastQuotaStatus.remainingInWindow === 0);
  const syncDisabled = cloudSyncPaused || noCreditsLeft;

  const [compact, setCompact] = useState(() => getInitialBadgeUIState().compact);
  const [position, setPosition] = useState(() => {
    const initialState = getInitialBadgeUIState();
    return { x: initialState.x, y: initialState.y };
  });

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        BADGE_UI_KEY,
        JSON.stringify({ compact, x: position.x, y: position.y } satisfies BadgeUIState)
      );
    } catch {}
  }, [compact, position]);

  const refreshEstimatedCredits = useCallback(() => {
    const ids = getPendingProjectIds();
    if (ids.length === 0) {
      setEstimatedCreditsToSync(null);
      setSyncPreviewItems(null);
      return;
    }
    const projects = ids
      .map((id) => getProject(id))
      .filter((p): p is Project => p != null);
    if (projects.length === 0) {
      setEstimatedCreditsToSync(null);
      setSyncPreviewItems(null);
      return;
    }
    setEstimatedCreditsToSync(null);
    setSyncPreviewItems(null);
    getSyncPreview(projects).then((result) => {
      if (result) {
        setEstimatedCreditsToSync(result.estimatedCredits);
        setSyncPreviewItems(result.items);
      }
    });
  }, [getPendingProjectIds, getProject]);

  useEffect(() => {
    if (compact || pendingSyncCount === 0) {
      setEstimatedCreditsToSync(null);
      setSyncPreviewItems(null);
      setShowPreviewPopover(false);
      return;
    }
    // Ao mudar o conteúdo (ex.: deletar seção), zera a estimativa na hora para não parecer que "continua somando"
    setEstimatedCreditsToSync(null);
    setSyncPreviewItems(null);
    const timer = setTimeout(() => {
      refreshEstimatedCredits();
    }, 600);
    return () => clearTimeout(timer);
  }, [compact, pendingSyncCount, pendingSignature, refreshEstimatedCredits]);

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

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!draggingRef.current) return;
      const nextX = Math.max(8, Math.min(window.innerWidth - 56, event.clientX - dragOffsetRef.current.x));
      const nextY = Math.max(8, Math.min(window.innerHeight - 56, event.clientY - dragOffsetRef.current.y));
      setPosition({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const startDrag = (event: React.MouseEvent<HTMLButtonElement>) => {
    draggingRef.current = true;
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  };

  const isProjectViewRoute = /^\/projects\/[^/]+\/view(?:\/|$)/.test(pathname || "");
  const isPublicShareRoute = /^\/public\/[^/]+\/(view|mindmap)(?:\/|$)/.test(pathname || "");

  if (!user) return null;
  if (pathname?.includes("/mindmap") || isProjectViewRoute || isPublicShareRoute) return null;

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

  const statusText = cloudSyncPaused
    ? cloudSyncPauseReason === "quota"
      ? t("settings.persistencePage.syncBadge.pausedQuota")
      : cloudSyncPauseReason === "failures"
        ? t("settings.persistencePage.syncBadge.pausedFailures")
        : cloudSyncPauseReason === "rate_limit"
          ? t("settings.persistencePage.syncBadge.pausedRateLimit")
          : t("settings.persistencePage.syncBadge.pausedGeneric")
    : syncStatus === "syncing"
      ? t("settings.persistencePage.syncBadge.statusSyncing")
      : syncStatus === "synced"
        ? t("settings.persistencePage.syncBadge.statusSynced")
        : syncStatus === "error"
          ? t("settings.persistencePage.syncBadge.statusError")
          : t("settings.persistencePage.syncBadge.statusWaiting");

  const statusClass =
    cloudSyncPaused
      ? "border-amber-700 bg-amber-950/70 text-amber-200"
      : syncStatus === "syncing"
      ? "border-blue-700 bg-blue-950/70 text-blue-200"
      : syncStatus === "synced"
        ? "border-green-700 bg-green-950/70 text-green-200"
        : syncStatus === "error"
          ? "border-red-700 bg-red-950/70 text-red-200"
          : "border-gray-700 bg-gray-900/80 text-gray-200";

      const quotaPercent =
        lastQuotaStatus && lastQuotaStatus.limitPerHour > 0
          ? Math.min(100, Math.round((lastQuotaStatus.usedInWindow / lastQuotaStatus.limitPerHour) * 100))
          : null;

  return (
      <div className="fixed z-50" style={{ left: position.x, top: position.y }}>
        <div className={`rounded-xl border shadow-xl shadow-black/30 backdrop-blur ${compact ? "px-2 py-2" : "px-3 py-2 min-w-[280px]"} ${statusClass}`}>
          <div className="flex items-center justify-between gap-2">
            <button
              onMouseDown={startDrag}
              title={tr("Arraste para reposicionar", "Drag to reposition", "Arrastra para reposicionar")}
              className="text-[10px] px-1.5 py-1 rounded bg-black/20 hover:bg-black/30 transition-colors cursor-grab active:cursor-grabbing"
            >
              ⠿
            </button>

            <span className="text-xs font-semibold whitespace-nowrap">☁️ {statusText}</span>

            <button
              onClick={() => setCompact((prev) => !prev)}
              className="text-[10px] px-1.5 py-1 rounded bg-black/20 hover:bg-black/30 transition-colors"
              title={compact ? tr("Expandir", "Expand", "Expandir") : tr("Compactar", "Compact", "Compactar")}
            >
              {compact ? "▢" : "—"}
            </button>
          </div>

          {compact ? (
            <>
              {lastQuotaStatus && (
                <div className="mt-1 text-[10px] opacity-90">
                  {t("settings.persistencePage.syncBadge.creditsUsed")}: {lastQuotaStatus.usedInWindow}/{lastQuotaStatus.limitPerHour}
                </div>
              )}
              <div className="mt-0.5 text-[10px] opacity-80">
                {lastSyncedAt
                  ? `${tr("Último", "Last", "Última")}: ${new Date(lastSyncedAt).toLocaleTimeString()}`
                  : tr("Ainda sem sync", "No sync yet", "Sin sincronización aún")}
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="opacity-90">{t("settings.persistencePage.syncBadge.creditsUsed")}</span>
                <span className="font-medium">
                  {lastQuotaStatus ? `${lastQuotaStatus.usedInWindow}/${lastQuotaStatus.limitPerHour}` : "—"}
                </span>
              </div>
              {lastQuotaStatus && (
                <div className="mt-1 h-1.5 rounded bg-gray-800 overflow-hidden">
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
              <div className="mt-1.5 text-[10px] opacity-80">
                {lastSyncedAt
                  ? `${tr("Último sync", "Last sync", "Último sync")}: ${new Date(lastSyncedAt).toLocaleTimeString()}`
                  : tr("Ainda sem sync", "No sync yet", "Sin sincronización aún")}
              </div>
              {lastQuotaStatus && (
                <div className="mt-0.5 text-[10px] opacity-75">
                  {t("settings.persistencePage.syncBadge.resetsAt")} {new Date(lastQuotaStatus.windowEndsAt).toLocaleTimeString()}
                </div>
              )}
              {pendingSyncCount > 0 && (
                <div className="mt-2 relative" ref={previewPopoverRef}>
                  <button
                    type="button"
                    onClick={() => setShowPreviewPopover((v) => !v)}
                    title={t("settings.persistencePage.syncBadge.previewClickHint")}
                    className="text-[10px] opacity-90 hover:opacity-100 underline cursor-pointer text-left w-full rounded px-1 -mx-1 py-0.5"
                  >
                    {estimatedCreditsToSync !== null
                      ? t("settings.persistencePage.syncBadge.creditsToSyncAll").replace("{{count}}", String(estimatedCreditsToSync))
                      : tr("Calculando créditos…", "Calculating credits…", "Calculando créditos…")}
                  </button>
                  {showPreviewPopover && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-[60] rounded-lg border border-gray-600 bg-gray-900 shadow-xl max-h-[240px] overflow-y-auto min-w-[200px]">
                      <div className="p-2 border-b border-gray-700 text-[10px] font-semibold text-gray-300 sticky top-0 bg-gray-900">
                        {t("settings.persistencePage.syncBadge.previewTitle")}
                      </div>
                      {syncPreviewItems && syncPreviewItems.length > 0 ? (
                      <ul className="p-2 space-y-3 text-[10px]">
                        {syncPreviewItems.map((item) => (
                          <li key={item.projectId} className="space-y-1.5">
                            <div className="font-medium text-gray-200 truncate" title={item.projectTitle}>
                              {item.projectTitle}
                            </div>
                            {item.sectionsNew.length > 0 && (
                              <div>
                                <span className="text-green-400">{t("settings.persistencePage.syncBadge.previewNew")}:</span>{" "}
                                {item.sectionsNew.map((s) => s.title).join(", ")}
                              </div>
                            )}
                            {item.sectionsUpdated.length > 0 && (
                              <div>
                                <span className="text-amber-400">{t("settings.persistencePage.syncBadge.previewUpdated")}:</span>{" "}
                                {item.sectionsUpdated.map((s) => s.title).join(", ")}
                              </div>
                            )}
                            {item.sectionsDeleted.length > 0 && (
                              <div>
                                <span className="text-red-400">{t("settings.persistencePage.syncBadge.previewDeleted")}:</span>{" "}
                                {item.sectionsDeleted.map((s) => s.title).join(", ")}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                      ) : (
                        <div className="p-2 text-[10px] opacity-80">
                          {tr("Calculando…", "Loading…", "Calculando…")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    void flushPendingSyncs();
                  }}
                  disabled={syncDisabled}
                  title={
                    syncDisabled && cloudSyncPausedUntil
                      ? `${t("settings.persistencePage.syncBadge.pausedUntil")}: ${new Date(cloudSyncPausedUntil).toLocaleTimeString()}`
                      : noCreditsLeft
                        ? t("settings.persistencePage.syncBadge.pausedQuota")
                        : undefined
                  }
                  className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                    syncDisabled
                      ? "bg-gray-600 text-gray-400 cursor-not-allowed opacity-80"
                      : "bg-blue-700 hover:bg-blue-600 text-white"
                  }`}
                >
                  {tr("Sincronizar", "Sync", "Sincronizar")}
                </button>
                <Link href="/settings/persistence" className="text-[11px] underline hover:opacity-90">
                  {tr("Ajustes", "Settings", "Ajustes")}
                </Link>
              </div>
            </>
          )}
        </div>
    </div>
  );
}
