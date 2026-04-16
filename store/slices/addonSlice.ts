import type { ProjectStore, UUID } from "./types";
import type { SectionAddon } from "@/lib/addons/types";
import { normalizeSectionAddons } from "@/lib/addons/normalize";
import { copyAddon } from "@/lib/addons/copy";
import { moveAddon } from "@/lib/addons/move";
import { collectReverseRefUpdates } from "@/lib/addons/refs";
import type { SectionAuditBy } from "./types";

type StoreSet = (partial: Partial<ProjectStore> | ((state: ProjectStore) => Partial<ProjectStore>)) => void;
type StoreGet = () => ProjectStore;

export function createAddonSlice(_set: StoreSet, get: StoreGet) {
  return {
    setSectionAddons: (projectId: UUID, sectionId: UUID, addons: SectionAddon[], updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const normalizedAddons = normalizeSectionAddons(addons) || [];
      get().editSection(
        projectId,
        sectionId,
        section.title,
        section.content || "",
        undefined,
        section.color,
        updatedBy,
        section.domainTags,
        normalizedAddons
      );
    },
    addSectionAddon: (projectId: UUID, sectionId: UUID, addon: SectionAddon, updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const current = section.addons || [];
      get().setSectionAddons(projectId, sectionId, [...current, addon], updatedBy);
    },
    updateSectionAddon: (projectId: UUID, sectionId: UUID, addonId: string, nextAddon: SectionAddon, updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const current = section.addons || [];
      get().setSectionAddons(
        projectId,
        sectionId,
        current.map((addon) => (addon.id === addonId ? nextAddon : addon)),
        updatedBy
      );
    },
    removeSectionAddon: (projectId: UUID, sectionId: UUID, addonId: string, updatedBy?: SectionAuditBy) => {
      const project = get().projects.find((p) => p.id === projectId);
      const section = project?.sections?.find((s) => s.id === sectionId);
      if (!section) return;
      const current = section.addons || [];
      get().setSectionAddons(
        projectId,
        sectionId,
        current.filter((addon) => addon.id !== addonId),
        updatedBy
      );
    },
    copyAddonToSection: (
      projectId: UUID,
      fromSectionId: UUID,
      toSectionId: UUID,
      addonId: string,
      updatedBy?: SectionAuditBy
    ) => {
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return;
      const fromSection = project.sections?.find((s) => s.id === fromSectionId);
      const toSection = project.sections?.find((s) => s.id === toSectionId);
      if (!fromSection || !toSection) return;
      const source = (fromSection.addons || []).find((a) => a.id === addonId);
      if (!source) return;
      const copied = copyAddon(source);
      get().addSectionAddon(projectId, toSectionId, copied, updatedBy);
    },
    moveAddonToSection: (
      projectId: UUID,
      fromSectionId: UUID,
      toSectionId: UUID,
      addonId: string,
      updatedBy?: SectionAuditBy
    ) => {
      return get().moveAddonsToSection(projectId, fromSectionId, toSectionId, [addonId], updatedBy);
    },
    moveAddonsToSection: (
      projectId: UUID,
      fromSectionId: UUID,
      toSectionId: UUID,
      addonIds: string[],
      updatedBy?: SectionAuditBy
    ) => {
      if (fromSectionId === toSectionId || addonIds.length === 0) {
        return { reverseRefsUpdated: 0 };
      }
      const project = get().projects.find((p) => p.id === projectId);
      if (!project) return { reverseRefsUpdated: 0 };
      const fromSection = project.sections?.find((s) => s.id === fromSectionId);
      const toSection = project.sections?.find((s) => s.id === toSectionId);
      if (!fromSection || !toSection) return { reverseRefsUpdated: 0 };

      const sourceAddons = fromSection.addons || [];
      const movingSet = new Set(addonIds);
      const movingSources = sourceAddons.filter((a) => movingSet.has(a.id));
      if (movingSources.length === 0) return { reverseRefsUpdated: 0 };

      // Preserve refs between addons that travel together.
      const preserveIds = new Set(movingSources.map((a) => a.id));
      const movedAddons = movingSources.map((a) => moveAddon(a, preserveIds));

      // Build post-move snapshot.
      const postMoveSections = (project.sections || []).map((s) => {
        if (s.id === fromSectionId) {
          return { ...s, addons: (s.addons || []).filter((a) => !movingSet.has(a.id)) };
        }
        if (s.id === toSectionId) {
          return { ...s, addons: [...(s.addons || []), ...movedAddons] };
        }
        return s;
      });

      // Apply reverse-ref updates per *type* of moved addon.
      const movedTypes = Array.from(new Set(movingSources.map((a) => a.type)));
      let sectionsAfterRefs = postMoveSections;
      let totalCount = 0;
      for (const t of movedTypes) {
        const { updatedSections, count } = collectReverseRefUpdates(
          sectionsAfterRefs,
          t,
          fromSectionId,
          toSectionId
        );
        sectionsAfterRefs = updatedSections;
        totalCount += count;
      }

      // Persist only changed sections.
      const originalById = new Map(
        (project.sections || []).map((s) => [s.id, s.addons || []] as const)
      );
      for (const section of sectionsAfterRefs) {
        const previous = originalById.get(section.id);
        const nextAddons = section.addons || [];
        if (previous !== nextAddons) {
          get().setSectionAddons(projectId, section.id, nextAddons, updatedBy);
        }
      }

      return { reverseRefsUpdated: totalCount };
    },
  };
}
