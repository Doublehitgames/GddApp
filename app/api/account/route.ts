import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  confirmationMatches,
  deleteAccountData,
  summarizeAccount,
  takeDeleteAttempt,
} from "@/lib/account/deleteAccount";

/**
 * /api/account — a conta de quem está no navegador.
 *
 * GET    → resumo do que seria apagado (contagens).
 * DELETE → apaga a conta e tudo dela. Corpo: { confirmEmail: "<e-mail da conta>" }.
 *
 * Só aceita a SESSÃO do navegador: chave de API (gdd_sk_) e token OAuth do MCP
 * nunca apagam a conta — apagar tem de vir da própria pessoa, na tela.
 */

type SessionUser = { id: string; email: string | null };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

/** Recusa qualquer Authorization: aqui não entra chave nem token, só cookie de sessão. */
async function sessionUser(request: NextRequest): Promise<
  | { user: SessionUser; supabase: SupabaseClient }
  | { response: ReturnType<typeof json> }
> {
  if (request.headers.get("authorization")) {
    return { response: json({ error: "Account deletion requires a browser session", code: "session_required" }, 403) };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { response: json({ error: "Not authenticated", code: "unauthenticated" }, 401) };
  }
  return { user: { id: data.user.id, email: data.user.email ?? null }, supabase };
}

function adminOrError(): { admin: SupabaseClient } | { response: ReturnType<typeof json> } {
  try {
    return { admin: createAdminClient() };
  } catch {
    return {
      response: json(
        { error: "Server is missing SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY", code: "service_unavailable" },
        503,
      ),
    };
  }
}

/** Pedido vindo de outro site (com Origin diferente) não apaga nada. */
function crossOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

export async function GET(request: NextRequest) {
  const s = await sessionUser(request);
  if ("response" in s) return s.response;
  const a = adminOrError();
  if ("response" in a) return a.response;

  try {
    const summary = await summarizeAccount(a.admin, s.user.id);
    return json({ email: s.user.email, summary });
  } catch {
    return json({ error: "Failed to read account summary", code: "db_error" }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  if (crossOrigin(request)) {
    return json({ error: "Cross-origin request refused", code: "forbidden" }, 403);
  }
  const s = await sessionUser(request);
  if ("response" in s) return s.response;

  if (!takeDeleteAttempt(s.user.id)) {
    return json({ error: "Too many attempts, try again later", code: "rate_limit" }, 429);
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const typed = body && typeof body === "object" ? (body as { confirmEmail?: unknown }).confirmEmail : undefined;
  if (!s.user.email) {
    return json({ error: "Account has no e-mail to confirm with", code: "no_email" }, 400);
  }
  if (!confirmationMatches(typed, s.user.email)) {
    return json({ error: "Confirmation does not match the account e-mail", code: "confirmation_mismatch" }, 400);
  }

  const a = adminOrError();
  if ("response" in a) return a.response;

  const result = await deleteAccountData(a.admin, s.user.id);
  if (!result.ok) {
    console.error("[account] delete failed at", result.step, result.message);
    return json({ error: "Failed to delete account", code: "delete_failed", step: result.step }, 500);
  }

  // Derruba os cookies de sessão deste navegador. O usuário já não existe, então
  // o signOut "global" falharia; o local só limpa os cookies.
  try {
    await s.supabase.auth.signOut({ scope: "local" });
  } catch {
    /* o cliente também sai do lado dele */
  }

  return json({ ok: true, deletedProjects: result.deletedProjects, warnings: result.warnings });
}
