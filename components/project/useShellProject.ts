"use client";

import { useMemo } from "react";
import { useProjectStore } from "@/store/projectStore";

/** O projeto da rota (slug ou UUID), como a casca resolve. */
export function useShellProject(projectRef: string) {
  const getProjectByRef = useProjectStore((s) => s.getProjectByRef);
  const projects = useProjectStore((s) => s.projects);
  return useMemo(() => getProjectByRef(projectRef), [getProjectByRef, projectRef, projects]);
}
