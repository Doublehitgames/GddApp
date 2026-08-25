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
/** A plain-text tool result, for reference material that is not data. */
export function text(content) {
    return { content: [{ type: "text", text: content }] };
}
/** Compact JSON. Pretty-printing costs ~45% more tokens and buys the agent nothing. */
export function json(data) {
    return text(JSON.stringify(data));
}
const asRec = (v) => (v && typeof v === "object" ? v : {});
/** Field names the caller actually sent — drops keys left undefined by the schema. */
export function touched(fields) {
    return Object.keys(fields).filter((k) => fields[k] !== undefined);
}
// ── Sections ──────────────────────────────────────────────────────
/** UI-only or audit columns that never help an agent reason about a section. */
const SECTION_NOISE = [
    "flowchartState",
    "createdBy",
    "createdByName",
    "updatedBy",
    "updatedByName",
];
/** One index row: enough to navigate and to decide what to open next. */
export function sectionRow(section) {
    const s = asRec(section);
    const blocks = Array.isArray(s.contentBlocks) ? s.contentBlocks : [];
    // The REST layer sends either full addon objects or, when asked for
    // `?addons=types`, just their type names. Either way the row shows types.
    const types = Array.isArray(s.addonTypes)
        ? s.addonTypes.filter((t) => typeof t === "string")
        : (Array.isArray(s.addons) ? s.addons : []).map((a) => asRec(a).type).filter((t) => typeof t === "string");
    return {
        id: s.id,
        title: s.title,
        ...(s.parentId ? { parentId: s.parentId } : {}),
        order: s.order,
        ...(s.dataId ? { dataId: s.dataId } : {}),
        ...(s.content || blocks.length ? { hasDescription: true } : {}),
        ...(types.length ? { addons: types } : {}),
    };
}
/**
 * Narrows a section listing before it is projected. The REST API has no
 * filtering, so this happens here: an agent asking "which pages still need a
 * description" should not pay for the 166 that do not.
 */
export function filterSections(sections, opts = {}) {
    let out = sections;
    if (opts.subtreeOf) {
        // Walk down from the root by parentId; a page's children may sit anywhere
        // in the array, so keep sweeping until the set stops growing.
        const keep = new Set([opts.subtreeOf]);
        let grew = true;
        while (grew) {
            grew = false;
            for (const section of out) {
                const s = asRec(section);
                const id = String(s.id);
                if (!keep.has(id) && typeof s.parentId === "string" && keep.has(s.parentId)) {
                    keep.add(id);
                    grew = true;
                }
            }
        }
        out = out.filter((section) => keep.has(String(asRec(section).id)));
    }
    if (opts.withoutDescription) {
        out = out.filter((section) => {
            const s = asRec(section);
            const blocks = Array.isArray(s.contentBlocks) ? s.contentBlocks : [];
            return !s.content && blocks.length === 0;
        });
    }
    if (opts.hasAddonType) {
        out = out.filter((section) => {
            const s = asRec(section);
            if (Array.isArray(s.addonTypes))
                return s.addonTypes.includes(opts.hasAddonType);
            return Array.isArray(s.addons) && s.addons.some((a) => asRec(a).type === opts.hasAddonType);
        });
    }
    return out;
}
/** Full section, minus the columns that only the web app reads. */
export function sectionFull(section) {
    const s = { ...asRec(section) };
    for (const k of SECTION_NOISE)
        delete s[k];
    return s;
}
export function sectionReceipt(section, updated) {
    const s = asRec(section);
    return { ok: true, id: s.id, title: s.title, updated, updatedAt: s.updatedAt };
}
export function sectionCreated(section) {
    const s = asRec(section);
    return {
        ok: true,
        id: s.id,
        title: s.title,
        ...(s.parentId ? { parentId: s.parentId } : {}),
        order: s.order,
        ...(s.dataId ? { dataId: s.dataId } : {}),
        createdAt: s.createdAt,
    };
}
// ── Addons ────────────────────────────────────────────────────────
/** One index row: identity only. The data lives in get_section. */
export function addonRow(addon) {
    const a = asRec(addon);
    return {
        id: a.id,
        type: a.type,
        name: a.name,
        ...(a.group ? { group: a.group } : {}),
    };
}
export function addonReceipt(addon, sectionId, updated) {
    const a = asRec(addon);
    return { ok: true, id: a.id, type: a.type, name: a.name, sectionId, updated };
}
export function addonCreated(addon, sectionId) {
    const a = asRec(addon);
    return { ok: true, id: a.id, type: a.type, name: a.name, sectionId };
}
/** copy_addon returns the inserted addon; move_addon wraps it with a ref count. */
export function addonMoved(result, toSectionId) {
    const r = asRec(result);
    const addon = "addon" in r ? asRec(r.addon) : r;
    return {
        ok: true,
        id: addon.id,
        type: addon.type,
        name: addon.name,
        toSectionId,
        ...(typeof r.reverseRefsUpdated === "number" ? { reverseRefsUpdated: r.reverseRefsUpdated } : {}),
    };
}
// ── Projects ──────────────────────────────────────────────────────
/** One index row. Settings (aiInstructions, mindmap, sheets) live in get_project. */
export function projectRow(project) {
    const p = asRec(project);
    return {
        id: p.id,
        title: p.title,
        ...(p.description ? { description: p.description } : {}),
        updatedAt: p.updatedAt,
    };
}
/** Project settings plus a section index — the map, not the territory. */
export function projectIndex(project) {
    const p = asRec(project);
    const sections = Array.isArray(p.sections) ? p.sections : [];
    return {
        id: p.id,
        title: p.title,
        ...(p.description ? { description: p.description } : {}),
        ...(p.aiInstructions ? { aiInstructions: p.aiInstructions } : {}),
        ...(p.mindmapSettings ? { mindmapSettings: p.mindmapSettings } : {}),
        ...(p.linkedSpreadsheets ? { linkedSpreadsheets: p.linkedSpreadsheets } : {}),
        // Just the count — the library itself lives in list_project_images.
        ...(p.imageCount ? { imageCount: p.imageCount } : {}),
        updatedAt: p.updatedAt,
        sectionCount: sections.length,
        sections: sections.map(sectionRow),
    };
}
/** Full project with every addon, minus the per-section UI/audit noise. */
export function projectFull(project) {
    const p = { ...asRec(project) };
    if (Array.isArray(p.sections))
        p.sections = p.sections.map(sectionFull);
    return p;
}
export function projectReceipt(project, updated) {
    const p = asRec(project);
    return { ok: true, id: p.id, title: p.title, updated, updatedAt: p.updatedAt };
}
export function projectCreated(project) {
    const p = asRec(project);
    return { ok: true, id: p.id, title: p.title, createdAt: p.createdAt };
}
// ── Search ────────────────────────────────────────────────────────
const EXCERPT = 200;
/** Search hits as pointers: what matched and where, not the whole page. */
export function searchProjection(result) {
    const r = asRec(result);
    const projects = Array.isArray(r.projects) ? r.projects : [];
    const sections = Array.isArray(r.sections) ? r.sections : [];
    return {
        projects: projects.map(projectRow),
        sections: sections.map((section) => {
            const s = asRec(section);
            const content = typeof s.content === "string" ? s.content : "";
            return {
                id: s.id,
                projectId: s.projectId,
                title: s.title,
                ...(s.dataId ? { dataId: s.dataId } : {}),
                ...(content ? { excerpt: content.slice(0, EXCERPT) } : {}),
            };
        }),
    };
}
/**
 * A batch write reports per section. Failures carry their reason; successes are
 * one line each, so a 50-page batch still answers in a few hundred characters.
 */
export function batchReceipt(result) {
    const r = asRec(result);
    const rows = Array.isArray(r.results) ? r.results : [];
    const failures = rows.map(asRec).filter((row) => row.ok !== true);
    return {
        ok: failures.length === 0,
        updated: r.updated,
        failed: r.failed,
        ...(failures.length
            ? { failures: failures.map((row) => ({ sectionId: row.sectionId, error: row.error })) }
            : {}),
    };
}
// ── Deletes ───────────────────────────────────────────────────────
export function deleted(kind, id) {
    return { ok: true, deleted: kind, id };
}
//# sourceMappingURL=project.js.map