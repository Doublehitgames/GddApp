import RoadmapPrintClient from "./RoadmapPrintClient";

export default async function RoadmapPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoadmapPrintClient projectId={id} />;
}
