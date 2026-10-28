import ProjectHomeClient from "./ProjectHomeClient";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectHomeClient projectId={id} />;
}
