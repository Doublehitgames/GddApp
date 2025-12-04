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
