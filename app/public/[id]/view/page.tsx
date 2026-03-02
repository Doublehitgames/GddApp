import GDDViewClient from "@/app/projects/[id]/view/GDDViewClient";

export default async function PublicGDDViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  return <GDDViewClient projectId={id} publicToken={token} />;
}
