import { useProjectStore } from '@/store/projectStore'
import { fetchProjectsFromSupabase, upsertProjectToSupabase } from '@/lib/supabase/projectSync'

jest.mock('@/lib/supabase/projectSync', () => ({
  fetchProjectsFromSupabase: jest.fn(),
  upsertProjectToSupabase: jest.fn(async () => ({ error: null })),
  deleteProjectFromSupabase: jest.fn(async () => ({ error: null })),
  migrateLocalProjectsToSupabase: jest.fn(async () => ({ migrated: 0, errors: 0 })),
}))

describe('ProjectStore sync behavior', () => {
  const fetchProjectsMock = fetchProjectsFromSupabase as jest.Mock
  const upsertProjectMock = upsertProjectToSupabase as jest.Mock

  let storage: Record<string, string>

  beforeEach(() => {
    jest.useFakeTimers()
    storage = {}

    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => storage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          storage[key] = value
        }),
        removeItem: jest.fn((key: string) => {
          delete storage[key]
        }),
        clear: jest.fn(() => {
          storage = {}
        }),
      },
      configurable: true,
      writable: true,
    })

    useProjectStore.setState({ projects: [], userId: null })
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('syncs a new project immediately and keeps debounce as fallback', async () => {
    const store = useProjectStore.getState()
    const projectId = store.addProject('Novo Projeto', 'Desc')

    expect(upsertProjectMock).toHaveBeenCalledTimes(1)
    expect(upsertProjectMock.mock.calls[0][0].id).toBe(projectId)

    jest.advanceTimersByTime(1600)
    await Promise.resolve()

    expect(upsertProjectMock.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('uses localStorage fallback snapshot if in-memory state is momentarily empty', async () => {
    const store = useProjectStore.getState()
    const projectId = store.addProject('Projeto Race', 'Desc')

    useProjectStore.setState({ projects: [] })

    jest.advanceTimersByTime(1600)
    await Promise.resolve()

    expect(upsertProjectMock.mock.calls.length).toBeGreaterThanOrEqual(1)
    const ids = upsertProjectMock.mock.calls.map((call) => call[0].id)
    expect(ids).toContain(projectId)
  })

  it('retries sync automatically when first attempts are unauthenticated', async () => {
    const store = useProjectStore.getState()
    const projectId = store.addProject('Projeto Retry', 'Desc')

    upsertProjectMock
      .mockResolvedValueOnce({ error: null, skippedReason: 'unauthenticated' })
      .mockResolvedValueOnce({ error: null, skippedReason: 'unauthenticated' })
      .mockResolvedValue({ error: null })

    jest.advanceTimersByTime(1600)
    await Promise.resolve()

    expect(upsertProjectMock.mock.calls.length).toBeGreaterThanOrEqual(1)

    jest.advanceTimersByTime(3600)
    await Promise.resolve()

    expect(upsertProjectMock.mock.calls.length).toBeGreaterThanOrEqual(2)

    jest.advanceTimersByTime(3600)
    await Promise.resolve()

    const ids = upsertProjectMock.mock.calls.map((call) => call[0].id)
    expect(ids).toContain(projectId)
    expect(upsertProjectMock.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('merges local + cloud, preserves local-only data and uploads local winners', async () => {
    const localProjectNewer = {
      id: 'p-same',
      title: 'Projeto Local Novo',
      description: 'local',
      sections: [],
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T12:00:00.000Z',
    }

    const localOnly = {
      id: 'p-local-only',
      title: 'Só Local',
      description: 'local only',
      sections: [],
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T11:00:00.000Z',
    }

    const remoteOlderSameId = {
      id: 'p-same',
      title: 'Projeto Cloud Antigo',
      description: 'cloud',
      sections: [],
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:30:00.000Z',
    }

    const remoteOnly = {
      id: 'p-remote-only',
      title: 'Só Cloud',
      description: 'cloud only',
      sections: [],
      createdAt: '2026-03-01T09:00:00.000Z',
      updatedAt: '2026-03-01T09:30:00.000Z',
    }

    useProjectStore.setState({ projects: [localProjectNewer as any, localOnly as any] })
    storage['gdd_projects_v1'] = JSON.stringify([localProjectNewer, localOnly])

    fetchProjectsMock.mockResolvedValue([remoteOlderSameId, remoteOnly])

    const result = await useProjectStore.getState().loadFromSupabase()

    expect(result).toBe('loaded')

    const merged = useProjectStore.getState().projects
    expect(merged).toHaveLength(3)
    expect(merged.find((p) => p.id === 'p-same')?.title).toBe('Projeto Local Novo')
    expect(merged.find((p) => p.id === 'p-local-only')).toBeDefined()
    expect(merged.find((p) => p.id === 'p-remote-only')).toBeDefined()

    jest.advanceTimersByTime(1600)
    await Promise.resolve()

    const uploadedIds = upsertProjectMock.mock.calls.map((call) => call[0].id)
    expect(uploadedIds).toContain('p-local-only')
    expect(uploadedIds).toContain('p-same')
  })

  it('keeps backward compatibility when color is passed in old 5th argument slot', () => {
    const store = useProjectStore.getState()
    const projectId = store.addProject('Projeto', 'Desc')
    const sectionId = store.addSection(projectId, 'Seção', 'Conteúdo')

    store.editSection(projectId, sectionId, 'Seção', 'Conteúdo', '#ff0000' as any)

    const section = useProjectStore.getState().getProject(projectId)?.sections?.find((s) => s.id === sectionId)
    expect(section?.parentId).toBeUndefined()
    expect(section?.color).toBe('#ff0000')
  })
})
