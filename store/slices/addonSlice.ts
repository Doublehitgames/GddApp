import type { ProjectStore, UUID } from "./types";
import type { SectionAddon } from "@/lib/addons/types";
import { normalizeSectionAddons } from "@/lib/addons/normalize";
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
  };
}
