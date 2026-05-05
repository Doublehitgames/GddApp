import KpiClient from "./KpiClient";

export default async function KpiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KpiClient projectId={id} />;
}
