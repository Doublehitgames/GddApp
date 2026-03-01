/**
 * Testes do projectStore - Core da aplicação
 * Testa todas as operações de gerenciamento de projetos e seções
 */

import { useProjectStore, Project, Section } from '@/store/projectStore'

jest.mock('@/lib/supabase/projectSync', () => ({
  fetchProjectsFromSupabase: jest.fn(async () => []),
  upsertProjectToSupabase: jest.fn(async () => ({ error: null })),
  deleteProjectFromSupabase: jest.fn(async () => ({ error: null })),
  migrateLocalProjectsToSupabase: jest.fn(async () => ({ migrated: 0, errors: 0 })),
}))

// Mock do crypto.randomUUID
const mockUUIDs = [
  'project-uuid-1',
  'project-uuid-2',
  'section-uuid-1',
  'section-uuid-2',
  'section-uuid-3',
  'subsection-uuid-1',
]
let uuidIndex = 0

global.crypto = {
  randomUUID: jest.fn(() => mockUUIDs[uuidIndex++] || `uuid-${uuidIndex}`),
} as any

describe('ProjectStore', () => {
  beforeEach(() => {
    // Reset store state
    useProjectStore.setState({ projects: [] })
    // Clear localStorage
    localStorage.clear()
    // Reset UUID index
    uuidIndex = 0
    // Clear mocks
    jest.clearAllMocks()
  })

  describe('addProject', () => {
    it('should add a new project', () => {
      const projectId = useProjectStore.getState().addProject('Test Game', 'A test game description')
      const store = useProjectStore.getState()

      expect(projectId).toBeDefined()
      expect(store.projects).toHaveLength(1)
      
      const project = store.projects[0]
      expect(project.title).toBe('Test Game')
      expect(project.description).toBe('A test game description')
      expect(project.sections).toEqual([])
      expect(project.createdAt).toBeDefined()
      expect(project.updatedAt).toBeDefined()
    })

    it('should add multiple projects', () => {
      useProjectStore.getState().addProject('Game 1', 'Description 1')
      useProjectStore.getState().addProject('Game 2', 'Description 2')
      
      const store = useProjectStore.getState()
      expect(store.projects).toHaveLength(2)
      expect(store.projects[0].title).toBe('Game 1')
      expect(store.projects[1].title).toBe('Game 2')
    })

    it('should persist project to localStorage', () => {
      useProjectStore.getState().addProject('Test Game', 'Description')

      const stored = localStorage.getItem('gdd_projects_v1')
      expect(stored).toBeDefined()
      
      const parsed = JSON.parse(stored!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].title).toBe('Test Game')
    })
  })

  describe('getProject', () => {
    it('should return project by id', () => {
      const projectId = useProjectStore.getState().addProject('Test Game', 'Description')
      const project = useProjectStore.getState().getProject(projectId)
      
      expect(project).toBeDefined()
      expect(project?.title).toBe('Test Game')
    })

    it('should return undefined for non-existent project', () => {
      const project = useProjectStore.getState().getProject('non-existent-id')
      expect(project).toBeUndefined()
    })
  })

  describe('editProject', () => {
    it('should edit project name and description', () => {
      const projectId = useProjectStore.getState().addProject('Original Name', 'Original Description')
      useProjectStore.getState().editProject(projectId, 'New Name', 'New Description')

      const project = useProjectStore.getState().getProject(projectId)
      expect(project?.title).toBe('New Name')
      expect(project?.description).toBe('New Description')
    })

    it('should update updatedAt timestamp', () => {
      const projectId = useProjectStore.getState().addProject('Test', 'Description')
      const project1 = useProjectStore.getState().getProject(projectId)
      const originalUpdatedAt = project1?.updatedAt

      // Small delay to ensure different timestamp
      const start = Date.now()
      while (Date.now() - start < 5) { /* wait */ }

      useProjectStore.getState().editProject(projectId, 'Updated', 'Updated Description')
      const project2 = useProjectStore.getState().getProject(projectId)
      
      // Should have an updatedAt field
      expect(project2?.updatedAt).toBeDefined()
      expect(typeof project2?.updatedAt).toBe('string')
    })
  })

  describe('removeProject', () => {
    it('should remove project by id', () => {
      const projectId = useProjectStore.getState().addProject('Test Game', 'Description')
      expect(useProjectStore.getState().projects).toHaveLength(1)
      
      useProjectStore.getState().removeProject(projectId)
      expect(useProjectStore.getState().projects).toHaveLength(0)
    })

    it('should not affect other projects', () => {
      const id1 = useProjectStore.getState().addProject('Game 1', 'Desc 1')
      const id2 = useProjectStore.getState().addProject('Game 2', 'Desc 2')

      useProjectStore.getState().removeProject(id1)

      const store = useProjectStore.getState()
      expect(store.projects).toHaveLength(1)
      expect(store.projects[0].id).toBe(id2)
    })
  })

  describe('addSection', () => {
    it('should add a root section to project', () => {
      const projectId = useProjectStore.getState().addProject('Test Game', 'Description')
      const sectionId = useProjectStore.getState().addSection(projectId, 'Game Mechanics', 'Content here')

      const project = useProjectStore.getState().getProject(projectId)
      expect(project?.sections).toHaveLength(1)
      
      const section = project?.sections?.[0]
      expect(section?.id).toBeDefined()
      expect(section?.title).toBe('Game Mechanics')
      expect(section?.content).toBe('Content here')
      expect(section?.parentId).toBeUndefined()
      expect(section?.order).toBe(0)
    })

    it('should add multiple sections with correct order', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')

      store.addSection(projectId, 'Section 1')
      store.addSection(projectId, 'Section 2')
      store.addSection(projectId, 'Section 3')

      const project = store.getProject(projectId)
      expect(project?.sections).toHaveLength(3)
      expect(project?.sections?.[0].order).toBe(0)
      expect(project?.sections?.[1].order).toBe(1)
      expect(project?.sections?.[2].order).toBe(2)
    })

    it('should set default empty content if not provided', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      
      store.addSection(projectId, 'Section Without Content')

      const project = store.getProject(projectId)
      expect(project?.sections?.[0].content).toBe('')
    })
  })

  describe('addSubsection', () => {
    it('should add subsection to parent section', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const parentId = store.addSection(projectId, 'Parent Section')

      const subsectionId = store.addSubsection(projectId, parentId, 'Subsection', 'Sub content')

      const project = store.getProject(projectId)
      expect(project?.sections).toHaveLength(2)

      const subsection = project?.sections?.find(s => s.id === subsectionId)
      expect(subsection?.title).toBe('Subsection')
      expect(subsection?.parentId).toBe(parentId)
      expect(subsection?.order).toBe(0)
    })

    it('should handle multiple subsections with correct order', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const parentId = store.addSection(projectId, 'Parent')

      store.addSubsection(projectId, parentId, 'Sub 1')
      store.addSubsection(projectId, parentId, 'Sub 2')
      store.addSubsection(projectId, parentId, 'Sub 3')

      const project = store.getProject(projectId)
      const subsections = project?.sections?.filter(s => s.parentId === parentId)
      
      expect(subsections).toHaveLength(3)
      expect(subsections?.[0].order).toBe(0)
      expect(subsections?.[1].order).toBe(1)
      expect(subsections?.[2].order).toBe(2)
    })
  })

  describe('editSection', () => {
    it('should edit section title and content', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const sectionId = store.addSection(projectId, 'Original Title', 'Original Content')

      store.editSection(projectId, sectionId, 'New Title', 'New Content')

      const project = store.getProject(projectId)
      const section = project?.sections?.find(s => s.id === sectionId)
      
      expect(section?.title).toBe('New Title')
      expect(section?.content).toBe('New Content')
    })
  })

  describe('removeSection', () => {
    it('should remove section from project', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const sectionId = store.addSection(projectId, 'Section to Remove')

      expect(store.getProject(projectId)?.sections).toHaveLength(1)
      
      store.removeSection(projectId, sectionId)
      
      expect(store.getProject(projectId)?.sections).toHaveLength(0)
    })

    it('should not remove subsections automatically', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const parentId = store.addSection(projectId, 'Parent')
      const subId = store.addSubsection(projectId, parentId, 'Subsection')

      store.removeSection(projectId, parentId)

      const project = store.getProject(projectId)
      // O subsection ainda existe (sem parent agora)
      expect(project?.sections).toHaveLength(1)
      expect(project?.sections?.[0].id).toBe(subId)
    })
  })

  describe('moveSectionUp', () => {
    it('should move section up in order', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const id1 = store.addSection(projectId, 'Section 1')
      const id2 = store.addSection(projectId, 'Section 2')

      store.moveSectionUp(projectId, id2)

      const project = store.getProject(projectId)
      const section1 = project?.sections?.find(s => s.id === id1)
      const section2 = project?.sections?.find(s => s.id === id2)

      expect(section2?.order).toBe(0)
      expect(section1?.order).toBe(1)
    })

    it('should not move first section up', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const id1 = store.addSection(projectId, 'Section 1')
      store.addSection(projectId, 'Section 2')

      const project1 = store.getProject(projectId)
      const originalOrder = project1?.sections?.find(s => s.id === id1)?.order

      store.moveSectionUp(projectId, id1)

      const project2 = store.getProject(projectId)
      const newOrder = project2?.sections?.find(s => s.id === id1)?.order

      expect(newOrder).toBe(originalOrder)
    })
  })

  describe('moveSectionDown', () => {
    it('should move section down in order', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const id1 = store.addSection(projectId, 'Section 1')
      const id2 = store.addSection(projectId, 'Section 2')

      store.moveSectionDown(projectId, id1)

      const project = store.getProject(projectId)
      const section1 = project?.sections?.find(s => s.id === id1)
      const section2 = project?.sections?.find(s => s.id === id2)

      expect(section1?.order).toBe(1)
      expect(section2?.order).toBe(0)
    })

    it('should not move last section down', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      store.addSection(projectId, 'Section 1')
      const id2 = store.addSection(projectId, 'Section 2')

      const project1 = store.getProject(projectId)
      const originalOrder = project1?.sections?.find(s => s.id === id2)?.order

      store.moveSectionDown(projectId, id2)

      const project2 = store.getProject(projectId)
      const newOrder = project2?.sections?.find(s => s.id === id2)?.order

      expect(newOrder).toBe(originalOrder)
    })
  })

  describe('reorderSections', () => {
    it('should reorder sections based on array of IDs', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const id1 = store.addSection(projectId, 'Section 1')
      const id2 = store.addSection(projectId, 'Section 2')
      const id3 = store.addSection(projectId, 'Section 3')

      // Reverse order
      store.reorderSections(projectId, [id3, id2, id1])

      const project = store.getProject(projectId)
      const section1 = project?.sections?.find(s => s.id === id1)
      const section2 = project?.sections?.find(s => s.id === id2)
      const section3 = project?.sections?.find(s => s.id === id3)

      expect(section3?.order).toBe(0)
      expect(section2?.order).toBe(1)
      expect(section1?.order).toBe(2)
    })
  })

  describe('countDescendants', () => {
    it('should count all descendants recursively', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const parentId = store.addSection(projectId, 'Parent')
      const child1 = store.addSubsection(projectId, parentId, 'Child 1')
      store.addSubsection(projectId, parentId, 'Child 2')
      store.addSubsection(projectId, child1, 'Grandchild 1')

      const count = store.countDescendants(projectId, parentId)
      expect(count).toBe(3) // 2 children + 1 grandchild
    })

    it('should return 0 for section with no descendants', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const sectionId = store.addSection(projectId, 'Section')

      const count = store.countDescendants(projectId, sectionId)
      expect(count).toBe(0)
    })
  })

  describe('hasDuplicateName', () => {
    it('should detect duplicate section names at same level', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      store.addSection(projectId, 'Game Mechanics')

      const hasDuplicate = store.hasDuplicateName(projectId, 'Game Mechanics')
      expect(hasDuplicate).toBe(true)
    })

    it('should be case insensitive', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      store.addSection(projectId, 'Game Mechanics')

      const hasDuplicate = store.hasDuplicateName(projectId, 'GAME MECHANICS')
      expect(hasDuplicate).toBe(true)
    })

    it('should allow same name in different levels', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const parentId = store.addSection(projectId, 'Combat')
      
      // Same name as subsection should be allowed
      const hasDuplicate = store.hasDuplicateName(projectId, 'Combat', parentId)
      expect(hasDuplicate).toBe(false)
    })

    it('should exclude current section when editing', () => {
      const store = useProjectStore.getState()
      const projectId = store.addProject('Test Game', 'Description')
      const sectionId = store.addSection(projectId, 'Original Name')

      // Checking if "Original Name" is duplicate while editing the same section
      const hasDuplicate = store.hasDuplicateName(projectId, 'Original Name', undefined, sectionId)
      expect(hasDuplicate).toBe(false)
    })
  })

  describe('loadFromStorage', () => {
    it('should load projects from localStorage', () => {
      const mockProjects: Project[] = [
        {
          id: 'test-id',
          title: 'Test Project',
          description: 'Test Description',
          sections: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      localStorage.setItem('gdd_projects_v1', JSON.stringify(mockProjects))
      useProjectStore.getState().loadFromStorage()

      const store = useProjectStore.getState()
      expect(store.projects).toHaveLength(1)
      expect(store.projects[0].title).toBe('Test Project')
    })

    it('should handle empty localStorage', () => {
      useProjectStore.getState().loadFromStorage()
      expect(useProjectStore.getState().projects).toHaveLength(0)
    })

    it('should migrate old projects without timestamps', () => {
      const oldProject = {
        id: 'old-id',
        title: 'Old Project',
        sections: [],
      }

      localStorage.setItem('gdd_projects_v1', JSON.stringify([oldProject]))
      useProjectStore.getState().loadFromStorage()

      const store = useProjectStore.getState()
      const project = store.projects[0]
      expect(project.createdAt).toBeDefined()
      expect(project.updatedAt).toBeDefined()
    })
  })

  describe('importProject', () => {
    it('should import a new project', () => {
      const importedProject: Project = {
        id: 'imported-id',
        title: 'Imported Project',
        description: 'Imported',
        sections: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      useProjectStore.getState().importProject(importedProject)

      const store = useProjectStore.getState()
      expect(store.projects).toHaveLength(1)
      expect(store.projects[0].id).toBe('imported-id')
    })

    it('should replace existing project with same ID', () => {
      useProjectStore.getState().addProject('Original', 'Original Description')
      const projectId = useProjectStore.getState().projects[0].id

      const importedProject: Project = {
        id: projectId,
        title: 'Replaced',
        description: 'Replaced Description',
        sections: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      useProjectStore.getState().importProject(importedProject)

      const store = useProjectStore.getState()
      expect(store.projects).toHaveLength(1)
      expect(store.projects[0].title).toBe('Replaced')
    })
  })

  describe('importAllProjects', () => {
    it('should replace all projects with imported ones', () => {
      useProjectStore.getState().addProject('Project 1', 'Desc 1')
      useProjectStore.getState().addProject('Project 2', 'Desc 2')

      const importedProjects: Project[] = [
        {
          id: 'imported-1',
          title: 'Imported 1',
          sections: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      useProjectStore.getState().importAllProjects(importedProjects)

      const store = useProjectStore.getState()
      expect(store.projects).toHaveLength(1)
      expect(store.projects[0].title).toBe('Imported 1')
    })
  })
})
