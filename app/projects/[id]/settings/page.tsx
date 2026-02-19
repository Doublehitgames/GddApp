import SettingsClient from "./SettingsClient";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
 
  return <SettingsClient projectId={resolvedParams.id} />;
}
