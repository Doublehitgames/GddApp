"use client";

import { useAuthInit } from "@/hooks/useAuthInit";
import ProjectSyncFooter from "@/components/ProjectSyncFooter";

export default function ClientInit() {
  useAuthInit();
  return <ProjectSyncFooter />;
}
