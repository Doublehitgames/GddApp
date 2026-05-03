"use client";

import { useState } from "react";
import type { LinkedSpreadsheet } from "@/store/slices/types";
import { parseSpreadsheetId, getGoogleSheetsToken, fetchSpreadsheetSheets } from "@/lib/googleSheets";
import { getGoogleClientId } from "@/lib/googleDrivePicker";
import { useI18n } from "@/lib/i18n/provider";

interface LinkedSpreadsheetsSettingsProps {
  projectId: string;
  spreadsheets: LinkedSpreadsheet[];
  onChange: (next: LinkedSpreadsheet[]) => void;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500 placeholder-gray-500";

export function LinkedSpreadsheetsSettings({
  projectId,
  spreadsheets,
  onChange,
}: LinkedSpreadsheetsSettingsProps) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedSheets, setFetchedSheets] = useState<string[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function resetForm() {
    setNewUrl("");
    setNewName("");
    setFetchedSheets(null);
    setFetchError(null);
    setAdding(false);
    setEditingId(null);
  }

  async function handleFetchSheets() {
    setFetchError(null);
    const spreadsheetId = parseSpreadsheetId(newUrl);
    if (!spreadsheetId) {
      setFetchError(t("linkedSpreadsheetsSettings.errorInvalidUrl"));
      return;
    }
    setFetching(true);
    try {
      const clientId = await getGoogleClientId();
      if (!clientId) { setFetchError(t("linkedSpreadsheetsSettings.errorNoClientId")); return; }
      const token = await getGoogleSheetsToken(clientId);
      if (!token) { setFetchError(t("linkedSpreadsheetsSettings.errorNoAuth")); return; }
      const sheets = await fetchSpreadsheetSheets(token, spreadsheetId);
      if (!sheets || sheets.length === 0) {
        setFetchError(t("linkedSpreadsheetsSettings.errorNoSheets"));
        return;
      }
      setFetchedSheets(sheets);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : t("linkedSpreadsheetsSettings.errorGeneric"));
    } finally {
      setFetching(false);
    }
  }

  function handleSave() {
    const spreadsheetId = parseSpreadsheetId(newUrl);
    if (!spreadsheetId || !newName.trim() || !fetchedSheets) return;
    if (editingId) {
      onChange(
        spreadsheets.map((s) =>
          s.id === editingId
            ? { ...s, name: newName.trim(), url: newUrl.trim(), spreadsheetId, sheets: fetchedSheets }
            : s
        )
      );
    } else {
      onChange([
        ...spreadsheets,
        {
          id: crypto.randomUUID(),
          name: newName.trim(),
          url: newUrl.trim(),
          spreadsheetId,
          sheets: fetchedSheets,
        },
      ]);
    }
    resetForm();
  }

  function handleEdit(s: LinkedSpreadsheet) {
    setEditingId(s.id);
    setNewUrl(s.url);
    setNewName(s.name);
    setFetchedSheets(s.sheets);
    setFetchError(null);
    setAdding(true);
  }

  function handleRemove(id: string) {
    onChange(spreadsheets.filter((s) => s.id !== id));
  }

  const canSave = Boolean(parseSpreadsheetId(newUrl) && newName.trim() && fetchedSheets);

  return (
    <div className="space-y-3">
      {/* Lista de planilhas cadastradas */}
      {spreadsheets.length > 0 && (
        <ul className="space-y-2">
          {spreadsheets.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-gray-700 bg-gray-800/60 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{s.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-gray-500">{s.url}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {s.sheets.map((sheet) => (
                    <span
                      key={sheet}
                      className="rounded border border-gray-600 bg-gray-700/60 px-1.5 py-0.5 text-[10px] text-gray-300"
                    >
                      {sheet}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleEdit(s)}
                  className="rounded px-2 py-1 text-xs text-gray-400 hover:text-white"
                >
                  {t("linkedSpreadsheetsSettings.editButton")}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(s.id)}
                  className="rounded px-2 py-1 text-xs text-rose-500 hover:text-rose-300"
                >
                  {t("linkedSpreadsheetsSettings.removeButton")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Formulário de adição/edição */}
      {adding ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-3 space-y-2.5">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => { setNewUrl(e.target.value); setFetchedSheets(null); setFetchError(null); }}
            placeholder={t("linkedSpreadsheetsSettings.urlPlaceholder")}
            className={INPUT_CLASS}
          />

          {/* Botão buscar abas */}
          {!fetchedSheets && (
            <button
              type="button"
              onClick={handleFetchSheets}
              disabled={fetching || !newUrl.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-700/60 bg-emerald-900/20 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
            >
              {fetching ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  {t("linkedSpreadsheetsSettings.fetchingSheets")}
                </>
              ) : t("linkedSpreadsheetsSettings.fetchButton")}
            </button>
          )}

          {fetchError && (
            <p className="text-xs text-rose-400">{fetchError}</p>
          )}

          {/* Abas encontradas */}
          {fetchedSheets && (
            <>
              <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 px-3 py-2">
                <p className="mb-1.5 text-[10px] uppercase tracking-wide text-emerald-500">
                  {fetchedSheets.length} {fetchedSheets.length === 1 ? t("linkedSpreadsheetsSettings.sheetFoundSingular") : t("linkedSpreadsheetsSettings.sheetFoundPlural")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {fetchedSheets.map((sheet) => (
                    <span
                      key={sheet}
                      className="rounded border border-emerald-700/40 bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-300"
                    >
                      {sheet}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setFetchedSheets(null); setFetchError(null); }}
                  className="mt-2 text-[10px] text-gray-500 hover:text-gray-300"
                >
                  {t("linkedSpreadsheetsSettings.refetchButton")}
                </button>
              </div>

              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("linkedSpreadsheetsSettings.namePlaceholder")}
                className={INPUT_CLASS}
                autoFocus
              />
            </>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 rounded-lg border border-indigo-600/60 bg-indigo-700/20 px-3 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-700/40 disabled:opacity-40"
            >
              {editingId ? t("linkedSpreadsheetsSettings.saveButton") : t("linkedSpreadsheetsSettings.addButton")}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:text-white"
            >
              {t("linkedSpreadsheetsSettings.cancelButton")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-700 bg-gray-800/30 px-3 py-2.5 text-sm text-gray-400 hover:border-gray-500 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t("linkedSpreadsheetsSettings.addButton")}
        </button>
      )}
    </div>
  );
}
