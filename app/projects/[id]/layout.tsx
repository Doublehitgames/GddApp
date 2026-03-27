import ProjectLayoutShell from "./ProjectLayoutShell";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectIdLayout({ children, params }: Props) {
  const { id } = await params;

  return <ProjectLayoutShell projectId={id}>{children}</ProjectLayoutShell>;
}
