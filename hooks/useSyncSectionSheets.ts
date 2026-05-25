// hooks/useSyncSectionSheets.ts
// Hook de sincronização em lote dos campos Google Sheets de uma seção inteira.

"use client";

import { useState, useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import { syncSectionAddons, type SyncSectionResult } from "@/lib/addons/syncSectionSheets";
import { getGoogleClientId } from "@/lib/googleDrivePicker";
import { getGoogleSheetsToken } from "@/lib/googleSheets";

export function useSyncSectionSheets(projectId: string, sectionId: string) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncSectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projects = useProjectStore((s) => s.projects);
  const setSectionAddons = useProjectStore((s) => s.setSectionAddons);

  const sync = useCallback(async () => {
    setError(null);
    setResult(null);

    // ── Resolve projeto e seção ────────────────────────────────────────────────
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      setError("Projeto não encontrado.");
      return;
    }

    const section = project.sections?.find((s) => s.id === sectionId);
    if (!section) {
      setError("Seção não encontrada.");
      return;
    }

    // ── Verifica planilha vinculada ───────────────────────────────────────────
    const { linkedSpreadsheetId } = section;
    if (!linkedSpreadsheetId) {
      setError("Nenhuma planilha vinculada a esta seção. Selecione uma planilha antes de sincronizar.");
      return;
    }

    const registryEntry = (project.linkedSpreadsheets ?? []).find((s) => s.id === linkedSpreadsheetId);
    if (!registryEntry) {
      setError("Planilha vinculada não encontrada no registro do projeto.");
      return;
    }

    // ── Obtém token Google ────────────────────────────────────────────────────
    const clientId = await getGoogleClientId();
    if (!clientId) {
      setError("Google Client ID não configurado.");
      return;
    }

    const token = await getGoogleSheetsToken(clientId);
    if (!token) {
      setError("Não foi possível obter autorização do Google.");
      return;
    }

    // ── Executa sincronização em lote ─────────────────────────────────────────
    setSyncing(true);
    try {
      const addons = section.addons ?? [];
      const syncResult = await syncSectionAddons(addons, registryEntry.spreadsheetId, token);
      setSectionAddons(projectId, sectionId, syncResult.updatedAddons);
      setResult(syncResult);
    } catch (e) {
      setError("Erro inesperado durante a sincronização.");
      console.error("[useSyncSectionSheets]", e);
    } finally {
      setSyncing(false);
    }
  }, [projects, projectId, sectionId, setSectionAddons]);

  return { sync, syncing, result, error };
}
