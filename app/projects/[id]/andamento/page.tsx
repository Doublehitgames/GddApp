import AndamentoClient from "./AndamentoClient";

export default async function AndamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AndamentoClient projectId={id} />;
}
