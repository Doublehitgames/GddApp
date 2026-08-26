/**
 * Tests for the activity log's coalescing rules.
 *
 * The log is capped at 200 events per project by a database trigger, and the
 * description editor autosaves on every pause in typing. Without coalescing, a
 * single writing session would evict the project's whole history — so these
 * rules are the feature, not an optimization.
 */

import { useProjectStore } from "@/store/projectStore";

jest.mock("@/lib/supabase/projectSync", () => ({
  fetchProjectsFromSupabase: jest.fn(async () => []),
  upsertProjectToSupabase: jest.fn(async () => ({ error: null })),
  deleteProjectFromSupabase: jest.fn(async () => ({ error: null })),
  migrateLocalProjectsToSupabase: jest.fn(async () => ({ migrated: 0, errors: 0 })),
}));

let uuidCounter = 0;
global.crypto = {
  randomUUID: jest.fn(() => `uuid-${++uuidCounter}`),
} as any;

const eventsOf = (projectId: string) =>
  useProjectStore.getState().activityLogByProject[projectId] ?? [];

describe("activity log coalescing", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      activityLogByProject: {},
      activityLogFetchedProjects: [],
      pendingActivityLog: {},
    });
    localStorage.clear();
    uuidCounter = 0;
    jest.clearAllMocks();
  });

  it("logs one event per page created", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    useProjectStore.getState().addSection(projectId, "Quadro de Missões");

    const events = eventsOf(projectId);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("created");
    expect(events[0].section_title).toBe("Quadro de Missões");
    expect(events[0].origin).toBe("app");
  });

  it("folds an autosave storm into a single 'modified' event", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const sectionId = useProjectStore.getState().addSection(projectId, "Economia");

    // Push the 'created' event out of the coalescing window so the edits are
    // judged on their own.
    useProjectStore.setState((s) => ({
      activityLogByProject: {
        ...s.activityLogByProject,
        [projectId]: s.activityLogByProject[projectId].map((e) => ({
          ...e,
          created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
        })),
      },
    }));

    for (let i = 0; i < 20; i++) {
      useProjectStore
        .getState()
        .updateSectionDescription(projectId, sectionId, [], `rascunho ${i}`);
    }

    const modified = eventsOf(projectId).filter((e) => e.action === "modified");
    expect(modified).toHaveLength(1);
    expect(modified[0].detail).toBe("description");
  });

  it("a freshly created page absorbs its first description", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const sectionId = useProjectStore.getState().addSection(projectId, "Loja");

    useProjectStore
      .getState()
      .updateSectionDescription(projectId, sectionId, [], "texto inicial");

    // Building a project from a template writes a description right after
    // creating each page; "criada" already tells that story.
    const events = eventsOf(projectId);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("created");
  });

  it("opens a new event once the edit window has passed", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const sectionId = useProjectStore.getState().addSection(projectId, "Missões");

    useProjectStore
      .getState()
      .updateSectionDescription(projectId, sectionId, [], "primeira sessão");

    // Age everything past the 30-minute window.
    useProjectStore.setState((s) => ({
      activityLogByProject: {
        ...s.activityLogByProject,
        [projectId]: s.activityLogByProject[projectId].map((e) => ({
          ...e,
          created_at: new Date(Date.now() - 31 * 60_000).toISOString(),
        })),
      },
    }));

    useProjectStore
      .getState()
      .updateSectionDescription(projectId, sectionId, [], "segunda sessão");

    const modified = eventsOf(projectId).filter((e) => e.action === "modified");
    expect(modified).toHaveLength(1);
    expect(eventsOf(projectId)).toHaveLength(2);
  });

  it("keeps edits to different pages apart", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const aId = useProjectStore.getState().addSection(projectId, "Página A");
    const bId = useProjectStore.getState().addSection(projectId, "Página B");

    useProjectStore.setState((s) => ({
      activityLogByProject: {
        ...s.activityLogByProject,
        [projectId]: s.activityLogByProject[projectId].map((e) => ({
          ...e,
          created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
        })),
      },
    }));

    useProjectStore.getState().updateSectionDescription(projectId, aId, [], "a");
    useProjectStore.getState().updateSectionDescription(projectId, bId, [], "b");

    const modified = eventsOf(projectId).filter((e) => e.action === "modified");
    expect(modified).toHaveLength(2);
    expect(new Set(modified.map((e) => e.section_id))).toEqual(new Set([aId, bId]));
  });

  it("a folded edit only queues one row for Supabase", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const sectionId = useProjectStore.getState().addSection(projectId, "Balanceamento");

    for (let i = 0; i < 10; i++) {
      useProjectStore.getState().updateSectionDescription(projectId, sectionId, [], `v${i}`);
    }

    const pending = useProjectStore.getState().pendingActivityLog[projectId] ?? [];
    expect(pending).toHaveLength(1);
    expect(pending[0].action).toBe("created");
  });
});
