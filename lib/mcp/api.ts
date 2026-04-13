/**
 * Internal fetch wrapper for MCP tools.
 * Calls /api/v1/* on the same host with the user's API key.
 */

export class McpApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "McpApiError";
  }
}

export function createApiFetcher(apiKey: string, baseUrl: string) {
  async function api(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      throw new McpApiError(
        (json.error as string) ?? `HTTP ${res.status}`,
        res.status,
        (json.code as string) ?? "unknown",
      );
    }

    return json.data;
  }

  return {
    // Projects
    listProjects: () => api("GET", "/projects"),
    getProject: (id: string) => api("GET", `/projects/${id}`),
    createProject: (params: { title: string; description?: string }) => api("POST", "/projects", params),
    updateProject: (id: string, params: Record<string, unknown>) => api("PATCH", `/projects/${id}`, params),
    deleteProject: (id: string) => api("DELETE", `/projects/${id}`),

    // Sections
    listSections: (projectId: string) => api("GET", `/projects/${projectId}/sections`),
    getSection: (projectId: string, sectionId: string) => api("GET", `/projects/${projectId}/sections/${sectionId}`),
    createSection: (projectId: string, params: Record<string, unknown>) => api("POST", `/projects/${projectId}/sections`, params),
    updateSection: (projectId: string, sectionId: string, params: Record<string, unknown>) => api("PATCH", `/projects/${projectId}/sections/${sectionId}`, params),
    deleteSection: (projectId: string, sectionId: string) => api("DELETE", `/projects/${projectId}/sections/${sectionId}`),

    // Addons
    listAddons: (projectId: string, sectionId: string) => api("GET", `/projects/${projectId}/sections/${sectionId}/addons`),
    createAddon: (projectId: string, sectionId: string, params: Record<string, unknown>) => api("POST", `/projects/${projectId}/sections/${sectionId}/addons`, params),
    updateAddon: (projectId: string, sectionId: string, addonId: string, params: Record<string, unknown>) => api("PATCH", `/projects/${projectId}/sections/${sectionId}/addons/${addonId}`, params),
    deleteAddon: (projectId: string, sectionId: string, addonId: string) => api("DELETE", `/projects/${projectId}/sections/${sectionId}/addons/${addonId}`),

    // Search
    search: (q: string, type?: string, limit?: number) => {
      const params = new URLSearchParams({ q });
      if (type) params.set("type", type);
      if (limit) params.set("limit", String(limit));
      return api("GET", `/search?${params}`);
    },
  };
}

export type ApiFetcher = ReturnType<typeof createApiFetcher>;
