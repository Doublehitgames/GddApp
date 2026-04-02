import DiagramasClient from "@/app/projects/[id]/diagramas/DiagramasClient";

export default async function SectionDiagramasPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>;
}) {
  const resolvedParams = await params;
  return (
    <DiagramasClient
      projectId={resolvedParams.id}
      sectionId={resolvedParams.sectionId}
    />
  );
}
