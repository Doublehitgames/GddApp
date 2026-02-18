/**
 * Testes para utilitários de referências cruzadas entre seções
 * Testa o sistema de links $[Section Name] e $[#sectionId]
 */

import {
  extractSectionReferences,
  findSection,
  convertReferencesToIds,
  convertReferencesToNames,
  validateReferences,
  getBacklinks,
  SectionReference,
} from '@/utils/sectionReferences'

describe('Section References Utils', () => {
  const mockSections = [
    { id: 'section-1', title: 'Game Mechanics', content: 'Content 1' },
    { id: 'section-2', title: 'Combat System', content: 'Content 2' },
    { id: 'section-3', title: 'Level Design', content: 'Content 3' },
    { id: 'section-4', title: 'Items', content: 'References: $[Combat System] and $[#section-3]' },
  ]

  describe('extractSectionReferences', () => {
    it('should extract name-based references', () => {
      const content = 'Check out $[Game Mechanics] for details.'
      const refs = extractSectionReferences(content)

      expect(refs).toHaveLength(1)
      expect(refs[0].raw).toBe('$[Game Mechanics]')
      expect(refs[0].refType).toBe('name')
      expect(refs[0].refValue).toBe('Game Mechanics')
      expect(refs[0].startIndex).toBe(10)
    })

    it('should extract ID-based references', () => {
      const content = 'See $[#section-1] for more info.'
      const refs = extractSectionReferences(content)

      expect(refs).toHaveLength(1)
      expect(refs[0].raw).toBe('$[#section-1]')
      expect(refs[0].refType).toBe('id')
      expect(refs[0].refValue).toBe('section-1')
    })

    it('should extract multiple references', () => {
      const content = 'Check $[Game Mechanics] and $[Combat System] and $[#section-3]'
      const refs = extractSectionReferences(content)

      expect(refs).toHaveLength(3)
      expect(refs[0].refValue).toBe('Game Mechanics')
      expect(refs[1].refValue).toBe('Combat System')
      expect(refs[2].refValue).toBe('section-3')
    })

    it('should handle references with spaces', () => {
      const content = '$[  Game Mechanics  ]'
      const refs = extractSectionReferences(content)

      expect(refs).toHaveLength(1)
      expect(refs[0].refValue).toBe('Game Mechanics')
    })

    it('should return empty array for no references', () => {
      const content = 'This is plain text without any references.'
      const refs = extractSectionReferences(content)

      expect(refs).toHaveLength(0)
    })

    it('should handle empty content', () => {
      const refs = extractSectionReferences('')
      expect(refs).toHaveLength(0)
    })

    it('should extract references in markdown formatted text', () => {
      const content = `
# Title
This section references $[Combat System] and also $[#section-1].

## Subsection
- Item 1: $[Level Design]
- Item 2: regular text
      `
      const refs = extractSectionReferences(content)

      expect(refs).toHaveLength(3)
    })
  })

  describe('findSection', () => {
    it('should find section by name (case-insensitive)', () => {
      const ref: SectionReference = {
        raw: '$[game mechanics]',
        refType: 'name',
        refValue: 'game mechanics',
        startIndex: 0,
        endIndex: 17,
      }

      const found = findSection(mockSections, ref)

      expect(found).not.toBeNull()
      expect(found?.id).toBe('section-1')
      expect(found?.title).toBe('Game Mechanics')
    })

    it('should find section by exact name', () => {
      const ref: SectionReference = {
        raw: '$[Combat System]',
        refType: 'name',
        refValue: 'Combat System',
        startIndex: 0,
        endIndex: 16,
      }

      const found = findSection(mockSections, ref)

      expect(found).not.toBeNull()
      expect(found?.id).toBe('section-2')
    })

    it('should find section by ID', () => {
      const ref: SectionReference = {
        raw: '$[#section-3]',
        refType: 'id',
        refValue: 'section-3',
        startIndex: 0,
        endIndex: 13,
      }

      const found = findSection(mockSections, ref)

      expect(found).not.toBeNull()
      expect(found?.id).toBe('section-3')
      expect(found?.title).toBe('Level Design')
    })

    it('should return null for non-existent name', () => {
      const ref: SectionReference = {
        raw: '$[Non Existent]',
        refType: 'name',
        refValue: 'Non Existent',
        startIndex: 0,
        endIndex: 15,
      }

      const found = findSection(mockSections, ref)
      expect(found).toBeNull()
    })

    it('should return null for non-existent ID', () => {
      const ref: SectionReference = {
        raw: '$[#invalid-id]',
        refType: 'id',
        refValue: 'invalid-id',
        startIndex: 0,
        endIndex: 14,
      }

      const found = findSection(mockSections, ref)
      expect(found).toBeNull()
    })

    it('should handle names with extra spaces', () => {
      const ref: SectionReference = {
        raw: '$[  Game Mechanics  ]',
        refType: 'name',
        refValue: '  Game Mechanics  ',
        startIndex: 0,
        endIndex: 21,
      }

      const found = findSection(mockSections, ref)
      expect(found).not.toBeNull()
      expect(found?.id).toBe('section-1')
    })
  })

  describe('convertReferencesToIds', () => {
    it('should convert name references to ID references', () => {
      const content = 'Check $[Game Mechanics] for details.'
      const result = convertReferencesToIds(content, mockSections)

      expect(result).toBe('Check $[#section-1] for details.')
    })

    it('should convert multiple name references', () => {
      const content = 'See $[Game Mechanics] and $[Combat System].'
      const result = convertReferencesToIds(content, mockSections)

      expect(result).toBe('See $[#section-1] and $[#section-2].')
    })

    it('should keep ID references unchanged', () => {
      const content = 'Already using $[#section-1].'
      const result = convertReferencesToIds(content, mockSections)

      expect(result).toBe('Already using $[#section-1].')
    })

    it('should handle mixed references', () => {
      const content = '$[Game Mechanics] and $[#section-2] and $[Level Design]'
      const result = convertReferencesToIds(content, mockSections)

      expect(result).toBe('$[#section-1] and $[#section-2] and $[#section-3]')
    })

    it('should not modify references to non-existent sections', () => {
      const content = 'Reference to $[Non Existent Section].'
      const result = convertReferencesToIds(content, mockSections)

      expect(result).toBe('Reference to $[Non Existent Section].')
    })

    it('should handle empty content', () => {
      const result = convertReferencesToIds('', mockSections)
      expect(result).toBe('')
    })

    it('should preserve text around references', () => {
      const content = 'Start text $[Game Mechanics] middle text $[Combat System] end text.'
      const result = convertReferencesToIds(content, mockSections)

      expect(result).toContain('Start text')
      expect(result).toContain('middle text')
      expect(result).toContain('end text')
      expect(result).toContain('$[#section-1]')
      expect(result).toContain('$[#section-2]')
    })
  })

  describe('convertReferencesToNames', () => {
    it('should convert ID references to name references', () => {
      const content = 'Check $[#section-1] for details.'
      const result = convertReferencesToNames(content, mockSections)

      expect(result).toBe('Check $[Game Mechanics] for details.')
    })

    it('should convert multiple ID references', () => {
      const content = 'See $[#section-1] and $[#section-2].'
      const result = convertReferencesToNames(content, mockSections)

      expect(result).toBe('See $[Game Mechanics] and $[Combat System].')
    })

    it('should keep name references unchanged', () => {
      const content = 'Already using $[Game Mechanics].'
      const result = convertReferencesToNames(content, mockSections)

      expect(result).toBe('Already using $[Game Mechanics].')
    })

    it('should handle mixed references', () => {
      const content = '$[#section-1] and $[Combat System] and $[#section-3]'
      const result = convertReferencesToNames(content, mockSections)

      expect(result).toBe('$[Game Mechanics] and $[Combat System] and $[Level Design]')
    })

    it('should not modify references to non-existent IDs', () => {
      const content = 'Reference to $[#invalid-id].'
      const result = convertReferencesToNames(content, mockSections)

      expect(result).toBe('Reference to $[#invalid-id].')
    })
  })

  describe('validateReferences', () => {
    it('should identify valid references', () => {
      const content = 'Check $[Game Mechanics] and $[#section-2].'
      const result = validateReferences(content, mockSections)

      expect(result.valid).toHaveLength(2)
      expect(result.invalid).toHaveLength(0)
    })

    it('should identify invalid references', () => {
      const content = 'Check $[Non Existent] and $[#invalid-id].'
      const result = validateReferences(content, mockSections)

      expect(result.valid).toHaveLength(0)
      expect(result.invalid).toHaveLength(2)
      expect(result.invalid[0].refValue).toBe('Non Existent')
      expect(result.invalid[1].refValue).toBe('invalid-id')
    })

    it('should separate valid and invalid references', () => {
      const content = 'Valid: $[Game Mechanics] Invalid: $[Non Existent] Valid: $[#section-3]'
      const result = validateReferences(content, mockSections)

      expect(result.valid).toHaveLength(2)
      expect(result.invalid).toHaveLength(1)
    })

    it('should handle content with no references', () => {
      const content = 'Plain text without references.'
      const result = validateReferences(content, mockSections)

      expect(result.valid).toHaveLength(0)
      expect(result.invalid).toHaveLength(0)
    })

    it('should handle empty content', () => {
      const result = validateReferences('', mockSections)

      expect(result.valid).toHaveLength(0)
      expect(result.invalid).toHaveLength(0)
    })
  })

  describe('getBacklinks', () => {
    it('should find sections that reference the target section', () => {
      const backlinks = getBacklinks('section-2', mockSections)

      expect(backlinks).toHaveLength(1)
      expect(backlinks[0].id).toBe('section-4')
      expect(backlinks[0].title).toBe('Items')
    })

    it('should find multiple backlinks', () => {
      const sectionsWithMultipleRefs = [
        { id: 's1', title: 'Section 1', content: 'Text' },
        { id: 's2', title: 'Section 2', content: 'Ref to $[Section 1]' },
        { id: 's3', title: 'Section 3', content: 'Also refs $[#s1]' },
        { id: 's4', title: 'Section 4', content: 'Another ref to $[Section 1]' },
      ]

      const backlinks = getBacklinks('s1', sectionsWithMultipleRefs)

      expect(backlinks).toHaveLength(3)
      expect(backlinks.map(b => b.id)).toContain('s2')
      expect(backlinks.map(b => b.id)).toContain('s3')
      expect(backlinks.map(b => b.id)).toContain('s4')
    })

    it('should return empty array if no backlinks', () => {
      const backlinks = getBacklinks('section-1', mockSections)
      expect(backlinks).toHaveLength(0)
    })

    it('should not include the target section itself', () => {
      const sectionsWithSelfRef = [
        { id: 's1', title: 'Section 1', content: 'Self ref: $[#s1]' },
      ]

      const backlinks = getBacklinks('s1', sectionsWithSelfRef)
      expect(backlinks).toHaveLength(0)
    })

    it('should not duplicate backlinks from same section', () => {
      const sectionsWithMultipleRefsFromSame = [
        { id: 's1', title: 'Section 1', content: 'Text' },
        { id: 's2', title: 'Section 2', content: '$[Section 1] and again $[#s1] and $[Section 1]' },
      ]

      const backlinks = getBacklinks('s1', sectionsWithMultipleRefsFromSame)

      expect(backlinks).toHaveLength(1)
      expect(backlinks[0].id).toBe('s2')
    })

    it('should handle sections without content', () => {
      const sectionsWithNoContent = [
        { id: 's1', title: 'Section 1' },
        { id: 's2', title: 'Section 2', content: '' },
      ]

      const backlinks = getBacklinks('s1', sectionsWithNoContent)
      expect(backlinks).toHaveLength(0)
    })
  })

  describe('Integration: Round-trip conversion', () => {
    it('should maintain content integrity after name->ID->name conversion', () => {
      const original = 'Check $[Game Mechanics] and $[Combat System] for details.'
      
      const asIds = convertReferencesToIds(original, mockSections)
      const backToNames = convertReferencesToNames(asIds, mockSections)

      expect(backToNames).toBe(original)
    })

    it('should handle complex markdown with multiple conversions', () => {
      const original = `
# Combat System
The combat references $[Game Mechanics] basics.

## Weapons
Weapons are covered in $[Items] section.

See also $[Level Design] for placement.
      `

      const asIds = convertReferencesToIds(original, mockSections)
      const backToNames = convertReferencesToNames(asIds, mockSections)

      // Should maintain structure even if not exact match due to whitespace
      expect(backToNames).toContain('$[Game Mechanics]')
      expect(backToNames).toContain('$[Level Design]')
    })
  })
})
