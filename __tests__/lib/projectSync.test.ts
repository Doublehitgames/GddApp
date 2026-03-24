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

  it("sends economyLink addons in sync payload", async () => {
    const projectWithAddon = {
      ...projectPayload,
      id: "project-with-economy-addon",
      sections: [
        {
          ...projectPayload.sections[0],
          id: "section-with-economy-addon",
          addons: [
            {
              id: "eco-1",
              type: "economyLink",
              name: "Economy Link",
              data: {
                id: "eco-1",
                name: "Economy Link",
                buyCurrencyRef: "currency-coins",
                buyValue: 100,
                buyModifiers: [{ refId: "var-buy-discount" }],
                sellCurrencyRef: "currency-coins",
                sellValue: 60,
                sellModifiers: [{ refId: "var-sell-bonus" }],
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
      id: "eco-1",
      type: "economyLink",
    });
  });

  it("sends currency and globalVariable addons in sync payload", async () => {
    const projectWithAddon = {
      ...projectPayload,
      id: "project-with-currency-and-globalvar",
      sections: [
        {
          ...projectPayload.sections[0],
          id: "section-with-currency-and-globalvar",
          addons: [
            {
              id: "cur-1",
              type: "currency",
              name: "Currency",
              data: {
                id: "cur-1",
                name: "Currency",
                code: "COINS",
                displayName: "Coins",
                kind: "soft",
                decimals: 0,
              },
            },
            {
              id: "gvar-1",
              type: "globalVariable",
              name: "Global Variable",
              data: {
                id: "gvar-1",
                name: "Global Variable",
                key: "sell_bonus_pct",
                displayName: "Sell Bonus",
                valueType: "percent",
                defaultValue: 25,
                scope: "global",
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
      id: "cur-1",
      type: "currency",
    });
    expect(payload.project?.sections?.[0]?.addons?.[1]).toMatchObject({
      id: "gvar-1",
      type: "globalVariable",
    });
  });

  it("sends inventory addon in sync payload", async () => {
    const projectWithAddon = {
      ...projectPayload,
      id: "project-with-inventory",
      sections: [
        {
          ...projectPayload.sections[0],
          id: "section-with-inventory",
          addons: [
            {
              id: "inv-1",
              type: "inventory",
              name: "Inventory",
              data: {
                id: "inv-1",
                name: "Inventory",
                weight: 1,
                stackable: true,
                maxStack: 20,
                inventoryCategory: "Seeds",
                slotSize: 1,
                durability: 0,
                bindType: "none",
                showInShop: true,
                consumable: false,
                discardable: true,
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
      id: "inv-1",
      type: "inventory",
    });
  });

  it("sends production addon in sync payload", async () => {
    const projectWithAddon = {
      ...projectPayload,
      id: "project-with-production",
      sections: [
        {
          ...projectPayload.sections[0],
          id: "section-with-production",
          addons: [
            {
              id: "prod-1",
              type: "production",
              name: "Production",
              data: {
                id: "prod-1",
                name: "Production",
                mode: "recipe",
                ingredients: [{ itemRef: "item-seed", quantity: 2 }],
                outputs: [{ itemRef: "item-plant", quantity: 1 }],
                craftTimeSeconds: 45,
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
      id: "prod-1",
      type: "production",
    });
  });

  it("returns explicit error when sections.balance_addons column is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        error: "addons_column_missing_in_sections",
        code: "sections_balance_addons_column_missing",
      }),
    });

    const result = await upsertProjectToSupabase(projectPayload);

    expect(result.error).toBe("addons_column_missing_in_sections");
    expect(result.errorCode).toBe("sections_balance_addons_column_missing");
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

  it('returns changeSummary when route includes detailed changes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        stats: {
          sectionsTotal: 1,
          sectionsUpserted: 1,
          sectionsDeleted: 0,
          sectionsUnchanged: 0,
          changeSummary: {
            sections: [
              {
                sectionId: "section-1",
                sectionTitle: "Gameplay",
                facets: ["content", "addons"],
                addons: [
                  {
                    action: "updated",
                    addonId: "eco-1",
                    addonType: "economyLink",
                    addonName: "Economia",
                  },
                ],
              },
            ],
          },
        },
      }),
    })

    const result = await upsertProjectToSupabase(projectPayload)

    expect(result.error).toBeNull()
    expect(result.stats?.changeSummary?.sections).toHaveLength(1)
    expect(result.stats?.changeSummary?.sections[0]).toMatchObject({
      sectionId: "section-1",
      facets: ["content", "addons"],
    })
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
