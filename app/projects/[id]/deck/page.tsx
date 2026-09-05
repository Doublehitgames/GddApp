import DeckClient from "./DeckClient";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  return <DeckClient projectId={resolvedParams.id} />;
}
