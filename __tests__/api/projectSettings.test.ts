jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

import { PATCH } from "@/app/api/projects/[id]/settings/route";
import type { NextRequest } from "next/server";

const mockCreateClient = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

type QueryContext = {
  table: string;
  mode: "select" | "update";
  payload?: Record<string, unknown>;
  filters: Record<string, unknown>;
};

/** Supabase de mentira: registra o que a rota tentou escrever e em quais filtros. */
function createMockSupabase(
  userId: string,
  executor: (ctx: QueryContext) => Promise<Record<string, unknown>>,
  seen: QueryContext[],
) {
  const build = (table: string) => {
    const ctx: QueryContext = { table, mode: "select", filters: {} };
    seen.push(ctx);
    const builder = {
      select() { ctx.mode = "select"; return builder; },
      update(payload: Record<string, unknown>) { ctx.mode = "update"; ctx.payload = payload; return builder; },
      eq(field: string, value: unknown) { ctx.filters[field] = value; return builder; },
      maybeSingle() { return executor(ctx); },
      then(onFulfilled: (v: Record<string, unknown>) => unknown, onRejected?: (e: unknown) => unknown) {
        return executor(ctx).then(onFulfilled, onRejected);
      },
    };
    return builder;
  };

  return {
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: userId } }, error: null })) },
    from: jest.fn((table: string) => build(table)),
  };
}

const LIBRARY = {
  folderId: "folder-1",
  folderUrl: "https://drive.google.com/drive/folders/folder-1",
  syncedAt: "2026-08-25T10:00:00.000Z",
  files: [{ fileId: "f1", name: "SEED_TURNIP.png" }],
};

function call(payload: Record<string, unknown>) {
  const req = { url: "http://localhost/api/projects/project-1/settings", json: async () => payload } as unknown as NextRequest;
  return PATCH(req, { params: Promise.resolve({ id: "project-1" }) });
}

/** @param role null = não é membro */
function setup(userId: string, ownerId: string, role: string | null, sharing?: unknown) {
  const seen: QueryContext[] = [];
  const client = createMockSupabase(userId, async (ctx) => {
    if (ctx.table === "projects" && ctx.mode === "select") {
      return { data: { id: "project-1", owner_id: ownerId, mindmap_settings: sharing ? { sharing } : {} }, error: null };
    }
    if (ctx.table === "project_members") {
      return { data: role ? { role } : null, error: null };
    }
    return { data: null, error: null };
  }, seen);
  mockCreateClient.mockReturnValue(client);
  return seen;
}

const updateOf = (seen: QueryContext[]) => seen.find((c) => c.table === "projects" && c.mode === "update");

describe("PATCH /api/projects/[id]/settings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("o dono salva a biblioteca de imagens", async () => {
    const seen = setup("owner-1", "owner-1", null);
    const res = await call({ image_library: LIBRARY });
    expect(res.status).toBe(200);
    expect(updateOf(seen)?.payload?.image_library).toEqual(LIBRARY);
  });

  it("um editor também salva — era isso que sumia calado antes", async () => {
    const seen = setup("member-1", "owner-1", "editor");
    const res = await call({ image_library: LIBRARY });
    expect(res.status).toBe(200);
    expect(updateOf(seen)?.payload?.image_library).toEqual(LIBRARY);
  });

  it("viewer não escreve", async () => {
    setup("member-1", "owner-1", "viewer");
    const res = await call({ image_library: LIBRARY });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("editor role required");
  });

  it("quem não é membro nenhum não escreve", async () => {
    setup("estranho", "owner-1", null);
    const res = await call({ image_library: LIBRARY });
    expect(res.status).toBe(403);
  });

  it("null desconecta a pasta", async () => {
    const seen = setup("owner-1", "owner-1", null);
    const res = await call({ image_library: null });
    expect(res.status).toBe(200);
    expect(updateOf(seen)?.payload).toHaveProperty("image_library", null);
  });

  it("recusa payload sem nenhum campo conhecido", async () => {
    setup("owner-1", "owner-1", null);
    const res = await call({ foo: 1 });
    expect(res.status).toBe(400);
  });

  it("recusa image_library que não é objeto", async () => {
    setup("owner-1", "owner-1", null);
    const res = await call({ image_library: "abc" });
    expect(res.status).toBe(400);
  });

  it("editor salva o mapa mental sem poder mexer no link público", async () => {
    const seen = setup("member-1", "owner-1", "editor", { token: "segredo", enabled: true });
    const res = await call({ mindmap_settings: { zoom: 2, sharing: { enabled: false } } });
    expect(res.status).toBe(200);
    const payload = updateOf(seen)?.payload?.mindmap_settings as Record<string, unknown>;
    expect(payload.zoom).toBe(2);
    // O sharing do dono é preservado, não o que o editor mandou.
    expect(payload.sharing).toEqual({ token: "segredo", enabled: true });
  });

  it("o dono muda o sharing normalmente", async () => {
    const seen = setup("owner-1", "owner-1", null, { token: "antigo", enabled: true });
    await call({ mindmap_settings: { sharing: { enabled: false } } });
    const payload = updateOf(seen)?.payload?.mindmap_settings as Record<string, unknown>;
    expect(payload.sharing).toEqual({ enabled: false });
  });

  it("não filtra o update por owner_id, senão o editor volta a ser ignorado", async () => {
    const seen = setup("member-1", "owner-1", "editor");
    await call({ image_library: LIBRARY });
    const update = updateOf(seen);
    expect(update?.filters).toEqual({ id: "project-1" });
  });
});
