/**
 * GET  /api/oauth/connections           — lista as conexões OAuth ativas do usuário
 * DELETE /api/oauth/connections?clientId — revoga a conexão de um cliente
 *
 * Autenticado por sessão Supabase (cookie), não por token — é o painel do
 * próprio usuário em /settings. Os helpers usam admin client porque a tabela
 * oauth_clients tem RLS fechado, mas tudo é filtrado por user.id da sessão.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listUserConnections, revokeUserConnection } from "@/lib/oauth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const connections = await listUserConnections(user.id);
  return NextResponse.json({ connections });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId parameter" }, { status: 400 });
  }

  const ok = await revokeUserConnection(user.id, clientId);
  if (!ok) {
    return NextResponse.json({ error: "Failed to revoke connection" }, { status: 500 });
  }

  return NextResponse.json({ revoked: true });
}
