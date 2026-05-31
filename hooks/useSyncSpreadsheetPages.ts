// hooks/useSyncSpreadsheetPages.ts
// Sincronização em lote de TODAS as páginas (seções) de um projeto vinculadas a
// uma mesma planilha do Google Sheets. Itera as seções sequencialmente para
// respeitar o rate limit da API do Google, reportando progresso página-a-página.

"use client";

import { useState, useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import { syncSectionAddons } from "@/lib/addons/syncSectionSheets";
import { getGoogleClientId } from "@/lib/googleDrivePicker";
import { getGoogleSheetsToken } from "@/lib/googleSheets";
import type { LinkedSpreadsheet } from "@/store/slices/types";

export type SyncPagesError = { sectionTitle: string; message: string };

export type SyncPagesProgress = {
  /** Id da planilha sendo sincronizada no momento (null quando ocioso). */
  spreadsheetId: string | null;
  syncing: boolean;
  /** Total de páginas vinculadas a sincronizar. */
  total: number;
  /** Quantas páginas já foram processadas. */
  done: number;
  /** Título da página sendo sincronizada agora. */
  currentTitle: string | null;
  /** Soma de campos sincronizados com sucesso em todas as páginas. */
  totalFieldsSynced: number;
  /** Erros por página (não interrompem o lote). */
  errors: SyncPagesError[];
  /** Verdadeiro quando o lote terminou (sucesso ou com erros). */
  finished: boolean;
  /** Erro fatal que impediu o lote inteiro (sem token, sem clientId, etc). */
  fatalError: string | null;
};

const IDLE: SyncPagesProgress = {
  spreadsheetId: null,
  syncing: false,
  total: 0,
  done: 0,
  currentTitle: null,
  totalFieldsSynced: 0,
  errors: [],
  finished: false,
  fatalError: null,
};

export function useSyncSpreadsheetPages(projectId: string) {
  const [progress, setProgress] = useState<SyncPagesProgress>(IDLE);

  const projects = useProjectStore((s) => s.projects);
  const setSectionAddons = useProjectStore((s) => s.setSectionAddons);

  const reset = useCallback(() => setProgress(IDLE), []);

  const sync = useCallback(
    async (spreadsheet: LinkedSpreadsheet) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        setProgress({ ...IDLE, finished: true, fatalError: "Projeto não encontrado." });
        return;
      }

      // Páginas do projeto vinculadas a esta planilha
      const pages = (project.sections ?? []).filter(
        (s) => s.linkedSpreadsheetId === spreadsheet.id,
      );

      if (pages.length === 0) {
        setProgress({ ...IDLE, spreadsheetId: spreadsheet.id, finished: true });
        return;
      }

      // Token Google (uma vez para todo o lote)
      const clientId = await getGoogleClientId();
      if (!clientId) {
        setProgress({ ...IDLE, spreadsheetId: spreadsheet.id, finished: true, fatalError: "noClientId" });
        return;
      }
      const token = await getGoogleSheetsToken(clientId);
      if (!token) {
        setProgress({ ...IDLE, spreadsheetId: spreadsheet.id, finished: true, fatalError: "noAuth" });
        return;
      }

      setProgress({
        ...IDLE,
        spreadsheetId: spreadsheet.id,
        syncing: true,
        total: pages.length,
      });

      let totalFieldsSynced = 0;
      const errors: SyncPagesError[] = [];

      // Sequencial: respeita rate limit e dá progresso página-a-página
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        setProgress((prev) => ({ ...prev, done: i, currentTitle: page.title }));
        try {
          const result = await syncSectionAddons(
            page.addons ?? [],
            spreadsheet.spreadsheetId,
            token,
            page.dataId,
            spreadsheet.columnsBySheet,
          );
          setSectionAddons(projectId, page.id, result.updatedAddons);
          totalFieldsSynced += result.totalSynced;
          // Erros por campo viram um aviso na página
          const failed = result.fields.filter((f) => !f.ok);
          if (failed.length > 0) {
            errors.push({
              sectionTitle: page.title,
              message: failed.map((f) => `${f.field}: ${f.error ?? "erro"}`).join("; "),
            });
          }
        } catch (e) {
          errors.push({
            sectionTitle: page.title,
            message: e instanceof Error ? e.message : "Erro inesperado",
          });
        }
      }

      setProgress({
        spreadsheetId: spreadsheet.id,
        syncing: false,
        total: pages.length,
        done: pages.length,
        currentTitle: null,
        totalFieldsSynced,
        errors,
        finished: true,
        fatalError: null,
      });
    },
    [projects, projectId, setSectionAddons],
  );

  return { sync, progress, reset };
}
