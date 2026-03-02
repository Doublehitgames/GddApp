import MindMapClient from "@/app/projects/[id]/mindmap/MindMapClient";

export default async function PublicMindMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  return <MindMapClient projectId={id} publicToken={token} />;
}
