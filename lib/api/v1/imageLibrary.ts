/**
 * Escrita no índice da biblioteca de imagens pela API.
 *
 * O índice normalmente nasce da sincronização no app, que lista a pasta do
 * Drive com o login Google de quem clica: o servidor não tem credencial do
 * Google. Um agente que acabou de subir arquivos no Drive, porém, já sabe o id
 * de cada um, e não precisa do servidor para descobrir nada. Aqui ele só
 * acrescenta esses arquivos ao índice.
 *
 * Acrescenta, nunca substitui: um agente não apaga a biblioteca que o time
 * montou. A sincronização manual continua mandando, porque é o retrato da
 * pasta: um arquivo acrescentado aqui que esteja fora da pasta ligada some do
 * índice na próxima sincronização (a página que já usa a URL dele não perde a
 * imagem, porque a URL fica gravada na página).
 */

import { IMAGE_LIBRARY_LIMIT, driveFolderUrl, parseDriveFolderId } from "@/lib/googleDriveFolder";

export type LibraryFile = { fileId: string; name: string; path?: string };

export type ImageLibraryRecord = {
  folderId: string;
  folderUrl: string;
  syncedAt: string;
  files: LibraryFile[];
};

export type MergeResult =
  | { ok: false; code: "no_folder" | "invalid_folder" | "library_full"; message: string }
  | {
      ok: true;
      library: ImageLibraryRecord;
      added: LibraryFile[];
      updated: LibraryFile[];
    };

function asFiles(value: unknown): LibraryFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is LibraryFile =>
      typeof f?.fileId === "string" && typeof f?.name === "string")
    .map((f) => ({
      fileId: f.fileId,
      name: f.name,
      ...(typeof f.path === "string" && f.path ? { path: f.path } : {}),
    }));
}

/**
 * Junta `incoming` ao índice atual. O mesmo `fileId` não entra duas vezes:
 * se já existe, nome e subpasta são atualizados.
 *
 * Sem índice ainda, a pasta vem de `folderUrl`. `syncedAt` continua sendo a
 * data da última sincronização com a pasta, e não muda aqui; para um índice
 * novo, recebe `now`.
 */
export function mergeImageLibrary(
  current: Record<string, unknown> | null | undefined,
  incoming: LibraryFile[],
  opts: { folderUrl?: string; now: string },
): MergeResult {
  let base: ImageLibraryRecord;
  if (current && typeof current === "object" && typeof current.folderId === "string" && current.folderId) {
    base = {
      folderId: current.folderId,
      folderUrl: typeof current.folderUrl === "string" ? current.folderUrl : driveFolderUrl(current.folderId),
      syncedAt: typeof current.syncedAt === "string" ? current.syncedAt : opts.now,
      files: asFiles(current.files),
    };
  } else {
    if (!opts.folderUrl) {
      return {
        ok: false,
        code: "no_folder",
        message: "This project has no image folder linked yet. Pass folderUrl: the Google Drive folder the files are in.",
      };
    }
    const folderId = parseDriveFolderId(opts.folderUrl);
    if (!folderId) {
      return { ok: false, code: "invalid_folder", message: "folderUrl is not a Google Drive folder link." };
    }
    base = { folderId, folderUrl: driveFolderUrl(folderId), syncedAt: opts.now, files: [] };
  }

  const files = [...base.files];
  const indexById = new Map(files.map((f, i) => [f.fileId, i]));
  const added: LibraryFile[] = [];
  const updated: LibraryFile[] = [];

  for (const raw of incoming) {
    const file: LibraryFile = {
      fileId: raw.fileId,
      name: raw.name,
      ...(raw.path ? { path: raw.path } : {}),
    };
    const at = indexById.get(file.fileId);
    if (at === undefined) {
      indexById.set(file.fileId, files.length);
      files.push(file);
      added.push(file);
    } else {
      const before = files[at];
      if (before.name !== file.name || before.path !== file.path) {
        files[at] = file;
        updated.push(file);
      }
    }
  }

  if (files.length > IMAGE_LIBRARY_LIMIT) {
    return {
      ok: false,
      code: "library_full",
      message: `The image library holds at most ${IMAGE_LIBRARY_LIMIT} files; this would make ${files.length}.`,
    };
  }

  return { ok: true, library: { ...base, files }, added, updated };
}
