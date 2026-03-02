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

function toJsonErrorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function supabaseSafeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = getRequestUrl(input);

  try {
    const response = await fetch(input, init);
    if (isSupabaseApiUrl(url) && !isJsonContentType(response.headers.get("content-type"))) {
      const fallbackStatus = response.status >= 400 ? response.status : 503;
      return toJsonErrorResponse(fallbackStatus, "supabase_non_json_response");
    }
    return response;
  } catch {
    return toJsonErrorResponse(503, "supabase_unavailable");
  }
}
