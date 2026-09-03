import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Teto de snapshots por requisição. Acima disso a tela oferece "carregar mais". */
const DEFAULT_LIMIT = 400;
const MAX_LIMIT = 1000;

const COLUMNS_WITH_ORIGIN =
  "id, section_id, project_id, title, content, sort_order, color, created_at, updated_by, updated_by_name, origin";
const COLUMNS_LEGACY =
  "id, section_id, project_id, title, content, sort_order, color, created_at, updated_by, updated_by_name";

/** A coluna `origin` chegou depois; sem a migração aplicada, o select falha. */
function isMissingOriginColumn(error: { message?: string } | null): boolean {
  const message = error?.message ?? "";
  return message.includes("origin") && /column|does not exist/i.test(message);
}

/**
 * GET: snapshots de todas as páginas do projeto, do mais recente para o mais
 * antigo. É a matéria-prima do changelog — quem monta a linha do tempo e
 * calcula os diffs é o cliente, que já tem a árvore de páginas em mãos.
 *
 * Query: `limit` (padrão 400) e `before` (ISO, para paginar para trás).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "project_id_required" }, { status: 400 });
    }

    const url = new URL(request.url);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT)
    );
    const before = url.searchParams.get("before");

    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { data: project, error: projectErr } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectErr || !project) {
      return NextResponse.json({ error: "project_not_found" }, { status: 404 });
    }

    const ownerId = (project as { owner_id: string }).owner_id;
    if (ownerId !== user.id) {
      const { data: memberRow } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!memberRow) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }

    const fetchVersions = async (columns: string) => {
      let query = supabase
        .from("section_versions")
        .select(columns)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (before) query = query.lt("created_at", before);
      return query;
    };

    let { data: versions, error: versionsErr } = await fetchVersions(COLUMNS_WITH_ORIGIN);

    if (versionsErr && isMissingOriginColumn(versionsErr)) {
      ({ data: versions, error: versionsErr } = await fetchVersions(COLUMNS_LEGACY));
    }

    if (versionsErr) {
      return NextResponse.json(
        { error: "changelog_fetch_failed", message: versionsErr.message },
        { status: 500 }
      );
    }

    const rows = versions ?? [];

    return NextResponse.json({
      versions: rows,
      /** Igual ao limite = provavelmente há mais história antes deste lote. */
      hasMore: rows.length === limit,
    });
  } catch (error) {
    console.error("[api/projects/.../changelog] GET error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
