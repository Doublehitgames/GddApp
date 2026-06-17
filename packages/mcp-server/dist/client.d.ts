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
    getProject(id: string): Promise<unknown>;
    createProject(params: {
        title: string;
        description?: string;
    }): Promise<unknown>;
    updateProject(id: string, params: Record<string, unknown>): Promise<unknown>;
    deleteProject(id: string): Promise<unknown>;
    listLinkedSpreadsheets(id: string): Promise<unknown>;
    listSections(projectId: string): Promise<unknown>;
    getSection(projectId: string, sectionId: string): Promise<unknown>;
    createSection(projectId: string, params: Record<string, unknown>): Promise<unknown>;
    updateSection(projectId: string, sectionId: string, params: Record<string, unknown>): Promise<unknown>;
    deleteSection(projectId: string, sectionId: string): Promise<unknown>;
    listAddons(projectId: string, sectionId: string): Promise<unknown>;
    createAddon(projectId: string, sectionId: string, params: Record<string, unknown>): Promise<unknown>;
    updateAddon(projectId: string, sectionId: string, addonId: string, params: Record<string, unknown>): Promise<unknown>;
    deleteAddon(projectId: string, sectionId: string, addonId: string): Promise<unknown>;
    copyAddon(projectId: string, sectionId: string, addonId: string, toSectionId: string, overwrite?: boolean): Promise<unknown>;
    moveAddon(projectId: string, sectionId: string, addonId: string, toSectionId: string, overwrite?: boolean): Promise<unknown>;
    search(q: string, type?: string, limit?: number): Promise<unknown>;
}
