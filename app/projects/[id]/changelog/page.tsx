import ChangelogClient from "./ChangelogClient";

export default async function ChangelogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChangelogClient projectId={id} />;
}
