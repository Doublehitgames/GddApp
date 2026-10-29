import BibliotecaClient from "./BibliotecaClient";

export default async function BibliotecaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const { id } = await params;
  // A coleção aberta vem de ?c=, lida aqui e não com useSearchParams: aquele
  // pede uma fronteira de Suspense, que hidrata depois de o store carregar do
  // localStorage — e o cliente desenhava a tabela onde o servidor não tinha nada.
  const { c } = await searchParams;
  return <BibliotecaClient projectId={id} collection={Array.isArray(c) ? c[0] : c} />;
}
