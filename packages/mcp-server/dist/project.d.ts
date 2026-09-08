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
 * Fat payloads belong to get_section, which is where an agent asks for them
 * on purpose.
 *
 * NOTE: twin of lib/mcp/project.ts (the remote /api/mcp server). The two MCP
 * servers are independent copies — keep both in sync.
 */
/** A plain-text tool result, for reference material that is not data. */
export declare function text(content: string): {
    content: {
        type: "text";
        text: string;
    }[];
};
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
/**
 * Narrows a section listing before it is projected. The REST API has no
 * filtering, so this happens here: an agent asking "which pages still need a
 * description" should not pay for the 166 that do not.
 */
export declare function filterSections(sections: unknown[], opts?: {
    subtreeOf?: string;
    withoutDescription?: boolean;
}): unknown[];
/** Full section, minus the columns that only the web app reads. */
export declare function sectionFull(section: unknown): Rec;
export declare function sectionReceipt(section: unknown, updated: string[]): Rec;
export declare function sectionCreated(section: unknown): Rec;
/** One index row. The project settings live in get_project. */
export declare function projectRow(project: unknown): Rec;
/** Project settings plus a section index — the map, not the territory. */
export declare function projectIndex(project: unknown): Rec;
export declare function projectReceipt(project: unknown, updated: string[]): Rec;
export declare function projectCreated(project: unknown): Rec;
/** Search hits as pointers: what matched and where, not the whole page. */
export declare function searchProjection(result: unknown): Rec;
/**
 * A batch write reports per section. Failures carry their reason; successes are
 * one line each, so a 50-page batch still answers in a few hundred characters.
 */
export declare function batchReceipt(result: unknown): Rec;
/**
 * Who the connection is acting as, and what that account may do.
 *
 * An agent holding an API key has no other way to know whose documents it is
 * about to edit — and the limits belong here because meeting a ceiling as a
 * 403 halfway through creating pages is a worse way to learn it.
 */
export declare function whoami(me: unknown): Rec;
/**
 * The project's team. Names, not ids, are what a human asking "who wrote this"
 * means — the id tags along for cross-referencing an activity event.
 */
export declare function memberRows(result: unknown): Rec;
/**
 * Recent history as one line per event. `detail` carries machine tokens the app
 * renders into a sentence; here a batch token becomes a plain `pages` count and
 * the rest is dropped, since 'description' only repeats what `action` said.
 */
export declare function activityRows(result: unknown): Rec;
export declare function deleted(kind: string, id: string): Rec;
export {};
