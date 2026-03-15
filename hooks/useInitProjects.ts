import { useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";

export function useInitProjects() {
  const loadFromStorage = useProjectStore((s) => s.loadFromStorage);
  const persistToStorage = useProjectStore((s) => s.persistToStorage);

  useEffect(() => {
    loadFromStorage(); // garante carregamento no client
  }, [loadFromStorage]);

  useEffect(() => {
    const save = () => persistToStorage();
    window.addEventListener("beforeunload", save);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", save);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [persistToStorage]);
}
