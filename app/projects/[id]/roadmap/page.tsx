import RoadmapClient from "./RoadmapClient";

export default async function RoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoadmapClient projectId={id} />;
}
