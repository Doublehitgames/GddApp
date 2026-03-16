/**
 * Google Drive Picker: abre o seletor de arquivos do Drive do usuário e retorna
 * o arquivo escolhido (id e nome). Usado para inserir imagens na descrição das seções.
 *
 * Configuração: defina NEXT_PUBLIC_GOOGLE_CLIENT_ID no .env.local (e no Vercel).
 * No Google Cloud: ative "Google Picker API" e crie credenciais OAuth 2.0 (Web).
 * Origens autorizadas: localhost e o domínio do app (ex.: gdd-app.vercel.app).
 */

const SCRIPT_API = "https://apis.google.com/js/api.js";
const SCRIPT_GSI = "https://accounts.google.com/gsi/client";

const IMAGE_MIME_TYPES =
  "image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp,image/svg+xml";

export type PickedFile = { id: string; name: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (options?: { prompt?: string }) => void };
        };
      };
      picker?: {
        ViewId: { DOCS: string };
        DocsView: new (viewId: string) => {
          setMimeTypes: (mimeTypes: string) => unknown;
        };
        PickerBuilder: new () => {
          setOAuthToken: (token: string) => unknown;
          addView: (view: unknown) => unknown;
          setCallback: (cb: (data: { docs?: Array<{ id: string; name: string }> }) => void) => unknown;
          build: () => { setVisible: (visible: boolean) => void };
        };
      };
    };
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
  }
}

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

function loadGapi(): Promise<void> {
  return loadScript(SCRIPT_API);
}

function loadGsi(): Promise<void> {
  return loadScript(SCRIPT_GSI);
}

/**
 * Retorna URL para exibir imagem do Drive por id.
 * Usa o endpoint de thumbnail (mais estável para <img>) quando uc?export=view retorna 403.
 * O arquivo precisa estar compartilhado como "Qualquer pessoa com o link" para aparecer.
 */
export function driveFileIdToImageUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

const DRIVE_UC_REGEX = /https:\/\/drive\.google\.com\/uc\?export=view&id=([a-zA-Z0-9_-]+)/g;
const DRIVE_FILE_REGEX = /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)(?:\/view)?/g;

/**
 * Para uso em <img src>: retorna a URL de thumbnail do Drive se for link do Drive, senão a própria URL.
 */
export function getDriveImageDisplayUrl(src: string): string {
  if (!src || !src.includes("drive.google.com")) return src;
  const idMatch = src.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const id = idMatch?.[1] ?? src.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  return id ? driveFileIdToImageUrl(id) : src;
}

/**
 * Normaliza URLs do Google Drive no markdown para o formato thumbnail,
 * para a imagem aparecer no editor (WYSIWYG) e na visualização.
 */
export function normalizeDriveUrlsInMarkdown(markdown: string): string {
  if (!markdown || typeof markdown !== "string") return markdown;
  return markdown
    .replace(DRIVE_UC_REGEX, (_, id) => driveFileIdToImageUrl(id))
    .replace(DRIVE_FILE_REGEX, (_, id) => driveFileIdToImageUrl(id));
}

const BUILD_TIME_CLIENT_ID =
  typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "" : "";

/**
 * Obtém o Google Client ID: primeiro do build (process.env), senão da API em runtime.
 * Assim a variável passa a valer no Vercel após adicionar e fazer redeploy, sem precisar
 * que o client tenha sido construído com a variável.
 */
export async function getGoogleClientId(): Promise<string | null> {
  if (BUILD_TIME_CLIENT_ID) return BUILD_TIME_CLIENT_ID;
  try {
    const res = await fetch("/api/config/public");
    if (!res.ok) return null;
    const data = (await res.json()) as { googleClientId?: string | null };
    const id = data?.googleClientId?.trim();
    return id || null;
  } catch {
    return null;
  }
}

/**
 * Abre o Google Picker para o usuário escolher uma imagem do Drive.
 * Retorna o arquivo selecionado ou null se cancelar / erro.
 * Se clientId não for passado, usa getGoogleClientId() (build-time ou API).
 */
export function openGoogleDriveImagePicker(clientId?: string | null): Promise<PickedFile | null> {
  const resolveClientId = clientId?.trim()
    ? Promise.resolve(clientId.trim())
    : getGoogleClientId();

  return resolveClientId.then((id) => {
    if (!id) return Promise.resolve(null);
    return openPickerWithClientId(id);
  });
}

function openPickerWithClientId(clientId: string): Promise<PickedFile | null> {
  return loadGsi()
    .then(() => {
      return new Promise<PickedFile | null>((resolve) => {
        const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/drive.readonly",
          callback: (response) => {
            if (response.error) {
              resolve(null);
              return;
            }
            const token = response.access_token;
            if (!token) {
              resolve(null);
              return;
            }
            loadGapi().then(() => {
              if (!window.gapi) {
                resolve(null);
                return;
              }
              window.gapi.load("picker", () => {
                const g = (window as unknown as { google?: { picker?: unknown } }).google?.picker;
                if (!g) {
                  resolve(null);
                  return;
                }
                const api = g as Record<string, unknown>;
                const View = api.DocsView as new (id: string) => { setMimeTypes: (m: string) => unknown };
                const view = new View((api.ViewId as { DOCS: string }).DOCS);
                view.setMimeTypes(IMAGE_MIME_TYPES);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const Builder = api.PickerBuilder as any;
                const picker = new Builder();
                picker.setOAuthToken(token);
                picker.addView(view);
                picker.setCallback((data: { action?: string; docs?: Array<{ id: string; name: string }> }) => {
                  if (process.env.NODE_ENV === "development") {
                    console.log("[Drive Picker] callback", { action: data?.action, docsCount: data?.docs?.length, data });
                  }
                  // Só resolver quando o usuário escolhe um arquivo; ignorar 'loaded' (abertura do Picker)
                  if (data?.action === "picked") {
                    const doc = data?.docs?.[0];
                    if (doc) resolve({ id: doc.id, name: doc.name || "Imagem" });
                    else resolve(null);
                  } else if (data?.action === "cancel") {
                    resolve(null);
                  }
                  // action === 'loaded' → não resolve, espera o usuário escolher ou cancelar
                });
                picker.build().setVisible(true);
              });
            });
          },
        });

        tokenClient?.requestAccessToken({ prompt: "" });
      });
    })
    .catch(() => null);
}

/**
 * Verifica de forma síncrona se o Client ID está no build (process.env).
 * Para checagem em runtime (incl. variável só no servidor), use getGoogleClientId() no click.
 */
export function isGoogleDrivePickerAvailable(): boolean {
  return Boolean(BUILD_TIME_CLIENT_ID);
}
