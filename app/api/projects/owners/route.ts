import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET: quem é o dono de cada projeto que o usuário enxerga mas não possui.
 *
 * O perfil de outra pessoa não é legível pelo cliente (RLS de `profiles` só
 * libera o próprio), então quem resolve nome/e-mail é o servidor — e só para
 * donos de projetos que o usuário realmente participa.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
    }

    // RLS já restringe a projetos que o usuário possui ou participa.
    const { data: visibleProjects } = await supabase.from("projects").select("owner_id");
    const ownerIds = Array.from(
      new Set(
        (visibleProjects ?? [])
          .map((row: { owner_id: string | null }) => row.owner_id)
          .filter((id): id is string => Boolean(id) && id !== user.id)
      )
    );

    if (ownerIds.length === 0) {
      return NextResponse.json({ owners: {} }, { headers: NO_STORE });
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json({ owners: {} }, { headers: NO_STORE });
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", ownerIds);

    const owners: Record<string, { displayName: string | null; email: string | null }> = {};
    for (const p of (profiles ?? []) as { id: string; email: string | null; display_name: string | null }[]) {
      owners[p.id] = { displayName: p.display_name ?? null, email: p.email ?? null };
    }

    return NextResponse.json({ owners }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ owners: {} }, { headers: NO_STORE });
  }
}
