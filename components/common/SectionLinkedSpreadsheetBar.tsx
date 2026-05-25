"use client";

import { useState } from "react";
import type { SyncSectionResult } from "@/lib/addons/syncSectionSheets";
import type { LinkedSpreadsheet } from "@/store/slices/types";

interface SectionLinkedSpreadsheetBarProps {
  linkedSpreadsheetId: string | undefined;
  spreadsheetRegistry: LinkedSpreadsheet[];
  onChange: (id: string | undefined) => void;
  /**
   * Quando true, exibe apenas um badge read-only com o nome da planilha ativa.
   * Útil dentro de drawers de addon, onde o seletor completo fica na página da seção.
   */
  readOnly?: boolean;
  /** Callback disparado pelo botão "Sincronizar tudo". Omitir oculta o botão. */
  onSync?: () => void;
  /** Indica que a sincronização está em andamento (exibe spinner). */
  syncing?: boolean;
  /** Resultado da última sincronização — exibido como feedback inline. */
  syncResult?: SyncSectionResult | null;
  /** Mensagem de erro da última sincronização. */
  syncError?: string | null;
}

/**
 * Seletor de planilha no nível da seção.
 *
 * - `readOnly=false` (padrão): aparece UMA vez na página da seção, acima dos addons.
 *   Exibe a planilha ativa como badge. Trocar exige clicar no lápis → selecionar → Confirmar,
 *   evitando alterações acidentais por missclick.
 * - `readOnly=true`: badge compacto para drawers de addon — mostra qual planilha está ativa.
 */
export function SectionLinkedSpreadsheetBar({
  linkedSpreadsheetId,
  spreadsheetRegistry,
  onChange,
  readOnly = false,
  onSync,
  syncing = false,
  syncResult = null,
  syncError = null,
}: SectionLinkedSpreadsheetBarProps) {
  const [editing, setEditing] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>(undefined);

  if (spreadsheetRegistry.length === 0) return null;

  const selected = linkedSpreadsheetId
    ? spreadsheetRegistry.find((s) => s.id === linkedSpreadsheetId)
    : undefined;

  /* ── Modo read-only: badge compacto para uso em drawers ── */
  if (readOnly) {
    if (!selected) return null;
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-700/25 bg-emerald-900/10 px-3 py-2">
        <span aria-hidden="true" className="text-sm">📊</span>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-emerald-200">
          {selected.name}
        </span>
        {selected.url ? (
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded border border-emerald-700/50 bg-emerald-900/30 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-800/40 hover:text-emerald-100"
            title="Abrir planilha no Google Sheets"
          >
            Abrir
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ) : null}
        <span className="shrink-0 text-[10px] text-gray-600">Alterar na página da seção</span>
      </div>
    );
  }

  /* ── Modo padrão: seletor com edit mode toggle ── */

  const handleEditStart = () => {
    setDraftId(linkedSpreadsheetId);
    setEditing(true);
  };

  const handleConfirm = () => {
    onChange(draftId);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraftId(undefined);
  };

  // Feedback da última sincronização
  const failedFields = syncResult?.fields.filter((f) => !f.ok) ?? [];
  const okCount = syncResult?.totalSynced ?? 0;

  return (
    <div className="mb-4 rounded-lg border border-emerald-700/30 bg-emerald-900/10 px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400/70">
        📊 Planilha desta seção
      </p>

      {editing ? (
        /* ── Modo edição: dropdown + Confirmar / Cancelar ── */
        <div className="flex items-center gap-2">
          <select
            autoFocus
            value={draftId ?? ""}
            onChange={(e) => setDraftId(e.target.value || undefined)}
            className="flex-1 rounded border border-emerald-600 bg-gray-900 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-500"
          >
            <option value="">Nenhuma planilha…</option>
            {spreadsheetRegistry.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-600/60 bg-emerald-700/30 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-700/50 hover:text-white"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-600/50 bg-gray-800/40 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-700/50 hover:text-white"
          >
            Cancelar
          </button>
        </div>
      ) : (
        /* ── Modo visualização: badge + ações ── */
        <div className="flex items-center gap-2">
          {selected ? (
            <span className="min-w-0 flex-1 truncate rounded border border-emerald-700/30 bg-emerald-900/20 px-2 py-1.5 text-xs font-medium text-emerald-200">
              {selected.name}
            </span>
          ) : (
            <span className="flex-1 text-xs text-gray-500 italic">
              Nenhuma planilha selecionada
            </span>
          )}

          {/* Lápis — abre modo edição */}
          <button
            type="button"
            onClick={handleEditStart}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-gray-600/50 bg-gray-800/40 px-2 py-1.5 text-[10px] font-medium text-gray-400 hover:border-emerald-700/50 hover:bg-emerald-900/20 hover:text-emerald-300"
            title="Trocar planilha"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
            </svg>
            Trocar
          </button>

          {selected?.url ? (
            <a
              href={selected.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-600/50 bg-emerald-700/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-700/35 hover:text-white"
              title="Abrir planilha no Google Sheets"
            >
              Abrir planilha
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : null}

          {onSync && linkedSpreadsheetId ? (
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-600/50 bg-blue-700/20 px-3 py-1.5 text-xs font-medium text-blue-200 hover:bg-blue-700/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              title="Sincronizar todos os campos vinculados ao Google Sheets nesta seção"
            >
              {syncing ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sincronizando…
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sincronizar tudo
                </>
              )}
            </button>
          ) : null}
        </div>
      )}

      {/* Feedback de sincronização */}
      {syncError && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-red-400">
          <span aria-hidden="true">⚠️</span>
          {syncError}
        </p>
      )}
      {!syncError && syncResult && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400">
          <span aria-hidden="true">✓</span>
          {okCount} {okCount === 1 ? "campo sincronizado" : "campos sincronizados"}
          {failedFields.length > 0 && (
            <span className="text-amber-400">
              {" "}· {failedFields.length} com erro ({failedFields.map((f) => f.field).join(", ")})
            </span>
          )}
        </p>
      )}
    </div>
  );
}
