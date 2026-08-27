/**
 * Utilities for handling cross-references between sections using $[Section Name] or $[#sectionId] syntax
 */

export interface SectionReference {
  raw: string; // The full match like "$[Sementes]" or "$[#abc123]"
  refType: 'name' | 'id';
  refValue: string; // Either section name or section ID
  startIndex: number;
  endIndex: number;
}

/**
 * Extract all section references from markdown content
 * Supports: $[Section Name] and $[#sectionId]
 */
export function extractSectionReferences(content: string): SectionReference[] {
  const references: SectionReference[] = [];
  
  // Pattern for $[anything]
  const pattern = /\$\[([^\]]+)\]/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const rawContent = match[1].trim();
    const isId = rawContent.startsWith('#');
    
    references.push({
      raw: match[0],
      refType: isId ? 'id' : 'name',
      refValue: isId ? rawContent.substring(1) : rawContent,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return references;
}

/**
 * Find section by name (case-insensitive) or by ID
 */
export function findSection(
  sections: any[],
  ref: SectionReference
): { id: string; title: string } | null {
  if (ref.refType === 'id') {
    const found = sections.find(s => s.id === ref.refValue);
    return found ? { id: found.id, title: found.title } : null;
  } else {
    // Find by name (case-insensitive)
    const normalizedName = ref.refValue.toLowerCase().trim();
    const found = sections.find(
      s => s.title.toLowerCase().trim() === normalizedName
    );
    return found ? { id: found.id, title: found.title } : null;
  }
}

/**
 * Convert name-based references to ID-based references
 * This makes references resilient to renaming
 */
export function convertReferencesToIds(content: string, sections: any[]): string {
  const refs = extractSectionReferences(content);
  
  // Process references from right to left to avoid index shifting issues
  const refsToReplace = refs
    .filter(ref => ref.refType === 'name')
    .map(ref => {
      const section = findSection(sections, ref);
      return { ref, section };
    })
    .filter(item => item.section !== null)
    .reverse(); // Process from end to beginning

  let newContent = content;
  
  refsToReplace.forEach(({ ref, section }) => {
    if (section) {
      const newRef = `$[#${section.id}]`;
      newContent = 
        newContent.substring(0, ref.startIndex) + 
        newRef + 
        newContent.substring(ref.endIndex);
    }
  });

  return newContent;
}

/**
 * Convert ID-based references back to name-based references for editing
 * This makes the editor more user-friendly
 */
export function convertReferencesToNames(content: string, sections: any[]): string {
  const refs = extractSectionReferences(content);
  
  // Process references from right to left to avoid index shifting issues
  const refsToReplace = refs
    .filter(ref => ref.refType === 'id')
    .map(ref => {
      const section = findSection(sections, ref);
      return { ref, section };
    })
    .filter(item => item.section !== null)
    .reverse(); // Process from end to beginning

  let newContent = content;
  
  refsToReplace.forEach(({ ref, section }) => {
    if (section) {
      const newRef = `$[${section.title}]`;
      newContent = 
        newContent.substring(0, ref.startIndex) + 
        newRef + 
        newContent.substring(ref.endIndex);
    }
  });

  return newContent;
}

/**
 * Walk a richDoc/BlockNote block tree and run `mapText` over every text node —
 * including the ones nested in links and inside table cells. Structure is
 * preserved; only text changes.
 */
export function mapBlockTexts(blocks: unknown, mapText: (text: string) => string): any {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b) => _mapBlockNode(b, mapText));
}

function _mapBlockNode(block: unknown, mapText: (text: string) => string): unknown {
  if (!block || typeof block !== "object") return block;
  const b = block as any;
  const next: any = { ...b };
  if (b.content !== undefined) next.content = _mapContent(b.content, mapText);
  if (Array.isArray(b.children)) next.children = b.children.map((c: unknown) => _mapBlockNode(c, mapText));
  return next;
}

function _mapContent(content: unknown, mapText: (text: string) => string): unknown {
  // A table keeps its text in { type: "tableContent", rows: [{ cells: [...] }] },
  // not in a flat inline array — miss this branch and refs inside tables are
  // left behind.
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const obj = content as { rows?: unknown[] };
    if (Array.isArray(obj.rows)) {
      return { ...obj, rows: obj.rows.map((row) => _mapTableRow(row, mapText)) };
    }
    return content;
  }
  if (!Array.isArray(content)) return content;
  return content.map((node) => {
    if (!node || typeof node !== "object") return node;
    const n = node as any;
    if (typeof n.text === "string") {
      const text = mapText(n.text);
      return text === n.text ? node : { ...n, text };
    }
    if (n.content !== undefined) return { ...n, content: _mapContent(n.content, mapText) };
    return node;
  });
}

function _mapTableRow(row: unknown, mapText: (text: string) => string): unknown {
  if (!row || typeof row !== "object") return row;
  const r = row as { cells?: unknown[] };
  if (!Array.isArray(r.cells)) return row;
  return {
    ...r,
    cells: r.cells.map((cell) => {
      if (Array.isArray(cell)) return _mapContent(cell, mapText);
      if (cell && typeof cell === "object") {
        const c = cell as { content?: unknown };
        if (c.content === undefined) return cell;
        return { ...c, content: _mapContent(c.content, mapText) };
      }
      return cell;
    }),
  };
}

/**
 * Walk a block tree and convert `$[#uuid]` refs to `$[Section Title]` in every
 * text node. Used when seeding the editor so the user sees readable names
 * instead of raw IDs.
 */
export function convertBlockRefsToNames(blocks: unknown, sections: any[]): any {
  return mapBlockTexts(blocks, (text) =>
    text.includes("$[#") ? convertReferencesToNames(text, sections) : text
  );
}

/** Title matching for name-based refs: trimmed and case-insensitive. */
function normalizeTitle(title: string): string {
  return (title || "").trim().toLowerCase();
}

/**
 * Rewrite every `$[Old Title]` ref in `text` to `$[New Title]`.
 *
 * Matching is by exact title, case-insensitive — the same rule the renderer
 * uses to resolve a ref. `$[#id]` refs are left alone: those already follow a
 * rename on their own.
 */
export function renameReferencesInText(text: string, oldTitle: string, newTitle: string): string {
  if (!text || !text.includes("$[")) return text;
  const target = normalizeTitle(oldTitle);
  if (!target || target === normalizeTitle(newTitle)) return text;

  const hits = extractSectionReferences(text)
    .filter((ref) => ref.refType === "name" && normalizeTitle(ref.refValue) === target)
    .reverse(); // right to left, so the earlier indices stay valid

  let out = text;
  hits.forEach((ref) => {
    out = out.substring(0, ref.startIndex) + `$[${newTitle}]` + out.substring(ref.endIndex);
  });
  return out;
}

/** `renameReferencesInText` over a whole block tree. */
export function renameReferencesInBlocks(blocks: unknown, oldTitle: string, newTitle: string): any {
  return mapBlockTexts(blocks, (text) => renameReferencesInText(text, oldTitle, newTitle));
}

export type RenameRefSection = {
  id: string;
  title: string;
  content?: string | null;
  contentBlocks?: unknown;
};

/** What changed in one page's description because of a rename. */
export type RenameRefPatch = {
  id: string;
  content?: string;
  contentBlocks?: unknown;
};

/**
 * Every page whose description still points at `oldTitle` by name, patched to
 * point at `newTitle` instead. Run this on rename and a name-based ref survives
 * it.
 *
 * Refs resolve by title, so a title shared by two pages is ambiguous: the
 * renamed page's refs cannot be told apart from its twin's. In that case
 * nothing is rewritten — leaving every ref on the page that kept the name beats
 * silently repointing half of them at the renamed one.
 */
export function buildRenameRefPatches(
  sections: RenameRefSection[],
  renamedSectionId: string,
  oldTitle: string,
  newTitle: string,
): RenameRefPatch[] {
  const target = normalizeTitle(oldTitle);
  if (!target || target === normalizeTitle(newTitle)) return [];
  const hasTwin = sections.some(
    (s) => s.id !== renamedSectionId && normalizeTitle(s.title) === target
  );
  if (hasTwin) return [];

  const patches: RenameRefPatch[] = [];
  for (const section of sections) {
    const patch: RenameRefPatch = { id: section.id };
    let changed = false;

    const content = section.content ?? "";
    const nextContent = renameReferencesInText(content, oldTitle, newTitle);
    if (nextContent !== content) {
      patch.content = nextContent;
      changed = true;
    }

    if (section.contentBlocks) {
      const nextBlocks = renameReferencesInBlocks(section.contentBlocks, oldTitle, newTitle);
      if (JSON.stringify(nextBlocks) !== JSON.stringify(section.contentBlocks)) {
        patch.contentBlocks = nextBlocks;
        changed = true;
      }
    }

    if (changed) patches.push(patch);
  }
  return patches;
}

/**
 * Validate if all references in content exist in the project
 */
export function validateReferences(
  content: string,
  sections: any[]
): { valid: SectionReference[]; invalid: SectionReference[] } {
  const refs = extractSectionReferences(content);
  const valid: SectionReference[] = [];
  const invalid: SectionReference[] = [];

  refs.forEach((ref) => {
    const found = findSection(sections, ref);
    if (found) {
      valid.push(ref);
    } else {
      invalid.push(ref);
    }
  });

  return { valid, invalid };
}

/**
 * Get all sections that reference a specific section (backlinks)
 */
export function getBacklinks(
  sectionId: string,
  sections: any[]
): Array<{ id: string; title: string }> {
  const backlinks: Array<{ id: string; title: string }> = [];

  sections.forEach((section) => {
    if (section.id === sectionId) return;

    const content = section.content || "";
    const refs = extractSectionReferences(content);

    refs.forEach((ref) => {
      const target = findSection(sections, ref);
      if (target && target.id === sectionId) {
        if (!backlinks.find((b) => b.id === section.id)) {
          backlinks.push({ id: section.id, title: section.title });
        }
      }
    });
  });

  return backlinks;
}
