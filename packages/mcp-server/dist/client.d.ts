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
    listProjectImages(id: string, match?: string): Promise<unknown>;
    listSections(projectId: string): Promise<unknown>;
    getSection(projectId: string, sectionId: string): Promise<unknown>;
    createSection(projectId: string, params: Record<string, unknown>): Promise<unknown>;
    updateSection(projectId: string, sectionId: string, params: Record<string, unknown>): Promise<unknown>;
    /** One request for many sections: see PATCH /projects/:id/sections. */
    batchUpdateSections(projectId: string, sections: Record<string, unknown>[]): Promise<unknown>;
    deleteSection(projectId: string, sectionId: string): Promise<unknown>;
    search(q: string, type?: string, limit?: number): Promise<unknown>;
}
