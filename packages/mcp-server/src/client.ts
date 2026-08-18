/**
 * HTTP client for GDD Manager REST API (/api/v1/*).
 *
 * Reads GDD_API_KEY and GDD_API_URL from environment.
 * Uses native fetch (Node 18+).
 */

export class GddApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "GddApiError";
  }
}

export class GddApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const key = process.env.GDD_API_KEY;
    if (!key) throw new Error("GDD_API_KEY environment variable is required");
    this.apiKey = key;
    this.baseUrl = (process.env.GDD_API_URL || "https://gdd-app.vercel.app").replace(/\/$/, "");
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
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
      throw new GddApiError(
        (json.error as string) ?? `HTTP ${res.status}`,
        res.status,
        (json.code as string) ?? "unknown",
      );
    }

    return json.data;
  }

  // ── Projects ──────────────────────────────────────────────────────

  async listProjects() {
    return this.request("GET", "/projects");
  }

  async getProject(id: string, addons?: "types" | "none") {
    const qs = addons ? `?addons=${addons}` : "";
    return this.request("GET", `/projects/${id}${qs}`);
  }

  async createProject(params: { title: string; description?: string }) {
    return this.request("POST", "/projects", params);
  }

  async updateProject(id: string, params: Record<string, unknown>) {
    return this.request("PATCH", `/projects/${id}`, params);
  }

  async deleteProject(id: string) {
    return this.request("DELETE", `/projects/${id}`);
  }

  async listLinkedSpreadsheets(id: string) {
    return this.request("GET", `/projects/${id}/spreadsheets`);
  }

  // ── Sections ──────────────────────────────────────────────────────

  /** `addons: "types"` keeps the heavy balance_addons payload off the wire. */
  async listSections(projectId: string, addons?: "types" | "none") {
    const qs = addons ? `?addons=${addons}` : "";
    return this.request("GET", `/projects/${projectId}/sections${qs}`);
  }

  async getSection(projectId: string, sectionId: string) {
    return this.request("GET", `/projects/${projectId}/sections/${sectionId}`);
  }

  async createSection(projectId: string, params: Record<string, unknown>) {
    return this.request("POST", `/projects/${projectId}/sections`, params);
  }

  async updateSection(projectId: string, sectionId: string, params: Record<string, unknown>) {
    return this.request("PATCH", `/projects/${projectId}/sections/${sectionId}`, params);
  }

  async deleteSection(projectId: string, sectionId: string) {
    return this.request("DELETE", `/projects/${projectId}/sections/${sectionId}`);
  }

  // ── Addons ────────────────────────────────────────────────────────

  async listAddons(projectId: string, sectionId: string) {
    return this.request("GET", `/projects/${projectId}/sections/${sectionId}/addons`);
  }

  async createAddon(projectId: string, sectionId: string, params: Record<string, unknown>) {
    return this.request("POST", `/projects/${projectId}/sections/${sectionId}/addons`, params);
  }

  async updateAddon(projectId: string, sectionId: string, addonId: string, params: Record<string, unknown>) {
    return this.request("PATCH", `/projects/${projectId}/sections/${sectionId}/addons/${addonId}`, params);
  }

  async deleteAddon(projectId: string, sectionId: string, addonId: string) {
    return this.request("DELETE", `/projects/${projectId}/sections/${sectionId}/addons/${addonId}`);
  }

  async copyAddon(projectId: string, sectionId: string, addonId: string, toSectionId: string, overwrite?: boolean) {
    return this.request(
      "POST",
      `/projects/${projectId}/sections/${sectionId}/addons/${addonId}/copy`,
      { toSectionId, overwrite },
    );
  }

  async moveAddon(projectId: string, sectionId: string, addonId: string, toSectionId: string, overwrite?: boolean) {
    return this.request(
      "POST",
      `/projects/${projectId}/sections/${sectionId}/addons/${addonId}/move`,
      { toSectionId, overwrite },
    );
  }

  // ── Remote Config (resolved economy) ──────────────────────────────

  async getRemoteConfig(projectId: string, opts: { sectionId?: string; addonId?: string } = {}) {
    const params = new URLSearchParams();
    if (opts.sectionId) params.set("sectionId", opts.sectionId);
    if (opts.addonId) params.set("addonId", opts.addonId);
    const qs = params.toString();
    return this.request("GET", `/projects/${projectId}/remote-config${qs ? `?${qs}` : ""}`);
  }

  // ── Search ────────────────────────────────────────────────────────

  async search(q: string, type?: string, limit?: number) {
    const params = new URLSearchParams({ q });
    if (type) params.set("type", type);
    if (limit) params.set("limit", String(limit));
    return this.request("GET", `/search?${params}`);
  }
}
