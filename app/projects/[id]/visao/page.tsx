import VisaoClient from "./VisaoClient";

// Por enquanto, o painel antigo do projeto (capa, ficha técnica): é aqui que eles
// moram agora. A tela da Visão de verdade (pilares, sensação…) vem com o campo vision.
export default async function VisaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VisaoClient projectId={id} />;
}
