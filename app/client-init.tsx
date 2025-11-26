"use client";

import { useInitProjects } from "@/hooks/useInitProjects";

export default function ClientInit() {
  useInitProjects();
  return null;
}
