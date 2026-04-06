import { useProjectStore } from "@/store/projectStore";
import type { Project, Section } from "@/store/projectStore";
import {
  fetchProjectsFromSupabase,
  fetchProjectFromSupabase,
  upsertProjectToSupabase,
  fetchDeletedProjectIds,
  fetchQuotaStatus,
} from "@/lib/supabase/projectSync";

jest.mock("@/lib/supabase/projectSync", () => ({
  fetchProjectsFromSupabase: jest.fn(async () => []),
  fetchProjectFromSupabase: jest.fn(async () => null),
  upsertProjectToSupabase: jest.fn(async () => ({ error: null })),
  deleteProjectFromSupabase: jest.fn(async () => ({ error: null })),
  migrateLocalProjectsToSupabase: jest.fn(async () => ({ migrated: 0, errors: 0 })),
  fetchDeletedProjectIds: jest.fn(async () => []),
  fetchQuotaStatus: jest.fn(async () => null),
}));

const fetchProjectsMock = fetchProjectsFromSupabase as jest.Mock;
const fetchProjectMock = fetchProjectFromSupabase as jest.Mock;
const upsertProjectMock = upsertProjectToSupabase as jest.Mock;
const fetchDeletedIdsMock = fetchDeletedProjectIds as jest.Mock;
const fetchQuotaMock = fetchQuotaStatus as jest.Mock;

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Test Project",
    description: "Desc",
    createdAt: now,
    updatedAt: now,
    sections: [],
    ...overrides,
  };
}

function makeSection(overrides: Partial<Section> = {}): Section {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "Test Section",
    content: "Content",
    created_at: now,
    order: 0,
    ...overrides,
  };
}

describe("Sync flow: loadFromSupabase", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    jest.useFakeTimers();
    storage = {};
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: jest.fn((key: string) => storage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => { storage[key] = value; }),
        removeItem: jest.fn((key: string) => { delete storage[key]; }),
        clear: jest.fn(() => { storage = {}; }),
      },
      configurable: true,
      writable: true,
    });
    useProjectStore.setState({
      projects: [],
      userId: "user-1",
      syncStatus: "idle",
      cloudSyncPausedUntil: null,
      cloudSyncPauseReason: null,
      lastSyncError: null,
      lastSyncFailureReason: null,
      pendingSyncCount: 0,
      lastSyncedAt: null,
      lastSyncStats: null,
      lastSyncStatsHistory: [],
      lastQuotaStatus: null,
      persistenceConfig: { debounceMs: 1500, autosaveIntervalMs: 30000, syncAutomatic: false },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('returns "empty" when cloud has no projects', async () => {
    fetchProjectsMock.mockResolvedValue([]);
    const result = await useProjectStore.getState().loadFromSupabase();
    expect(result).toBe("empty");
  });

  it('returns "error" when fetch fails', async () => {
    fetchProjectsMock.mockResolvedValue(null);
    const result = await useProjectStore.getState().loadFromSupabase();
    expect(result).toBe("error");
  });

  it("loads all projects from cloud when local is empty", async () => {
    const remote1 = makeProject({ title: "Remote A" });
    const remote2 = makeProject({ title: "Remote B" });
    fetchProjectsMock.mockResolvedValue([remote1, remote2]);

    const result = await useProjectStore.getState().loadFromSupabase();
    expect(result).toBe("loaded");

    const projects = useProjectStore.getState().projects;
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.title).sort()).toEqual(["Remote A", "Remote B"]);
  });

  it("prefers local project when local is newer", async () => {
    const projectId = "proj-merge-1";
    const localProject = makeProject({
      id: projectId,
      title: "Local Title",
      updatedAt: "2026-04-06T12:00:00.000Z",
      sections: [makeSection({ id: "sec-1", title: "Local Section" })],
    });
    const remoteProject = makeProject({
      id: projectId,
      title: "Remote Title",
      updatedAt: "2026-04-06T10:00:00.000Z",
      sections: [makeSection({ id: "sec-1", title: "Remote Section" })],
    });

    useProjectStore.setState({ projects: [localProject] });
    fetchProjectsMock.mockResolvedValue([remoteProject]);

    await useProjectStore.getState().loadFromSupabase();

    const merged = useProjectStore.getState().getProject(projectId);
    expect(merged?.title).toBe("Local Title");
  });

  it("prefers remote project when remote is newer", async () => {
    const projectId = "proj-merge-2";
    const localProject = makeProject({
      id: projectId,
      title: "Local Old",
      updatedAt: "2026-04-06T08:00:00.000Z",
      sections: [],
    });
    const remoteProject = makeProject({
      id: projectId,
      title: "Remote New",
      updatedAt: "2026-04-06T12:00:00.000Z",
      sections: [makeSection({ id: "sec-r1", title: "Remote Only" })],
    });

    useProjectStore.setState({ projects: [localProject] });
    fetchProjectsMock.mockResolvedValue([remoteProject]);

    await useProjectStore.getState().loadFromSupabase();

    const merged = useProjectStore.getState().getProject(projectId);
    expect(merged?.title).toBe("Remote New");
  });

  it("merges sections by timestamp — newer section wins per section ID", async () => {
    const projectId = "proj-section-merge";
    const localProject = makeProject({
      id: projectId,
      updatedAt: "2026-04-06T10:00:00.000Z",
      sections: [
        makeSection({ id: "sec-1", title: "Local Sec1 Updated", updated_at: "2026-04-06T11:00:00.000Z" }),
        makeSection({ id: "sec-2", title: "Local Sec2 Old", updated_at: "2026-04-06T08:00:00.000Z" }),
      ],
    });
    const remoteProject = makeProject({
      id: projectId,
      updatedAt: "2026-04-06T10:00:00.000Z",
      sections: [
        makeSection({ id: "sec-1", title: "Remote Sec1 Old", updated_at: "2026-04-06T09:00:00.000Z" }),
        makeSection({ id: "sec-2", title: "Remote Sec2 Updated", updated_at: "2026-04-06T12:00:00.000Z" }),
      ],
    });

    useProjectStore.setState({ projects: [localProject] });
    fetchProjectsMock.mockResolvedValue([remoteProject]);

    await useProjectStore.getState().loadFromSupabase();

    const merged = useProjectStore.getState().getProject(projectId);
    const sec1 = merged?.sections?.find((s) => s.id === "sec-1");
    const sec2 = merged?.sections?.find((s) => s.id === "sec-2");
    expect(sec1?.title).toBe("Local Sec1 Updated");
    expect(sec2?.title).toBe("Remote Sec2 Updated");
  });

  it("keeps local-only projects and marks them dirty for upload", async () => {
    const localOnly = makeProject({ id: "local-only-1", title: "Local Only" });
    const remoteProject = makeProject({ id: "remote-1", title: "From Cloud" });

    useProjectStore.setState({ projects: [localOnly] });
    fetchProjectsMock.mockResolvedValue([remoteProject]);

    await useProjectStore.getState().loadFromSupabase();

    const projects = useProjectStore.getState().projects;
    expect(projects).toHaveLength(2);
    expect(projects.find((p) => p.id === "local-only-1")).toBeDefined();
    expect(projects.find((p) => p.id === "remote-1")).toBeDefined();

    const pending = useProjectStore.getState().getPendingProjectIds();
    expect(pending).toContain("local-only-1");
  });

  it("removes locally projects that were deleted in cloud", async () => {
    const deletedProject = makeProject({ id: "deleted-1", title: "Will Be Removed" });
    const keptProject = makeProject({ id: "kept-1", title: "Stays" });

    useProjectStore.setState({ projects: [deletedProject, keptProject] });
    fetchDeletedIdsMock.mockResolvedValue(["deleted-1"]);
    fetchProjectsMock.mockResolvedValue([keptProject]);

    await useProjectStore.getState().loadFromSupabase();

    const projects = useProjectStore.getState().projects;
    expect(projects.find((p) => p.id === "deleted-1")).toBeUndefined();
    expect(projects.find((p) => p.id === "kept-1")).toBeDefined();
  });
});

describe("Sync flow: syncNow error handling", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    jest.useFakeTimers();
    storage = {};
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: jest.fn((key: string) => storage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => { storage[key] = value; }),
        removeItem: jest.fn((key: string) => { delete storage[key]; }),
        clear: jest.fn(() => { storage = {}; }),
      },
      configurable: true,
      writable: true,
    });
    useProjectStore.setState({
      projects: [],
      userId: "user-1",
      syncStatus: "idle",
      cloudSyncPausedUntil: null,
      cloudSyncPauseReason: null,
      lastSyncError: null,
      lastSyncFailureReason: null,
      pendingSyncCount: 0,
      persistenceConfig: { debounceMs: 1500, autosaveIntervalMs: 30000, syncAutomatic: true },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("pauses sync on quota_exceeded with cloudSyncPauseReason=quota", async () => {
    const quota = {
      limitPerHour: 30,
      usedInWindow: 30,
      remainingInWindow: 0,
      windowStartedAt: "2026-04-06T10:00:00.000Z",
      windowEndsAt: "2026-04-06T11:00:00.000Z",
      consumedThisSync: 0,
    };

    upsertProjectMock.mockResolvedValue({
      error: "Quota exceeded",
      errorCode: "quota_exceeded",
      quota,
    });

    const store = useProjectStore.getState();
    store.addProject("Quota Test", "Desc");
    await Promise.resolve();

    const state = useProjectStore.getState();
    expect(state.syncStatus).toBe("error");
    expect(state.cloudSyncPauseReason).toBe("quota");
    expect(state.lastQuotaStatus).toBeTruthy();
  });

  it("pauses sync for 1 minute on rate_limit", async () => {
    upsertProjectMock.mockResolvedValue({
      error: "Rate limited",
      errorCode: "rate_limit",
    });

    const store = useProjectStore.getState();
    store.addProject("Rate Limit Test", "Desc");
    await Promise.resolve();

    const state = useProjectStore.getState();
    expect(state.syncStatus).toBe("error");
    expect(state.cloudSyncPauseReason).toBe("rate_limit");
    expect(state.cloudSyncPausedUntil).toBeTruthy();
  });

  it("removes project locally when cloud returns project_deleted", async () => {
    upsertProjectMock.mockResolvedValue({
      error: "Deleted",
      errorCode: "project_deleted",
    });

    const store = useProjectStore.getState();
    const projectId = store.addProject("Will Be Deleted", "Desc");
    await Promise.resolve();

    const project = useProjectStore.getState().getProject(projectId);
    expect(project).toBeUndefined();
    expect(useProjectStore.getState().syncStatus).toBe("idle");
  });

  it("shows error for structural_limit without pausing", async () => {
    upsertProjectMock.mockResolvedValue({
      error: "Limit exceeded",
      errorCode: "structural_limit_exceeded",
      structuralLimitReason: "projects_limit",
    });

    const store = useProjectStore.getState();
    store.addProject("Limit Test", "Desc");
    await Promise.resolve();

    const state = useProjectStore.getState();
    expect(state.syncStatus).toBe("error");
    expect(state.lastSyncError).toContain("Limite");
    expect(state.cloudSyncPausedUntil).toBeNull();
  });

  it("registers generic errors in circuit breaker", async () => {
    upsertProjectMock.mockResolvedValue({
      error: "Server error",
      errorCode: "sync_route_timeout",
    });

    const store = useProjectStore.getState();
    store.addProject("Error Test", "Desc");
    await Promise.resolve();

    const state = useProjectStore.getState();
    expect(state.syncStatus).toBe("error");
    expect(state.lastSyncFailureReason).toContain("sync_route_timeout");
  });
});

describe("Sync flow: circuit breaker", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    jest.useFakeTimers();
    storage = {};
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: jest.fn((key: string) => storage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => { storage[key] = value; }),
        removeItem: jest.fn((key: string) => { delete storage[key]; }),
        clear: jest.fn(() => { storage = {}; }),
      },
      configurable: true,
      writable: true,
    });
    useProjectStore.setState({
      projects: [],
      userId: "user-1",
      syncStatus: "idle",
      cloudSyncPausedUntil: null,
      cloudSyncPauseReason: null,
      lastSyncError: null,
      lastSyncFailureReason: null,
      pendingSyncCount: 0,
      persistenceConfig: { debounceMs: 1500, autosaveIntervalMs: 30000, syncAutomatic: true },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("activates circuit breaker after threshold consecutive failures via auto-retry", async () => {
    // Eliminate jitter so backoff timing is deterministic
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);

    // All syncs fail
    upsertProjectMock.mockResolvedValue({
      error: "Server error",
      errorCode: "internal",
    });

    const store = useProjectStore.getState();

    // addProject triggers syncNow immediately → failure 1
    // registerSyncFailure schedules a retry via setTimeout(debouncedSync, backoffDelay)
    // Each retry triggers another syncNow → another failure → another retry
    // After SYNC_CIRCUIT_BREAKER_THRESHOLD (5) failures within SYNC_FAILURE_WINDOW_MS (120s),
    // the circuit breaker activates.
    // Backoff delays (jitter=0): 30s, 30s, 60s, 120s...
    // Failures 1-4 happen at: 0s, 30s+1.5s, 60s+3s, 120s+4.5s — but 120s+4.5s > 120s window
    // So the 4th failure resets the counter. This makes it hard to hit 5 within 120s with one project.
    // Use 2 projects to interleave failures.
    store.addProject("Fail A", "Desc"); // failure 1 at t=0
    await Promise.resolve();

    store.addProject("Fail B", "Desc"); // failure 2 at t=0
    await Promise.resolve();

    // Each failure schedules a retry after backoff (30s base).
    // After 30s + debounce (1.5s), the retry fires → failure 3 and 4
    jest.advanceTimersByTime(32_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Retry for both projects should have fired → failures 3 and 4
    // Next retries scheduled for 30s later → failures 5 and 6
    jest.advanceTimersByTime(32_000);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // By now we should have 5+ failures within a 64s window (< 120s)
    const state = useProjectStore.getState();
    expect(state.cloudSyncPauseReason).toBe("failures");
    expect(state.cloudSyncPausedUntil).toBeTruthy();

    randomSpy.mockRestore();
  });
});

describe("Sync flow: flushPendingSyncs", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    jest.useFakeTimers();
    storage = {};
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: jest.fn((key: string) => storage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => { storage[key] = value; }),
        removeItem: jest.fn((key: string) => { delete storage[key]; }),
        clear: jest.fn(() => { storage = {}; }),
      },
      configurable: true,
      writable: true,
    });
    useProjectStore.setState({
      projects: [],
      userId: "user-1",
      syncStatus: "idle",
      cloudSyncPausedUntil: null,
      cloudSyncPauseReason: null,
      lastSyncError: null,
      lastSyncFailureReason: null,
      pendingSyncCount: 0,
      persistenceConfig: { debounceMs: 1500, autosaveIntervalMs: 30000, syncAutomatic: true },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("syncs all dirty projects in parallel", async () => {
    upsertProjectMock.mockResolvedValue({ error: null, stats: { sectionsUpserted: 0, sectionsDeleted: 0 } });

    const store = useProjectStore.getState();
    const id1 = store.addProject("Project A", "Desc");
    const id2 = store.addProject("Project B", "Desc");
    await Promise.resolve();

    // Edit both projects to make them dirty again with new hashes
    store.editProject(id1, "Project A v2", "Updated");
    store.editProject(id2, "Project B v2", "Updated");

    // Clear mock calls so we only count flush calls
    upsertProjectMock.mockClear();

    // Flush all pending
    await store.flushPendingSyncs();

    // Both projects should have been synced
    const syncedIds = upsertProjectMock.mock.calls.map((call: unknown[]) => (call[0] as Project).id);
    expect(syncedIds).toContain(id1);
    expect(syncedIds).toContain(id2);
  });

  it("does nothing when no projects are pending", async () => {
    upsertProjectMock.mockClear();

    await useProjectStore.getState().flushPendingSyncs();

    expect(upsertProjectMock).not.toHaveBeenCalled();
  });
});

describe("Sync flow: persisted state restoration", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    jest.useFakeTimers();
    storage = {};
    Object.defineProperty(global, "localStorage", {
      value: {
        getItem: jest.fn((key: string) => storage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => { storage[key] = value; }),
        removeItem: jest.fn((key: string) => { delete storage[key]; }),
        clear: jest.fn(() => { storage = {}; }),
      },
      configurable: true,
      writable: true,
    });
    useProjectStore.setState({
      projects: [],
      userId: "user-1",
      syncStatus: "idle",
      cloudSyncPausedUntil: null,
      cloudSyncPauseReason: null,
      lastSyncError: null,
      lastSyncFailureReason: null,
      pendingSyncCount: 0,
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("restores dirty project IDs after loadFromStorage", () => {
    const project = makeProject({ id: "proj-dirty" });
    storage["gdd_projects_v1"] = JSON.stringify([project]);
    storage["gdd_sync_state_v1"] = JSON.stringify({
      lastQuotaStatus: null,
      lastSyncedAt: "2026-04-06T10:00:00.000Z",
      lastSyncStats: null,
      lastSyncStatsHistory: [],
      dirtyProjectIds: ["proj-dirty"],
    });

    useProjectStore.getState().loadFromStorage();

    const pending = useProjectStore.getState().getPendingProjectIds();
    expect(pending).toContain("proj-dirty");
    expect(useProjectStore.getState().pendingSyncCount).toBe(1);
  });

  it("restores lastSyncedAt and sets syncStatus to synced", () => {
    const project = makeProject({ id: "proj-1" });
    storage["gdd_projects_v1"] = JSON.stringify([project]);
    storage["gdd_sync_state_v1"] = JSON.stringify({
      lastSyncedAt: "2026-04-06T09:00:00.000Z",
      lastSyncStats: null,
      lastSyncStatsHistory: [],
      dirtyProjectIds: [],
    });

    useProjectStore.getState().loadFromStorage();

    expect(useProjectStore.getState().lastSyncedAt).toBe("2026-04-06T09:00:00.000Z");
    expect(useProjectStore.getState().syncStatus).toBe("synced");
  });

  it("clears expired quota status on restore", () => {
    const project = makeProject({ id: "proj-1" });
    storage["gdd_projects_v1"] = JSON.stringify([project]);
    storage["gdd_sync_state_v1"] = JSON.stringify({
      lastQuotaStatus: {
        limitPerHour: 30,
        usedInWindow: 15,
        remainingInWindow: 15,
        windowStartedAt: "2020-01-01T00:00:00.000Z",
        windowEndsAt: "2020-01-01T01:00:00.000Z",
        consumedThisSync: 0,
      },
      lastSyncedAt: null,
      lastSyncStats: null,
      lastSyncStatsHistory: [],
      dirtyProjectIds: [],
    });

    useProjectStore.getState().loadFromStorage();

    expect(useProjectStore.getState().lastQuotaStatus).toBeNull();
  });

  it("ignores dirty IDs for projects that no longer exist", () => {
    const project = makeProject({ id: "proj-exists" });
    storage["gdd_projects_v1"] = JSON.stringify([project]);
    storage["gdd_sync_state_v1"] = JSON.stringify({
      lastSyncedAt: null,
      lastSyncStats: null,
      lastSyncStatsHistory: [],
      dirtyProjectIds: ["proj-exists", "proj-gone"],
    });

    useProjectStore.getState().loadFromStorage();

    const pending = useProjectStore.getState().getPendingProjectIds();
    expect(pending).toContain("proj-exists");
    expect(pending).not.toContain("proj-gone");
  });
});
