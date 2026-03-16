import SectionDetailClient from "../SectionDetailClient";

export default async function SectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sectionId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const openEdit = resolvedSearch?.edit === "1";
  return (
    <SectionDetailClient
      projectId={resolvedParams.id}
      sectionId={resolvedParams.sectionId}
      openEdit={openEdit}
    />
  );
}
