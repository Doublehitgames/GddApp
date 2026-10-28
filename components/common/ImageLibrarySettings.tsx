"use client";

import { useRef, useState } from "react";
import type { ProjectImageLibrary } from "@/store/slices/types";
import { getGoogleClientId } from "@/lib/googleDrivePicker";
import { DriveThumb } from "@/components/common/DriveThumb";
import { useI18n } from "@/lib/i18n/provider";
import {
  classifyDriveError,
  driveFolderUrl,
  imageLabel,
  getGoogleDriveToken,
  listDriveFolderImages,
  parseDriveFolderId,
  IMAGE_LIBRARY_LIMIT,
  type DriveErrorKind,
  type ScanProgress,
} from "@/lib/googleDriveFolder";

interface ImageLibrarySettingsProps {
  library?: ProjectImageLibrary;
  onChange: (next?: ProjectImageLibrary) => void | Promise<void>;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-line-strong placeholder-subtle";

const PREVIEW_COUNT = 12;

/** Cada categoria de falha do Drive tem sua própria instrução no locale. */
const DRIVE_ERROR_KEYS: Record<DriveErrorKind, string> = {
  apiDisabled: "imageLibrary.driveApiDisabled",
  notFound: "imageLibrary.driveNotFound",
  rateLimit: "imageLibrary.driveRateLimit",
  forbidden: "imageLibrary.driveForbidden",
  unknown: "imageLibrary.driveUnknown",
};

/**
 * Cadastro da pasta de imagens do Drive e sincronização do índice.
 *
 * O índice é montado aqui, no browser, porque só o browser tem token do Google
 * (o mesmo do picker). Depois de salvo, o app, o modo leitura e o agente MCP
 * leem o cache sem precisar de credencial.
 */
export function ImageLibrarySettings({ library, onChange }: ImageLibrarySettingsProps) {
  const { t, locale } = useI18n();
  const [url, setUrl] = useState(library?.folderUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** Erro cru do Drive → instrução traduzida da categoria correspondente. */
  function driveErrorMessage(raw: string): string {
    const info = classifyDriveError(raw);
    return t(DRIVE_ERROR_KEYS[info.kind])
      .replace("{link}", info.enableLink ?? "")
      .replace("{message}", info.raw);
  }

  async function syncFolder(rawUrl: string) {
    setError(null);
    setNotice(null);

    const folderId = parseDriveFolderId(rawUrl);
    if (!folderId) {
      setError(t("imageLibrary.errorInvalidUrl"));
      return;
    }

    setBusy(true);
    setProgress({ scanned: 0, pending: 1, images: 0, current: "" });
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const clientId = await getGoogleClientId();
      if (!clientId) {
        setError(t("imageLibrary.errorNoClientId"));
        return;
      }
      const token = await getGoogleDriveToken(clientId);
      if (!token) {
        setError(t("imageLibrary.errorNoAuth"));
        return;
      }

      const { files, truncated, error: listError, canceled } = await listDriveFolderImages(
        token,
        folderId,
        { onProgress: setProgress, signal: controller.signal },
      );

      if (canceled) {
        setNotice(t("imageLibrary.noticeCanceled").replace("{images}", String(files.length)));
        return;
      }
      if (listError) {
        setError(driveErrorMessage(listError));
        return;
      }
      if (files.length === 0) {
        setError(t("imageLibrary.errorEmptyFolder"));
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
        t(truncated ? "imageLibrary.noticeTruncated" : "imageLibrary.noticeIndexed")
          .replace("{images}", String(files.length))
          .replace("{folders}", String(folders))
          .replace("{limit}", String(IMAGE_LIBRARY_LIMIT)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("imageLibrary.errorGeneric"));
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

  const countLabel = (one: string, many: string, count: number) =>
    count === 1 ? t(one) : t(many).replace("{count}", String(count));

  /**
   * Barra de progresso da varredura. Não existe total conhecido — a árvore é
   * descoberta enquanto anda — então mostra os números reais (pastas prontas,
   * pastas na fila, imagens) em vez de uma porcentagem inventada.
   */
  const progressPanel = progress && (
    <div className="rounded-lg border border-line/60 bg-canvas/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink">
          <span
            className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"
            aria-hidden
          />
          <span>
            {t("imageLibrary.scanning")}{" "}
            {countLabel("imageLibrary.scanFoldersOne", "imageLibrary.scanFolders", progress.scanned)}
            {" · "}
            {countLabel("imageLibrary.scanImagesOne", "imageLibrary.scanImages", progress.images)}
            {progress.pending > 0
              ? ` · ${t("imageLibrary.scanQueued").replace("{count}", String(progress.pending))}`
              : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={cancelSync}
          className="rounded-lg border border-line-strong px-3 py-1 text-xs text-ink-2 hover:bg-surface-2/40"
        >
          {t("imageLibrary.cancelButton")}
        </button>
      </div>
      <div className="mt-2 truncate text-xs text-subtle">
        📁 {progress.current || t("imageLibrary.rootFolder")}
      </div>
      {/* Barra indeterminada: a fila encolhe e cresce, então isso é sinal de vida, não medida. */}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
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
        <div className="rounded-lg border border-line/60 bg-canvas/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold text-ink">
                {countLabel("imageLibrary.indexedOne", "imageLibrary.indexedMany", library.files.length)}
              </div>
              <div className="text-xs text-muted">
                {t("imageLibrary.updatedAt").replace(
                  "{date}",
                  new Date(library.syncedAt).toLocaleString(locale),
                )}
                {" · "}
                <a
                  href={library.folderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 dark:text-sky-400 hover:underline"
                >
                  {t("imageLibrary.openInDrive")}
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
                {busy ? t("imageLibrary.scanningButton") : t("imageLibrary.refreshButton")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={disconnect}
                className="rounded-lg border border-line-strong px-3 py-2 text-sm text-ink-2 hover:bg-surface-2/40 disabled:opacity-50"
              >
                {t("imageLibrary.disconnectButton")}
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
                    className="h-16 w-16 rounded-lg border border-line bg-canvas object-contain"
                  />
                  <div className="mt-1 truncate text-[10px] text-subtle">{file.name}</div>
                </div>
              ))}
              {library.files.length > preview.length && (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-line text-xs text-subtle">
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
            placeholder={t("imageLibrary.urlPlaceholder")}
            className={INPUT_CLASS}
          />
          <button
            type="button"
            disabled={busy || !url.trim()}
            onClick={() => syncFolder(url)}
            className="whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? t("imageLibrary.scanningButton") : t("imageLibrary.connectButton")}
          </button>
        </div>
      )}

      {error && <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>}
      {notice && <div className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</div>}

      <p className="text-xs text-subtle">{t("imageLibrary.hint")}</p>
    </div>
  );
}
