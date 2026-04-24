import type { ProjectStore, UUID, Section, SectionAuditBy } from "./types";
import type { SectionAddon } from "@/lib/addons/types";
import {
  FREE_MAX_SECTIONS_PER_PROJECT,
  FREE_MAX_SECTIONS_TOTAL,
} from "@/lib/structuralLimits";
import { duplicateAddonsForDuplicatedSection } from "@/lib/addons/copy";
import { buildPageTypeAddons, type PageTypeId } from "@/lib/pageTypes/registry";
import type { SyncEngineAPI } from "./syncEngine";

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
    addSection: (projectId: UUID, title: string, content?: string, createdBy?: SectionAuditBy, pageTypeId?: string, customAddons?: SectionAddon[], domainTags?: string[]) => {
      const projects = get().projects;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return "" as UUID;
      const sectionsInProject = (project.sections || []).length;
      if (sectionsInProject >= FREE_MAX_SECTIONS_PER_PROJECT) {
        throw new Error("structural_limit_sections_per_project");
      }
      const totalSections = projects.reduce((sum, p) => sum + (p.sections || []).length, 0);
      if (totalSections >= FREE_MAX_SECTIONS_TOTAL) {
        throw new Error("structural_limit_sections_total");
      }
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const audit = createdBy
        ? { created_by: createdBy.userId, created_by_name: createdBy.displayName ?? null, updated_at: now, updated_by: createdBy.userId, updated_by_name: createdBy.displayName ?? null }
        : {};
      const seededAddons: SectionAddon[] | undefined = customAddons?.length
        ? customAddons
        : pageTypeId
        ? (() => {
            const addons = buildPageTypeAddons(pageTypeId as PageTypeId);
            return addons.length ? addons : undefined;
          })()
        : undefined;
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
                    ...(pageTypeId && pageTypeId !== "blank" ? { pageTypeId } : {}),
                    ...(seededAddons ? { addons: seededAddons } : {}),
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
      return newId;
    },

    addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string, createdBy?: SectionAuditBy, pageTypeId?: string, customAddons?: SectionAddon[], domainTags?: string[]) => {
      const projects = get().projects;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return "" as UUID;
      const sectionsInProject = (project.sections || []).length;
      if (sectionsInProject >= FREE_MAX_SECTIONS_PER_PROJECT) {
        throw new Error("structural_limit_sections_per_project");
      }
      const totalSections = projects.reduce((sum, p) => sum + (p.sections || []).length, 0);
      if (totalSections >= FREE_MAX_SECTIONS_TOTAL) {
        throw new Error("structural_limit_sections_total");
      }
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      const audit = createdBy
        ? { created_by: createdBy.userId, created_by_name: createdBy.displayName ?? null, updated_at: now, updated_by: createdBy.userId, updated_by_name: createdBy.displayName ?? null }
        : {};
      const seededAddons: SectionAddon[] | undefined = customAddons?.length
        ? customAddons
        : pageTypeId
        ? (() => {
            const addons = buildPageTypeAddons(pageTypeId as PageTypeId);
            return addons.length ? addons : undefined;
          })()
        : undefined;
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
                    ...(pageTypeId && pageTypeId !== "blank" ? { pageTypeId } : {}),
                    ...(seededAddons ? { addons: seededAddons } : {}),
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

      // Compute how many we can create under both limits.
      const sectionsInProject = allSections.length;
      const totalSections = projects.reduce(
        (sum, p) => sum + (p.sections || []).length,
        0
      );
      const allowedByProject =
        FREE_MAX_SECTIONS_PER_PROJECT - sectionsInProject;
      const allowedByTotal = FREE_MAX_SECTIONS_TOTAL - totalSections;
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
        const { addons: newAddons, idMap: addonIdMap } =
          duplicateAddonsForDuplicatedSection(s.addons);

        // Remap section.dataId if it pointed to an addon that was duplicated.
        const newDataId =
          s.dataId && addonIdMap.has(s.dataId)
            ? addonIdMap.get(s.dataId)
            : s.dataId;

        const cloned: Section = {
          ...s,
          id: newId,
          parentId: isRoot ? rootParent : idMap.get(s.parentId as UUID),
          order: isRoot ? insertAfterOrder + 1 : s.order,
          title: isRoot ? `${s.title}${copySuffix}` : s.title,
          created_at: now,
          addons: newAddons.length > 0 ? newAddons : undefined,
          dataId: newDataId,
          // Flowchart state references addon/section IDs we did not remap; drop it.
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
      addons?: SectionAddon[],
      dataId?: string
    ) => {
      const now = new Date().toISOString();
      const audit: Partial<Section> = { updated_at: now };
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
                      if (addons !== undefined) updated.addons = addons.length ? addons : undefined;
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

    setSectionAddonGroupNote: (projectId: UUID, sectionId: UUID, group: string, note: string) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: new Date().toISOString(),
                  sections: (p.sections || []).map((s) => {
                    if (s.id !== sectionId) return s;
                    const currentNotes = { ...(s.addonGroupNotes || {}) };
                    const trimmed = note.trim();
                    if (trimmed) {
                      currentNotes[group] = trimmed;
                    } else {
                      delete currentNotes[group];
                    }
                    return {
                      ...s,
                      addonGroupNotes: Object.keys(currentNotes).length > 0 ? currentNotes : undefined,
                      updated_at: new Date().toISOString(),
                    };
                  }),
                }
              : p
          ),
        projectId
      );
    },

    renameSectionAddonGroup: (projectId: UUID, sectionId: UUID, oldGroup: string, newGroup: string) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  updatedAt: new Date().toISOString(),
                  sections: (p.sections || []).map((s) => {
                    if (s.id !== sectionId) return s;
                    const notes = s.addonGroupNotes;
                    if (!notes || !notes[oldGroup]) return s;
                    const newNotes = { ...notes };
                    newNotes[newGroup] = newNotes[oldGroup];
                    delete newNotes[oldGroup];
                    return { ...s, addonGroupNotes: newNotes, updated_at: new Date().toISOString() };
                  }),
                }
              : p
          ),
        projectId
      );
    },

    removeSection: (projectId: UUID, sectionId: UUID) => {
      engine.wrappedSetWithSync(
        (prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, updatedAt: new Date().toISOString(), sections: (p.sections || []).filter((s) => s.id !== sectionId) }
              : p
          ),
        projectId
      );
      get().removeSectionDiagram(projectId, sectionId);
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

    hasDuplicateName: (projectId: UUID, title: string, parentId?: UUID, excludeId?: UUID) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return false;

      const siblings = (project.sections || []).filter(
        (s) => s.parentId === parentId && s.id !== excludeId
      );

      return siblings.some((s) => s.title.toLowerCase() === title.toLowerCase());
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
