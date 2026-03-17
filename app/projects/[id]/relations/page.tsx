import RelationsClient from "./RelationsClient";

export default async function RelationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RelationsClient projectId={id} />;
}
