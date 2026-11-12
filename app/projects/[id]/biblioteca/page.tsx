import BibliotecaClient from "./BibliotecaClient";

export default async function BibliotecaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string | string[]; p?: string | string[] }>;
}) {
  const { id } = await params;
  // A coleção aberta vem de ?c=, lida aqui e não com useSearchParams: aquele
  // pede uma fronteira de Suspense, que hidrata depois de o store carregar do
  // localStorage — e o cliente desenhava a tabela onde o servidor não tinha nada.
  // Sem ?c= é "Todos". ?p= é a página que abre selecionada, vinda de um card de "Todos".
  const { c, p } = await searchParams;
  const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  return <BibliotecaClient projectId={id} collection={first(c)} page={first(p)} />;
}
