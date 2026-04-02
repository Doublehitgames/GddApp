import { createAdminClient } from "@/lib/supabase/admin";
import type { Project } from "@/store/projectStore";

function mapRowToProject(projectRow: any, sectionRows: any[]): Project {
  return {
    id: projectRow.id,
    title: projectRow.title,
    description: projectRow.description || "",
    createdAt: projectRow.created_at,
    updatedAt: projectRow.updated_at,
    mindMapSettings: projectRow.mindmap_settings || {},
    sections: (sectionRows || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content || "",
      flowchartEnabled: row.flowchart_state != null,
      flowchartState: row.flowchart_state || undefined,
      created_at: row.created_at,
      parentId: row.parent_id || undefined,
      order: (row.sort_order ?? row.order) ?? 0,
      color: row.color || undefined,
      domainTags: Array.isArray(row.domain_tags) && row.domain_tags.length > 0 ? row.domain_tags : undefined,
    })),
  };
}

export async function getPublicProjectByIdAndToken(id: string, token: string): Promise<Project | null> {
  const supabase = createAdminClient();

  const { data: projectRow, error: projectErr } = await supabase
    .from("projects")
    .select("id,title,description,created_at,updated_at,mindmap_settings")
    .eq("id", id)
    .single();

  if (projectErr || !projectRow) return null;

  const sharing = (projectRow.mindmap_settings as any)?.sharing;
  const isPublic = Boolean(sharing?.isPublic);
  const shareToken = typeof sharing?.shareToken === "string" ? sharing.shareToken : "";

  if (!isPublic || !shareToken || shareToken !== token) return null;

  const { data: sectionRows, error: sectionErr } = await supabase
    .from("sections")
    .select("id,title,content,created_at,parent_id,sort_order,color,domain_tags,flowchart_state")
    .eq("project_id", id)
    .order("sort_order", { ascending: true });

  if (sectionErr) return null;

  return mapRowToProject(projectRow, sectionRows || []);
}

export async function getPublicProjectByToken(token: string): Promise<Project | null> {
  const supabase = createAdminClient();

  const { data: projectRows, error } = await supabase
    .from("projects")
    .select("id,title,description,created_at,updated_at,mindmap_settings");

  if (error || !projectRows) return null;

  const projectRow = projectRows.find((row: any) => {
    const sharing = (row.mindmap_settings as any)?.sharing;
    return Boolean(sharing?.isPublic) && typeof sharing?.shareToken === "string" && sharing.shareToken === token;
  });

  if (!projectRow) return null;

  const { data: sectionRows, error: sectionErr } = await supabase
    .from("sections")
    .select("id,title,content,created_at,parent_id,sort_order,color,domain_tags,flowchart_state")
    .eq("project_id", projectRow.id)
    .order("sort_order", { ascending: true });

  if (sectionErr) return null;

  return mapRowToProject(projectRow, sectionRows || []);
}
