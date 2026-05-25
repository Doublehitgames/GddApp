"use client";

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
}

/**
 * Seletor de planilha no nível da seção.
 *
 * - `readOnly=false` (padrão): seletor completo — aparece UMA vez na página da seção,
 *   acima da lista de addons.
 * - `readOnly=true`: badge compacto — usado dentro dos drawers de addon para indicar
 *   qual planilha está ativa sem duplicar o controle de edição.
 */
export function SectionLinkedSpreadsheetBar({
  linkedSpreadsheetId,
  spreadsheetRegistry,
  onChange,
  readOnly = false,
}: SectionLinkedSpreadsheetBarProps) {
  if (spreadsheetRegistry.length === 0) return null;

  const selected = linkedSpreadsheetId
    ? spreadsheetRegistry.find((s) => s.id === linkedSpreadsheetId)
    : undefined;

  /* ── Modo read-only: badge compacto para uso em drawers ── */
  if (readOnly) {
    if (!selected) return null;
    return (
      <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-emerald-700/25 bg-emerald-900/10 px-3 py-1.5 text-[11px] text-emerald-300/80">
        <span aria-hidden="true">📊</span>
        <span className="font-medium text-emerald-200">{selected.name}</span>
        {selected.url ? (
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-0.5 text-emerald-400 hover:text-emerald-200"
            title="Abrir planilha no Google Sheets"
          >
            ↗
          </a>
        ) : null}
        <span className="ml-auto text-[10px] text-gray-500">Alterar na página da seção</span>
      </div>
    );
  }

  /* ── Modo padrão: seletor completo ── */
  return (
    <div className="mb-4 rounded-lg border border-emerald-700/30 bg-emerald-900/10 px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400/70">
        📊 Planilha desta seção
      </p>
      <div className="flex items-center gap-2">
        <select
          value={linkedSpreadsheetId ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-600"
        >
          <option value="">Nenhuma planilha selecionada…</option>
          {spreadsheetRegistry.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {selected?.url ? (
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-xs text-emerald-300 hover:text-emerald-200"
            title="Abrir planilha no Google Sheets"
          >
            ↗
          </a>
        ) : null}
      </div>
      {!linkedSpreadsheetId && (
        <p className="mt-1.5 text-[10px] text-gray-500">
          Selecione a planilha vinculada a esta seção. Os campos de vínculo abaixo usarão ela automaticamente.
        </p>
      )}
    </div>
  );
}
