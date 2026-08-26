import type { ProjectStore, UUID, Section, SectionAuditBy } from "./types";
import type { RichDocBlock } from "@/lib/richDoc/types";
import { toSlug } from "@/lib/utils/slug";
import type { SyncEngineAPI } from "./syncEngine";
import { limitsForProject, ownerKeyOf, sectionsUsedByOwner } from "./limits";

export type DuplicateSectionOutcome = {
  /** ID of the duplicated root section, or null when the limit blocked everything. */
  newRootId: UUID | null;
  /** Pages that were actually cloned (root + included descendants). */
  duplicated: Array<{ oldId: UUID; newId: UUID; title: string }>;
  /** Pages skipped because the structural limit would be exceeded. */
  skipped: Array<{ oldId: UUID; title: string }>;
  /** Which limit was hit (if any were skipped). */
  limitReason:
    | "structural_limit_sections_per_project"
    | "structural_limit_sections_total"
    | null;
};

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

export function createSectionCrudSlice(set: StoreSet, get: StoreGet, engine: SyncEngineAPI) {
  return {
    addSection: (projectId: UUID, title: string, content?: string, createdBy?: SectionAuditBy, domainTags?: string[]) => {
      const projects = get().projects;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return "" as UUID;
      const limits = limitsForProject(get(), project);
      const sectionsInProject = (project.sections || []).length;
      if (sectionsInProject >= limits.FREE_MAX_SECTIONS_PER_PROJECT) {
        throw new Error("structural_limit_sections_per_project");
      }
      const totalSections = sectionsUsedByOwner(
        projects,
        ownerKeyOf(project, get().userId),
        get().userId
      );
      if (totalSections >= limits.FREE_MAX_SECTIONS_TOTAL) {
        throw new Error("structural_limit_sections_total");
      }
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const audit = createdBy
        ? { created_by: createdBy.userId, created_by_name: createdBy.displayName ?? null, updated_at: now, updated_by: createdBy.userId, updated_by_name: createdBy.displayName ?? null }
        : {};
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const siblings = (p.sections || []).filter((s) => !s.parentId);
              const maxOrder = siblings.reduce((max, s) => Math.max(max, s.order || 0), -1);
              return {
                ...p,
                updatedAt: now,
                sections: [
                  ...(p.sections || []),
                  {
                    id: newId,
                    title,
                    content: content || "",
                    created_at: now,
                    parentId: undefined,
                    order: maxOrder + 1,
                    ...(domainTags && domainTags.length ? { domainTags } : {}),
                    ...audit,
                  } as Section,
                ],
              };
            }
            return p;
          }),
        projectId
      );
      get().logSectionActivity({
        project_id: projectId,
        section_id: newId,
        section_title: title,
        action: "created",
        user_id: createdBy?.userId ?? null,
        user_name: createdBy?.displayName ?? null,
      });
      return newId;
    },

    addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string, createdBy?: SectionAuditBy, domainTags?: string[]) => {
      const projects = get().projects;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return "" as UUID;
      const limits = limitsForProject(get(), project);
      const sectionsInProject = (project.sections || []).length;
      if (sectionsInProject >= limits.FREE_MAX_SECTIONS_PER_PROJECT) {
        throw new Error("structural_limit_sections_per_project");
      }
      const totalSections = sectionsUsedByOwner(
        projects,
        ownerKeyOf(project, get().userId),
        get().userId
      );
      if (totalSections >= limits.FREE_MAX_SECTIONS_TOTAL) {
        throw new Error("structural_limit_sections_total");
      }
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const audit = createdBy
        ? { created_by: createdBy.userId, created_by_name: createdBy.displayName ?? null, updated_at: now, updated_by: createdBy.userId, updated_by_name: createdBy.displayName ?? null }
        : {};
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id === projectId) {
              const siblings = (p.sections || []).filter((s) => s.parentId === parentId);
              const maxOrder = siblings.reduce((max, s) => Math.max(max, s.order || 0), -1);
              return {
                ...p,
                updatedAt: now,
                sections: [
                  ...(p.sections || []),
                  {
                    id: newId,
                    title,
                    content: content || "",
                    created_at: now,
                    parentId,
                    order: maxOrder + 1,
                    ...(domainTags && domainTags.length ? { domainTags } : {}),
                    ...audit,
                  } as Section,
                ],
              };
            }
            return p;
          }),
        projectId
      );
      get().logSectionActivity({
        project_id: projectId,
        section_id: newId,
        section_title: title,
        action: "created",
        user_id: createdBy?.userId ?? null,
        user_name: createdBy?.displayName ?? null,
      });
      return newId;
    },

    duplicateSection: (
      projectId: UUID,
      sectionId: UUID,
      copySuffix: string,
      createdBy?: SectionAuditBy
    ): DuplicateSectionOutcome => {
      const projects = get().projects;
      const project = projects.find((p) => p.id === projectId);
      const empty: DuplicateSectionOutcome = {
        newRootId: null,
        duplicated: [],
        skipped: [],
        limitReason: null,
      };
      if (!project) return empty;
      const allSections = project.sections || [];
      const root = allSections.find((s) => s.id === sectionId);
      if (!root) return empty;

      // BFS in parent-before-child order so cuts never leave an orphan.
      const bfs: Section[] = [];
      const queue: Section[] = [root];
      while (queue.length > 0) {
        const current = queue.shift()!;
        bfs.push(current);
        const children = allSections
          .filter((s) => s.parentId === current.id)
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        queue.push(...children);
      }

      // Compute how many we can create under both limits (os do DONO do projeto).
      const limits = limitsForProject(get(), project);
      const sectionsInProject = allSections.length;
      const totalSections = sectionsUsedByOwner(
        projects,
        ownerKeyOf(project, get().userId),
        get().userId
      );
      const allowedByProject = limits.FREE_MAX_SECTIONS_PER_PROJECT - sectionsInProject;
      const allowedByTotal = limits.FREE_MAX_SECTIONS_TOTAL - totalSections;
      const allowed = Math.max(0, Math.min(allowedByProject, allowedByTotal));

      let limitReason: DuplicateSectionOutcome["limitReason"] = null;
      if (allowed < bfs.length) {
        limitReason =
          allowedByProject <= allowedByTotal
            ? "structural_limit_sections_per_project"
            : "structural_limit_sections_total";
      }

      if (allowed === 0) {
        return {
          ...empty,
          skipped: bfs.map((s) => ({ oldId: s.id, title: s.title })),
          limitReason,
        };
      }

      const take = bfs.slice(0, allowed);
      const skip = bfs.slice(allowed);
      const idMap = new Map<UUID, UUID>();
      for (const s of take) idMap.set(s.id, crypto.randomUUID());

      const now = new Date().toISOString();
      const audit = createdBy
        ? {
            created_by: createdBy.userId,
            created_by_name: createdBy.displayName ?? null,
            updated_at: now,
            updated_by: createdBy.userId,
            updated_by_name: createdBy.displayName ?? null,
          }
        : {};

      // Sibling ordering: the duplicated root sits right after the original among
      // its siblings. Everything after the original is pushed down by one.
      const rootParent = root.parentId;
      const rootSiblings = allSections
        .filter((s) => s.parentId === rootParent)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const rootIdxInSiblings = rootSiblings.findIndex((s) => s.id === root.id);
      const insertAfterOrder =
        rootSiblings[rootIdxInSiblings]?.order ?? rootSiblings.length;

      const pushedSiblingIds = new Set(
        rootSiblings.slice(rootIdxInSiblings + 1).map((s) => s.id)
      );

      const newSections: Section[] = take.map((s) => {
        const newId = idMap.get(s.id)!;
        const isRoot = s.id === root.id;
        const cloned: Section = {
          ...s,
          id: newId,
          parentId: isRoot ? rootParent : idMap.get(s.parentId as UUID),
          order: isRoot ? insertAfterOrder + 1 : s.order,
          title: isRoot ? `${s.title}${copySuffix}` : s.title,
          created_at: now,
          // Flowchart state references section IDs we did not remap; drop it.
          flowchartEnabled: undefined,
          flowchartState: undefined,
          ...audit,
        };
        return cloned;
      });

      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const shifted = (p.sections || []).map((s) =>
              pushedSiblingIds.has(s.id)
                ? { ...s, order: (s.order || 0) + 1 }
                : s
            );
            return {
              ...p,
              updatedAt: now,
              sections: [...shifted, ...newSections],
            };
          }),
        projectId
      );

      return {
        newRootId: idMap.get(root.id) ?? null,
        duplicated: take.map((s) => ({
          oldId: s.id,
          newId: idMap.get(s.id)!,
          title: s.title,
        })),
        skipped: skip.map((s) => ({ oldId: s.id, title: s.title })),
        limitReason,
      };
    },

    editSection: (
      projectId: UUID,
      sectionId: UUID,
      title: string,
      content: string,
      parentId?: string | null,
      color?: string,
      updatedBy?: SectionAuditBy,
      domainTags?: string[],
      dataId?: string
    ) => {
      const now = new Date().toISOString();
      const audit: Partial<Section> = { updated_at: now };
      // Detectar rename antes de alterar o store
      const oldSection = get().projects
        .find((p) => p.id === projectId)
        ?.sections?.find((s) => s.id === sectionId);
      const titleChanged = oldSection && oldSection.title !== title;
      // editSection is the legacy markdown path (AI improve, version restore,
      // title/color tweaks). If the markdown content actually changed, any
      // previously-stored contentBlocks are now stale — drop them so the
      // read view falls back to the new markdown instead of rendering the old
      // blocks. Inline description edits go through updateSectionDescription
      // (which sets blocks), so they're unaffected.
      const contentChanged = !oldSection || (oldSection.content || "") !== (content || "");
      if (updatedBy) {
        audit.updated_by = updatedBy.userId;
        audit.updated_by_name = updatedBy.displayName ?? null;
      }
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) => {
                    if (s.id === sectionId) {
                      const updated: Section = { ...s, title, content, ...audit };
                      if (contentChanged) delete updated.contentBlocks;
                      const isColorPassedAsParentId =
                        typeof parentId === "string" && parentId.startsWith("#") && color === undefined;

                      const resolvedParentId = isColorPassedAsParentId ? undefined : parentId;
                      const resolvedColor = isColorPassedAsParentId ? parentId : color;

                      if (resolvedParentId !== undefined) {
                        if (resolvedParentId === null) delete updated.parentId;
                        else updated.parentId = resolvedParentId;
                      }
                      if (resolvedColor !== undefined) updated.color = resolvedColor;
                      else if (resolvedColor === undefined) delete updated.color;
                      if (domainTags !== undefined) updated.domainTags = domainTags.length ? domainTags : undefined;
                      if (dataId !== undefined) updated.dataId = dataId || undefined;
                      return updated;
                    }
                    return s;
                  }),
                }
              : p
          ),
        projectId
      );
      if (titleChanged && oldSection) {
        get().logSectionActivity({
          project_id: projectId,
          section_id: sectionId,
          section_title: title,
          action: "renamed",
          old_title: oldSection.title,
          user_id: updatedBy?.userId ?? null,
          user_name: updatedBy?.displayName ?? null,
        });
      }
    },

    updateSectionDescription: (
      projectId: UUID,
      sectionId: UUID,
      contentBlocks: RichDocBlock[],
      contentMarkdown: string,
      updatedBy?: SectionAuditBy
    ) => {
      const now = new Date().toISOString();
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) => {
                    if (s.id !== sectionId) return s;
                    const updated: Section = {
                      ...s,
                      content: contentMarkdown,
                      contentBlocks: contentBlocks.length ? contentBlocks : undefined,
                      updated_at: now,
                    };
                    if (updatedBy) {
                      updated.updated_by = updatedBy.userId;
                      updated.updated_by_name = updatedBy.displayName ?? null;
                    }
                    return updated;
                  }),
                }
              : p
          ),
        projectId
      );
    },

    setSectionDataId: (projectId: UUID, sectionId: UUID, dataId: string | undefined) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: new Date().toISOString(),
                  sections: (p.sections || []).map((s) =>
                    s.id === sectionId ? { ...s, dataId: dataId || undefined, updated_at: new Date().toISOString() } : s
                  ),
                }
              : p
          ),
        projectId
      );
    },

    removeSection: (projectId: UUID, sectionId: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      const sections = project?.sections || [];

      // Coleta todos os descendentes para replicar o ON DELETE CASCADE do banco
      const toDelete = new Set<string>([sectionId]);
      const collectDescendants = (parentId: string) => {
        sections.forEach((s) => {
          if (s.parentId === parentId && !toDelete.has(s.id)) {
            toDelete.add(s.id);
            collectDescendants(s.id);
          }
        });
      };
      collectDescendants(sectionId);

      const deletedSection = sections.find((s) => s.id === sectionId);

      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, updatedAt: new Date().toISOString(), sections: (p.sections || []).filter((s) => !toDelete.has(s.id)) }
              : p
          ),
        projectId
      );
      get().removeSectionDiagram(projectId, sectionId);

      if (deletedSection) {
        get().logSectionActivity({
          project_id: projectId,
          section_id: sectionId,
          section_title: deletedSection.title,
          action: "deleted",
          user_id: deletedSection.updated_by ?? null,
          user_name: deletedSection.updated_by_name ?? null,
        });
      }
    },

    moveSectionUp: (projectId: UUID, sectionId: UUID) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const sections = p.sections || [];
            const section = sections.find((s) => s.id === sectionId);
            if (!section) return p;
            const siblings = sections.filter((s) => s.parentId === section.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = siblings.findIndex((s) => s.id === sectionId);
            if (currentIndex <= 0) return p;
            const prevSection = siblings[currentIndex - 1];
            const tempOrder = section.order;
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: sections.map((s) => {
                if (s.id === sectionId) return { ...s, order: prevSection.order };
                if (s.id === prevSection.id) return { ...s, order: tempOrder };
                return s;
              }),
            };
          }),
        projectId
      );
    },

    moveSectionDown: (projectId: UUID, sectionId: UUID) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const sections = p.sections || [];
            const section = sections.find((s) => s.id === sectionId);
            if (!section) return p;
            const siblings = sections.filter((s) => s.parentId === section.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const currentIndex = siblings.findIndex((s) => s.id === sectionId);
            if (currentIndex === -1 || currentIndex >= siblings.length - 1) return p;
            const nextSection = siblings[currentIndex + 1];
            const tempOrder = section.order;
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: sections.map((s) => {
                if (s.id === sectionId) return { ...s, order: nextSection.order };
                if (s.id === nextSection.id) return { ...s, order: tempOrder };
                return s;
              }),
            };
          }),
        projectId
      );
    },

    reorderSections: (projectId: UUID, sectionIds: UUID[]) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) => {
            if (p.id !== projectId) return p;
            const sections = p.sections || [];
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              sections: sections.map((s) => {
                const newIndex = sectionIds.indexOf(s.id);
                return newIndex !== -1 ? { ...s, order: newIndex } : s;
              }),
            };
          }),
        projectId
      );
    },

    setSectionThumbImage: (projectId: UUID, sectionId: UUID, thumbImageUrl?: string) => {
      const normalizedThumbUrl =
        typeof thumbImageUrl === "string" && thumbImageUrl.trim()
          ? thumbImageUrl.trim()
          : undefined;
      const now = new Date().toISOString();
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: now,
                  sections: (p.sections || []).map((s) =>
                    s.id === sectionId ? { ...s, thumbImageUrl: normalizedThumbUrl, updated_at: now } : s
                  ),
                }
              : p
          ),
        projectId
      );
    },

    countDescendants: (projectId: UUID, sectionId: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return 0;

      const sections = project.sections || [];
      const MAX_DEPTH = 50;
      const countChildren = (parentId: UUID, depth: number): number => {
        if (depth >= MAX_DEPTH) return 0;
        const children = sections.filter((s) => s.parentId === parentId);
        return children.reduce((sum, child) => sum + 1 + countChildren(child.id, depth + 1), 0);
      };

      return countChildren(sectionId, 0);
    },

    getSectionById: (projectId: UUID, sectionId: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      return project?.sections?.find((s) => s.id === sectionId);
    },

    getSectionBySlug: (projectId: UUID, slug: string) => {
      const project = get().projects.find((p) => p.id === projectId);
      return project?.sections?.find((s) => toSlug(s.title) === slug);
    },

    hasDuplicateName: (projectId: UUID, title: string, parentId?: UUID, excludeId?: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return false;

      const newSlug = toSlug(title);
      const siblings = (project.sections || []).filter(
        (s) => s.parentId === parentId && s.id !== excludeId
      );

      return siblings.some((s) => toSlug(s.title) === newSlug);
    },

    hasDuplicateDataId: (projectId: UUID, dataId: string, excludeId?: UUID) => {
      const trimmed = dataId.trim();
      if (!trimmed) return false;
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return false;
      const target = trimmed.toLowerCase();
      return (project.sections || []).some(
        (s) => s.id !== excludeId && (s.dataId || "").trim().toLowerCase() === target
      );
    },
  };
}
