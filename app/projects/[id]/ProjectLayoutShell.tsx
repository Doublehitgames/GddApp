"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import ProjectSectionsSidebar from "@/components/ProjectSectionsSidebar";

interface Props {
  children: React.ReactNode;
  projectId: string;
}

export default function ProjectLayoutShell({ children, projectId }: Props) {
  const pathname = usePathname();

  const shouldShowSidebar = useMemo(() => {
    if (!pathname) return true;
    return !pathname.endsWith("/mindmap") && !pathname.endsWith("/view");
  }, [pathname]);

  return (
    <div className="min-h-screen bg-gray-900 pb-14">
      <div className={shouldShowSidebar ? "lg:pr-[372px]" : ""}>{children}</div>
      {shouldShowSidebar && (
        <>
          <div className="hidden lg:block fixed right-4 top-6 z-40 w-[340px] h-[calc(100vh-3rem)]">
            <ProjectSectionsSidebar projectId={projectId} />
          </div>
          <div className="lg:hidden px-4 pb-4">
            <ProjectSectionsSidebar projectId={projectId} />
          </div>
        </>
      )}
    </div>
  );
}
