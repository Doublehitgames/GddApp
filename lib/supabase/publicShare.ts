import { createAdminClient } from "@/lib/supabase/admin";
import type { Project } from "@/store/projectStore";
import { parseDeckLayout } from "@/lib/deck/deck";
import { parsePageStatus } from "@/lib/pageStatus/types";

function isMissingColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const message = String((error as { message?: unknown }).message || "").toLowerCase();
  if (!message.includes(column)) return false;
  return message.includes("column") || message.includes("does not exist");
}

function isMissingCoverImageColumn(error: unknown): boolean {
  return isMissingColumnError(error, "cover_image_url");
}

// `content_blocks` e `thumb_image_url` vieram de migração (add_sections_thumb_image.sql).
// Numa instalação que ainda não rodou o SQL, pedir a coluna derruba a query inteira —
// então caímos no select antigo em vez de perder o share público por completo.
// Esta lista é a fonte de verdade do que o link público enxerga. Campo que o
// mapeador lá embaixo lê e que não estiver aqui volta sempre vazio — foi o que
// aconteceu com `status` e `deck_layout`: no mapa público toda página aparecia
// como "sem estado" e o Deck ignorava a escolha da página, sem erro nenhum.
const SECTION_COLUMNS =
  "id,title,content,content_blocks,thumb_image_url,created_at,parent_id,sort_order,color,domain_tags,data_id,status,status_at,deck_layout,flowchart_state";
const SECTION_COLUMNS_LEGACY =
  "id,title,content,created_at,parent_id,sort_order,color,domain_tags,flowchart_state";

async function fetchPublicSections(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string
): Promise<any[] | null> {
  const primary = await supabase
    .from("sections")
    .select(SECTION_COLUMNS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (!primary.error) return primary.data || [];

  const missingNewColumn =
    isMissingColumnError(primary.error, "content_blocks") ||
    isMissingColumnError(primary.error, "thumb_image_url");
  if (!missingNewColumn) return null;

  const fallback = await supabase
    .from("sections")
    .select(SECTION_COLUMNS_LEGACY)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (fallback.error) return null;
  return fallback.data || [];
}

function mapRowToProject(projectRow: any, sectionRows: any[]): Project {
  return {
    id: projectRow.id,
    title: projectRow.title,
    description: projectRow.description || "",
    coverImageUrl: projectRow.cover_image_url || undefined,
    createdAt: projectRow.created_at,
    updatedAt: projectRow.updated_at,
    mindMapSettings: projectRow.mindmap_settings || {},
    sections: (sectionRows || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content || "",
      contentBlocks: Array.isArray(row.content_blocks) ? row.content_blocks : undefined,
      thumbImageUrl: row.thumb_image_url || undefined,
      flowchartEnabled: row.flowchart_state != null,
      flowchartState: row.flowchart_state || undefined,
      created_at: row.created_at,
      parentId: row.parent_id || undefined,
      order: (row.sort_order ?? row.order) ?? 0,
      color: row.color || undefined,
      dataId: row.data_id || undefined,
      deckLayout: parseDeckLayout(row.deck_layout),
      status: parsePageStatus(row.status),
      statusAt: row.status_at || null,
      domainTags: Array.isArray(row.domain_tags) && row.domain_tags.length > 0 ? row.domain_tags : undefined,
    })),
  };
}

export async function getPublicProjectByIdAndToken(id: string, token: string): Promise<Project | null> {
  const supabase = createAdminClient();

  const initialProjectResult = await supabase
    .from("projects")
    .select("id,title,description,cover_image_url,created_at,updated_at,mindmap_settings")
    .eq("id", id)
    .single();

  let projectRow: any = initialProjectResult.data;
  let projectErr: any = initialProjectResult.error;

  if (projectErr && isMissingCoverImageColumn(projectErr)) {
    const fallback = await supabase
      .from("projects")
      .select("id,title,description,created_at,updated_at,mindmap_settings")
      .eq("id", id)
      .single();

    projectRow = fallback.data;
    projectErr = fallback.error;
  }

  if (projectErr || !projectRow) return null;

  const sharing = (projectRow.mindmap_settings as any)?.sharing;
  const isPublic = Boolean(sharing?.isPublic);
  const shareToken = typeof sharing?.shareToken === "string" ? sharing.shareToken : "";

  if (!isPublic || !shareToken || shareToken !== token) return null;

  const sectionRows = await fetchPublicSections(supabase, id);
  if (!sectionRows) return null;

  return mapRowToProject(projectRow, sectionRows);
}

export async function getPublicProjectByToken(token: string): Promise<Project | null> {
  const supabase = createAdminClient();

  const initialProjectsResult = await supabase
    .from("projects")
    .select("id,title,description,cover_image_url,created_at,updated_at,mindmap_settings");

  let projectRows: any[] | null = initialProjectsResult.data as any[] | null;
  let error: any = initialProjectsResult.error;

  if (error && isMissingCoverImageColumn(error)) {
    const fallback = await supabase
      .from("projects")
      .select("id,title,description,created_at,updated_at,mindmap_settings");
    projectRows = fallback.data;
    error = fallback.error;
  }

  if (error || !projectRows) return null;

  const projectRow = projectRows.find((row: any) => {
    const sharing = (row.mindmap_settings as any)?.sharing;
    return Boolean(sharing?.isPublic) && typeof sharing?.shareToken === "string" && sharing.shareToken === token;
  });

  if (!projectRow) return null;

  const sectionRows = await fetchPublicSections(supabase, projectRow.id);
  if (!sectionRows) return null;

  return mapRowToProject(projectRow, sectionRows);
}
