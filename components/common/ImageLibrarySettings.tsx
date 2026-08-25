"use client";

import { useRef, useState } from "react";
import type { ProjectImageLibrary } from "@/store/slices/types";
import { getGoogleClientId } from "@/lib/googleDrivePicker";
import { DriveThumb } from "@/components/common/DriveThumb";
import {
  driveFolderUrl,
  explainDriveError,
  imageLabel,
  getGoogleDriveToken,
  listDriveFolderImages,
  parseDriveFolderId,
  IMAGE_LIBRARY_LIMIT,
  type ScanProgress,
} from "@/lib/googleDriveFolder";

interface ImageLibrarySettingsProps {
  library?: ProjectImageLibrary;
  onChange: (next?: ProjectImageLibrary) => void | Promise<void>;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-gray-500 placeholder-gray-500";

const PREVIEW_COUNT = 12;

/**
 * Cadastro da pasta de imagens do Drive e sincronização do índice.
 *
 * O índice é montado aqui, no browser, porque só o browser tem token do Google
 * (o mesmo do picker). Depois de salvo, o app, o modo leitura e o agente MCP
 * leem o cache sem precisar de credencial.
 */
export function ImageLibrarySettings({ library, onChange }: ImageLibrarySettingsProps) {
  const [url, setUrl] = useState(library?.folderUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function syncFolder(rawUrl: string) {
    setError(null);
    setNotice(null);

    const folderId = parseDriveFolderId(rawUrl);
    if (!folderId) {
      setError("Não reconheci essa URL. Cole o link da pasta do Drive (…/drive/folders/ID).");
      return;
    }

    setBusy(true);
    setProgress({ scanned: 0, pending: 1, images: 0, current: "raiz" });
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const clientId = await getGoogleClientId();
      if (!clientId) {
        setError("Google Client ID não configurado (NEXT_PUBLIC_GOOGLE_CLIENT_ID).");
        return;
      }
      const token = await getGoogleDriveToken(clientId);
      if (!token) {
        setError("Não consegui autorizar o acesso ao Drive.");
        return;
      }

      const { files, truncated, error: listError, canceled } = await listDriveFolderImages(
        token,
        folderId,
        { onProgress: setProgress, signal: controller.signal },
      );

      if (canceled) {
        setNotice(`Varredura cancelada — nada foi salvo (${files.length} imagens até ali).`);
        return;
      }
      if (listError) {
        setError(explainDriveError(listError));
        return;
      }
      if (files.length === 0) {
        setError("A pasta não tem imagens (ou não está compartilhada com você).");
        return;
      }

      await onChange({
        folderId,
        folderUrl: driveFolderUrl(folderId),
        syncedAt: new Date().toISOString(),
        files,
      });
      setUrl(driveFolderUrl(folderId));
      const folders = new Set(files.map((f) => f.path ?? "")).size;
      setNotice(
        truncated
          ? `${files.length} imagens indexadas em ${folders} pastas (limite de ${IMAGE_LIBRARY_LIMIT} atingido — o resto ficou de fora).`
          : `${files.length} imagens indexadas em ${folders} pastas.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao sincronizar a pasta.");
    } finally {
      abortRef.current = null;
      setProgress(null);
      setBusy(false);
    }
  }

  function cancelSync() {
    abortRef.current?.abort();
  }

  async function disconnect() {
    setError(null);
    setNotice(null);
    await onChange(undefined);
    setUrl("");
  }

  const preview = (library?.files ?? []).slice(0, PREVIEW_COUNT);

  /**
   * Barra de progresso da varredura. Não existe total conhecido — a árvore é
   * descoberta enquanto anda — então mostra os números reais (pastas prontas,
   * pastas na fila, imagens) em vez de uma porcentagem inventada.
   */
  const progressPanel = progress && (
    <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-white">
          <span
            className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"
            aria-hidden
          />
          <span>
            Varrendo… <strong>{progress.scanned}</strong> pasta
            {progress.scanned === 1 ? "" : "s"} · <strong>{progress.images}</strong> imagem
            {progress.images === 1 ? "" : "s"}
            {progress.pending > 0 ? ` · ${progress.pending} na fila` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={cancelSync}
          className="rounded-lg border border-gray-600 px-3 py-1 text-xs text-gray-300 hover:bg-gray-700/40"
        >
          Cancelar
        </button>
      </div>
      <div className="mt-2 truncate text-xs text-gray-500">📁 {progress.current}</div>
      {/* Barra indeterminada: a fila encolhe e cresce, então isso é sinal de vida, não medida. */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{
            width: `${Math.min(95, Math.round((progress.scanned / Math.max(1, progress.scanned + progress.pending)) * 100))}%`,
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {library && (
        <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold text-white">
                {library.files.length === 1
                  ? "1 imagem indexada"
                  : `${library.files.length} imagens indexadas`}
              </div>
              <div className="text-xs text-gray-400">
                Atualizado em {new Date(library.syncedAt).toLocaleString("pt-BR")} ·{" "}
                <a
                  href={library.folderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  abrir pasta no Drive
                </a>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => syncFolder(library.folderUrl)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Varrendo…" : "Atualizar índice"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={disconnect}
                className="rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700/40 disabled:opacity-50"
              >
                Desconectar
              </button>
            </div>
          </div>

          {preview.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {preview.map((file) => (
                <div key={file.fileId} className="w-16" title={imageLabel(file)}>
                  <DriveThumb
                    fileId={file.fileId}
                    alt={file.name}
                    size={200}
                    className="h-16 w-16 rounded-lg border border-gray-700 bg-gray-950 object-contain"
                  />
                  <div className="mt-1 truncate text-[10px] text-gray-500">{file.name}</div>
                </div>
              ))}
              {library.files.length > preview.length && (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-gray-700 text-xs text-gray-500">
                  +{library.files.length - preview.length}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {progressPanel}

      {!library && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
            className={INPUT_CLASS}
          />
          <button
            type="button"
            disabled={busy || !url.trim()}
            onClick={() => syncFolder(url)}
            className="whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Varrendo…" : "Conectar pasta"}
          </button>
        </div>
      )}

      {error && <div className="text-sm text-rose-400">{error}</div>}
      {notice && <div className="text-sm text-emerald-400">{notice}</div>}

      <p className="text-xs text-gray-500">
        A pasta precisa estar compartilhada como &quot;qualquer pessoa com o link&quot; para as imagens
        aparecerem no GDD e no modo leitura. Nomeie os arquivos com o ID do dado da página (ex.:
        SEED_TURNIP.png) para o agente casar imagem e página automaticamente.
      </p>
    </div>
  );
}
