import { AreaComingSoon } from "@/components/project/AreaComingSoon";

export default async function SistemasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AreaComingSoon projectId={id} />;
}
