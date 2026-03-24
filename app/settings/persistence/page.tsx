"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";
import { ToggleSwitch } from "@/components/ToggleSwitch";

export default function PersistenceSettingsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const persistenceConfig = useProjectStore((s) => s.persistenceConfig);
  const updatePersistenceConfig = useProjectStore((s) => s.updatePersistenceConfig);
  const flushPendingSyncs = useProjectStore((s) => s.flushPendingSyncs);
  const syncStatus = useProjectStore((s) => s.syncStatus);
  const pendingSyncCount = useProjectStore((s) => s.pendingSyncCount);
  const lastSyncedAt = useProjectStore((s) => s.lastSyncedAt);
  const lastSyncStatsHistory = useProjectStore((s) => s.lastSyncStatsHistory);
  const clearSyncHistory = useProjectStore((s) => s.clearSyncHistory);
  const lastQuotaStatus = useProjectStore((s) => s.lastQuotaStatus);
  const lastSyncError = useProjectStore((s) => s.lastSyncError);
  const lastSyncFailureReason = useProjectStore((s) => s.lastSyncFailureReason);
  const cloudSyncPausedUntil = useProjectStore((s) => s.cloudSyncPausedUntil);
  const cloudSyncPaused = Boolean(
    cloudSyncPausedUntil && new Date(cloudSyncPausedUntil).getTime() > Date.now()
  );
  const noCreditsLeft = Boolean(lastQuotaStatus && lastQuotaStatus.remainingInWindow === 0);
  const syncDisabled = cloudSyncPaused || noCreditsLeft;

  const [saving, setSaving] = useState(false);

  const quotaPercent =
    lastQuotaStatus && lastQuotaStatus.limitPerHour > 0
      ? Math.min(100, Math.round((lastQuotaStatus.usedInWindow / lastQuotaStatus.limitPerHour) * 100))
      : 0;

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 300);
  };

  const formatSyncChangeSummary = (entry: (typeof lastSyncStatsHistory)[number]): string | null => {
    const sections = entry.changeSummary?.sections;
    if (!sections || sections.length === 0) return null;

    const labels: string[] = [];
    const seen = new Set<string>();
    const pushUnique = (value: string) => {
      const normalized = value.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      labels.push(value.trim());
    };

    for (const section of sections) {
      for (const facet of section.facets || []) {
        if (facet === "addons") continue;
        if (facet === "created") pushUnique(t("settings.persistencePage.history.changeFacets.created"));
        if (facet === "title") pushUnique(t("settings.persistencePage.history.changeFacets.title"));
        if (facet === "content") pushUnique(t("settings.persistencePage.history.changeFacets.content"));
        if (facet === "domainTags") pushUnique(t("settings.persistencePage.history.changeFacets.domainTags"));
        if (facet === "parent") pushUnique(t("settings.persistencePage.history.changeFacets.parent"));
        if (facet === "order") pushUnique(t("settings.persistencePage.history.changeFacets.order"));
        if (facet === "color") pushUnique(t("settings.persistencePage.history.changeFacets.color"));
      }

      for (const addon of section.addons || []) {
        const addonLabel = t("settings.persistencePage.history.changeFacets.addonLabel").replace(
          "{{name}}",
          addon.addonName || addon.addonType
        );
        pushUnique(addonLabel);
      }
    }

    if (labels.length === 0) return null;
    const maxLabels = 6;
    const visible = labels.slice(0, maxLabels);
    const extraCount = Math.max(0, labels.length - visible.length);
    const suffix = extraCount > 0
      ? ` ${t("settings.persistencePage.history.moreItems").replace("{{count}}", String(extraCount))}`
      : "";
    return `${t("settings.persistencePage.history.modifiedPrefix")}: ${visible.join(", ")}${suffix}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <button
              onClick={() => router.push("/")}
              className="text-blue-400 hover:text-blue-300 mb-2 flex items-center gap-2"
            >
              ← {t("common.back")}
            </button>
            <h1 className="text-3xl font-bold">{t("settings.persistencePage.title")}</h1>
            <p className="text-gray-400 mt-2">
              {t("settings.persistencePage.subtitle")}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg mb-6 bg-gray-800 border border-gray-700">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded-md bg-gray-900 border border-gray-700">
              {t("settings.persistencePage.statusLabel")}: {syncStatus === "syncing" ? t("settings.persistencePage.status.syncing") : syncStatus === "synced" ? t("settings.persistencePage.status.synced") : syncStatus === "error" ? t("settings.persistencePage.status.error") : t("settings.persistencePage.status.idle")}
            </span>
            <span className="px-2 py-1 rounded-md bg-gray-900 border border-gray-700">
              {t("settings.persistencePage.pendingLabel")}: {pendingSyncCount}
            </span>
            {lastSyncedAt && (
              <span className="px-2 py-1 rounded-md bg-gray-900 border border-gray-700">
                {t("settings.persistencePage.lastSyncLabel")}: {new Date(lastSyncedAt).toLocaleString()}
              </span>
            )}
          </div>
          {lastSyncError && (
            <>
              <p className="text-red-300 text-sm mt-2">{t("settings.persistencePage.lastErrorLabel")}: {lastSyncError}</p>
              {lastSyncError.includes("supabase_non_json_response") && (
                <p className="text-amber-200/90 text-xs mt-2">{t("settings.persistencePage.errorSupabaseNonJson")}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">{t("settings.persistencePage.errorHintNetwork")}</p>
            </>
          )}
          {lastSyncFailureReason && lastSyncFailureReason !== lastSyncError && (
            <p className="text-amber-300/90 text-xs mt-1">
              {t("settings.persistencePage.lastFailureReasonLabel")}: {lastSyncFailureReason}
            </p>
          )}
        </div>

        {lastQuotaStatus && (
          <div className="p-4 rounded-lg mb-6 bg-gray-800 border border-gray-700">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-200">{t("settings.persistencePage.credits.title")}</h2>
              <span className="text-sm font-semibold text-white">
                {lastQuotaStatus.remainingInWindow}/{lastQuotaStatus.limitPerHour}
              </span>
            </div>
            <div className="mt-2 h-2 rounded bg-gray-700 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  quotaPercent >= 75 ? "bg-red-500" : quotaPercent >= 50 ? "bg-amber-500" : "bg-blue-500"
                }`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-300 mt-2">
              {t("settings.persistencePage.credits.used")}: {lastQuotaStatus.usedInWindow} · {t("settings.persistencePage.credits.remaining")}: {lastQuotaStatus.remainingInWindow}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t("settings.persistencePage.credits.resetAt")}: {new Date(lastQuotaStatus.windowEndsAt).toLocaleTimeString()}
            </p>
            <p className="text-xs text-gray-400 mt-2 border-t border-gray-700 pt-2">
              {t("settings.persistencePage.credits.howItWorks")}
            </p>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6 space-y-6 border border-gray-700">
          <div className="flex items-start gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <ToggleSwitch
                checked={persistenceConfig.syncAutomatic}
                onChange={(next) => updatePersistenceConfig({ syncAutomatic: next })}
                ariaLabel={t("settings.persistencePage.form.syncAutomatic")}
              />
              <span className="font-medium">{t("settings.persistencePage.form.syncAutomatic")}</span>
            </label>
          </div>
          <p className="text-xs text-gray-400 -mt-2">{t("settings.persistencePage.form.syncAutomaticHint")}</p>

          {persistenceConfig.syncAutomatic && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-2">{t("settings.persistencePage.form.autosaveLabel")}</label>
                <input
                  type="number"
                  min={5000}
                  step={1000}
                  value={persistenceConfig.autosaveIntervalMs}
                  onChange={(e) => updatePersistenceConfig({ autosaveIntervalMs: Number(e.target.value) || 30000 })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">{t("settings.persistencePage.form.autosaveHint")}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">{t("settings.persistencePage.form.debounceLabel")}</label>
                <input
                  type="number"
                  min={300}
                  step={100}
                  value={persistenceConfig.debounceMs}
                  onChange={(e) => updatePersistenceConfig({ debounceMs: Number(e.target.value) || 1500 })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">{t("settings.persistencePage.form.debounceHint")}</p>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              {saving ? t("settings.persistencePage.actions.saved") : t("settings.persistencePage.actions.save")}
            </button>
            <button
              onClick={() => { void flushPendingSyncs(); }}
              disabled={syncDisabled}
              title={
                syncDisabled && cloudSyncPausedUntil
                  ? `${t("settings.persistencePage.syncBadge.pausedUntil")}: ${new Date(cloudSyncPausedUntil).toLocaleTimeString()}`
                  : noCreditsLeft
                    ? t("settings.persistencePage.syncBadge.pausedQuota")
                    : undefined
              }
              className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${
                syncDisabled
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed opacity-90"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {t("settings.persistencePage.actions.syncNow")}
            </button>
          </div>

          <div className="pt-2 border-t border-gray-700/80">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-gray-200">{t("settings.persistencePage.history.title")}</h2>
              {lastSyncStatsHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearSyncHistory()}
                  className="text-xs text-gray-400 hover:text-gray-200 underline"
                >
                  {t("settings.persistencePage.history.clearButton")}
                </button>
              )}
            </div>
            {lastSyncStatsHistory.length === 0 ? (
              <p className="text-xs text-gray-400">{t("settings.persistencePage.history.empty")}</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
                {lastSyncStatsHistory.map((entry) => {
                  const who = entry.syncedByDisplayName ?? entry.syncedByUserId ?? t("settings.persistencePage.history.unknownUser");
                  const changeSummaryText = formatSyncChangeSummary(entry);
                  return (
                    <div
                      key={`${entry.projectId}-${entry.syncedAt}`}
                      className="text-xs bg-gray-900/70 border border-gray-700 rounded-md px-2 py-1.5 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-gray-300 truncate">
                        {new Date(entry.syncedAt).toLocaleTimeString()} · {entry.projectId.slice(0, 8)}
                        {(entry.syncedByUserId ?? entry.syncedByDisplayName) && (
                          <span className="text-gray-500 ml-1">
                            {t("settings.persistencePage.history.syncedBy").replace("{{name}}", who)}
                          </span>
                        )}
                      </span>
                      <span className="text-gray-400 shrink-0">
                        {t("settings.persistencePage.syncBadge.lastSyncCreated")}: {entry.sectionsUpserted} · {t("settings.persistencePage.syncBadge.lastSyncDeleted")}: {entry.sectionsDeleted} · {t("settings.persistencePage.syncBadge.lastSyncUnchanged")}: {entry.sectionsUnchanged}
                      </span>
                      <span className="text-gray-500 shrink-0">
                        {t("settings.persistencePage.history.credits")}: {entry.creditsConsumed ?? 0}
                      </span>
                      {changeSummaryText && (
                        <span className="w-full text-gray-300 truncate" title={changeSummaryText}>
                          {changeSummaryText}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
