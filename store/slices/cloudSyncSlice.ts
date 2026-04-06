import type { ProjectStore, UUID, Project, Section } from "./types";
import { STORAGE_KEY } from "./types";
import {
  fetchProjectFromSupabase,
  fetchProjectsFromSupabase,
  fetchDeletedProjectIds,
  fetchQuotaStatus,
} from "@/lib/supabase/projectSync";
import {
  sanitizeProjectsForStorage,
  parseProjectsFromStorage,
  buildSectionDiagramKey,
  persistDiagrams,
  logInfo,
  logWarn,
} from "./storageHelpers";
import type { SyncEngineAPI } from "./syncEngine";

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

export function createCloudSyncSlice(set: StoreSet, get: StoreGet, engine: SyncEngineAPI) {
  return {
    syncProjectToSupabase: async (projectId: UUID) => {
      engine.markProjectDirty(projectId);
      await engine.syncNow(projectId);
    },

    discardPendingChangesForProject: async (projectId: UUID) => {
      const { userId, projects } = get();
      if (!userId) {
        return { error: "unauthenticated" };
      }

      const localProject = projects.find((p) => p.id === projectId);
      if (!localProject) {
        return { error: "project_not_found_local" };
      }

      if (engine.inFlightSyncProjectIds.has(projectId)) {
        return { error: "sync_in_progress" };
      }

      const remoteProject = await fetchProjectFromSupabase(projectId);
      if (!remoteProject) {
        return { error: "project_not_found_in_cloud" };
      }

      // Protege alteracoes locais da pagina inicial (descricao, ficha tecnica, capa e settings)
      // para nao serem perdidas ao descartar pendencias de secoes.
      if (engine.buildProjectMetadataHash(localProject) !== engine.buildProjectMetadataHash(remoteProject)) {
        return { error: "project_metadata_pending" };
      }

      engine.wrappedSet((prev) => prev.map((project) => (project.id === projectId ? remoteProject : project)));
      engine.clearProjectDirty(projectId);
      engine.clearProjectBackoff(projectId);
      engine.syncRetryCount.delete(projectId);
      engine.syncedProjectHash.set(projectId, engine.buildProjectHash(remoteProject));

      set({ syncStatus: "idle", lastSyncError: null, lastSyncFailureReason: null });
      engine.persistSyncState();

      return { error: null };
    },

    getPendingProjectIds: () => Array.from(engine.dirtyProjectIds),

    clearSyncHistory: () => {
      set({ lastSyncStatsHistory: [] });
      engine.persistSyncState();
    },

    refreshQuotaStatus: async (projectId?: string) => {
      if (!projectId) {
        set({ lastQuotaStatus: null });
        engine.persistSyncState();
        return;
      }
      const q = await fetchQuotaStatus(projectId);
      if (q) {
        set({ lastQuotaStatus: q });
        engine.persistSyncState();
      }
    },

    setProjectOwnerLocally: (projectId: UUID, ownerId: string) => {
      engine.wrappedSet((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, ownerId, updatedAt: new Date().toISOString() }
            : p
        )
      );
    },

    flushPendingSyncs: async () => {
      if (engine.isCloudSyncPaused()) return;

      const pendingIds = Array.from(engine.dirtyProjectIds);
      if (pendingIds.length === 0) return;

      set({ syncStatus: "syncing", lastSyncError: null });

      await Promise.all(
        pendingIds.map(async (projectId) => {
          await engine.syncNow(projectId);
        })
      );

      // Check if all flushed projects were successfully synced.
      // New edits during the flush may have added fresh dirty IDs — those are
      // expected and should NOT prevent the status from reflecting the flush result.
      const stillDirty = pendingIds.filter((id) => engine.dirtyProjectIds.has(id));
      if (stillDirty.length === 0) {
        set({ syncStatus: "synced", lastSyncedAt: new Date().toISOString() });
      }
    },

    loadFromSupabase: async () => {
      const remote = await fetchProjectsFromSupabase();
      if (remote === null) return "error";

      // Garante que temos os dados locais para fazer merge
      let localProjects = get().projects;
      if (localProjects.length === 0) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = parseProjectsFromStorage(raw);
            if (parsed) localProjects = parsed;
          }
        } catch {}
      }

      // Projetos deletados pelo dono: remover da lista local para membros nao re-criarem como owner
      const localIds = localProjects.map((p) => p.id);
      if (localIds.length > 0) {
        const deletedIds = await fetchDeletedProjectIds(localIds);
        deletedIds.forEach((id) => get().removeProjectLocally(id));
        localProjects = get().projects;
        if (localProjects.length === 0) {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const parsed = parseProjectsFromStorage(raw);
              if (parsed) localProjects = parsed;
            }
          } catch {}
        }
      }

      // Se nuvem esta vazia, sinaliza para o hook de init disparar migracao
      if (remote.length === 0) return "empty";

      // Re-le o estado local antes do merge (pode ter mudado durante o fetch)
      localProjects = get().projects;
      if (localProjects.length === 0) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = parseProjectsFromStorage(raw);
            if (parsed) localProjects = parsed;
          }
        } catch {}
      }

      // -- Merge inteligente --
      // Regra: prefere local se mais recente ou se tiver mais secoes (evita perda quando sync falhou).
      // Projetos que so existem localmente (ainda nao sincronizados) sao MANTIDOS
      // e automaticamente enviados ao cloud.
      const toTimestampMs = (value?: string | null): number => {
        if (!value) return 0;
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const remoteById = new Map(remote.map((p) => [p.id, p] as const));
      const remoteIds = new Set(remoteById.keys());
      const localOnly = localProjects.filter((p) => !remoteIds.has(p.id));
      const localNewerSameId = localProjects.filter((localProject) => {
        const remoteProject = remoteById.get(localProject.id);
        if (!remoteProject) return false;
        return new Date(localProject.updatedAt) > new Date(remoteProject.updatedAt);
      });

      const merged: Project[] = [
        ...remote.map((remoteProject) => {
          const local = localProjects.find((p) => p.id === remoteProject.id);
          if (!local) return remoteProject;

          const localSectionsById = new Map((local.sections || []).map((section) => [section.id, section] as const));
          const remoteSectionsById = new Map((remoteProject.sections || []).map((section) => [section.id, section] as const));

          const orderedSectionIds: string[] = [];
          const seenSectionIds = new Set<string>();
          const pushSectionId = (id: string) => {
            if (seenSectionIds.has(id)) return;
            seenSectionIds.add(id);
            orderedSectionIds.push(id);
          };

          (local.sections || []).forEach((section) => pushSectionId(section.id));
          (remoteProject.sections || []).forEach((section) => pushSectionId(section.id));

          const mergedSections = orderedSectionIds
            .map((sectionId) => {
              const localSection = localSectionsById.get(sectionId);
              const remoteSection = remoteSectionsById.get(sectionId);
              if (!localSection) return remoteSection;
              if (!remoteSection) return localSection;

              const localSectionUpdated = toTimestampMs(localSection.updated_at || localSection.created_at || null);
              const remoteSectionUpdated = toTimestampMs(remoteSection.updated_at || remoteSection.created_at || null);
              const preferLocalSection = localSectionUpdated > remoteSectionUpdated;

              return preferLocalSection ? localSection : remoteSection;
            })
            .filter((section): section is Section => Boolean(section));

          const localUpdated = new Date(local.updatedAt).getTime();
          const remoteUpdated = new Date(remoteProject.updatedAt).getTime();
          const localSections = (local.sections || []).length;
          const remoteSections = (remoteProject.sections || []).length;
          // Prefere local se for mais recente OU se tiver mais secoes (evita perder dados quando sync de secoes falhou)
          const preferLocal =
            localUpdated > remoteUpdated || (localUpdated >= remoteUpdated && localSections >= remoteSections);
          const base = preferLocal
            ? { ...remoteProject, ...local }
            : { ...local, ...remoteProject };

          // Retrocompatibilidade: se a nuvem ainda nao tem cover_image_url,
          // mantem a capa local para nao "sumir" apos refresh/load.
          const localCover = typeof local.coverImageUrl === "string" ? local.coverImageUrl.trim() : "";
          const remoteCover = typeof remoteProject.coverImageUrl === "string" ? remoteProject.coverImageUrl.trim() : "";

          return {
            ...base,
            sections: mergedSections,
            coverImageUrl: localCover || remoteCover || undefined,
          };
        }),
        ...localOnly, // Projetos que so existem localmente
      ];

      const totalSections = (arr: Project[]) =>
        arr.reduce((sum, p) => sum + (p.sections || []).length, 0);
      const mergedCount = totalSections(merged);

      // Nunca perder projeto nem secoes: preferir sempre a versao com mais secoes por projeto.
      // Re-le estado atual (memoria + localStorage) e garante que nenhum projeto seja removido ou encolhido.
      let toApply = merged;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const current = raw ? parseProjectsFromStorage(raw) : null;
        const inMemory = get().projects;
        const localById = new Map<string, Project>();
        for (const p of [...(current || []), ...inMemory]) {
          const existing = localById.get(p.id);
          const n = (p.sections || []).length;
          const existingN = existing ? (existing.sections || []).length : 0;
          if (!existing || n > existingN) localById.set(p.id, p);
        }
        const applyById = new Map(toApply.map((p) => [p.id, p]));
        for (const [id, localProject] of localById) {
          const applied = applyById.get(id);
          const localSectionsCount = (localProject.sections || []).length;
          const appliedSections = applied ? (applied.sections || []).length : 0;
          if (!applied || localSectionsCount > appliedSections) {
            applyById.set(id, localProject);
            if (!applied) logInfo("[projectStore] Mantendo projeto so local no merge:", id);
            else if (localSectionsCount > appliedSections) logInfo("[projectStore] Preferindo versao local com mais secoes:", id);
          }
        }
        toApply = Array.from(applyById.values());
      } catch (e) {
        logWarn("[projectStore] Erro ao fazer merge defensivo; mantendo merged.", e);
      }

      const currentDiagrams = get().diagramsBySection;
      const nextDiagrams = { ...currentDiagrams };
      for (const project of toApply) {
        for (const section of project.sections || []) {
          const sectionKey = buildSectionDiagramKey(project.id, section.id);
          const remoteDiagram = section.flowchartState;
          if (!remoteDiagram) continue;

          const existing = nextDiagrams[sectionKey];
          if (!existing) {
            nextDiagrams[sectionKey] = remoteDiagram;
            continue;
          }

          const existingUpdated = toTimestampMs(existing.updatedAt || null);
          const remoteUpdated = toTimestampMs(remoteDiagram.updatedAt || section.updated_at || project.updatedAt || null);
          if (remoteUpdated > existingUpdated) {
            nextDiagrams[sectionKey] = remoteDiagram;
          }
        }
      }

      set({ projects: toApply, diagramsBySection: nextDiagrams });
      persistDiagrams(nextDiagrams);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProjectsForStorage(toApply)));
      } catch {}

      // Sobe ao cloud apenas projetos que ainda nao existem no servidor (localOnly).
      // Nao disparamos sync para "localNewerSameId" aqui: apos um load, comparacao de datas
      // (ex.: formato do Supabase vs localStorage) pode dar falso positivo e consumir creditos no login.
      // Edicoes do usuario continuam disparando sync normalmente via wrappedSetWithSync.
      if (localOnly.length > 0) {
        logInfo(`[projectStore] Subindo ${localOnly.length} projeto(s) novos (so locais) para o cloud...`);
        localOnly.forEach((p) => {
          engine.markProjectDirty(p.id);
          engine.debouncedSync(p.id);
        });
      }

      return "loaded";
    },
  };
}
