import ProjectDetailClient from "./ProjectDetailClient";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
 
  return <ProjectDetailClient projectId={resolvedParams.id} />;
}