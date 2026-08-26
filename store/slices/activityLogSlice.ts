/**
 * Slice que gerencia o histórico de atividade de seções por projeto.
 *
 * Fluxo offline-first:
 *   1. Ação (criar/deletar/renomear) → evento salvo em pendingActivityLog (localStorage)
 *   2. Sync do projeto → flushPendingActivityLog envia os eventos ao Supabase e limpa a fila
 *
 * activityLogByProject: log já persistido, buscado do Supabase ao abrir o projeto (in-memory)
 * pendingActivityLog: fila local de eventos ainda não enviados (localStorage)
 */

import type { ActivityLogEvent } from "@/lib/supabase/activityLogSync";

export type { ActivityLogEvent };

const PENDING_KEY = "gdd_pending_activity_log_v1";

/**
 * Por quanto tempo edições repetidas na mesma página continuam sendo o mesmo
 * evento.
 *
 * A descrição salva sozinha a cada pausa na digitação, então um evento por
 * chamada transformaria dez minutos de escrita em dezenas de linhas — e a
 * tabela só guarda 200 eventos por projeto. Uma sessão de escrita é um evento.
 */
const EDIT_WINDOW_MS = 30 * 60_000;

function loadPending(): Record<string, ActivityLogEvent[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ActivityLogEvent[]>) : {};
  } catch {
    return {};
  }
}

function persistPending(pending: Record<string, ActivityLogEvent[]>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {}
}

export type ActivityLogState = {
  /** Eventos já confirmados no banco, buscados do Supabase. In-memory apenas. */
  activityLogByProject: Record<string, ActivityLogEvent[]>;
  /** Projetos cujo log já foi carregado nesta sessão (evita double-fetch). */
  activityLogFetchedProjects: string[];
  /** Fila de eventos ainda não enviados ao Supabase. Persistida no localStorage. */
  pendingActivityLog: Record<string, ActivityLogEvent[]>;
};

export type ActivityLogActions = {
  fetchActivityLog: (projectId: string) => Promise<void>;
  /** Registra um evento localmente. O envio ao Supabase acontece no próximo sync do projeto. */
  logSectionActivity: (event: Omit<ActivityLogEvent, "id" | "created_at">) => void;
  /** Chamado pelo syncEngine após sync bem-sucedido: envia fila pendente ao Supabase e limpa. */
  flushPendingActivityLog: (projectId: string) => Promise<void>;
};

type StoreSet = (
  partial:
    | Partial<ActivityLogState & ActivityLogActions>
    | ((state: ActivityLogState & ActivityLogActions) => Partial<ActivityLogState & ActivityLogActions>)
) => void;
type StoreGet = () => ActivityLogState & ActivityLogActions;

export function createActivityLogSlice(set: StoreSet, get: StoreGet) {
  return {
    // ── State ──────────────────────────────────────────────────────────────
    activityLogByProject: {} as Record<string, ActivityLogEvent[]>,
    activityLogFetchedProjects: [] as string[],
    pendingActivityLog: loadPending(),

    // ── Actions ────────────────────────────────────────────────────────────

    fetchActivityLog: async (projectId: string) => {
      if (get().activityLogFetchedProjects.includes(projectId)) return;

      const { fetchActivityLog: fetch } = await import("@/lib/supabase/activityLogSync");
      const events = await fetch(projectId);

      if (events === null) return; // timeout/erro — não marca como fetched

      // Mescla eventos do banco com os pendentes locais (pendentes ficam no topo)
      const pending = get().pendingActivityLog[projectId] ?? [];
      const merged = [
        ...pending,
        ...events.filter((e) => !pending.some((p) => p.id === e.id)),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      set((s) => ({
        activityLogByProject: { ...s.activityLogByProject, [projectId]: merged },
        activityLogFetchedProjects: [...s.activityLogFetchedProjects, projectId],
      }));
    },

    logSectionActivity: (event: Omit<ActivityLogEvent, "id" | "created_at">) => {
      const now = new Date().toISOString();

      // Edições repetidas na mesma página, dentro da janela, são a mesma sessão
      // de escrita: em vez de um evento novo, o evento existente sobe de hora.
      // Se ele já foi para o banco, não há o que subir — fica como está, e um
      // "modificada há 20min" desatualizado é infinitamente melhor que 40 linhas.
      //
      // Uma página recém-criada absorve a primeira descrição: "criada" já conta
      // a história, e escrever o texto é parte de criar. Sem isso, montar um
      // projeto por template daria duas linhas por página.
      if (event.action === "modified") {
        const existing = get().activityLogByProject[event.project_id] ?? [];
        const recent = existing.find(
          (e) =>
            e.section_id === event.section_id &&
            (e.action === "modified" || e.action === "created")
        );

        if (recent && Date.now() - new Date(recent.created_at).getTime() < EDIT_WINDOW_MS) {
          if (recent.action === "created") return;

          const pendingForProject = get().pendingActivityLog[event.project_id] ?? [];
          const isStillPending = pendingForProject.some((p) => p.id === recent.id);
          if (!isStillPending) return;

          set((s) => {
            const bump = (list: ActivityLogEvent[]) =>
              list.map((e) => (e.id === recent.id ? { ...e, created_at: now } : e));
            const updatedPending = {
              ...s.pendingActivityLog,
              [event.project_id]: bump(s.pendingActivityLog[event.project_id] ?? []),
            };
            persistPending(updatedPending);
            return {
              pendingActivityLog: updatedPending,
              activityLogByProject: {
                ...s.activityLogByProject,
                // Reordena: o evento acabou de virar o mais recente da lista.
                [event.project_id]: bump(s.activityLogByProject[event.project_id] ?? []).sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ),
              },
            };
          });
          return;
        }
      }

      const newEvent: ActivityLogEvent = {
        origin: "app",
        ...event,
        id: crypto.randomUUID(),
        created_at: now,
      };

      set((s) => {
        // Adiciona à fila pendente
        const existingPending = s.pendingActivityLog[event.project_id] ?? [];
        const updatedPending = {
          ...s.pendingActivityLog,
          [event.project_id]: [...existingPending, newEvent],
        };
        persistPending(updatedPending);

        // Atualiza o display imediatamente (otimista)
        const existingDisplay = s.activityLogByProject[event.project_id] ?? [];
        return {
          pendingActivityLog: updatedPending,
          activityLogByProject: {
            ...s.activityLogByProject,
            [event.project_id]: [newEvent, ...existingDisplay],
          },
        };
      });
    },

    flushPendingActivityLog: async (projectId: string) => {
      const pending = get().pendingActivityLog[projectId] ?? [];
      if (pending.length === 0) return;

      const { insertActivityEvent } = await import("@/lib/supabase/activityLogSync");

      // Envia cada evento em ordem (best-effort — erros individuais são swallowed)
      for (const event of pending) {
        await insertActivityEvent(event);
      }

      // Limpa a fila do projeto independente de erros individuais
      set((s) => {
        const updated = { ...s.pendingActivityLog };
        delete updated[projectId];
        persistPending(updated);
        return { pendingActivityLog: updated };
      });
    },
  };
}
