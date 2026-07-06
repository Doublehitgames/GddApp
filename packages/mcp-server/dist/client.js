/**
 * HTTP client for GDD Manager REST API (/api/v1/*).
 *
 * Reads GDD_API_KEY and GDD_API_URL from environment.
 * Uses native fetch (Node 18+).
 */
export class GddApiError extends Error {
    status;
    code;
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = "GddApiError";
    }
}
export class GddApiClient {
    baseUrl;
    apiKey;
    constructor() {
        const key = process.env.GDD_API_KEY;
        if (!key)
            throw new Error("GDD_API_KEY environment variable is required");
        this.apiKey = key;
        this.baseUrl = (process.env.GDD_API_URL || "https://gdd-app.vercel.app").replace(/\/$/, "");
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}/api/v1${path}`;
        const headers = {
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
        const json = (await res.json());
        if (!res.ok) {
            throw new GddApiError(json.error ?? `HTTP ${res.status}`, res.status, json.code ?? "unknown");
        }
        return json.data;
    }
    // ── Projects ──────────────────────────────────────────────────────
    async listProjects() {
        return this.request("GET", "/projects");
    }
    async getProject(id) {
        return this.request("GET", `/projects/${id}`);
    }
    async createProject(params) {
        return this.request("POST", "/projects", params);
    }
    async updateProject(id, params) {
        return this.request("PATCH", `/projects/${id}`, params);
    }
    async deleteProject(id) {
        return this.request("DELETE", `/projects/${id}`);
    }
    async listLinkedSpreadsheets(id) {
        return this.request("GET", `/projects/${id}/spreadsheets`);
    }
    // ── Sections ──────────────────────────────────────────────────────
    async listSections(projectId) {
        return this.request("GET", `/projects/${projectId}/sections`);
    }
    async getSection(projectId, sectionId) {
        return this.request("GET", `/projects/${projectId}/sections/${sectionId}`);
    }
    async createSection(projectId, params) {
        return this.request("POST", `/projects/${projectId}/sections`, params);
    }
    async updateSection(projectId, sectionId, params) {
        return this.request("PATCH", `/projects/${projectId}/sections/${sectionId}`, params);
    }
    async deleteSection(projectId, sectionId) {
        return this.request("DELETE", `/projects/${projectId}/sections/${sectionId}`);
    }
    // ── Addons ────────────────────────────────────────────────────────
    async listAddons(projectId, sectionId) {
        return this.request("GET", `/projects/${projectId}/sections/${sectionId}/addons`);
    }
    async createAddon(projectId, sectionId, params) {
        return this.request("POST", `/projects/${projectId}/sections/${sectionId}/addons`, params);
    }
    async updateAddon(projectId, sectionId, addonId, params) {
        return this.request("PATCH", `/projects/${projectId}/sections/${sectionId}/addons/${addonId}`, params);
    }
    async deleteAddon(projectId, sectionId, addonId) {
        return this.request("DELETE", `/projects/${projectId}/sections/${sectionId}/addons/${addonId}`);
    }
    async copyAddon(projectId, sectionId, addonId, toSectionId, overwrite) {
        return this.request("POST", `/projects/${projectId}/sections/${sectionId}/addons/${addonId}/copy`, { toSectionId, overwrite });
    }
    async moveAddon(projectId, sectionId, addonId, toSectionId, overwrite) {
        return this.request("POST", `/projects/${projectId}/sections/${sectionId}/addons/${addonId}/move`, { toSectionId, overwrite });
    }
    // ── Remote Config (resolved economy) ──────────────────────────────
    async getRemoteConfig(projectId, opts = {}) {
        const params = new URLSearchParams();
        if (opts.sectionId)
            params.set("sectionId", opts.sectionId);
        if (opts.addonId)
            params.set("addonId", opts.addonId);
        const qs = params.toString();
        return this.request("GET", `/projects/${projectId}/remote-config${qs ? `?${qs}` : ""}`);
    }
    // ── Search ────────────────────────────────────────────────────────
    async search(q, type, limit) {
        const params = new URLSearchParams({ q });
        if (type)
            params.set("type", type);
        if (limit)
            params.set("limit", String(limit));
        return this.request("GET", `/search?${params}`);
    }
}
//# sourceMappingURL=client.js.map