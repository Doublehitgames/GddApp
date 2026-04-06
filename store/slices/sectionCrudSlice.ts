import type { ProjectStore, UUID, Section, SectionAuditBy } from "./types";
import type { SectionAddon } from "@/lib/addons/types";
import {
  FREE_MAX_SECTIONS_PER_PROJECT,
  FREE_MAX_SECTIONS_TOTAL,
} from "@/lib/structuralLimits";
import type { SyncEngineAPI } from "./syncEngine";

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

export function createSectionCrudSlice(set: StoreSet, get: StoreGet, engine: SyncEngineAPI) {
  return {
    addSection: (projectId: UUID, title: string, content?: string, createdBy?: SectionAuditBy) => {
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
                  { id: newId, title, content: content || "", created_at: now, parentId: undefined, order: maxOrder + 1, ...audit } as Section,
                ],
              };
            }
            return p;
          }),
        projectId
      );
      return newId;
    },

    addSubsection: (projectId: UUID, parentId: UUID, title: string, content?: string, createdBy?: SectionAuditBy) => {
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
                  { id: newId, title, content: content || "", created_at: now, parentId, order: maxOrder + 1, ...audit } as Section,
                ],
              };
            }
            return p;
          }),
        projectId
      );
      return newId;
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
      addons?: SectionAddon[]
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
  };
}
