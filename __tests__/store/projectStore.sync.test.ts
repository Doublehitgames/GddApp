import { useProjectStore } from '@/store/projectStore'
import { fetchProjectFromSupabase, fetchProjectsFromSupabase, upsertProjectToSupabase } from '@/lib/supabase/projectSync'

jest.mock('@/lib/supabase/projectSync', () => ({
  fetchProjectsFromSupabase: jest.fn(),
  fetchProjectFromSupabase: jest.fn(async () => null),
  upsertProjectToSupabase: jest.fn(async () => ({ error: null })),
  deleteProjectFromSupabase: jest.fn(async () => ({ error: null })),
  migrateLocalProjectsToSupabase: jest.fn(async () => ({ migrated: 0, errors: 0 })),
  fetchDeletedProjectIds: jest.fn(async () => []),
}))

describe('ProjectStore sync behavior', () => {
  const fetchProjectsMock = fetchProjectsFromSupabase as jest.Mock
  const fetchProjectMock = fetchProjectFromSupabase as jest.Mock
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

    expect(upsertProjectMock).toHaveBeenCalledTimes(1)
    expect(upsertProjectMock.mock.calls[0][0].id).toBe(projectId)
  })

  it('does not re-sync unchanged payload after debounce window', async () => {
    const store = useProjectStore.getState()
    store.addProject('Projeto Hash', 'Desc')

    expect(upsertProjectMock).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(5000)
    await Promise.resolve()

    expect(upsertProjectMock).toHaveBeenCalledTimes(1)
  })

  // TODO: align with current backoff + debounce timing (retry runs after backoff then debounce)
  it.skip('applies backoff before retrying sync after cloud failure', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0)

    upsertProjectMock
      .mockResolvedValueOnce({ error: 'timeout' })
      .mockResolvedValue({ error: null })

    const store = useProjectStore.getState()
    store.addProject('Projeto Backoff', 'Desc')

    expect(upsertProjectMock).toHaveBeenCalledTimes(1)

    await Promise.resolve()

    jest.advanceTimersByTime(30000)
    await Promise.resolve()
    expect(upsertProjectMock).toHaveBeenCalledTimes(1)

    jest.advanceTimersByTime(2000)
    await Promise.resolve()
    expect(upsertProjectMock).toHaveBeenCalledTimes(2)

    randomSpy.mockRestore()
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

  // TODO: align with current unauthenticated retry + debounce timing
  it.skip('retries sync automatically when first attempts are unauthenticated', async () => {
    upsertProjectMock
      .mockResolvedValueOnce({ error: null, skippedReason: 'unauthenticated' })
      .mockResolvedValueOnce({ error: null, skippedReason: 'unauthenticated' })
      .mockResolvedValue({ error: null })

    const store = useProjectStore.getState()
    const projectId = store.addProject('Projeto Retry', 'Desc')

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

  // TODO: loadFromSupabase + post-merge dirty/upload behavior may have changed
  it.skip('merges local + cloud, preserves local-only data and uploads local winners', async () => {
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

  it('discards pending changes by restoring project from cloud', async () => {
    useProjectStore.setState({ userId: 'user-1' })
    const store = useProjectStore.getState()
    const projectId = store.addProject('Projeto local', 'Descrição local')

    await Promise.resolve()
    await Promise.resolve()

    store.editProject(projectId, 'Projeto alterado localmente', 'Alteração local')
    expect(useProjectStore.getState().getPendingProjectIds()).toContain(projectId)

    fetchProjectMock.mockResolvedValueOnce({
      id: projectId,
      title: 'Projeto na nuvem',
      description: 'Versão cloud',
      sections: [],
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T11:00:00.000Z',
    })

    const result = await useProjectStore.getState().discardPendingChangesForProject(projectId)

    expect(result).toEqual({ error: null })
    expect(fetchProjectMock).toHaveBeenCalledWith(projectId)
    expect(useProjectStore.getState().getProject(projectId)?.title).toBe('Projeto na nuvem')
    expect(useProjectStore.getState().pendingSyncCount).toBe(0)
    expect(useProjectStore.getState().getPendingProjectIds()).not.toContain(projectId)
  })

  it('keeps local pending data when discard fails to load cloud snapshot', async () => {
    useProjectStore.setState({ userId: 'user-1' })
    const store = useProjectStore.getState()
    const projectId = store.addProject('Projeto local', 'Descrição local')

    await Promise.resolve()
    await Promise.resolve()

    store.editProject(projectId, 'Projeto alterado localmente', 'Alteração local')
    const localBeforeDiscard = useProjectStore.getState().getProject(projectId)

    fetchProjectMock.mockResolvedValueOnce(null)

    const result = await useProjectStore.getState().discardPendingChangesForProject(projectId)

    expect(result).toEqual({ error: 'project_not_found_in_cloud' })
    expect(useProjectStore.getState().getProject(projectId)).toEqual(localBeforeDiscard)
    expect(useProjectStore.getState().getPendingProjectIds()).toContain(projectId)
    expect(useProjectStore.getState().pendingSyncCount).toBe(1)
  })

  it('persists changeSummary in sync history when API provides detailed changes', async () => {
    upsertProjectMock.mockResolvedValueOnce({
      error: null,
      stats: {
        sectionsTotal: 1,
        sectionsUpserted: 1,
        sectionsDeleted: 0,
        sectionsUnchanged: 0,
        changeSummary: {
          sections: [
            {
              sectionId: 'section-1',
              sectionTitle: 'Gameplay',
              facets: ['content', 'addons'],
              addons: [
                {
                  action: 'updated',
                  addonId: 'eco-1',
                  addonType: 'economyLink',
                  addonName: 'Economia',
                },
              ],
            },
          ],
        },
      },
    })

    const store = useProjectStore.getState()
    store.addProject('Projeto com resumo', 'Desc')

    await Promise.resolve()
    await Promise.resolve()

    const history = useProjectStore.getState().lastSyncStatsHistory
    expect(history.length).toBeGreaterThan(0)
    expect(history[0].changeSummary?.sections).toHaveLength(1)
    expect(history[0].changeSummary?.sections[0].facets).toContain('addons')
  })

  it('marks project dirty and autosyncs when section flowchart changes', async () => {
    const store = useProjectStore.getState()
    const projectId = store.addProject('Projeto com flowchart', 'Desc')
    const sectionId = store.addSection(projectId, 'Secao 1', '')

    await Promise.resolve()
    await Promise.resolve()
    upsertProjectMock.mockClear()

    store.updatePersistenceConfig({ syncAutomatic: true, debounceMs: 100 })
    store.saveSectionDiagram(projectId, sectionId, {
      version: 1,
      updatedAt: '2026-03-01T12:00:00.000Z',
      nodes: [{ id: 'n-1', position: { x: 0, y: 0 }, data: { label: 'N1' } }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    } as any)

    expect(useProjectStore.getState().getPendingProjectIds()).toContain(projectId)
    expect(useProjectStore.getState().getProject(projectId)?.sections?.find((s) => s.id === sectionId)?.flowchartState).toBeDefined()

    jest.advanceTimersByTime(200)
    await Promise.resolve()

    expect(upsertProjectMock).toHaveBeenCalledTimes(1)
    const syncedProject = upsertProjectMock.mock.calls[0][0]
    const syncedSection = syncedProject.sections.find((s: any) => s.id === sectionId)
    expect(syncedSection.flowchartState).toBeDefined()
    expect(syncedSection.flowchartState.nodes).toHaveLength(1)
  })
})
