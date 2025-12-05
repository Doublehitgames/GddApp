import GDDViewClient from "./GDDViewClient";

export default async function GDDViewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
 
  return <GDDViewClient projectId={resolvedParams.id} />;
}
