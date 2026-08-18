/**
 * Response projection for MCP tools.
 *
 * The REST API returns whole records. Echoing them back to the agent costs
 * thousands of tokens per call for data it already has or did not ask for:
 * a 150-character description edit on an animal page used to come back as
 * 78 KB, and listing a 185-page project as 2.1 MB.
 *
 * The rule: a write returns a receipt (proof it saved, plus the ids the agent
 * could not know), a listing returns index rows, a read returns everything.
 * Fat payloads belong to get_section / get_project(includeAddons) /
 * get_remote_config, which is where an agent asks for them on purpose.
 *
 * NOTE: twin of lib/mcp/project.ts (the remote /api/mcp server). The two MCP
 * servers are independent copies — keep both in sync.
 */
/** Compact JSON. Pretty-printing costs ~45% more tokens and buys the agent nothing. */
export declare function json(data: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
};
type Rec = Record<string, unknown>;
/** Field names the caller actually sent — drops keys left undefined by the schema. */
export declare function touched(fields: Rec): string[];
/** One index row: enough to navigate and to decide what to open next. */
export declare function sectionRow(section: unknown): Rec;
/** Full section, minus the columns that only the web app reads. */
export declare function sectionFull(section: unknown): Rec;
export declare function sectionReceipt(section: unknown, updated: string[]): Rec;
export declare function sectionCreated(section: unknown): Rec;
/** One index row: identity only. The data lives in get_section. */
export declare function addonRow(addon: unknown): Rec;
export declare function addonReceipt(addon: unknown, sectionId: string, updated: string[]): Rec;
export declare function addonCreated(addon: unknown, sectionId: string): Rec;
/** copy_addon returns the inserted addon; move_addon wraps it with a ref count. */
export declare function addonMoved(result: unknown, toSectionId: string): Rec;
/** One index row. Settings (aiInstructions, mindmap, sheets) live in get_project. */
export declare function projectRow(project: unknown): Rec;
/** Project settings plus a section index — the map, not the territory. */
export declare function projectIndex(project: unknown): Rec;
/** Full project with every addon, minus the per-section UI/audit noise. */
export declare function projectFull(project: unknown): Rec;
export declare function projectReceipt(project: unknown, updated: string[]): Rec;
export declare function projectCreated(project: unknown): Rec;
/** Search hits as pointers: what matched and where, not the whole page. */
export declare function searchProjection(result: unknown): Rec;
export declare function deleted(kind: string, id: string): Rec;
export {};
