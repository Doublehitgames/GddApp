import { useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";

export function useInitProjects() {
  const loadFromStorage = useProjectStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage(); // garante carregamento no client
  }, [loadFromStorage]);
}
