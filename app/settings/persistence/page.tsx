"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { useI18n } from "@/lib/i18n/provider";

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
  const lastSyncError = useProjectStore((s) => s.lastSyncError);

  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 300);
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
          {lastSyncError && <p className="text-red-300 text-sm mt-2">{t("settings.persistencePage.lastErrorLabel")}: {lastSyncError}</p>}
        </div>

        <div className="bg-gray-800 rounded-lg p-6 space-y-6 border border-gray-700">
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

          <div className="grid gap-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={persistenceConfig.syncOnBlur}
                onChange={(e) => updatePersistenceConfig({ syncOnBlur: e.target.checked })}
              />
              <span>{t("settings.persistencePage.form.syncOnBlur")}</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={persistenceConfig.syncOnVisibilityHidden}
                onChange={(e) => updatePersistenceConfig({ syncOnVisibilityHidden: e.target.checked })}
              />
              <span>{t("settings.persistencePage.form.syncOnHidden")}</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={persistenceConfig.syncOnPageHide}
                onChange={(e) => updatePersistenceConfig({ syncOnPageHide: e.target.checked })}
              />
              <span>{t("settings.persistencePage.form.syncOnPageHide")}</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={persistenceConfig.syncOnBeforeUnload}
                onChange={(e) => updatePersistenceConfig({ syncOnBeforeUnload: e.target.checked })}
              />
              <span>{t("settings.persistencePage.form.syncOnBeforeUnload")}</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              {saving ? t("settings.persistencePage.actions.saved") : t("settings.persistencePage.actions.save")}
            </button>
            <button
              onClick={() => { void flushPendingSyncs(); }}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
            >
              {t("settings.persistencePage.actions.syncNow")}
            </button>
          </div>

          <div className="pt-2 border-t border-gray-700/80">
            <h2 className="text-sm font-semibold text-gray-200 mb-2">{t("settings.persistencePage.history.title")}</h2>
            {lastSyncStatsHistory.length === 0 ? (
              <p className="text-xs text-gray-400">{t("settings.persistencePage.history.empty")}</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-auto pr-1">
                {lastSyncStatsHistory.map((entry) => (
                  <div
                    key={`${entry.projectId}-${entry.syncedAt}`}
                    className="text-xs bg-gray-900/70 border border-gray-700 rounded-md px-2 py-1.5 flex items-center justify-between gap-2"
                  >
                    <span className="text-gray-300 truncate">
                      {new Date(entry.syncedAt).toLocaleTimeString()} · {entry.projectId.slice(0, 8)}
                    </span>
                    <span className="text-gray-400 shrink-0">
                      {t("settings.persistencePage.history.delta")}: +{entry.sectionsUpserted} / -{entry.sectionsDeleted} / ={entry.sectionsUnchanged}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
