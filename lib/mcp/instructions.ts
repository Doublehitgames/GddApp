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
 * NOTE: twin of packages/mcp-server/src/instructions.ts (the stdio server).
 * The two MCP servers are independent copies — keep both in sync.
 */

export const SERVER_INSTRUCTIONS = `GDD Manager holds game design documents as a tree of pages. Each page has a title and a prose description, and may carry a dataId used by the game's data pipeline.

CROSS-REFERENCES — the convention agents most often miss:
Whenever a description mentions something that has its own page, write it as $[Exact Page Title]. It is plain text in \`content\` and inside the text of a \`contentBlocks\` node; the app renders it as a clickable link. Matching is by exact title, case-insensitive — and emoji are part of the title, so $[🦴Osso] is right and $[Osso] is not. Use list_sections to confirm a title before referencing it. Prefer a reference over a bare mention: "moído no $[Moinho]" beats "moído no Moinho".

WRITING DESCRIPTIONS:
A description is prose with design value — context, role, flavour, how the thing connects to the rest of the game. It is not a spec sheet: do not restate numbers, prices, currencies, quantities or ids that the page already displays on its own. Send \`content\` as markdown and the server derives \`contentBlocks\` from it, so the two cannot disagree; send \`contentBlocks\` yourself only when you need headings, tables or callouts, and pair it with a plain-text \`content\` for search.

PAGE STATUS:
A page may carry a \`status\`: draft, review, approved, implemented or obsolete. It is the team's own signal of what can be trusted, so read it before rewriting and leave it alone unless you were asked to change it — a page marked approved or implemented was a decision someone made.

WHAT CHANGED, AND WHEN:
A page carries two dates. \`contentUpdatedAt\` is when its text last changed; \`updatedAt\` also moves for a colour, an order or a parent. To find what was actually rewritten since some moment, compare against \`contentUpdatedAt\`.

CONVENTIONS PER PROJECT:
A project may carry its own rules in \`aiInstructions\`. Read them with get_project before writing, and follow them over these defaults when they disagree.

COST:
Writes return a receipt, not the page — read a page back with get_section when you need its contents. Use batch_update_sections instead of looping update_section. Narrow list_sections with subtreeOf / withoutDescription instead of listing everything and filtering yourself.`;
