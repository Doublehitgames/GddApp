import type { ExportFile } from "@/lib/dataExport/markdown";

/**
 * Empacota arquivos num .zip. O `jszip` só carrega na hora do clique.
 * Aceita texto e Blob (os .docx de vários projetos vão juntos assim).
 */
export type ZipEntry = { path: string; content: string | Blob };

/** O zip ainda aberto — os testes leem os bytes direto, sem passar por Blob. */
export async function buildZipArchive(entries: Array<ZipEntry | ExportFile>) {
  const { default: JSZip } = await import(/* webpackChunkName: "jszip" */ "jszip");
  const zip = new JSZip();
  for (const entry of entries) zip.file(entry.path, entry.content);
  return zip;
}

export async function buildZip(entries: Array<ZipEntry | ExportFile>): Promise<Blob> {
  const zip = await buildZipArchive(entries);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/** Baixa um Blob sem depender do `saveAs` do file-saver (não resolve neste build). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari cancela o download se a URL some no mesmo tick.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
