import DocumentacaoClient from "./DocumentacaoClient";

export default async function DocumentacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentacaoClient projectId={id} />;
}
