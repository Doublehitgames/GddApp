import { NextResponse } from "next/server";
import { getRemoteConfig } from "@/lib/remoteConfig";

const FALLBACK = {
  FREE_MAX_PROJECTS: 2,
  FREE_MAX_SECTIONS_PER_PROJECT: 300,
  FREE_MAX_SECTIONS_TOTAL: 200,
  SYNC_REQUESTS_PER_MINUTE: 30,
};

export async function GET() {
  try {
    const config = await getRemoteConfig();
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
