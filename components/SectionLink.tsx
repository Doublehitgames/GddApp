"use client";

import { useRouter } from "next/navigation";
import { useProjectStore } from "@/store/projectStore";
import { sectionPathById } from "@/lib/utils/slug";

interface SectionLinkProps {
  sectionName: string;
  projectId: string;
  sectionId: string | null;
  children: React.ReactNode;
}

/**
 * Renders a clickable link to another section
 * Used for cross-references like $[Section Name]
 */
export function SectionLink({ sectionName, projectId, sectionId, children }: SectionLinkProps) {
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const project = projects.find((p) => p.id === projectId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (sectionId && project) {
      router.push(sectionPathById(project, sectionId));
    }
  };

  if (!sectionId) {
    // Invalid reference - section doesn't exist
    return (
      <span
        className="text-red-500 underline decoration-wavy cursor-help"
        title={`Seção não encontrada: "${sectionName}"`}
      >
        {children}
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="text-blue-400 hover:text-blue-300 underline cursor-pointer font-medium inline"
      title={`Ir para: ${sectionName}`}
    >
      {children}
    </button>
  );
}
