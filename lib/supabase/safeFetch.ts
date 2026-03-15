function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();

  const requestLike = input as Request;
  return typeof requestLike.url === "string" ? requestLike.url : "";
}

function isSupabaseApiUrl(url: string): boolean {
  return /\/(auth|rest|storage|functions|realtime)\/v1\//i.test(url);
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("application/problem+json");
}

const MAX_BODY_PREVIEW = 500;

function toJsonErrorResponse(
  status: number,
  error: string,
  details?: { status?: number; bodyPreview?: string }
): Response {
  const body: Record<string, unknown> = { error, ...details };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function supabaseSafeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = getRequestUrl(input);

  try {
    const response = await fetch(input, init);
    if (!isSupabaseApiUrl(url)) {
      return response;
    }
    // Qualquer 2xx: deixar passar (PostgREST pode retornar 200/201/204 com ou sem Content-Type)
    // Só tratamos como erro quando a resposta é 4xx/5xx e não é JSON (ex.: página HTML de erro)
    if (response.ok) {
      return response;
    }
    if (!isJsonContentType(response.headers.get("content-type"))) {
      let bodyPreview = "";
      try {
        const text = await response.text();
        bodyPreview = text.slice(0, MAX_BODY_PREVIEW);
        if (text.length > MAX_BODY_PREVIEW) bodyPreview += "...";
      } catch {
        bodyPreview = "(não foi possível ler o corpo da resposta)";
      }
      const fallbackStatus = response.status >= 400 ? response.status : 503;
      const hint =
        bodyPreview.trim().toLowerCase().startsWith("<!") ||
        bodyPreview.includes("<!DOCTYPE") ||
        bodyPreview.includes("<html")
          ? " Supabase retornou HTML (projeto pausado? página de erro?)."
          : "";
      return toJsonErrorResponse(fallbackStatus, `supabase_non_json_response${hint}`, {
        status: response.status,
        bodyPreview,
      });
    }
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return toJsonErrorResponse(503, `supabase_unavailable: ${message}`);
  }
}
