import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";

/**
 * GET /api/v1/me — returns the authenticated user's profile.
 * Accepts both API key (Authorization: Bearer gdd_sk_...) and session cookies.
 * Primary use: quick test that an API key works.
 */
export async function GET(request: NextRequest) {
  const auth = await getApiUser(request);

  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: profile, error } = await auth.supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .eq("id", auth.userId)
    .single();

  if (error || !profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    authSource: auth.source,
  });
}
