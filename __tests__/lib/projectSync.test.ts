import { createClient } from '@/lib/supabase/client'
import { upsertProjectToSupabase } from '@/lib/supabase/projectSync'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('projectSync auth/session behavior', () => {
  const createClientMock = createClient as jest.Mock

  function makeSupabaseMock(options: {
    sessionUserId?: string | null
    fallbackUserId?: string | null
  }) {
    const projectUpsert = jest.fn(async () => ({ error: null }))
    const sectionsUpsert = jest.fn(async () => ({ error: null }))

    const sectionsDeleteNot = jest.fn(async () => ({ error: null }))
    const sectionsDeleteEq = jest.fn(() => ({ not: sectionsDeleteNot }))
    const sectionsDelete = jest.fn(() => ({ eq: sectionsDeleteEq }))

    const from = jest.fn((table: string) => {
      if (table === 'projects') {
        return {
          upsert: projectUpsert,
          delete: jest.fn(() => ({ eq: jest.fn(async () => ({ error: null })) })),
        }
      }

      if (table === 'sections') {
        return {
          upsert: sectionsUpsert,
          delete: sectionsDelete,
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const auth = {
      getSession: jest.fn(async () => ({
        data: {
          session: options.sessionUserId
            ? { user: { id: options.sessionUserId } }
            : null,
        },
      })),
      getUser: jest.fn(async () => ({
        data: {
          user: options.fallbackUserId ? { id: options.fallbackUserId } : null,
        },
      })),
    }

    return {
      mock: { auth, from },
      spies: { projectUpsert, sectionsUpsert, sectionsDeleteNot },
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses session user id from getSession for upsert', async () => {
    const { mock, spies } = makeSupabaseMock({ sessionUserId: 'user-1', fallbackUserId: null })
    createClientMock.mockReturnValue(mock)

    const result = await upsertProjectToSupabase({
      id: 'project-1',
      title: 'Projeto',
      description: 'Desc',
      sections: [
        {
          id: 'section-1',
          title: 'Sec',
          content: 'Conteúdo',
          created_at: '2026-03-01T10:00:00.000Z',
          order: 0,
        },
      ],
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    } as any)

    expect(result.error).toBeNull()
    expect(mock.auth.getSession).toHaveBeenCalled()
    expect(mock.auth.getUser).not.toHaveBeenCalled()

    expect(spies.projectUpsert).toHaveBeenCalledTimes(1)
    const firstProjectUpsertPayload = (spies.projectUpsert as unknown as { mock: { calls: any[][] } }).mock.calls[0]?.[0] as { owner_id?: string } | undefined
    expect(firstProjectUpsertPayload?.owner_id).toBe('user-1')
    expect(spies.sectionsUpsert).toHaveBeenCalledTimes(1)
    expect(spies.sectionsDeleteNot).toHaveBeenCalledTimes(1)
  })

  it('falls back to getUser when local session is unavailable', async () => {
    const { mock, spies } = makeSupabaseMock({ sessionUserId: null, fallbackUserId: 'user-2' })
    createClientMock.mockReturnValue(mock)

    const result = await upsertProjectToSupabase({
      id: 'project-2',
      title: 'Projeto 2',
      description: '',
      sections: [
        {
          id: 'section-2',
          title: 'Sec 2',
          content: '',
          created_at: '2026-03-01T10:00:00.000Z',
          order: 0,
        },
      ],
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    } as any)

    expect(result.error).toBeNull()
    expect(mock.auth.getSession).toHaveBeenCalled()
    expect(mock.auth.getUser).toHaveBeenCalled()
    const firstProjectUpsertPayload = (spies.projectUpsert as unknown as { mock: { calls: any[][] } }).mock.calls[0]?.[0] as { owner_id?: string } | undefined
    expect(firstProjectUpsertPayload?.owner_id).toBe('user-2')
  })

  it('skips upsert gracefully when user is unauthenticated', async () => {
    const { mock, spies } = makeSupabaseMock({ sessionUserId: null, fallbackUserId: null })
    createClientMock.mockReturnValue(mock)

    const result = await upsertProjectToSupabase({
      id: 'project-3',
      title: 'Projeto 3',
      description: '',
      sections: [],
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    } as any)

    expect(result.error).toBeNull()
    expect(result.skippedReason).toBe('unauthenticated')
    expect(mock.auth.getSession).toHaveBeenCalled()
    expect(mock.auth.getUser).toHaveBeenCalled()
    expect(spies.projectUpsert).not.toHaveBeenCalled()
    expect(spies.sectionsUpsert).not.toHaveBeenCalled()
  })
})
