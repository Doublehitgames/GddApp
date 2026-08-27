/**
 * Renaming a page through the store must carry every `$[Old Title]` ref in the
 * project over to the new title — in page descriptions (markdown and blocks) and
 * in the project's own description.
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

const blocksWithRef = (text: string) => [
  { type: "paragraph", content: [{ type: "text", text, styles: {} }] },
] as any;

describe("editSection — cross-reference rename sweep", () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], diagramsBySection: {} });
    localStorage.clear();
    uuidCounter = 0;
    jest.clearAllMocks();
  });

  const setup = () => {
    const store = useProjectStore.getState();
    const projectId = store.addProject("P", "");
    const feedId = store.addSection(projectId, "Racoes Animal", "A ração base.");
    const troughId = store.addSection(projectId, "Cocho", "Enche com $[Racoes Animal].");
    const millId = store.addSection(projectId, "Moinho", "Nada a ver com ração.");
    return { projectId, feedId, troughId, millId };
  };

  const sectionOf = (projectId: string, sectionId: string) =>
    useProjectStore.getState().getProject(projectId)!.sections!.find((s) => s.id === sectionId)!;

  it("rewrites name refs on other pages when the target is renamed", () => {
    const { projectId, feedId, troughId, millId } = setup();

    useProjectStore
      .getState()
      .editSection(projectId, feedId, "Rações de Animal", "A ração base.");

    expect(sectionOf(projectId, feedId).title).toBe("Rações de Animal");
    expect(sectionOf(projectId, troughId).content).toBe("Enche com $[Rações de Animal].");
    expect(sectionOf(projectId, millId).content).toBe("Nada a ver com ração.");
  });

  it("rewrites refs stored in contentBlocks too", () => {
    const { projectId, feedId, troughId } = setup();

    useProjectStore
      .getState()
      .updateSectionDescription(
        projectId,
        troughId,
        blocksWithRef("Enche com $[Racoes Animal]."),
        "Enche com $[Racoes Animal]."
      );

    useProjectStore.getState().editSection(projectId, feedId, "Rações de Animal", "A ração base.");

    const trough = sectionOf(projectId, troughId);
    expect((trough.contentBlocks as any)[0].content[0].text).toBe("Enche com $[Rações de Animal].");
    expect(trough.content).toBe("Enche com $[Rações de Animal].");
  });

  it("rewrites refs in the project's own description", () => {
    const { projectId, feedId } = setup();
    useProjectStore.getState().editProject(projectId, "P", "O loop gira em torno de $[Racoes Animal].");

    useProjectStore.getState().editSection(projectId, feedId, "Rações de Animal", "A ração base.");

    expect(useProjectStore.getState().getProject(projectId)!.description).toBe(
      "O loop gira em torno de $[Rações de Animal]."
    );
  });

  it("keeps a rename that also rewrites the renamed page's own description", () => {
    const { projectId, feedId } = setup();

    useProjectStore
      .getState()
      .editSection(projectId, feedId, "Rações de Animal", "Nova prosa citando $[Racoes Animal].");

    const feed = sectionOf(projectId, feedId);
    expect(feed.title).toBe("Rações de Animal");
    expect(feed.content).toBe("Nova prosa citando $[Rações de Animal].");
  });

  it("leaves id-based refs untouched — they already follow the rename", () => {
    const { projectId, feedId, troughId } = setup();
    useProjectStore
      .getState()
      .editSection(projectId, troughId, "Cocho", `Enche com $[#${feedId}].`);

    useProjectStore.getState().editSection(projectId, feedId, "Rações de Animal", "A ração base.");

    expect(sectionOf(projectId, troughId).content).toBe(`Enche com $[#${feedId}].`);
  });

  it("rewrites nothing when another page still carries the old title", () => {
    const { projectId, feedId, troughId } = setup();
    const store = useProjectStore.getState();
    store.addSection(projectId, "Racoes Animal", "A homônima.");

    useProjectStore.getState().editSection(projectId, feedId, "Rações de Animal", "A ração base.");

    expect(sectionOf(projectId, troughId).content).toBe("Enche com $[Racoes Animal].");
  });

  it("does not touch other pages when only the content changes", () => {
    const { projectId, feedId, troughId } = setup();
    const before = sectionOf(projectId, troughId);

    useProjectStore.getState().editSection(projectId, feedId, "Racoes Animal", "Prosa nova.");

    expect(sectionOf(projectId, troughId)).toBe(before);
  });
});
