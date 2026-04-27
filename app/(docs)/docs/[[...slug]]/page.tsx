import { redirect } from "next/navigation";

type RouteParams = { slug?: string[] };

export default async function DocsLegacyRedirect({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug = [] } = await params;
  const path = slug.length > 0 ? `/${slug.join("/")}` : "";
  redirect(`/docs/pt-BR${path}`);
}
