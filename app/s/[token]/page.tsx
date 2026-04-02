import GDDViewClient from "@/app/projects/[id]/view/GDDViewClient";
import MindMapClient from "@/app/projects/[id]/mindmap/MindMapClient";
import DiagramasClient from "@/app/projects/[id]/diagramas/DiagramasClient";
import { getPublicProjectByToken } from "@/lib/supabase/publicShare";

export default async function PublicSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string; sectionId?: string }>;
}) {
  const { token } = await params;
  const { mode, sectionId } = await searchParams;

  const project = await getPublicProjectByToken(token);
  if (!project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <p className="text-gray-700">Link público inválido ou expirado.</p>
      </div>
    );
  }

  const isMindMapMode = mode === "mindmap";
  const isDiagramMode = mode === "diagramas";

  if (isMindMapMode) {
    return <MindMapClient projectId={project.id} publicToken={token} />;
  }

  if (isDiagramMode) {
    const requestedSection = sectionId
      ? project.sections?.find((section) => section.id === sectionId)
      : undefined;
    const fallbackSection = project.sections?.find((section) => Boolean(section.flowchartEnabled));
    const targetSection = requestedSection && requestedSection.flowchartEnabled
      ? requestedSection
      : fallbackSection;

    if (!targetSection) {
      return <GDDViewClient projectId={project.id} publicToken={token} />;
    }

    return (
      <DiagramasClient
        projectId={project.id}
        sectionId={targetSection.id}
        publicToken={token}
        publicProjectTitle={project.title}
        publicSectionTitle={targetSection.title}
        initialDiagramState={targetSection.flowchartState}
        readOnlyPublic
      />
    );
  }

  return <GDDViewClient projectId={project.id} publicToken={token} />;
}
