import { NextRequest } from "next/server";
import { requireAuth, requireProject, apiJson, apiError } from "@/lib/api/v1/helpers";
import { driveFileIdToImageUrl } from "@/lib/googleDrivePicker";
import { addProjectImagesSchema } from "@/lib/api/v1/schemas";
import { mergeImageLibrary, type LibraryFile as IndexedFile } from "@/lib/api/v1/imageLibrary";

/**
 * Dito na resposta vazia porque é ali que o agente empaca: o índice não lê o
 * Drive na hora, e nada mais na resposta diz isso.
 */
const NO_LIBRARY_HINT =
  "No image folder is linked to this project. Files dropped in Google Drive are not seen until they are indexed: " +
  "if you know their Drive file ids (you just uploaded them), register them with add_project_images, passing the folder's link as folderUrl; " +
  "otherwise ask the user to link and sync the folder in the project's Settings, under Image library.";

const toImage = (f: IndexedFile) => ({
  name: f.name,
  ...(f.path ? { path: f.path } : {}),
  url: driveFileIdToImageUrl(f.fileId),
});

type Ctx = { params: Promise<{ id: string }> };

/** Teto de resposta: a biblioteca pode ter milhares de arquivos; `match` é o caminho. */
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

type LibraryFile = { fileId?: unknown; name?: unknown; path?: unknown };

/** Rótulo usado no filtro: inclui a subpasta, então `match` também busca por pasta. */
function label(file: { name: string; path?: string }): string {
  return file.path ? `${file.path}/${file.name}` : file.name;
}

/**
 * GET /api/v1/projects/:id/images — o índice de imagens da pasta do Drive do
 * projeto, com a URL de exibição já montada (mesmo formato que o app usa).
 *
 * Endpoint próprio, e não um campo do GET do projeto, porque a lista pode ter
 * centenas de arquivos: quem quer o projeto não deve pagar por ela.
 *
 * Query: `match` filtra por substring do nome (case-insensitive), `limit` corta
 * a resposta (padrão 200, máximo 1000).
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId);
  if ("response" in pResult) return pResult.response;

  const library = pResult.project.image_library;
  if (!library || typeof library !== "object") {
    return apiJson({ folderId: null, syncedAt: null, count: 0, images: [], hint: NO_LIBRARY_HINT });
  }

  const url = new URL(request.url);
  const match = (url.searchParams.get("match") || "").trim().toLowerCase();
  const requestedLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const all = Array.isArray(library.files) ? (library.files as LibraryFile[]) : [];
  const named = all
    .filter((f): f is { fileId: string; name: string; path?: string } =>
      typeof f?.fileId === "string" && typeof f?.name === "string")
    .map((f) => ({ ...f, path: typeof f.path === "string" ? f.path : undefined }))
    .filter((f) => !match || label(f).toLowerCase().includes(match));

  const images = named.slice(0, limit).map(toImage);

  return apiJson({
    folderId: (library.folderId as string) ?? null,
    folderUrl: (library.folderUrl as string) ?? null,
    syncedAt: (library.syncedAt as string) ?? null,
    count: named.length,
    ...(named.length > images.length ? { truncated: true } : {}),
    images,
  });
}

/**
 * POST /api/v1/projects/:id/images — acrescenta ao índice arquivos do Drive que
 * o chamador já conhece pelo id (que acabou de subir, por exemplo), sem passar
 * pela sincronização do app. Regras em lib/api/v1/imageLibrary.ts.
 *
 * Body: `{ files: [{ fileId, name, path? }], folderUrl? }`. Devolve as URLs
 * prontas dos arquivos acrescentados, para gravar em `thumbImageUrl`.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireAuth(request);
  if ("response" in result) return result.response;
  const { auth } = result;

  const pResult = await requireProject(auth.supabase, id, auth.userId, { write: true });
  if ("response" in pResult) return pResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400, "invalid_json");
  }

  const parsed = addProjectImagesSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, "validation_error", {
      issues: parsed.error.issues,
    });
  }

  const merged = mergeImageLibrary(pResult.project.image_library, parsed.data.files, {
    folderUrl: parsed.data.folderUrl,
    now: new Date().toISOString(),
  });
  if (!merged.ok) return apiError(merged.message, 400, merged.code);

  if (merged.added.length || merged.updated.length) {
    const { error } = await auth.supabase
      .from("projects")
      .update({ image_library: merged.library })
      .eq("id", id);
    if (error) return apiError("Failed to update the image library", 500, "db_error");
  }

  return apiJson({
    ok: true,
    folderUrl: merged.library.folderUrl,
    syncedAt: merged.library.syncedAt,
    count: merged.library.files.length,
    added: merged.added.map(toImage),
    ...(merged.updated.length ? { updated: merged.updated.map(toImage) } : {}),
  });
}
