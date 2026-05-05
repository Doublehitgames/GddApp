"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import { createClient } from "@/lib/supabase/client";
import { ensureUserProfile } from "@/lib/supabase/ensureUserProfile";
import { migrateLocalProjectsToSupabase } from "@/lib/supabase/projectSync";

/**
 * Inicializa o auth e conecta o userId ao projectStore para sync automático.
 * Também oferece migração automática dos dados do localStorage para o Supabase
 * na primeira vez que o usuário faz login.
 */
export function useAuthInit() {
  const { initialize, user } = useAuthStore();
  const { loadFromSupabase, loadFromStorage, setUserId, persistToStorage, flushPendingSyncs, persistenceConfig, refreshQuotaStatus, loadAgendaFromSupabase } = useProjectStore();
  const migratedRef = useRef(false);

  // Inicializa auth uma vez
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Quando o user muda (login/logout), atualiza o userId no store e carrega dados
  useEffect(() => {
    if (user) {
      setUserId(user.id);
      loadFromStorage();

      // Atualiza cota no badge (tempo de reset e créditos restantes) ao abrir/voltar ao app
      void refreshQuotaStatus();

      // Carrega tasks de agenda do Supabase
      void loadAgendaFromSupabase();

      // Garante que o usuário tenha linha em profiles (evita quebra se profile foi apagado e auth mantido)
      const supabase = createClient();
      void ensureUserProfile(supabase, user);

      // Carrega projetos da nuvem
      loadFromSupabase().then(async (result) => {
        if (result === "empty" && !migratedRef.current) {
          // Primeira vez do usuário: migrar dados locais para Supabase
          const localProjects = useProjectStore.getState().projects;
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

    // Sync automático: só o temporizador (intervalo em configurações). Desativado = apenas manual (botão Sincronizar).
    const intervalId = persistenceConfig.syncAutomatic
      ? window.setInterval(() => {
          void flushPendingSyncs();
        }, persistenceConfig.autosaveIntervalMs)
      : undefined;

    const onVisibilityChange = () => {
      persistToStorage();
      if (document.visibilityState === "visible") void refreshQuotaStatus();
    };

    const onPageHide = () => {
      persistToStorage();
    };

    const onBeforeUnload = () => {
      persistToStorage();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [user?.id, flushPendingSyncs, persistenceConfig.syncAutomatic, persistenceConfig.autosaveIntervalMs, refreshQuotaStatus]);
}
