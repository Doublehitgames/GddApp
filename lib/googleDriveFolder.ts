/**
 * Lista as imagens de uma pasta do Google Drive, no browser, com o token que o
 * picker já concede (scope drive.readonly).
 *
 * Por que no cliente: o servidor não tem credencial Google nenhuma — nem o
 * Sheets tem (ver lib/googleSheets.ts). O browser tem. Então o índice é montado
 * aqui e persistido no projeto (Project.imageLibrary), e daí pra frente servidor,
 * modo leitura pública e agente MCP leem o cache, sem OAuth.
 *
 * ATENÇÃO: são necessárias DUAS APIs no Google Cloud — Picker API (a janela de
 * escolher arquivo) e Drive API (listar o conteúdo de uma pasta, feito aqui).
 */

import type { ProjectImage } from "@/store/slices/types";

const SCRIPT_GSI = "https://accounts.google.com/gsi/client";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const PAGE_SIZE = 1000;

/**
 * Quantas pastas são varridas ao mesmo tempo. A varredura é dominada por
 * latência (~200-400ms por chamada), não por CPU: em série, 60 pastas viram
 * mais de 20 segundos. O limite do Drive é de ~1000 requisições por 100s por
 * usuário, então 8 em paralelo fica bem longe do teto.
 */
const CONCURRENCY = 8;

/** Tetos de segurança: pasta gigante não vira um jsonb de megabytes. */
export const IMAGE_LIBRARY_LIMIT = 2000;
export const IMAGE_LIBRARY_FOLDER_LIMIT = 300;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// Cache em memória: sincronizar duas vezes na mesma sessão não repede consentimento.
let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

/** Token OAuth com drive.readonly. Igual ao padrão do getGoogleSheetsToken. */
export async function getGoogleDriveToken(clientId: string): Promise<string | null> {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  await loadScript(SCRIPT_GSI);

  return new Promise((resolve) => {
    const google = (
      window as unknown as {
        google?: {
          accounts?: {
            oauth2?: {
              initTokenClient: (c: unknown) => { requestAccessToken: (o?: unknown) => void };
            };
          };
        };
      }
    ).google;
    if (!google?.accounts?.oauth2) {
      resolve(null);
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response: { access_token?: string; expires_in?: number; error?: string }) => {
        if (response.error || !response.access_token) {
          resolve(null);
          return;
        }
        cachedToken = response.access_token;
        cachedTokenExpiry = Date.now() + ((response.expires_in ?? 3600) - 60) * 1000;
        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken({ prompt: "" });
  });
}

/**
 * Extrai o id da pasta de uma URL do Drive, ou devolve o valor como está se já
 * parecer um id.
 * e.g. https://drive.google.com/drive/folders/1AbC?usp=sharing → "1AbC"
 */
export function parseDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Alguns links de "Meu Drive" trazem a pasta em ?id=
  const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

/** URL canônica da pasta, pra guardar junto do índice e exibir na UI. */
export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/** Categorias de falha do Drive que merecem instrução própria na UI. */
export type DriveErrorKind = "apiDisabled" | "notFound" | "rateLimit" | "forbidden" | "unknown";

export type DriveErrorInfo = {
  kind: DriveErrorKind;
  /** Mensagem crua do Google, para o caso `unknown` e para depuração. */
  raw: string;
  /** Link do Google Cloud para ativar a Drive API, quando dá para descobrir o projeto. */
  enableLink?: string;
};

/**
 * Classifica o erro cru do Google. Fica aqui, mas sem texto de usuário: o texto
 * é responsabilidade de quem renderiza (locales), esta função só diz o que houve.
 *
 * O caso mais comum e mais confuso é `apiDisabled`: o picker usa a Picker API e
 * `files.list` usa a Drive API — são duas APIs diferentes no Google Cloud, então
 * escolher imagem funciona enquanto listar pasta falha.
 */
export function classifyDriveError(message: string): DriveErrorInfo {
  const raw = message || "";

  if (/has not been used in project|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(raw)) {
    const project = raw.match(/project (\d{6,})/)?.[1];
    return {
      kind: "apiDisabled",
      raw,
      enableLink: project
        ? `https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${project}`
        : "https://console.cloud.google.com/apis/library/drive.googleapis.com",
    };
  }
  if (/File not found|notFound/i.test(raw)) return { kind: "notFound", raw };
  if (/rateLimit|userRateLimitExceeded|Rate Limit|quota/i.test(raw)) return { kind: "rateLimit", raw };
  if (/insufficient|forbidden|403/i.test(raw)) return { kind: "forbidden", raw };

  return { kind: "unknown", raw };
}

type DriveEntry = { id?: unknown; name?: unknown; mimeType?: unknown };

type DriveListResponse = {
  files?: DriveEntry[];
  nextPageToken?: string;
  error?: { message?: string };
};

/** Rótulo estável de uma imagem para filtro e ordenação: "subpasta/arquivo.png". */
export function imageLabel(file: ProjectImage): string {
  return file.path ? `${file.path}/${file.name}` : file.name;
}

/** Query de uma pasta: imagens e subpastas, ignorando lixeira. */
function childrenQuery(folderId: string): string {
  return (
    "'" + folderId + "' in parents and trashed = false and " +
    "(mimeType contains 'image/' or mimeType = '" + FOLDER_MIME + "')"
  );
}

/** O que a UI mostra enquanto a varredura corre. */
export type ScanProgress = {
  /** Pastas já varridas por completo. */
  scanned: number;
  /** Pastas descobertas e ainda na fila. */
  pending: number;
  /** Imagens encontradas até agora. */
  images: number;
  /** Nome da última pasta varrida, para dar sinal de vida. */
  current: string;
};

export type ScanResult = {
  files: ProjectImage[];
  truncated: boolean;
  error: string | null;
  /** True quando o usuário abortou — o chamador não deve salvar o resultado. */
  canceled: boolean;
};

type Folder = { id: string; path: string };

/**
 * Varre a pasta e TODAS as subpastas, guardando o caminho relativo de cada
 * imagem — dois `icon.png` em pastas diferentes continuam distinguíveis.
 *
 * Varre CONCURRENCY pastas em paralelo (a fila cresce conforme descobre
 * subpastas), reporta progresso a cada pasta concluída e para na hora se o
 * `signal` for abortado.
 *
 * Limites: IMAGE_LIBRARY_LIMIT imagens e IMAGE_LIBRARY_FOLDER_LIMIT pastas. Ao
 * bater em qualquer um, devolve `truncated` em vez de cortar em silêncio.
 */
export async function listDriveFolderImages(
  token: string,
  folderId: string,
  opts: { onProgress?: (p: ScanProgress) => void; signal?: AbortSignal } = {},
): Promise<ScanResult> {
  const files: ProjectImage[] = [];
  const queue: Folder[] = [{ id: folderId, path: "" }];
  const known = new Set<string>([folderId]);

  let truncated = false;
  let failure: string | null = null;
  let scanned = 0;
  let active = 0;

  const aborted = () => opts.signal?.aborted === true;
  const done = () => failure !== null || aborted() || files.length >= IMAGE_LIBRARY_LIMIT;

  function report(current: string) {
    opts.onProgress?.({ scanned, pending: queue.length + active, images: files.length, current });
  }

  /** Uma pasta: pagina até o fim e empilha o que achou. */
  async function scan(folder: Folder): Promise<void> {
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q: childrenQuery(folder.id),
        fields: "nextPageToken,files(id,name,mimeType)",
        pageSize: String(PAGE_SIZE),
        orderBy: "folder,name",
        // Pastas em Drive compartilhado só aparecem com esses dois.
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);

      let payload: DriveListResponse;
      try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: opts.signal,
        });
        payload = (await response.json()) as DriveListResponse;
        if (!response.ok) {
          failure = payload?.error?.message || `drive_${response.status}`;
          return;
        }
      } catch (e) {
        // Abortar não é falha: o chamador pediu para parar.
        if (aborted()) return;
        failure = e instanceof Error ? e.message : "drive_fetch_failed";
        return;
      }

      for (const entry of payload.files ?? []) {
        const id = typeof entry.id === "string" ? entry.id : "";
        if (!id) continue;
        const name = typeof entry.name === "string" && entry.name ? entry.name : id;

        if (entry.mimeType === FOLDER_MIME) {
          if (known.has(id)) continue;
          if (known.size >= IMAGE_LIBRARY_FOLDER_LIMIT) {
            truncated = true;
            continue;
          }
          known.add(id);
          queue.push({ id, path: folder.path ? `${folder.path}/${name}` : name });
          continue;
        }

        if (files.length >= IMAGE_LIBRARY_LIMIT) {
          truncated = true;
          break;
        }
        files.push({ fileId: id, name, ...(folder.path ? { path: folder.path } : {}) });
      }

      pageToken = done() ? undefined : payload.nextPageToken;
    } while (pageToken);
  }

  /**
   * Um trabalhador da pool. A fila é alimentada pelos próprios trabalhadores, então
   * fila vazia com alguém ainda varrendo não significa fim — significa esperar.
   */
  async function worker(): Promise<void> {
    for (;;) {
      if (done()) return;

      const folder = queue.shift();
      if (!folder) {
        if (active === 0) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
        continue;
      }

      active++;
      try {
        await scan(folder);
      } finally {
        active--;
        scanned++;
      }
      // Caminho vazio = raiz. Quem renderiza dá o nome, aqui não tem texto de UI.
      report(folder.path);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  if (aborted()) return { files, truncated, error: null, canceled: true };
  if (failure) return { files, truncated, error: failure, canceled: false };

  // Pasta primeiro, nome depois — agrupa cada subpasta em vez de intercalar
  // (localeCompare sobre "pasta/arquivo" ignora a barra e embaralha os níveis).
  files.sort((a, b) => {
    const byPath = (a.path ?? "").localeCompare(b.path ?? "", "pt-BR");
    return byPath !== 0 ? byPath : a.name.localeCompare(b.name, "pt-BR");
  });

  return { files, truncated, error: null, canceled: false };
}
