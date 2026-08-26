/**
 * Server-level instructions, sent once in the MCP initialize response.
 *
 * The MCP spec describes this field as a hint to improve the model's
 * understanding of the server. It is the right home for conventions that apply
 * to every write but do not belong in any single tool's schema — cross-
 * references being the one that agents otherwise never discover, because
 * nothing in a plain-text write suggests they exist.
 *
 * Keep it short: it is loaded into context on every session.
 *
 * NOTE: twin of lib/mcp/instructions.ts (the remote /api/mcp server). The two
 * MCP servers are independent copies — keep both in sync.
 */
export declare const SERVER_INSTRUCTIONS = "GDD Manager holds game design documents as a tree of pages. Each page has a title and a prose description, and may carry a dataId used by the game's data pipeline.\n\nCROSS-REFERENCES \u2014 the convention agents most often miss:\nWhenever a description mentions something that has its own page, write it as $[Exact Page Title]. It is plain text in `content` and inside the text of a `contentBlocks` node; the app renders it as a clickable link. Matching is by exact title, case-insensitive \u2014 and emoji are part of the title, so $[\uD83E\uDDB4Osso] is right and $[Osso] is not. Use list_sections to confirm a title before referencing it. Prefer a reference over a bare mention: \"mo\u00EDdo no $[Moinho]\" beats \"mo\u00EDdo no Moinho\".\n\nWRITING DESCRIPTIONS:\nA description is prose with design value \u2014 context, role, flavour, how the thing connects to the rest of the game. It is not a spec sheet: do not restate numbers, prices, currencies, quantities or ids that the page already displays on its own. Send `content` as markdown and the server derives `contentBlocks` from it, so the two cannot disagree; send `contentBlocks` yourself only when you need headings, tables or callouts, and pair it with a plain-text `content` for search.\n\nCONVENTIONS PER PROJECT:\nA project may carry its own rules in `aiInstructions`. Read them with get_project before writing, and follow them over these defaults when they disagree.\n\nCOST:\nWrites return a receipt, not the page \u2014 read a page back with get_section when you need its contents. Use batch_update_sections instead of looping update_section. Narrow list_sections with subtreeOf / withoutDescription instead of listing everything and filtering yourself.";
