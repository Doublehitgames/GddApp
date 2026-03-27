import ProjectSectionsSidebar from "@/components/ProjectSectionsSidebar";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectIdLayout({ children, params }: Props) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gray-900 pb-14">
      <div className="lg:pr-[372px]">{children}</div>
      <div className="hidden lg:block fixed right-4 top-6 z-40 w-[340px] h-[calc(100vh-3rem)]">
        <ProjectSectionsSidebar projectId={id} />
      </div>
      <div className="lg:hidden px-4 pb-4">
        <ProjectSectionsSidebar projectId={id} />
      </div>
    </div>
  );
}
