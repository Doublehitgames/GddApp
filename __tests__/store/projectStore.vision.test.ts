/**
 * updateProjectVision: a Visão é editada aos pedaços (a home salva um campo de
 * cada vez, o "Primeiros passos" só mexe no starter), então cada chamada é um
 * patch — o que não veio no patch fica como estava.
 */

import { useProjectStore } from '@/store/projectStore'

jest.mock('@/lib/supabase/projectSync', () => ({
  fetchProjectsFromSupabase: jest.fn(async () => []),
  upsertProjectToSupabase: jest.fn(async () => ({ error: null })),
  deleteProjectFromSupabase: jest.fn(async () => ({ error: null })),
  migrateLocalProjectsToSupabase: jest.fn(async () => ({ migrated: 0, errors: 0 })),
}))

const OLD = '2020-01-01T00:00:00.000Z'

function seed() {
  useProjectStore.setState({
    projects: [
      { id: 'p1', title: 'Granjita', sections: [], createdAt: OLD, updatedAt: OLD },
      { id: 'p2', title: 'Outro', sections: [], createdAt: OLD, updatedAt: OLD },
    ],
    diagramsBySection: {},
  })
}

const getProject = (id: string) => useProjectStore.getState().projects.find((p) => p.id === id)

describe('updateProjectVision', () => {
  beforeEach(() => {
    localStorage.clear()
    seed()
  })

  it('cria a visão num projeto que não tinha', () => {
    useProjectStore.getState().updateProjectVision('p1', { logline: 'Uma fazenda que conversa' })
    expect(getProject('p1')?.vision).toEqual({ logline: 'Uma fazenda que conversa' })
  })

  it('mescla o patch e mantém as chaves que não vieram', () => {
    const { updateProjectVision } = useProjectStore.getState()
    updateProjectVision('p1', { logline: 'Uma fazenda que conversa', genre: 'Simulação' })
    updateProjectVision('p1', { pillars: ['Colheita', 'Troca'] })
    updateProjectVision('p1', { genre: 'Cozy' })

    expect(getProject('p1')?.vision).toEqual({
      logline: 'Uma fazenda que conversa',
      genre: 'Cozy',
      pillars: ['Colheita', 'Troca'],
    })
  })

  it('troca o starter inteiro em vez de mesclar as listas', () => {
    const { updateProjectVision } = useProjectStore.getState()
    updateProjectVision('p1', { logline: 'L', starter: { answered: ['logline'], skipped: ['genre'] } })
    updateProjectVision('p1', { starter: { answered: ['logline', 'genre'], skipped: [], doneAt: '2026-10-28T00:00:00Z' } })

    expect(getProject('p1')?.vision).toEqual({
      logline: 'L',
      starter: { answered: ['logline', 'genre'], skipped: [], doneAt: '2026-10-28T00:00:00Z' },
    })
  })

  it('atualiza updatedAt e não toca nos outros projetos', () => {
    useProjectStore.getState().updateProjectVision('p1', { feeling: 'Aconchego' })
    expect(getProject('p1')?.updatedAt).not.toBe(OLD)
    expect(getProject('p2')?.updatedAt).toBe(OLD)
    expect(getProject('p2')?.vision).toBeUndefined()
  })

  it('marca o projeto como pendente de sync', () => {
    useProjectStore.setState({ pendingSyncCount: 0 })
    useProjectStore.getState().updateProjectVision('p1', { playerVerb: 'Plantar' })
    expect(useProjectStore.getState().pendingSyncCount).toBeGreaterThan(0)
  })
})
