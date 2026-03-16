import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET: retorna quais dos IDs enviados estão em deleted_projects (projetos excluídos pelo dono).
 * Query: ?ids=uuid1,uuid2,uuid3
 * Uso: ao carregar da nuvem, o cliente envia seus project IDs locais e remove os que foram deletados.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const idsParam = request.nextUrl.searchParams.get("ids");
    if (!idsParam || typeof idsParam !== "string") {
      return NextResponse.json({ deletedIds: [] });
    }

    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    if (ids.length === 0) return NextResponse.json({ deletedIds: [] });

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json({ deletedIds: [] });
    }

    const { data: rows, error } = await admin
      .from("deleted_projects")
      .select("project_id")
      .in("project_id", ids);

    if (error) {
      return NextResponse.json({ deletedIds: [] });
    }

    const deletedIds = (rows || []).map((r: { project_id: string }) => r.project_id);
    return NextResponse.json({ deletedIds });
  } catch (error) {
    console.error("[api/projects/deleted-ids] GET error:", error);
    return NextResponse.json({ deletedIds: [] });
  }
}
