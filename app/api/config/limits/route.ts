import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRemoteConfig } from "@/lib/remoteConfig";

const FALLBACK = {
  FREE_MAX_PROJECTS: 2,
  FREE_MAX_SECTIONS_PER_PROJECT: 300,
  FREE_MAX_SECTIONS_TOTAL: 400,
  SYNC_REQUESTS_PER_MINUTE: 30,
};

/** Depende da sessão: cada usuário pode ter overrides próprios. Nunca cachear. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let userId: string | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      // Sem sessão (ou cookies indisponíveis): devolve os limites globais.
    }
    const config = await getRemoteConfig(userId);
    return NextResponse.json(config, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(FALLBACK, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
