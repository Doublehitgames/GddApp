import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_CLOUD_SYNC_CREDITS_PER_HOUR = 30;
const CLOUD_SYNC_USAGE_BY_PROJECT_TABLE = "cloud_sync_usage_hourly_by_project";

function getHourlyCreditLimit(): number {
  const raw = process.env.CLOUD_SYNC_CREDITS_PER_HOUR;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  return DEFAULT_CLOUD_SYNC_CREDITS_PER_HOUR;
}

function getWindowTimestamps(now: Date) {
  const windowStart = new Date(now);
  windowStart.setMinutes(0, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);
  return {
    windowStartIso: windowStart.toISOString(),
    windowEndIso: windowEnd.toISOString(),
  };
}

/** Retorna a cota do projeto (janela da hora atual). Cota é por projeto; dono e membros compartilham. Requer ?projectId=uuid. */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required", code: "missing_project_id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    // Acesso: dono ou membro do projeto
    const { data: projectRow } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!projectRow) {
      return NextResponse.json({ error: "project not found", code: "not_found" }, { status: 404 });
    }

    const isOwner = (projectRow as { owner_id: string }).owner_id === user.id;
    if (!isOwner) {
      const { data: memberRow } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!memberRow) {
        return NextResponse.json({ error: "forbidden", code: "forbidden" }, { status: 403 });
      }
    }

    const now = new Date();
    const { windowStartIso, windowEndIso } = getWindowTimestamps(now);
    const limitPerHour = getHourlyCreditLimit();

    const { data: usageRow, error } = await supabase
      .from(CLOUD_SYNC_USAGE_BY_PROJECT_TABLE)
      .select("used_credits")
      .eq("project_id", projectId)
      .eq("window_start", windowStartIso)
      .maybeSingle();

    const usedInWindow = error ? 0 : Number(usageRow?.used_credits ?? 0);
    const remainingInWindow = Math.max(0, limitPerHour - usedInWindow);

    return NextResponse.json({
      limitPerHour,
      usedInWindow,
      remainingInWindow,
      windowStartedAt: windowStartIso,
      windowEndsAt: windowEndIso,
      consumedThisSync: 0,
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
