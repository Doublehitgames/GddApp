import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRemoteConfig } from "@/lib/remoteConfig";

const FALLBACK = {
  FREE_MAX_PROJECTS: 2,
  FREE_MAX_SECTIONS_PER_PROJECT: 300,
  SYNC_REQUESTS_PER_MINUTE: 30,
};

/** Depende da sessão: cada usuário pode ter overrides próprios. Nunca cachear. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let userId: string | null = null;
    let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
    try {
      supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      // Sem sessão (ou cookies indisponíveis): devolve os limites globais.
    }

    const config = await getRemoteConfig(userId);

    // Limites estruturais são sempre avaliados no DONO do projeto. Um membro
    // convidado precisa saber o limite de quem o convidou, senão a UI bloqueia
    // numa conta e o servidor aceita na outra.
    const byOwner: Record<string, typeof config> = {};
    if (userId && supabase) {
      byOwner[userId] = config;
      // RLS já restringe a projetos que o usuário possui ou participa.
      const { data: visibleProjects } = await supabase.from("projects").select("owner_id");
      const otherOwnerIds = Array.from(
        new Set(
          (visibleProjects ?? [])
            .map((row: { owner_id: string | null }) => row.owner_id)
            .filter((id): id is string => Boolean(id) && id !== userId)
        )
      );
      for (const ownerId of otherOwnerIds) {
        byOwner[ownerId] = await getRemoteConfig(ownerId);
      }
    }

    return NextResponse.json(
      { ...config, byOwner },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ...FALLBACK, byOwner: {} },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
