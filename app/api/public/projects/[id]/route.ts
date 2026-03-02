import { NextRequest, NextResponse } from "next/server";
import { getPublicProjectByIdAndToken } from "@/lib/supabase/publicShare";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const token = request.nextUrl.searchParams.get("token")?.trim();

    if (!id || !token) {
      return NextResponse.json({ error: "missing_id_or_token" }, { status: 400 });
    }

    const project = await getPublicProjectByIdAndToken(id, token);
    if (!project) {
      return NextResponse.json({ error: "forbidden_or_not_found" }, { status: 403 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("[api/public/projects/[id]] GET error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
