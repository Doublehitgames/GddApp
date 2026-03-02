import GDDViewClient from "@/app/projects/[id]/view/GDDViewClient";
import MindMapClient from "@/app/projects/[id]/mindmap/MindMapClient";
import { getPublicProjectByToken } from "@/lib/supabase/publicShare";

export default async function PublicSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { token } = await params;
  const { mode } = await searchParams;

  const project = await getPublicProjectByToken(token);
  if (!project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <p className="text-gray-700">Link público inválido ou expirado.</p>
      </div>
    );
  }

  const isMindMapMode = mode === "mindmap";

  if (isMindMapMode) {
    return <MindMapClient projectId={project.id} publicToken={token} />;
  }

  return <GDDViewClient projectId={project.id} publicToken={token} />;
}
