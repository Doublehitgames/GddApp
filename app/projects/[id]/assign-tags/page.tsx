import AssignTagsClient from "./AssignTagsClient";

export default async function AssignTagsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignTagsClient projectId={id} />;
}
