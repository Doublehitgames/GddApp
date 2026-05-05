import AgendaClient from "./AgendaClient";

export default async function AgendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgendaClient projectId={id} />;
}
