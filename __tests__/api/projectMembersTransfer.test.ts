jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

import { PATCH } from "@/app/api/projects/[id]/members/route";
import type { NextRequest } from "next/server";

const mockCreateClient = jest.fn();
const mockCreateAdminClient = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

type QueryFilters = Record<string, unknown>;
type QueryContext = {
  table: string;
  mode: "select" | "update" | "upsert" | "delete";
  columns?: string;
  options?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  filters: QueryFilters;
};

function createMockSupabase(
  executor: (ctx: QueryContext) => Promise<Record<string, unknown>>,
  rpcExecutor?: (fn: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>
) {
  const build = (table: string) => {
    const ctx: QueryContext = { table, mode: "select", filters: {} };
    const builder = {
      select(columns: string, options?: Record<string, unknown>) {
        ctx.mode = "select";
        ctx.columns = columns;
        ctx.options = options;
        return builder;
      },
      eq(field: string, value: unknown) {
        ctx.filters[field] = value;
        return builder;
      },
      in(field: string, value: unknown[]) {
        ctx.filters[field] = value;
        return builder;
      },
      order() {
        return builder;
      },
      update(payload: Record<string, unknown>) {
        ctx.mode = "update";
        ctx.payload = payload;
        return builder;
      },
      upsert(payload: Record<string, unknown>) {
        ctx.mode = "upsert";
        ctx.payload = payload;
        return builder;
      },
      delete() {
        ctx.mode = "delete";
        return builder;
      },
      maybeSingle() {
        return executor(ctx);
      },
      then(onFulfilled: (value: Record<string, unknown>) => unknown, onRejected?: (error: unknown) => unknown) {
        return executor(ctx).then(onFulfilled, onRejected);
      },
    };
    return builder;
  };

  return {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: "owner-1" } }, error: null })),
    },
    from: jest.fn((table: string) => build(table)),
    rpc: jest.fn(async (fn: string, args: Record<string, unknown>) => {
      if (rpcExecutor) return rpcExecutor(fn, args);
      return { data: null, error: null };
    }),
  };
}

function buildRequest(payload: Record<string, unknown>) {
  return {
    url: "http://localhost/api/projects/project-1/members",
    json: async () => payload,
  } as unknown as NextRequest;
}

async function callPatch(payload: Record<string, unknown>) {
  const req = buildRequest(payload);
  const res = await PATCH(req, { params: Promise.resolve({ id: "project-1" }) });
  if (!res) throw new Error("PATCH returned undefined response");
  return res;
}

describe("PATCH /api/projects/[id]/members", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("bloqueia quando usuário não é owner", async () => {
    const userClient = createMockSupabase(async (ctx) => {
      if (ctx.table === "projects") {
        return { data: { id: "project-1", title: "Meu Projeto", owner_id: "owner-real" }, error: null };
      }
      return { data: null, error: null };
    });
    mockCreateClient.mockReturnValue(userClient);

    const res = await callPatch({ targetUserId: "editor-1", confirmProjectTitle: "Meu Projeto" });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("forbidden");
  });

  it("bloqueia transferência para membro que não é editor", async () => {
    const userClient = createMockSupabase(async (ctx) => {
      if (ctx.table === "projects") {
        return { data: { id: "project-1", title: "Meu Projeto", owner_id: "owner-1" }, error: null };
      }
      if (ctx.table === "project_members") {
        return { data: { role: "viewer" }, error: null };
      }
      return { data: null, error: null };
    });
    mockCreateClient.mockReturnValue(userClient);

    const res = await callPatch({ targetUserId: "viewer-1", confirmProjectTitle: "Meu Projeto" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("validation_error");
  });

  it("falha quando confirmação do nome está incorreta", async () => {
    const userClient = createMockSupabase(async (ctx) => {
      if (ctx.table === "projects") {
        return { data: { id: "project-1", title: "Nome Correto", owner_id: "owner-1" }, error: null };
      }
      return { data: null, error: null };
    });
    mockCreateClient.mockReturnValue(userClient);

    const res = await callPatch({ targetUserId: "editor-1", confirmProjectTitle: "Nome Errado" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("validation_error");
  });

  it("bloqueia por limite estrutural do novo owner", async () => {
    const userClient = createMockSupabase(
      async (ctx) => {
        if (ctx.table === "projects") {
          return { data: { id: "project-1", title: "Meu Projeto", owner_id: "owner-1" }, error: null };
        }
        if (ctx.table === "project_members") {
          return { data: { role: "editor" }, error: null };
        }
        return { data: null, error: null };
      },
      async () => ({ data: [{ new_owner_id: "editor-1", previous_owner_id: "owner-1" }], error: null })
    );
    mockCreateClient.mockReturnValue(userClient);

    const adminClient = createMockSupabase(async (ctx) => {
      if (ctx.table === "projects" && ctx.mode === "select") {
        return { data: [{ id: "p-a" }, { id: "p-b" }], error: null };
      }
      if (ctx.table === "sections" && ctx.filters.project_id === "project-1") {
        return { count: 5, error: null };
      }
      if (ctx.table === "sections" && Array.isArray(ctx.filters.project_id)) {
        return { count: 20, error: null };
      }
      return { data: null, error: null };
    });
    mockCreateAdminClient.mockReturnValue(adminClient);

    const res = await callPatch({ targetUserId: "editor-1", confirmProjectTitle: "Meu Projeto" });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("structural_limit_exceeded");
    expect(body.reason).toBe("projects_limit");
  });

  it("transfere ownership com sucesso e retorna novo owner", async () => {
    const userClient = createMockSupabase(async (ctx) => {
      if (ctx.table === "projects") {
        return { data: { id: "project-1", title: "Meu Projeto", owner_id: "owner-1" }, error: null };
      }
      if (ctx.table === "project_members") {
        return { data: { role: "editor" }, error: null };
      }
      return { data: null, error: null };
    });
    mockCreateClient.mockReturnValue(userClient);

    const adminClient = createMockSupabase(async (ctx) => {
      if (ctx.table === "projects" && ctx.mode === "select") {
        return { data: [{ id: "existing-1" }], error: null };
      }
      if (ctx.table === "sections" && ctx.filters.project_id === "project-1") {
        return { count: 3, error: null };
      }
      if (ctx.table === "sections" && Array.isArray(ctx.filters.project_id)) {
        return { count: 30, error: null };
      }
      if (ctx.table === "project_members" && ctx.mode === "upsert") {
        return { data: null, error: null };
      }
      if (ctx.table === "projects" && ctx.mode === "update") {
        return { data: null, error: null };
      }
      if (ctx.table === "project_members" && ctx.mode === "delete") {
        return { data: null, error: null };
      }
      if (ctx.table === "profiles") {
        if (Array.isArray(ctx.filters.id)) {
          return {
            data: [{ id: "owner-1", email: "owner@test.com", display_name: "Owner" }],
            error: null,
          };
        }
        if (ctx.filters.id === "editor-1") {
          return { data: { id: "editor-1", email: "editor@test.com", display_name: "Editor" }, error: null };
        }
        return { data: { id: "owner-1", email: "owner@test.com", display_name: "Owner" }, error: null };
      }
      if (ctx.table === "project_members" && ctx.mode === "select") {
        return { data: [{ user_id: "owner-1", role: "editor", created_at: "2026-03-19T00:00:00.000Z" }], error: null };
      }
      return { data: null, error: null };
    });
    mockCreateAdminClient.mockReturnValue(adminClient);

    const res = await callPatch({ targetUserId: "editor-1", confirmProjectTitle: "Meu Projeto" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.newOwnerId).toBe("editor-1");
    expect(Array.isArray(body.members)).toBe(true);
  });

  it("retorna erro claro quando RPC não está aplicada no Supabase", async () => {
    const userClient = createMockSupabase(
      async (ctx) => {
        if (ctx.table === "projects") {
          return { data: { id: "project-1", title: "Meu Projeto", owner_id: "owner-1" }, error: null };
        }
        if (ctx.table === "project_members") {
          return { data: { role: "editor" }, error: null };
        }
        return { data: null, error: null };
      },
      async () => ({
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public.transfer_project_ownership" },
      })
    );
    mockCreateClient.mockReturnValue(userClient);

    const adminClient = createMockSupabase(async (ctx) => {
      if (ctx.table === "projects" && ctx.mode === "select") {
        return { data: [{ id: "existing-1" }], error: null };
      }
      if (ctx.table === "sections" && ctx.filters.project_id === "project-1") {
        return { count: 3, error: null };
      }
      if (ctx.table === "sections" && Array.isArray(ctx.filters.project_id)) {
        return { count: 30, error: null };
      }
      return { data: null, error: null };
    });
    mockCreateAdminClient.mockReturnValue(adminClient);

    const res = await callPatch({ targetUserId: "editor-1", confirmProjectTitle: "Meu Projeto" });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("transfer_migration_required");
  });
});
