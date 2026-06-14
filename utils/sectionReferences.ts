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
 * Walk a BlockNote block tree and convert `$[#uuid]` refs to `$[Section Title]`
 * in every text node. Used when seeding the editor so the user sees readable
 * names instead of raw IDs.
 */
export function convertBlockRefsToNames(blocks: unknown, sections: any[]): any {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b) => _convertBlockNode(b, sections));
}

function _convertBlockNode(block: unknown, sections: any[]): unknown {
  if (!block || typeof block !== "object") return block;
  const b = block as any;
  const next: any = { ...b };
  if (b.content !== undefined) next.content = _convertContent(b.content, sections);
  if (Array.isArray(b.children)) next.children = b.children.map((c: unknown) => _convertBlockNode(c, sections));
  return next;
}

function _convertContent(content: unknown, sections: any[]): unknown {
  if (!Array.isArray(content)) return content;
  return content.map((node) => {
    if (!node || typeof node !== "object") return node;
    const n = node as any;
    if (typeof n.text === "string" && n.text.includes("$[#")) {
      return { ...n, text: convertReferencesToNames(n.text, sections) };
    }
    if (n.type === "link" && Array.isArray(n.content)) {
      return { ...n, content: _convertContent(n.content, sections) };
    }
    return node;
  });
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
