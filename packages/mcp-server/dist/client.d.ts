/**
 * HTTP client for GDD Manager REST API (/api/v1/*).
 *
 * Reads GDD_API_KEY and GDD_API_URL from environment.
 * Uses native fetch (Node 18+).
 */
export declare class GddApiError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string);
}
export declare class GddApiClient {
    private baseUrl;
    private apiKey;
    constructor();
    private request;
    listProjects(): Promise<unknown>;
    getProject(id: string, addons?: "types" | "none"): Promise<unknown>;
    createProject(params: {
        title: string;
        description?: string;
    }): Promise<unknown>;
    updateProject(id: string, params: Record<string, unknown>): Promise<unknown>;
    deleteProject(id: string): Promise<unknown>;
    listLinkedSpreadsheets(id: string): Promise<unknown>;
    listProjectImages(id: string, match?: string): Promise<unknown>;
    /** `addons: "types"` keeps the heavy balance_addons payload off the wire. */
    listSections(projectId: string, addons?: "types" | "none"): Promise<unknown>;
    getSection(projectId: string, sectionId: string): Promise<unknown>;
    createSection(projectId: string, params: Record<string, unknown>): Promise<unknown>;
    /** `addons: "none"` keeps the re-read light when the caller only wants a receipt. */
    updateSection(projectId: string, sectionId: string, params: Record<string, unknown>, addons?: "types" | "none"): Promise<unknown>;
    /** One request for many sections: see PATCH /projects/:id/sections. */
    batchUpdateSections(projectId: string, sections: Record<string, unknown>[]): Promise<unknown>;
    deleteSection(projectId: string, sectionId: string): Promise<unknown>;
    listAddons(projectId: string, sectionId: string): Promise<unknown>;
    createAddon(projectId: string, sectionId: string, params: Record<string, unknown>): Promise<unknown>;
    updateAddon(projectId: string, sectionId: string, addonId: string, params: Record<string, unknown>): Promise<unknown>;
    deleteAddon(projectId: string, sectionId: string, addonId: string): Promise<unknown>;
    copyAddon(projectId: string, sectionId: string, addonId: string, toSectionId: string, overwrite?: boolean): Promise<unknown>;
    moveAddon(projectId: string, sectionId: string, addonId: string, toSectionId: string, overwrite?: boolean): Promise<unknown>;
    getRemoteConfig(projectId: string, opts?: {
        sectionId?: string;
        addonId?: string;
    }): Promise<unknown>;
    search(q: string, type?: string, limit?: number): Promise<unknown>;
}
