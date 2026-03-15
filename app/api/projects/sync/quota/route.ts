import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_CLOUD_SYNC_CREDITS_PER_HOUR = 30;
const CLOUD_SYNC_USAGE_TABLE = "cloud_sync_usage_hourly";

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

/** Retorna a cota atual do usuário (janela da hora atual). Usado para atualizar o badge ao abrir o app. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const now = new Date();
    const { windowStartIso, windowEndIso } = getWindowTimestamps(now);
    const limitPerHour = getHourlyCreditLimit();

    const { data: usageRow, error } = await supabase
      .from(CLOUD_SYNC_USAGE_TABLE)
      .select("used_credits")
      .eq("user_id", user.id)
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
