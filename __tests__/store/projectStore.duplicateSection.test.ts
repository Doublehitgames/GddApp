/**
 * Tests for the `duplicateSection` action: deep clone, sibling placement,
 * intra-section ref rewrite, and partial duplication when the structural
 * limit would be exceeded.
 */

import { useProjectStore } from "@/store/projectStore";
import { FREE_MAX_SECTIONS_PER_PROJECT } from "@/lib/structuralLimits";

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

describe("duplicateSection", () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], diagramsBySection: {} });
    localStorage.clear();
    uuidCounter = 0;
    jest.clearAllMocks();
  });

  it("creates a sibling copy with the copy suffix and new IDs", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const rootId = store.addSection(projectId, "Hero", "content");

    const outcome = useProjectStore
      .getState()
      .duplicateSection(projectId, rootId, " (copy)");

    expect(outcome.newRootId).toBeDefined();
    expect(outcome.duplicated).toHaveLength(1);
    expect(outcome.skipped).toHaveLength(0);
    expect(outcome.limitReason).toBeNull();

    const project = useProjectStore.getState().getProject(projectId)!;
    expect(project.sections).toHaveLength(2);
    const copy = project.sections!.find((s) => s.id === outcome.newRootId)!;
    expect(copy.title).toBe("Hero (copy)");
    expect(copy.parentId).toBeUndefined();
    expect(copy.content).toBe("content");
    expect(copy.id).not.toBe(rootId);
  });

  it("deep-clones descendants parent-before-child with remapped parentIds", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const rootId = store.addSection(projectId, "Root");
    const childAId = store.addSubsection(projectId, rootId, "Child A");
    const childBId = store.addSubsection(projectId, rootId, "Child B");
    const grandId = store.addSubsection(projectId, childAId, "Grand");

    const outcome = useProjectStore
      .getState()
      .duplicateSection(projectId, rootId, " (copy)");

    expect(outcome.duplicated).toHaveLength(4);
    expect(outcome.skipped).toHaveLength(0);

    const project = useProjectStore.getState().getProject(projectId)!;
    const clones = project.sections!.filter(
      (s) => ![rootId, childAId, childBId, grandId].includes(s.id)
    );
    expect(clones).toHaveLength(4);
    const clonedRoot = clones.find((s) => s.title === "Root (copy)")!;
    const clonedChildA = clones.find((s) => s.title === "Child A")!;
    const clonedGrand = clones.find((s) => s.title === "Grand")!;
    expect(clonedChildA.parentId).toBe(clonedRoot.id);
    expect(clonedGrand.parentId).toBe(clonedChildA.id);
  });

  it("places the duplicated root immediately after the original sibling order", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    store.addSection(projectId, "A"); // order 0
    const bId = store.addSection(projectId, "B"); // order 1
    store.addSection(projectId, "C"); // order 2

    const outcome = useProjectStore
      .getState()
      .duplicateSection(projectId, bId, " (copy)");

    const project = useProjectStore.getState().getProject(projectId)!;
    const roots = project
      .sections!.filter((s) => !s.parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    expect(roots.map((s) => s.title)).toEqual(["A", "B", "B (copy)", "C"]);
  });

  it("partially duplicates when exceeding FREE_MAX_SECTIONS_PER_PROJECT, parent-first", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");

    // Fill project until one below the limit so only ONE duplicate fits.
    const rootId = store.addSection(projectId, "Root");
    const childId = store.addSubsection(projectId, rootId, "Child");

    const slotsToFill =
      FREE_MAX_SECTIONS_PER_PROJECT - 2 /* root + child */ - 1 /* leave 1 slot */;
    for (let i = 0; i < slotsToFill; i++) {
      store.addSection(projectId, `Filler ${i}`);
    }
    expect(useProjectStore.getState().getProject(projectId)!.sections).toHaveLength(
      FREE_MAX_SECTIONS_PER_PROJECT - 1
    );

    const outcome = useProjectStore
      .getState()
      .duplicateSection(projectId, rootId, " (copy)");

    // Only the root fits; child is skipped.
    expect(outcome.duplicated).toHaveLength(1);
    expect(outcome.duplicated[0].title).toBe("Root");
    expect(outcome.skipped).toHaveLength(1);
    expect(outcome.skipped[0].title).toBe("Child");
    expect(outcome.limitReason).toBe("structural_limit_sections_per_project");
    expect(outcome.newRootId).toBeDefined();
  });

  it("returns an empty outcome when the project is already at the limit", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const rootId = store.addSection(projectId, "Root");
    for (let i = 0; i < FREE_MAX_SECTIONS_PER_PROJECT - 1; i++) {
      store.addSection(projectId, `Filler ${i}`);
    }

    const outcome = useProjectStore
      .getState()
      .duplicateSection(projectId, rootId, " (copy)");

    expect(outcome.newRootId).toBeNull();
    expect(outcome.duplicated).toHaveLength(0);
    expect(outcome.skipped).toHaveLength(1);
    expect(outcome.limitReason).toBe("structural_limit_sections_per_project");
  });

  it("rewrites intra-section addon refs so clones point at the new sibling IDs", () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const rootId = store.addSection(projectId, "Root");

    // Seed a production addon and a dataSchema that refs it. Mutate state
    // directly to avoid depending on addon-specific create helpers.
    useProjectStore.setState((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sections: p.sections!.map((sec) =>
                sec.id === rootId
                  ? {
                      ...sec,
                      addons: [
                        {
                          id: "production-old-1",
                          type: "production",
                          data: { id: "production-old-1", name: "Prod" },
                        } as any,
                        {
                          id: "data-schema-old-2",
                          type: "dataSchema",
                          data: {
                            id: "data-schema-old-2",
                            entries: [{ productionRef: "production-old-1" }],
                          },
                        } as any,
                      ],
                    }
                  : sec
              ),
            }
          : p
      ),
    }));

    const outcome = useProjectStore
      .getState()
      .duplicateSection(projectId, rootId, " (copy)");

    const project = useProjectStore.getState().getProject(projectId)!;
    const copy = project.sections!.find((s) => s.id === outcome.newRootId)!;
    const prod = copy.addons!.find((a) => a.type === "production")!;
    const schema = copy.addons!.find((a) => a.type === "dataSchema")! as any;

    // New IDs, not the originals.
    expect(prod.id).not.toBe("production-old-1");
    expect(schema.id).not.toBe("data-schema-old-2");
    // data.id mirrors wrapper id.
    expect((prod.data as any).id).toBe(prod.id);
    expect(schema.data.id).toBe(schema.id);
    // productionRef now points at the NEW production clone, not the old one.
    expect(schema.data.entries[0].productionRef).toBe(prod.id);
  });
});
