import { upsertProjectToSupabase } from '@/lib/supabase/projectSync'

// upsertProjectToSupabase usa fetch() para POST /api/projects/sync; auth é validada no server.
const mockFetch = jest.fn()
const originalFetch = globalThis.fetch

beforeAll(() => {
  (globalThis as any).fetch = mockFetch
})

afterAll(() => {
  (globalThis as any).fetch = originalFetch
})

describe('projectSync auth/session behavior', () => {
  const projectPayload = {
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
  } as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns success when sync route returns 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, stats: {} }),
    })

    const result = await upsertProjectToSupabase(projectPayload)

    expect(result.error).toBeNull()
    expect(result.skippedReason).toBeUndefined()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/projects/sync'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it("sends progressionTable addons in sync payload", async () => {
    const projectWithAddon = {
      ...projectPayload,
      id: "project-with-addon",
      sections: [
        {
          ...projectPayload.sections[0],
          id: "section-with-addon",
          addons: [
            {
              id: "prog-1",
              type: "progressionTable",
              name: "Tabela de progressao",
              data: {
                id: "prog-1",
                name: "Tabela de progressao",
                startLevel: 1,
                endLevel: 2,
                columns: [{ id: "hp", name: "HP", decimals: 0, generator: { mode: "manual" } }],
                rows: [
                  { level: 1, values: { hp: 100 } },
                  { level: 2, values: { hp: 120 } },
                ],
              },
            },
          ],
        },
      ],
    } as any;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, stats: {} }),
    });

    const result = await upsertProjectToSupabase(projectWithAddon);
    expect(result.error).toBeNull();

    const [, requestInit] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [string, RequestInit];
    const payload = JSON.parse(String(requestInit.body ?? "{}")) as { project?: { sections?: Array<{ addons?: unknown[] }> } };
    expect(payload.project?.sections?.[0]?.addons?.[0]).toMatchObject({
      id: "prog-1",
      type: "progressionTable",
    });
  });

  it('returns quota info when route includes quota in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        stats: { sectionsTotal: 1, sectionsUpserted: 1, sectionsDeleted: 0, sectionsUnchanged: 0 },
        quota: {
          limitPerHour: 30,
          usedInWindow: 1,
          remainingInWindow: 29,
          windowStartedAt: new Date().toISOString(),
          windowEndsAt: new Date().toISOString(),
          consumedThisSync: 1,
        },
      }),
    })

    const result = await upsertProjectToSupabase(projectPayload)

    expect(result.error).toBeNull()
    expect(result.quota).toBeDefined()
    expect(result.quota?.limitPerHour).toBe(30)
    expect(result.quota?.remainingInWindow).toBe(29)
  })

  it('returns skippedReason unauthenticated when route returns 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthenticated' }),
    })

    const result = await upsertProjectToSupabase({
      ...projectPayload,
      id: 'project-3',
      title: 'Projeto 3',
      sections: [],
    })

    expect(result.error).toBeNull()
    expect(result.skippedReason).toBe('unauthenticated')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
