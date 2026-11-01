jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

const mockCreateClient = jest.fn();
const mockCreateAdminClient = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

import { DELETE, GET } from "@/app/api/account/route";
import {
  confirmationMatches,
  deleteAccountData,
  resetDeleteAttempts,
  summarizeAccount,
  DELETE_ATTEMPTS_PER_WINDOW,
} from "@/lib/account/deleteAccount";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const USER = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OTHER = "a3bb189e-8bf9-4888-9912-ace4e6543002";
const P1 = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const P2 = "9b2f5c4e-3d1a-4f6b-8e7c-2a1b0c9d8e7f";

type Op = {
  table: string;
  op: "select" | "delete" | "update" | "upsert";
  payload?: unknown;
  filters: Array<[string, string, unknown]>;
};

/** Supabase admin de mentira: grava cada operação, na ordem, com os filtros. */
function fakeAdmin(opts: { failAt?: (op: Op) => boolean; data?: (op: Op) => unknown } = {}) {
  const ops: Op[] = [];
  const deletedUsers: string[] = [];
  const from = (table: string) => {
    const op: Op = { table, op: "select", filters: [] };
    ops.push(op);
    const result = () => {
      if (opts.failAt?.(op)) return Promise.resolve({ data: null, error: { message: `boom in ${table}` } });
      return Promise.resolve({ data: opts.data?.(op) ?? [], error: null });
    };
    const b: Record<string, unknown> = {
      select() { return b; },
      delete() { op.op = "delete"; return b; },
      update(p: unknown) { op.op = "update"; op.payload = p; return b; },
      upsert(p: unknown) { op.op = "upsert"; op.payload = p; return b; },
      eq(f: string, v: unknown) { op.filters.push(["eq", f, v]); return b; },
      in(f: string, v: unknown) { op.filters.push(["in", f, v]); return b; },
      is(f: string, v: unknown) { op.filters.push(["is", f, v]); return b; },
      like(f: string, v: unknown) { op.filters.push(["like", f, v]); return b; },
      then(ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) { return result().then(ok, ko); },
    };
    return b;
  };
  const client = {
    from: jest.fn(from),
    auth: {
      admin: {
        deleteUser: jest.fn(async (id: string) => {
          deletedUsers.push(id);
          return { data: {}, error: null };
        }),
      },
    },
  };
  return { client: client as unknown as SupabaseClient, ops, deletedUsers };
}

const ownedProjects = (op: Op) =>
  op.table === "projects" && op.op === "select" ? [{ id: P1 }, { id: P2 }] : undefined;

function sessionClient(user: { id: string; email: string | null } | null) {
  return {
    auth: {
      getUser: jest.fn(async () => ({ data: { user }, error: user ? null : { message: "no" } })),
      signOut: jest.fn(async () => ({ error: null })),
    },
  };
}

function req(opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers = new Map(Object.entries({ host: "gdd.test", ...(opts.headers ?? {}) }));
  return {
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: async () => opts.body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  resetDeleteAttempts();
  mockCreateClient.mockReset();
  mockCreateAdminClient.mockReset();
});

describe("confirmationMatches", () => {
  it("ignora maiúsculas e espaços nas pontas", () => {
    expect(confirmationMatches("  Ana@Exemplo.com ", "ana@exemplo.com")).toBe(true);
  });
  it("recusa vazio, outro e-mail e tipo errado", () => {
    expect(confirmationMatches("", "ana@exemplo.com")).toBe(false);
    expect(confirmationMatches("bia@exemplo.com", "ana@exemplo.com")).toBe(false);
    expect(confirmationMatches(42, "ana@exemplo.com")).toBe(false);
    expect(confirmationMatches("ana@exemplo.com", null)).toBe(false);
  });
});

describe("deleteAccountData", () => {
  it("apaga na ordem: lápide, projetos, vínculos, nomes, acessos, perfil e por último o Auth", async () => {
    const { client, ops, deletedUsers } = fakeAdmin({ data: ownedProjects });
    const res = await deleteAccountData(client, USER);

    expect(res).toEqual({ ok: true, deletedProjects: 2, warnings: [] });
    const writes = ops.filter((o) => o.op !== "select").map((o) => `${o.op}:${o.table}`);
    expect(writes).toEqual([
      "upsert:deleted_projects",
      "delete:projects",
      "delete:project_members",
      "update:project_members",
      "update:section_activity_log",
      "update:section_versions",
      "delete:user_api_keys",
      "delete:oauth_tokens",
      "delete:oauth_codes",
      "delete:app_config",
      "delete:profiles",
    ]);
    expect(deletedUsers).toEqual([USER]);

    const tomb = ops.find((o) => o.table === "deleted_projects")!;
    expect(tomb.payload).toEqual([{ project_id: P1 }, { project_id: P2 }]);
    // Tudo filtrado pela própria pessoa — o cliente admin não tem RLS.
    expect(ops.find((o) => o.op === "delete" && o.table === "projects")!.filters).toEqual([["eq", "owner_id", USER]]);
    expect(ops.find((o) => o.op === "update" && o.table === "project_members")).toMatchObject({
      payload: { invited_by: null },
      filters: [["eq", "invited_by", USER]],
    });
    expect(ops.find((o) => o.table === "app_config")!.filters).toEqual([["like", "key", `%:${USER}`]]);
    expect(ops.find((o) => o.table === "profiles")!.filters).toEqual([["eq", "id", USER]]);
  });

  it("sem projetos próprios, não grava lápide nem apaga projeto", async () => {
    const { client, ops } = fakeAdmin();
    const res = await deleteAccountData(client, USER);
    expect(res.ok).toBe(true);
    expect(ops.some((o) => o.table === "deleted_projects")).toBe(false);
    expect(ops.some((o) => o.table === "projects" && o.op === "delete")).toBe(false);
  });

  it("etapa obrigatória que falha para tudo antes de apagar o usuário do Auth", async () => {
    const { client, ops, deletedUsers } = fakeAdmin({
      data: ownedProjects,
      failAt: (o) => o.table === "user_api_keys",
    });
    const res = await deleteAccountData(client, USER);
    expect(res).toEqual({ ok: false, step: "api_keys", message: "boom in user_api_keys" });
    expect(deletedUsers).toEqual([]);
    expect(ops.some((o) => o.table === "profiles")).toBe(false);
  });

  it("etapa opcional que falha (tabela antiga ausente) vira aviso e segue", async () => {
    const { client, deletedUsers } = fakeAdmin({
      data: ownedProjects,
      failAt: (o) => o.table === "deleted_projects" || o.table === "section_versions",
    });
    const res = await deleteAccountData(client, USER);
    expect(res).toEqual({ ok: true, deletedProjects: 2, warnings: ["tombstones", "version_names"] });
    expect(deletedUsers).toEqual([USER]);
  });
});

describe("summarizeAccount", () => {
  it("conta projetos, compartilhados, pessoas afetadas, participações, chaves e conexões", async () => {
    const { client } = fakeAdmin({
      data: (o) => {
        if (o.table === "projects") return [{ id: P1 }, { id: P2 }];
        if (o.table === "project_members" && o.filters[0][0] === "in")
          return [
            { project_id: P1, user_id: OTHER },
            { project_id: P1, user_id: "e4eaaaf2-d142-11e1-b3e4-080027620cdd" },
          ];
        if (o.table === "project_members") return [{ project_id: "c56a4180-65aa-42ec-a945-5fd21dec0538" }];
        if (o.table === "user_api_keys") return [{ id: "k1" }];
        if (o.table === "oauth_tokens") return [{ client_id: "c1" }, { client_id: "c1" }];
        return [];
      },
    });
    expect(await summarizeAccount(client, USER)).toEqual({
      ownedProjects: 2,
      sharedOwnedProjects: 1,
      membersAffected: 2,
      memberships: 1,
      apiKeys: 1,
      connections: 1,
    });
  });
});

describe("DELETE /api/account", () => {
  it("recusa chave de API ou token: só a sessão do navegador apaga", async () => {
    const res = await DELETE(req({ headers: { authorization: "Bearer gdd_sk_abc" }, body: { confirmEmail: "a@b.com" } }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "session_required" });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("recusa pedido vindo de outro site", async () => {
    const res = await DELETE(req({ headers: { origin: "https://evil.example" }, body: {} }));
    expect(res.status).toBe(403);
  });

  it("401 sem sessão", async () => {
    mockCreateClient.mockReturnValue(sessionClient(null));
    const res = await DELETE(req({ body: { confirmEmail: "a@b.com" } }));
    expect(res.status).toBe(401);
  });

  it("400 quando o e-mail digitado não bate, sem tocar no banco", async () => {
    mockCreateClient.mockReturnValue(sessionClient({ id: USER, email: "ana@exemplo.com" }));
    const res = await DELETE(req({ body: { confirmEmail: "bia@exemplo.com" } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "confirmation_mismatch" });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("503 claro quando falta a chave de serviço", async () => {
    mockCreateClient.mockReturnValue(sessionClient({ id: USER, email: "ana@exemplo.com" }));
    mockCreateAdminClient.mockImplementation(() => {
      throw new Error("Missing Supabase backend key");
    });
    const res = await DELETE(req({ body: { confirmEmail: "ana@exemplo.com" } }));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "service_unavailable" });
  });

  it("apaga, encerra a sessão e responde ok", async () => {
    const session = sessionClient({ id: USER, email: "ana@exemplo.com" });
    mockCreateClient.mockReturnValue(session);
    const admin = fakeAdmin({ data: ownedProjects });
    mockCreateAdminClient.mockReturnValue(admin.client);

    const res = await DELETE(req({ headers: { origin: "https://gdd.test" }, body: { confirmEmail: "ANA@exemplo.com" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deletedProjects: 2, warnings: [] });
    expect(admin.deletedUsers).toEqual([USER]);
    expect(session.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("500 com a etapa quando algo obrigatório falha", async () => {
    mockCreateClient.mockReturnValue(sessionClient({ id: USER, email: "ana@exemplo.com" }));
    mockCreateAdminClient.mockReturnValue(fakeAdmin({ failAt: (o) => o.table === "profiles" }).client);
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await DELETE(req({ body: { confirmEmail: "ana@exemplo.com" } }));
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ code: "delete_failed", step: "profile" });
  });

  it("freia tentativas repetidas", async () => {
    mockCreateClient.mockReturnValue(sessionClient({ id: USER, email: "ana@exemplo.com" }));
    for (let i = 0; i < DELETE_ATTEMPTS_PER_WINDOW; i++) {
      expect((await DELETE(req({ body: { confirmEmail: "x@y.com" } }))).status).toBe(400);
    }
    expect((await DELETE(req({ body: { confirmEmail: "x@y.com" } }))).status).toBe(429);
  });
});

describe("GET /api/account", () => {
  it("devolve e-mail e resumo", async () => {
    mockCreateClient.mockReturnValue(sessionClient({ id: USER, email: "ana@exemplo.com" }));
    mockCreateAdminClient.mockReturnValue(fakeAdmin({ data: ownedProjects }).client);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ email: "ana@exemplo.com", summary: { ownedProjects: 2 } });
  });
});
