"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import { migrateLocalProjectsToSupabase } from "@/lib/supabase/projectSync";

/**
 * Inicializa o auth e conecta o userId ao projectStore para sync automático.
 * Também oferece migração automática dos dados do localStorage para o Supabase
 * na primeira vez que o usuário faz login.
 */
export function useAuthInit() {
  const { initialize, user } = useAuthStore();
  const { loadFromSupabase, loadFromStorage, setUserId, projects, flushPendingSyncs, persistenceConfig } = useProjectStore();
  const migratedRef = useRef(false);

  // Inicializa auth uma vez
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Quando o user muda (login/logout), atualiza o userId no store e carrega dados
  useEffect(() => {
    if (user) {
      setUserId(user.id);

      // Carrega projetos da nuvem
      loadFromSupabase().then(async (result) => {
        if (result === "empty" && !migratedRef.current) {
          // Primeira vez do usuário: migrar dados locais para Supabase
          const localProjects = projects;
          if (localProjects.length > 0) {
            migratedRef.current = true;
            const { migrated } = await migrateLocalProjectsToSupabase(localProjects, user.id);
            if (migrated > 0) {
              // Recarrega do Supabase após migração
              await loadFromSupabase();
            }
          }
        } else if (result === "error") {
          // Fallback para localStorage se Supabase falhar
          loadFromStorage();
        }
      });
    } else {
      setUserId(null);
      loadFromStorage();
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;

    const intervalId = window.setInterval(() => {
      void flushPendingSyncs();
    }, persistenceConfig.autosaveIntervalMs);

    const onVisibilityChange = () => {
      if (persistenceConfig.syncOnVisibilityHidden && document.visibilityState === "hidden") {
        void flushPendingSyncs();
      }
    };

    const onPageHide = () => {
      if (persistenceConfig.syncOnPageHide) {
        void flushPendingSyncs();
      }
    };

    const onBeforeUnload = () => {
      if (persistenceConfig.syncOnBeforeUnload) {
        void flushPendingSyncs();
      }
    };

    const onBlur = () => {
      if (persistenceConfig.syncOnBlur) {
        void flushPendingSyncs();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("blur", onBlur);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("blur", onBlur);
    };
  }, [user?.id, flushPendingSyncs, persistenceConfig]);
}
