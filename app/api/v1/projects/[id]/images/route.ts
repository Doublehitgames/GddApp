import { NextRequest } from "next/server";
import { requireAuth, requireProject, apiJson } from "@/lib/api/v1/helpers";
import { driveFileIdToImageUrl } from "@/lib/googleDrivePicker";

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
    return apiJson({ folderId: null, syncedAt: null, count: 0, images: [] });
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

  const images = named.slice(0, limit).map((f) => ({
    name: f.name,
    ...(f.path ? { path: f.path } : {}),
    url: driveFileIdToImageUrl(f.fileId),
  }));

  return apiJson({
    folderId: (library.folderId as string) ?? null,
    folderUrl: (library.folderUrl as string) ?? null,
    syncedAt: (library.syncedAt as string) ?? null,
    count: named.length,
    ...(named.length > images.length ? { truncated: true } : {}),
    images,
  });
}
