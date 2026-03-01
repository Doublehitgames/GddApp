"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";

export default function PersistenceSettingsPage() {
  const router = useRouter();
  const persistenceConfig = useProjectStore((s) => s.persistenceConfig);
  const updatePersistenceConfig = useProjectStore((s) => s.updatePersistenceConfig);
  const flushPendingSyncs = useProjectStore((s) => s.flushPendingSyncs);
  const syncStatus = useProjectStore((s) => s.syncStatus);
  const pendingSyncCount = useProjectStore((s) => s.pendingSyncCount);
  const lastSyncedAt = useProjectStore((s) => s.lastSyncedAt);
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
              ← Voltar
            </button>
            <h1 className="text-3xl font-bold">Persistência e Sync</h1>
            <p className="text-gray-400 mt-2">
              Ajuste o autosave e os gatilhos de sincronização com a nuvem.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg mb-6 bg-gray-800 border border-gray-700">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded-md bg-gray-900 border border-gray-700">
              Status: {syncStatus === "syncing" ? "Sincronizando" : syncStatus === "synced" ? "Sincronizado" : syncStatus === "error" ? "Erro" : "Aguardando"}
            </span>
            <span className="px-2 py-1 rounded-md bg-gray-900 border border-gray-700">
              Pendentes: {pendingSyncCount}
            </span>
            {lastSyncedAt && (
              <span className="px-2 py-1 rounded-md bg-gray-900 border border-gray-700">
                Último sync: {new Date(lastSyncedAt).toLocaleString()}
              </span>
            )}
          </div>
          {lastSyncError && <p className="text-red-300 text-sm mt-2">Último erro: {lastSyncError}</p>}
        </div>

        <div className="bg-gray-800 rounded-lg p-6 space-y-6 border border-gray-700">
          <div>
            <label className="block text-sm font-semibold mb-2">Debounce de edição (ms)</label>
            <input
              type="number"
              min={300}
              step={100}
              value={persistenceConfig.debounceMs}
              onChange={(e) => updatePersistenceConfig({ debounceMs: Number(e.target.value) || 1500 })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Tempo mínimo após edição para tentar sincronizar automaticamente.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Intervalo do autosave (ms)</label>
            <input
              type="number"
              min={5000}
              step={1000}
              value={persistenceConfig.autosaveIntervalMs}
              onChange={(e) => updatePersistenceConfig({ autosaveIntervalMs: Number(e.target.value) || 30000 })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Recomendado: 30000ms (30s).</p>
          </div>

          <div className="grid gap-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={persistenceConfig.syncOnBlur}
                onChange={(e) => updatePersistenceConfig({ syncOnBlur: e.target.checked })}
              />
              <span>Sincronizar ao perder foco da janela</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={persistenceConfig.syncOnVisibilityHidden}
                onChange={(e) => updatePersistenceConfig({ syncOnVisibilityHidden: e.target.checked })}
              />
              <span>Sincronizar ao trocar de aba (document hidden)</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={persistenceConfig.syncOnPageHide}
                onChange={(e) => updatePersistenceConfig({ syncOnPageHide: e.target.checked })}
              />
              <span>Sincronizar no evento pagehide</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={persistenceConfig.syncOnBeforeUnload}
                onChange={(e) => updatePersistenceConfig({ syncOnBeforeUnload: e.target.checked })}
              />
              <span>Sincronizar antes de sair da página</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              {saving ? "Salvo" : "Salvar ajustes"}
            </button>
            <button
              onClick={() => { void flushPendingSyncs(); }}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
            >
              Sincronizar agora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
